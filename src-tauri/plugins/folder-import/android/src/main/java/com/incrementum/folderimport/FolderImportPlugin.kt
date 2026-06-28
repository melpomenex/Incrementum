// Copyright 2026 Incrementum
// SPDX-License-Identifier: Apache-2.0
//
// Android implementation of the folder-import Tauri plugin.
//
// Uses Android's Storage Access Framework (ACTION_OPEN_DOCUMENT_TREE) to let
// the user pick a folder, then recursively walks the selected tree with
// DocumentFile, copying every supported file into the app's private storage
// (`<filesDir>/imports/<relative-subpath>`) so Rust's std::fs can read it
// later (content:// URIs are not readable as filesystem paths).
//
// Mirrors the contract of tauri-plugin-dialog's DialogPlugin.kt:
// `@Command` handlers receive an `app.tauri.plugin.Invoke`, resolve/reject it,
// and `startActivityForResult(invoke, intent, "<callbackMethod>")` defers the
// result to an `@ActivityCallback`-annotated method.

package com.incrementum.folderimport

import android.app.Activity
import android.content.ContentUris
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.provider.Settings
import androidx.core.content.FileProvider
import androidx.documentfile.provider.DocumentFile
import app.tauri.Logger
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.io.FileOutputStream

@InvokeArg
class PickFolderOptions {
  var extensions: Array<String>? = null
}

@InvokeArg
class PickFilesOptions {
  var extensions: Array<String>? = null
  var multiple: Boolean = false
}

@InvokeArg
class InstallApkOptions {
  var filePath: String? = null
}

/**
 * One staged file, serialized back to Rust as JSON. Field names must match the
 * Rust `StagedFile` struct (camelCase via serde rename_all = "camelCase"):
 * path, relativePath, fileName.
 */
data class StagedFile(
  val path: String,
  val relativePath: String,
  val fileName: String,
)

@TauriPlugin
class FolderImportPlugin(private val activity: Activity) : Plugin(activity) {

  /** Extension allow-list captured while the picker is shown, applied on result. */
  private var pendingExtensions: Set<String> = emptySet()
  /** Whether the current file pick allows multiple selection. */
  private var pendingMultiple: Boolean = false
  /** Whether the current picker is picking a folder or files. */
  private var isFolderPick: Boolean = false

  @Command
  fun pickFolderDocuments(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(PickFolderOptions::class.java)
      pendingExtensions = normalizeExtensions(args.extensions)
      isFolderPick = true

      // Persistable permission so re-picking later doesn't re-prompt; harmless
      // if the provider doesn't grant it.
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
        addFlags(
          Intent.FLAG_GRANT_READ_URI_PERMISSION
            or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        )
      }

