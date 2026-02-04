#!/usr/bin/env bash
set -euo pipefail

cmd="${1:-}"
shift || true

if [[ "$cmd" == "dev" ]]; then
  # Start Vite as a direct child of this script so the sandbox allows the bind.
  npm run dev -- --host 127.0.0.1 --port 15173 --strictPort &
  vite_pid=$!
  trap 'kill "$vite_pid" 2>/dev/null || true' EXIT

  export TAURI_CLI_NO_DEV_SERVER_WAIT=true
  export CARGO_BUILD_JOBS=1
  export RUST_MIN_STACK=268435456
  export RUSTFLAGS="-C debuginfo=0 -C codegen-units=1"

  tauri dev "$@"
  exit 0
fi

tauri "$cmd" "$@"
