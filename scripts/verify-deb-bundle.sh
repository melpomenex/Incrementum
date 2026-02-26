#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mapfile -t debs < <(find src-tauri/target -type f -path "*/release/bundle/deb/*.deb" | sort)
if [[ ${#debs[@]} -eq 0 ]]; then
  echo "No .deb files found under src-tauri/target/**/release/bundle/deb/"
  exit 1
fi

for deb in "${debs[@]}"; do
  echo "Verifying deb: $deb"
  listing="$(dpkg-deb -c "$deb")"

  if ! grep -Eq '/whisper-[^/ ]+' <<<"$listing"; then
    echo "Missing whisper sidecar in $deb"
    exit 1
  fi
done

echo "Deb bundle verification passed."
