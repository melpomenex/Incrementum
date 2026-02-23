import java.io.File
import org.apache.tools.ant.taskdefs.condition.Os
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.logging.LogLevel
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
        val executable = """npm""";
        try {
            runTauriCli(executable)
        } catch (e: Exception) {
            if (Os.isFamily(Os.FAMILY_WINDOWS)) {
                // Try different Windows-specific extensions
                val fallbacks = listOf(
                    "$executable.exe",
                    "$executable.cmd",
                    "$executable.bat",
                )
                
                var lastException: Exception = e
                for (fallback in fallbacks) {
                    try {
                        runTauriCli(fallback)
                        return
                    } catch (fallbackException: Exception) {
                        lastException = fallbackException
                    }
                }
                throw lastException
            } else {
                throw e;
            }
        }
    }

    fun runTauriCli(executable: String) {
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

        project.exec {
            workingDir(File(project.projectDir, rootDirRel))
            executable(executable)
            args(listOf("run", "--", "tauri", "build", "--no-bundle"))
            args("--config", """{"build":{"beforeBuildCommand":""}}""")
            environment("ANDROID_NDK_HOME", ndkHome)
            environment("NDK_HOME", ndkHome)
            environment("CARGO_TARGET_${cargoTarget.uppercase().replace('-', '_')}_LINKER", linkerPath)
            environment("CC_${cargoTarget}", linkerPath)
            if (project.logger.isEnabled(LogLevel.DEBUG)) {
                args("-vv")
            } else if (project.logger.isEnabled(LogLevel.INFO)) {
                args("-v")
            }
            // Compile the Android shared library directly to avoid android-studio-script panic
            args("--", "--target", cargoTarget)
        }.assertNormalExitValue()

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
}