      startActivityForResult(invoke, intent, "pickerResult")
    } catch (ex: Exception) {
      val message = ex.message ?: "Failed to open folder picker"
      Logger.error(message)
      invoke.reject(message)
    }
  }

  /**
   * Pick one or more FILES (not a folder) via Android's Storage Access Framework
   * (ACTION_OPEN_DOCUMENT), copy each natively into `<filesDir>/imports/<name>`
   * — exactly like [stageFile] does for folder imports — and return the staged
   * filesystem paths. This is the mobile single-file/multi-file path: the copy
   * happens in native Kotlin with no bytes crossing the Tauri IPC (which on
   * Android is JSON-only and would hang/OOM on large files). Mirrors what native
   * audiobook players do.
   */
  @Command
  fun pickFiles(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(PickFilesOptions::class.java)
      pendingExtensions = normalizeExtensions(args.extensions)
      pendingMultiple = args.multiple
      isFolderPick = false

      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
        type = "*/*"
        if (pendingExtensions.isNotEmpty()) {
          // SAF matches EXTRA_MIME_TYPES against MIME; we also constrain by
          // extension after the pick. Allow any so files aren't greyed out.
          putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("*/*"))
        }
        if (args.multiple) {
          putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }
        addCategory(Intent.CATEGORY_OPENABLE)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }

      startActivityForResult(invoke, intent, "pickerResult")
    } catch (ex: Exception) {
      val message = ex.message ?: "Failed to open file picker"
      Logger.error(message)
      invoke.reject(message)
    }
  }

  private fun handleFilePickerResult(invoke: Invoke, result: androidx.activity.result.ActivityResult) {
    try {
      if (result.resultCode != Activity.RESULT_OK) {
        return invoke.reject("File picker cancelled")
      }
      val data = result.data
      val uris = mutableListOf<Uri>()
      if (data?.clipData != null) {
        val clip = data.clipData!!
        for (i in 0 until clip.itemCount) {
          uris.add(clip.getItemAt(i).uri)
        }
      } else {
        val singleUri = data?.data
        if (singleUri != null) {
          uris.add(singleUri)
        }
      }
      if (uris.isEmpty()) {
        return invoke.reject("File picker cancelled")
      }

      val importRoot = File(activity.filesDir, "imports")
      val staged = mutableListOf<StagedFile>()
      for (uri in uris) {
        val fileName = queryDisplayName(uri) ?: "file_${System.currentTimeMillis()}"
        // Enforce the extension allow-list post-pick (SAF may surface other types).
        if (!hasSupportedExtension(fileName)) continue
        stageFileByUri(uri, fileName, fileName, importRoot)?.let(staged::add)
      }

      if (staged.isEmpty()) {
        return invoke.reject("No supported files selected")
      }

      val arr = JSArray()
      for (f in staged) {
        val obj = JSObject()
        obj.put("path", f.path)
        obj.put("relativePath", f.relativePath)
        obj.put("fileName", f.fileName)
        arr.put(obj)
      }
      val out = JSObject()
      out.put("files", arr)
      invoke.resolve(out)
    } catch (ex: Exception) {
      val message = ex.message ?: "Failed to import files"
      Logger.error(message)
      invoke.reject(message)
    }
  }

  /** Resolve a content URI's human-readable display name. */
  private fun queryDisplayName(uri: Uri): String? {
    return try {
      activity.contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
        if (c.moveToFirst()) c.getString(0) else null
      }
    } catch (ex: Exception) {
      null
    }
  }

  /**
   * Copy a single content:// URI's bytes into `<filesDir>/imports/<relativePath>`,
   * returning the staged [StagedFile] or null on copy failure. Native-side copy
   * (like [stageFile] for folders) — no IPC byte transfer.
   */
  private fun stageFileByUri(
    uri: Uri,
    fileName: String,
    relativePath: String,
    importRoot: File,
  ): StagedFile? {
    // Avoid collisions: if the name exists, suffix a counter.
    val dest = uniqueDest(importRoot, relativePath)
    return try {
      activity.contentResolver.openInputStream(uri)?.use { input ->
        FileOutputStream(dest).use { output ->
          input.copyTo(output)
        }
      } ?: return null
      StagedFile(
        path = dest.absolutePath,
        relativePath = relativePath,
        fileName = fileName,
      )
    } catch (ex: Exception) {
      Logger.error("Failed to stage $relativePath: ${ex.message}")
      null
    }
  }

  private fun uniqueDest(importRoot: File, relativePath: String): File {
    val base = File(importRoot, relativePath)
    base.parentFile?.mkdirs()
    if (!base.exists()) return base
    val dot = relativePath.lastIndexOf('.')
    val stem = if (dot > 0) relativePath.substring(0, dot) else relativePath
    val ext = if (dot > 0) relativePath.substring(dot) else ""
    var i = 1
    while (true) {
      val candidate = File(importRoot, "$stem ($i)$ext")
      if (!candidate.exists()) return candidate
      i++
    }
  }

  @Command
  fun installApk(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(InstallApkOptions::class.java)
      val filePath = args.filePath
        ?: return invoke.reject("filePath is required")
      val apkFile = File(filePath)
      if (!apkFile.exists()) {
        return invoke.reject("APK file does not exist at: $filePath")
      }

      val context = activity.applicationContext

      // 1. Copy the APK to the external cache directory to make it readable by the system package installer.
      // System package installers on many Android variants (and OS versions 10+) are blocked from accessing
      // another app's private internal storage (/data/user/0/...) even when using FileProvider.
      val externalCacheDir = context.externalCacheDir
      val targetApkFile = if (externalCacheDir != null) {
        val destFile = File(externalCacheDir, "update.apk")
        try {
          apkFile.inputStream().use { input ->
            destFile.outputStream().use { output ->
              input.copyTo(output)
            }
          }
          destFile
        } catch (ex: Exception) {
          Logger.error("Failed to copy APK to external cache, using original: ${ex.message}")
          apkFile
        }
      } else {
        apkFile
      }

      // 2. Check and request install permissions on Android 8.0 (Oreo) and above
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        if (!activity.packageManager.canRequestPackageInstalls()) {
          // Open settings to let the user enable 'Install unknown apps' for this app
          val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
            data = Uri.parse("package:${activity.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          activity.startActivity(intent)
          return invoke.reject("INSTALL_PERMISSION_REQUIRED")
        }
      }

      // 3. Generate secure FileProvider content URI
      val apkUri = FileProvider.getUriForFile(
        context,
        "${context.packageName}.fileprovider",
        targetApkFile
      )

      // 4. Fire package installer intent
      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(apkUri, "application/vnd.android.package-archive")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }

      activity.startActivity(intent)
      invoke.resolve()
    } catch (e: Exception) {
      invoke.reject("Failed to trigger installation: ${e.message}")
    }
  }


  @Command
  fun backupDbToDownloads(invoke: Invoke) {
    try {
      val context = activity.applicationContext
      val dbFile = File(context.filesDir, "incrementum.db")
      if (!dbFile.exists()) {
        return invoke.reject("Database file does not exist at: ${dbFile.absolutePath}")
      }

      val resolver = context.contentResolver
      val contentValues = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, "Incrementum_Backup_Auto.db")
        put(MediaStore.MediaColumns.MIME_TYPE, "application/x-sqlite3")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Incrementum")
        }
      }

      val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        MediaStore.Downloads.EXTERNAL_CONTENT_URI
      } else {
        @Suppress("DEPRECATION")
        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        val incrementumDir = File(downloadsDir, "Incrementum")
        incrementumDir.mkdirs()
        val destFile = File(incrementumDir, "Incrementum_Backup_Auto.db")
        dbFile.inputStream().use { input ->
          destFile.outputStream().use { output ->
            input.copyTo(output)
          }
        }
        val res = JSObject()
        res.put("path", destFile.absolutePath)
        return invoke.resolve(res)
      }

      // Query if the file already exists in MediaStore and delete it to overwrite
      val projection = arrayOf(MediaStore.MediaColumns._ID)
      val selection = "${MediaStore.MediaColumns.DISPLAY_NAME} = ? AND ${MediaStore.MediaColumns.RELATIVE_PATH} = ?"
      val selectionArgs = arrayOf("Incrementum_Backup_Auto.db", Environment.DIRECTORY_DOWNLOADS + "/Incrementum/")
      resolver.query(collection, projection, selection, selectionArgs, null)?.use { cursor ->
        if (cursor.moveToFirst()) {
          val id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID))
          val deleteUri = ContentUris.withAppendedId(collection, id)
          resolver.delete(deleteUri, null, null)
        }
      }

      val fileUri = resolver.insert(collection, contentValues)
        ?: return invoke.reject("Failed to insert media store record")

      resolver.openOutputStream(fileUri)?.use { outputStream ->
        dbFile.inputStream().use { inputStream ->
          inputStream.copyTo(outputStream)
        }
      }

      var pathResult = ""
      val pathProjection = arrayOf(MediaStore.MediaColumns.DATA)
      resolver.query(fileUri, pathProjection, null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) {
          pathResult = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATA)) ?: ""
        }
      }

      val res = JSObject()
      res.put("path", if (pathResult.isNotEmpty()) pathResult else "/sdcard/Download/Incrementum/Incrementum_Backup_Auto.db")
      invoke.resolve(res)
    } catch (e: Exception) {
      invoke.reject("Failed to backup database: ${e.message}")
    }
  }


  @ActivityCallback
  fun pickerResult(invoke: Invoke, result: androidx.activity.result.ActivityResult) {
    if (isFolderPick) {
      handleFolderPickerResult(invoke, result)
    } else {
      handleFilePickerResult(invoke, result)
    }
  }

  private fun handleFolderPickerResult(invoke: Invoke, result: androidx.activity.result.ActivityResult) {
    try {
      val data = result.data
      val treeUri: Uri = data?.data
        ?: return invoke.reject("Folder picker cancelled")
      if (result.resultCode != Activity.RESULT_OK) {
        return invoke.reject("Folder picker cancelled")
      }

      // Persist read access (best-effort).
      try {
        val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION
        activity.contentResolver.takePersistableUriPermission(treeUri, flags)
      } catch (ignored: SecurityException) {
        // Some providers don't return persistable grants; non-fatal.
      }

      val root = DocumentFile.fromTreeUri(activity, treeUri)
        ?: return invoke.reject("Failed to access selected folder")

      val importRoot = File(activity.filesDir, "imports")
      val staged = mutableListOf<StagedFile>()

      // Walk the tree depth-first, preserving the subdirectory layout.
      walkAndStage(root, "", importRoot, staged)

      // Sort for stable ordering regardless of provider iteration order.
      staged.sortBy { it.relativePath }

      val arr = JSArray()
      for (f in staged) {
        val obj = JSObject()
        obj.put("path", f.path)
        obj.put("relativePath", f.relativePath)
        obj.put("fileName", f.fileName)
        arr.put(obj)
      }
      val out = JSObject()
      out.put("files", arr)
      invoke.resolve(out)
    } catch (ex: Exception) {
      val message = ex.message ?: "Failed to import folder"
      Logger.error(message)
      invoke.reject(message)
    }
  }

  /**
   * Recursively walk [dir], copying each supported file into [importRoot] under
   * its [relativePath]. [prefix] is the directory path relative to the picked
   * tree root, built up as we descend.
   */
  private fun walkAndStage(
    dir: DocumentFile,
    prefix: String,
    importRoot: File,
    out: MutableList<StagedFile>,
  ) {
    for (child in dir.listFiles()) {
      val name = child.name ?: continue
      val childRel = if (prefix.isEmpty()) name else "$prefix/$name"
      if (child.isDirectory) {
        walkAndStage(child, childRel, importRoot, out)
      } else if (child.isFile && hasSupportedExtension(name)) {
        stageFile(child, name, childRel, importRoot)?.let(out::add)
      }
    }
  }

  /**
   * Copy one DocumentFile's bytes into `<filesDir>/imports/<relativePath>`,
   * returning the staged [StagedFile] or null on copy failure.
   */
  private fun stageFile(
    file: DocumentFile,
    fileName: String,
    relativePath: String,
    importRoot: File,
  ): StagedFile? {
    val dest = File(importRoot, relativePath).apply {
      parentFile?.mkdirs()
    }
    return try {
      activity.contentResolver.openInputStream(file.uri)?.use { input ->
        FileOutputStream(dest).use { output ->
          input.copyTo(output)
        }
      } ?: return null
      StagedFile(
        path = dest.absolutePath,
        relativePath = relativePath,
        fileName = fileName,
      )
    } catch (ex: Exception) {
      Logger.error("Failed to stage $relativePath: ${ex.message}")
      null
    }
  }

  private fun hasSupportedExtension(name: String): Boolean {
    val dot = name.lastIndexOf('.')
    if (dot < 0) return false
    val ext = name.substring(dot + 1).lowercase()
    return pendingExtensions.contains(ext)
  }

  private fun normalizeExtensions(raw: Array<String>?): Set<String> {
    val cleaned = raw
      ?.filter { it.isNotBlank() }
      ?.map { it.trimStart('.').lowercase() }
      ?.toHashSet()
      ?: emptySet()
    return cleaned.ifEmpty { DEFAULT_EXTENSIONS.toSet() }
  }

  companion object {
    // Must match DEFAULT_EXTENSIONS in src/lib.rs.
    private val DEFAULT_EXTENSIONS = arrayOf(
      "pdf", "epub", "md", "markdown", "txt", "html", "htm", "json",
      "mp3", "wav", "m4a", "m4b", "aac", "ogg", "flac", "opus", "wma",
      "mp4", "webm", "mov", "mkv", "avi", "m4v",
    )
  }
}
