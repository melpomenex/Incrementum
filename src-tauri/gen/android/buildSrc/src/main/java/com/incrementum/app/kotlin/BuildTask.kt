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

        // Spawn cargo through /bin/sh -c. Gradle's project.exec (and a direct
        // ProcessBuilder exec of the cargo ELF) has historically failed here
        // with the opaque "A problem occurred starting process 'cargo'" and,
        // when wrapped, "error=2, No such file or directory" on a cargo binary
        // that demonstrably exists and runs from a shell. Routing through the
        // shell (the same way the workflow's own diagnostics successfully invoke
        // cargo) sidesteps Java's direct-exec path entirely and lets the shell
        // resolve the dynamic linker / PATH the same way every other cargo
        // invocation in this build does.
        //
        // We still prune the redundant per-ABI CARGO_TARGET_* vars for the
        // targets we are NOT building, because the inherited environment
        // (one CARGO_TARGET_* set per ABI + a long runner PATH) is the bulk of
        // the size and is what originally overflowed ARG_MAX.
        val otherAbiTargets = listOf("aarch64", "armv7", "i686", "x86_64") - target
        val workDir = File(project.projectDir, "$rootDirRel/src-tauri").absoluteFile
        val argv = mutableListOf(
            cargoExecutable,
            "build", "--lib", "--target", cargoTarget
        )
        if (release) argv += "--release"
        // Quote each argv element for the shell.
        val cmdLine = argv.joinToString(" ") { "'" + it.replace("'", "'\\''") + "'" }

        val pb = ProcessBuilder(listOf("/bin/sh", "-c", cmdLine))
        pb.directory(workDir)
        pb.redirectErrorStream(true)
        val env = pb.environment()
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
            System.err.println("[rustBuild spawn-fail] ${e.javaClass.name}: ${e.message}")
            System.err.println("[rustBuild spawn-fail] workDir=$workDir exists=${workDir.exists()} cargo=$cargoExecutable cargoExists=${File(cargoExecutable).exists()}")
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
