#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Bash 3 compatible alternative to mapfile
resource_dirs=()
while IFS= read -r line; do
  resource_dirs+=("$line")
done < <(find src-tauri/target -type d -path "*/release/bundle/macos/*.app/Contents/Resources" | sort)

if [[ ${#resource_dirs[@]} -eq 0 ]]; then
  echo "No macOS app resources found under src-tauri/target/**/release/bundle/macos/*.app/Contents/Resources"
  exit 1
fi

for resources in "${resource_dirs[@]}"; do
  echo "Verifying macOS bundle resources: $resources"

  whisper_sidecar="$(find "$resources" -maxdepth 3 -type f \( -name 'whisper-*' -o -name 'whisper' \) | head -n 1 || true)"
  if [[ -z "$whisper_sidecar" ]]; then
    echo "Missing whisper sidecar in $resources"
    exit 1
  fi

  echo "Found whisper sidecar: $whisper_sidecar"
done

echo "macOS bundle verification passed."
