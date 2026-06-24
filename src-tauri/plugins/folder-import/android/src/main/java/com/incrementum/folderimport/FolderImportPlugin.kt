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
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import androidx.documentfile.provider.DocumentFile
import app.tauri.Logger
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

  @Command
  fun pickFolderDocuments(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(PickFolderOptions::class.java)
      pendingExtensions = normalizeExtensions(args.extensions)

      // Persistable permission so re-picking later doesn't re-prompt; harmless
      // if the provider doesn't grant it.
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
        addFlags(
          Intent.FLAG_GRANT_READ_URI_PERMISSION
            or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        )
      }

      startActivityForResult(invoke, intent, "folderPickerResult")
    } catch (ex: Exception) {
      val message = ex.message ?: "Failed to open folder picker"
      Logger.error(message)
      invoke.reject(message)
    }
  }

  @Suppress("unused") // invoked by Tauri when the SAF activity returns
  fun folderPickerResult(invoke: Invoke, @Suppress("UNUSED_PARAMETER") result: androidx.activity.result.ActivityResult) {
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
