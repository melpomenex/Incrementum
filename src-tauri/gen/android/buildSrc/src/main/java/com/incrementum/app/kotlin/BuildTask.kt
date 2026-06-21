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

        // Spawn cargo via ProcessBuilder with the inherited environment
        // *minus* the redundant per-ABI variables the Tauri CLI injects for ALL
        // four Android targets. Gradle's project.exec inherits the entire
        // environment; on the GitHub runner that includes ~30
        // CARGO_TARGET_*/WRY_*/TAURI_* vars (one set per ABI) plus a very long
        // PATH. The combined argv+environ can exceed the kernel ARG_MAX when
        // Gradle forks cargo, and execve returns E2BIG, which Gradle surfaces as
        // the opaque "A problem occurred starting process 'command 'cargo''".
        //
        // We can't just clear the env — cargo is a dynamically-linked ELF and
        // its loader needs the inherited LD_*/PATH/etc. So we start from the
        // full environment and delete only the cross-ABI CARGO_TARGET_* entries
        // for the THREE targets we are NOT building, which is where the bulk of
        // the bloat comes from. We keep the current target's RUSTFLAGS/linker
        // and everything else (PATH, LD_*, locale, etc.).
        val otherAbiTargets = listOf("aarch64", "armv7", "i686", "x86_64") - target
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
        // Drop the per-ABI vars for every target except the one we're building.
        // These are the bulk contributors to the environment size and are the
        // only thing that differs per-ABI; keeping the rest of the env intact
        // preserves PATH / dynamic-loader / locale / toolchain resolution.
        for (other in otherAbiTargets) {
            val otherCargoTarget = when (other) {
                "aarch64" -> "aarch64-linux-android"
                "armv7" -> "armv7-linux-androideabi"
                "i686" -> "i686-linux-android"
                "x86_64" -> "x86_64-linux-android"
                else -> null
            } ?: continue
            val otherEnv = otherCargoTarget.uppercase().replace('-', '_')
            env.remove("CARGO_TARGET_${otherEnv}_LINKER")
            env.remove("CARGO_TARGET_${otherEnv}_AR")
            env.remove("CARGO_TARGET_${otherEnv}_RUSTFLAGS")
            env.remove("CC_${otherCargoTarget}")
            env.remove("AR_${otherCargoTarget}")
        }
        // (Re)assert this target's NDK + cross-compile config.
        env["ANDROID_NDK_HOME"] = ndkHome
        env["NDK_HOME"] = ndkHome
        env["CARGO_TARGET_${cargoTargetEnv}_LINKER"] = linkerPath
        env["CARGO_TARGET_${cargoTargetEnv}_AR"] = arPath
        env["CC_${cargoTarget}"] = linkerPath
        env["AR_${cargoTarget}"] = arPath

        val process = try {
            pb.start()
        } catch (e: Throwable) {
            // The spawn itself failed (e.g. ENOENT/E2BIG). Dump diagnostics so
            // the opaque failure ("A problem occurred starting process 'cargo'")
            // has a concrete cause: ARG_MAX, env size, the resolved cargo path,
            // and its ELF interpreter from `file`.
            try {
                val argMax = Runtime.getRuntime().exec(arrayOf("getconf", "ARG_MAX"))
                    .inputStream.bufferedReader().use { it.readText().trim() }
                val envSize = env.entries.sumOf { (k, v) -> k.length + v.length + 2 }
                val fileOut = Runtime.getRuntime().exec(arrayOf("file", cargoExecutable))
                    .inputStream.bufferedReader().use { it.readText().trim() }
                val lsOut = Runtime.getRuntime().exec(arrayOf("ls", "-l", cargoExecutable))
                    .inputStream.bufferedReader().use { it.readText().trim() }
                project.logger.lifecycle(
                    "[rustBuild spawn-fail diag] ${e.javaClass.name}: ${e.message}"
                )
                project.logger.lifecycle(
                    "[rustBuild spawn-fail diag] ARG_MAX=$argMax envBytes=$envSize envEntries=${env.size} " +
                        "cargo=$cargoExecutable exists=${File(cargoExecutable).exists()} " +
                        "canExecute=${File(cargoExecutable).canExecute()} ls=[$lsOut] file=[$fileOut]"
                )
            } catch (t: Throwable) {
                project.logger.lifecycle("[rustBuild spawn-fail diag] diag collection failed: ${t.message}")
            }
            throw GradleException("cargo spawn failed: ${e.message}", e)
        }
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
