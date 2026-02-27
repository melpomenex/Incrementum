#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mapfile -t resource_dirs < <(find src-tauri/target -type d -path "*/release/bundle/macos/*.app/Contents/Resources" | sort)
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

  notebooklm_sidecar="$(find "$resources" -maxdepth 3 -type f \( -name 'notebooklm-*' -o -name 'notebooklm' \) ! -path '*/notebooklm-runtime/*' | head -n 1 || true)"
  if [[ -z "$notebooklm_sidecar" ]]; then
    echo "Missing notebooklm sidecar in $resources"
    exit 1
  fi

  runtime_root=""
  if [[ -d "$resources/notebooklm-runtime" ]]; then
    runtime_root="$resources/notebooklm-runtime"
  elif [[ -d "$resources/bin/notebooklm-runtime" ]]; then
    runtime_root="$resources/bin/notebooklm-runtime"
  fi

  if [[ -z "$runtime_root" ]]; then
    echo "Missing notebooklm runtime directory in $resources"
    exit 1
  fi

  runtime_python="$(find "$runtime_root" -type f -path '*/python/bin/python3' | head -n 1 || true)"
  runtime_manifest="$(find "$runtime_root" -type f -name 'runtime-manifest.json' | head -n 1 || true)"
  runtime_module="$(find "$runtime_root" -type d -path '*/site-packages/notebooklm' | head -n 1 || true)"

  if [[ -z "$runtime_python" ]]; then
    echo "Missing notebooklm runtime python in $runtime_root"
    exit 1
  fi

  if [[ -z "$runtime_manifest" ]]; then
    echo "Missing notebooklm runtime manifest in $runtime_root"
    exit 1
  fi

  if [[ -z "$runtime_module" ]]; then
    echo "Missing notebooklm module in $runtime_root"
    exit 1
  fi
done

echo "macOS bundle verification passed."
