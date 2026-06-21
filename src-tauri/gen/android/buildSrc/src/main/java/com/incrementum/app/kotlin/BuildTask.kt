import java.io.File
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction

open class BuildTask : DefaultTask() {
    @Input
    var rootDirRel: String? = null
    @Input
    var target: String? = null
    @Input
    var release: Boolean? = null

    @TaskAction
    fun assemble() {
        buildRustLibrary()
    }

    fun buildRustLibrary() {
        val rootDirRel = rootDirRel ?: throw GradleException("rootDirRel cannot be null")
        val target = target ?: throw GradleException("target cannot be null")
        val release = release ?: throw GradleException("release cannot be null")

        val cargoTarget = when (target) {
            "aarch64" -> "aarch64-linux-android"
            "armv7" -> "armv7-linux-androideabi"
            "i686" -> "i686-linux-android"
            "x86_64" -> "x86_64-linux-android"
            else -> throw GradleException("Unsupported target: $target")
        }
        val abiDir = when (target) {
            "aarch64" -> "arm64-v8a"
            "armv7" -> "armeabi-v7a"
            "i686" -> "x86"
            "x86_64" -> "x86_64"
            else -> throw GradleException("Unsupported target: $target")
        }
        val clangTriple = when (target) {
            "aarch64" -> "aarch64-linux-android"
            "armv7" -> "armv7a-linux-androideabi"
            "i686" -> "i686-linux-android"
            "x86_64" -> "x86_64-linux-android"
            else -> throw GradleException("Unsupported target: $target")
        }
        val ndkHome = System.getenv("ANDROID_NDK_HOME")
            ?: System.getenv("NDK_HOME")
            ?: throw GradleException("NDK_HOME/ANDROID_NDK_HOME must be set")
        val linkerPath = "$ndkHome/toolchains/llvm/prebuilt/linux-x86_64/bin/${clangTriple}24-clang"

        val arPath = "$ndkHome/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-ar"
        val cargoTargetEnv = cargoTarget.uppercase().replace('-', '_')

        val cargoExecutable = resolveCargoExecutable()

        // Spawn cargo with a *minimal* environment instead of inheriting the
        // Gradle daemon's full environment. The Tauri CLI injects ~30
        // CARGO_TARGET_* / WRY_* / TAURI_* variables for every Android ABI into
        // the gradlew process, and the GitHub Actions runner adds many more
        // (long PATH, toolcache vars, etc.). Gradle's project.exec inherits all
        // of them, so when it forks cargo the combined argv+environ can exceed
        // the kernel's ARG_MAX (execve returns E2BIG), which Gradle surfaces as
        // the opaque "A problem occurred starting process 'command 'cargo''".
        // Building an explicit whitelist keeps the spawn well under the limit.
        val pb = ProcessBuilder(
            listOfNotNull(
                cargoExecutable,
                "build", "--lib", "--target", cargoTarget,
                if (release) "--release" else null
            )
        )
        pb.directory(File(project.projectDir, "$rootDirRel/src-tauri"))
        pb.redirectErrorStream(true)
        val env = pb.environment()
        env.clear()
        // Essentials cargo + the linker need to run at all.
        env["PATH"] = System.getenv("PATH") ?: "/usr/bin:/bin"
        env["HOME"] = System.getenv("HOME") ?: ""
        env["USER"] = System.getenv("USER") ?: ""
        env["LANG"] = System.getenv("LANG") ?: "C.UTF-8"
        env["TERM"] = System.getenv("TERM") ?: "dumb"
        // Cargo home / toolchain resolution.
        System.getenv("CARGO_HOME")?.let { env["CARGO_HOME"] = it }
        System.getenv("RUSTUP_HOME")?.let { env["RUSTUP_HOME"] = it }
        System.getenv("RUSTUP_TOOLCHAIN")?.let { env["RUSTUP_TOOLCHAIN"] = it }
        // NDK + cross-compile config for *this* ABI only.
        env["ANDROID_NDK_HOME"] = ndkHome
        env["NDK_HOME"] = ndkHome
        env["CARGO_TARGET_${cargoTargetEnv}_LINKER"] = linkerPath
        env["CARGO_TARGET_${cargoTargetEnv}_AR"] = arPath
        env["CC_${cargoTarget}"] = linkerPath
        env["AR_${cargoTarget}"] = arPath
        // The Tauri/Android link args (-landroid -llog -lOpenSLES). Carry the
        // RUSTFLAGS the parent already set for this exact target so cargo links
        // the Android system libs, but NOT the ones for the other 3 ABIs (those
        // bloat the environment and are what triggers the ARG_MAX overflow).
        System.getenv("CARGO_TARGET_${cargoTargetEnv}_RUSTFLAGS")?.let {
            env["CARGO_TARGET_${cargoTargetEnv}_RUSTFLAGS"] = it
        }

        val process = pb.start()
        val output = process.inputStream.bufferedReader().use { it.readText() }
        val exitCode = process.waitFor()
        if (output.isNotBlank()) {
            project.logger.lifecycle(output)
        }
        if (exitCode != 0) {
            throw GradleException("cargo build failed with exit code $exitCode for target $cargoTarget")
        }

        val projectRoot = File(project.projectDir, rootDirRel)
        val profile = if (release) "release" else "debug"
        val builtLib = File(
            projectRoot,
            "src-tauri/target/$cargoTarget/$profile/libincrementum_tauri_lib.so"
        )
        if (!builtLib.exists()) {
            throw GradleException("Built library not found: ${builtLib.absolutePath}")
        }

        val jniOutDir = File(project.projectDir, "app/src/main/jniLibs/$abiDir")
        jniOutDir.mkdirs()
        builtLib.copyTo(File(jniOutDir, "libincrementum_tauri_lib.so"), overwrite = true)

        project.logger.lifecycle("Copied ${builtLib.absolutePath} -> ${jniOutDir.absolutePath}")
    }

    private fun resolveCargoExecutable(): String {
        val envCargo = System.getenv("CARGO")
        if (!envCargo.isNullOrBlank() && File(envCargo).canExecute()) {
            return envCargo
        }

        val rustToolchain = System.getenv("RUST_TOOLCHAIN")
        if (!rustToolchain.isNullOrBlank()) {
            val toolcacheCargo = File("/opt/hostedtoolcache/Rust/$rustToolchain/x64/bin/cargo")
            if (toolcacheCargo.canExecute()) {
                return toolcacheCargo.absolutePath
            }
        }

        val hostedRustRoot = File("/opt/hostedtoolcache/Rust")
        if (hostedRustRoot.isDirectory) {
            val candidates = hostedRustRoot.listFiles()?.sortedByDescending { it.name } ?: emptyList()
            for (dir in candidates) {
                val toolcacheCargo = File(dir, "x64/bin/cargo")
                if (toolcacheCargo.canExecute()) {
                    return toolcacheCargo.absolutePath
                }
            }
        }

        val home = System.getProperty("user.home") ?: ""
        val candidates = listOf(
            "$home/.cargo/bin/cargo",
            "/usr/local/bin/cargo",
            "/usr/bin/cargo"
        )
        for (candidate in candidates) {
            if (File(candidate).canExecute()) {
                return candidate
            }
        }

        return "cargo"
    }
}
