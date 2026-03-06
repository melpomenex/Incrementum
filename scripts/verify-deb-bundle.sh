#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Bash 3 compatible alternative to mapfile
debs=()
while IFS= read -r line; do
  debs+=("$line")
done < <(find src-tauri/target -type f -path "*/release/bundle/deb/*.deb" | sort)

if [[ ${#debs[@]} -eq 0 ]]; then
  echo "No .deb files found under src-tauri/target/**/release/bundle/deb/"
  exit 1
fi

for deb in "${debs[@]}"; do
  echo "Verifying deb: $deb"
  listing="$(dpkg-deb -c "$deb")"

  # Tauri sidecars can appear as `whisper` or `whisper-<target>`.
  if ! grep -Eq '/whisper([^/ ]*)$' <<<"$listing"; then
    echo "Missing whisper sidecar in $deb"
    exit 1
  fi

  # Check for NotebookLM runtime (optional but recommended)
  if grep -Eq '/notebooklm-runtime' <<<"$listing"; then
    echo "NotebookLM runtime directory found in $deb"

    # Check for notebooklm sidecar
    if grep -Eq '/notebooklm(-[^/ ]*)?$' <<<"$listing"; then
      echo "NotebookLM sidecar found in $deb"
    else
      echo "WARNING: NotebookLM runtime directory found but no sidecar in $deb"
    fi
  else
    echo "WARNING: NotebookLM runtime not bundled in $deb (users need to install notebooklm-py separately)"
  fi
done

echo "Deb bundle verification passed."
