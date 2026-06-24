// swift-tools-version:5.3
// Copyright 2026 Incrementum
// SPDX-License-Identifier: Apache-2.0

import PackageDescription

let package = Package(
  name: "tauri-plugin-incrementum-folder-import",
  platforms: [
    .macOS(.v10_13),
    .iOS(.v13),
  ],
  products: [
    .library(
      name: "tauri-plugin-incrementum-folder-import",
      type: .static,
      targets: ["tauri-plugin-incrementum-folder-import"]
    )
  ],
  dependencies: [
    .package(name: "Tauri", path: "../.tauri/tauri-api")
  ],
  targets: [
    .target(
      name: "tauri-plugin-incrementum-folder-import",
      dependencies: [
        .byName(name: "Tauri")
      ],
      path: "Sources")
  ]
)
