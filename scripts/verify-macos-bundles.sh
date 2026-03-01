#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Function to verify whisper sidecar in a Resources directory
verify_resources() {
  local resources="$1"
  echo "Verifying macOS bundle resources: $resources"

  local whisper_sidecar
  whisper_sidecar="$(find "$resources" -maxdepth 3 -type f \( -name 'whisper-*' -o -name 'whisper' \) | head -n 1 || true)"
  if [[ -z "$whisper_sidecar" ]]; then
    echo "Missing whisper sidecar in $resources"
    return 1
  fi

  echo "Found whisper sidecar: $whisper_sidecar"
  return 0
}

# First, try to find .app bundles directly (when building with --bundles app)
# Bash 3 compatible alternative to mapfile
resource_dirs=()
while IFS= read -r line; do
  resource_dirs+=("$line")
done < <(find src-tauri/target -type d -path "*/release/bundle/macos/*.app/Contents/Resources" 2>/dev/null | sort)

if [[ ${#resource_dirs[@]} -gt 0 ]]; then
  echo "Found ${#resource_dirs[@]} .app bundle(s) to verify"
  for resources in "${resource_dirs[@]}"; do
    verify_resources "$resources"
  done
  echo "macOS bundle verification passed."
  exit 0
fi

# If no .app bundles found, look for DMG files (when building with --bundles dmg)
dmg_files=()
while IFS= read -r line; do
  dmg_files+=("$line")
done < <(find src-tauri/target -type f -path "*/release/bundle/dmg/*.dmg" 2>/dev/null | sort)

if [[ ${#dmg_files[@]} -eq 0 ]]; then
  echo "No macOS app resources or DMG files found"
  echo "Looked for:"
  echo "  - src-tauri/target/**/release/bundle/macos/*.app/Contents/Resources"
  echo "  - src-tauri/target/**/release/bundle/dmg/*.dmg"
  exit 1
fi

echo "Found ${#dmg_files[@]} DMG file(s) to verify"

# Verify each DMG by mounting it
for dmg in "${dmg_files[@]}"; do
  echo "Verifying DMG: $dmg"

  # Create a temporary mount point
  mount_point="$(mktemp -d)"

  # Mount the DMG
  echo "Mounting DMG at $mount_point"
  hdiutil attach "$dmg" -mountpoint "$mount_point" -readonly -nobrowse -quiet

  # Find the .app bundle inside the DMG
  app_bundle="$(find "$mount_point" -maxdepth 2 -name "*.app" -type d | head -n 1 || true)"

  if [[ -z "$app_bundle" ]]; then
    echo "No .app bundle found in DMG: $dmg"
    hdiutil detach "$mount_point" -quiet || true
    rm -rf "$mount_point"
    exit 1
  fi

  echo "Found app bundle: $app_bundle"

  # Verify the Resources directory
  resources="$app_bundle/Contents/Resources"
  if [[ ! -d "$resources" ]]; then
    echo "No Resources directory found in $app_bundle"
    hdiutil detach "$mount_point" -quiet || true
    rm -rf "$mount_point"
    exit 1
  fi

  verify_resources "$resources"
  result=$?

  # Unmount the DMG
  echo "Unmounting DMG"
  hdiutil detach "$mount_point" -quiet || true
  rm -rf "$mount_point"

  if [[ $result -ne 0 ]]; then
    exit 1
  fi
done

echo "macOS bundle verification passed."
