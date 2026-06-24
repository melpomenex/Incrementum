// Copyright 2026 Incrementum
// SPDX-License-Identifier: Apache-2.0
//
// iOS implementation of the folder-import Tauri plugin.
//
// Presents UIDocumentPickerViewController in folder mode (.folder content type),
// then walks the picked directory with FileManager.enumerator (recursive),
// copies each supported file into <Documents>/imports/<relative-subpath>, and
// returns the staged filesystem paths. Staged files are app-private and readable
// by Rust std::fs, so the existing path-based import pipeline consumes them.

import MobileCoreServices
import SwiftRs
import Tauri
import UIKit
import UniformTypeIdentifiers

/// Decodable argument payload from Rust/JS. `extensions` is optional and
/// defaults to the same set as the desktop/Kotlin side when empty.
struct PickFolderOptions: Decodable {
  var extensions: [String]?
}

public class FolderImportPlugin: Plugin {

  /// Held while the document picker is on screen so the completion handler
  /// can resolve the originating `Invoke`.
  private var pendingInvoke: Invoke?
  private var extensions: Set<String> = Self.defaultExtensions

  @objc public func pickFolderDocuments(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PickFolderOptions.self)

    // Build the extension allow-list (lowercased, leading dots stripped).
    if let raw = args.extensions, !raw.isEmpty {
      extensions = Set(raw.map { $0.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: ".")) })
    } else {
      extensions = Self.defaultExtensions
    }

    pendingInvoke = invoke

    DispatchQueue.main.async {
      // `.folder` lets the user pick a directory (iOS 13+).
      let folderType = UTType.folder.identifier
      let picker = UIDocumentPickerViewController(
        documentTypes: [folderType], in: .import)
      picker.allowsMultipleSelection = false
      picker.modalPresentationStyle = .fullScreen
      picker.delegate = self
      self.manager.viewController?.present(picker, animated: true, completion: nil)
    }
  }

  /// Recursively copy supported files from [url] (a directory) into the app's
  /// Documents/imports folder, returning the staged file descriptors.
  private func stageFiles(from url: URL) -> [[String: String]] {
    let fileManager = FileManager.default
    // App-private Documents dir; mirrors the import_document_from_bytes
    // staging location used by the existing mobile single-file import.
    let docs = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
    let importRoot = docs.appendingPathComponent("imports", isDirectory: true)

    var staged: [[String: String]] = []
    guard
      let enumerator = fileManager.enumerator(
        at: url,
        includingPropertiesForKeys: [.isDirectoryKey],
        options: [.skipsHiddenFiles])
    else {
      return []
    }

    for case let fileURL as URL in enumerator {
      var isDir: ObjCBool = false
      guard fileManager.fileExists(atPath: fileURL.path, isDirectory: &isDir), !isDir.boolValue
      else { continue }

      // Relative path under the picked folder root.
      let relativePath = fileURL.path.replacingOccurrences(of: url.path + "/", with: "")
      guard hasSupportedExtension(fileURL.path) else { continue }

      let dest = importRoot.appendingPathComponent(relativePath)
      do {
        try fileManager.createDirectory(
          at: dest.deletingLastPathComponent(),
          withIntermediateDirectories: true)
        if fileManager.fileExists(atPath: dest.path) {
          try fileManager.removeItem(at: dest)
        }
        try fileManager.copyItem(at: fileURL, to: dest)
        staged.append([
          "path": dest.path,
          "relativePath": relativePath,
          "fileName": fileURL.lastPathComponent,
        ])
      } catch {
        // Skip files we can't copy (permissions, etc.) but keep going.
        continue
      }
    }

    staged.sort { $0["relativePath"] ?? "" < $1["relativePath"] ?? "" }
    return staged
  }

  private func hasSupportedExtension(_ path: String) -> Bool {
    guard let dot = path.lastIndex(of: ".") else { return false }
    let ext = String(path[path.index(after: dot)...]).lowercased()
    return extensions.contains(ext)
  }

  /// Must match DEFAULT_EXTENSIONS in src/lib.rs.
  static var defaultExtensions: Set<String> = [
    "pdf", "epub", "md", "markdown", "txt", "html", "htm", "json",
    "mp3", "wav", "m4a", "m4b", "aac", "ogg", "flac", "opus", "wma",
    "mp4", "webm", "mov", "mkv", "avi", "m4v",
  ]
}

// MARK: - UIDocumentPickerDelegate

extension FolderImportPlugin: UIDocumentPickerDelegate {
  public func documentPicker(
    _ controller: UIDocumentPickerViewController,
    didPickDocumentsAt urls: [URL]
  ) {
    guard let invoke = pendingInvoke else { return }
    pendingInvoke = nil

    guard let folderURL = urls.first else {
      invoke.resolve(["files": []])
      return
    }

    // The picked URL is security-scoped on iOS; start/stop access around use.
    let didStart = folderURL.startAccessingSecurityScopedResource()
    defer {
      if didStart { folderURL.stopAccessingSecurityScopedResource() }
    }

    let staged = stageFiles(from: folderURL)
    invoke.resolve(["files": staged])
  }

  public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    pendingInvoke?.resolve(["files": []])
    pendingInvoke = nil
  }
}

@_cdecl("init_plugin_incrementum_folder_import")
func initPlugin() -> Plugin {
  return FolderImportPlugin()
}
