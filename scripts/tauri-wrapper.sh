#!/usr/bin/env bash
set -euo pipefail

cmd="${1:-}"
shift || true

if [[ "$cmd" == "dev" ]]; then
  # Tauri (wry/tao) on Linux requires a GTK display backend. In headless shells
  # this otherwise fails with a panic like:
  # "Failed to initialize gtk backend!: ... Failed to initialize GTK"
  #
  # Auto-wrap with Xvfb when available; otherwise fail fast with a clear hint.
  if [[ "$(uname -s)" == "Linux" ]]; then
    if [[ -z "${DISPLAY-}" && -z "${WAYLAND_DISPLAY-}" && -z "${MIR_SOCKET-}" ]]; then
      if command -v xvfb-run >/dev/null 2>&1; then
        export INCREMENTUM_TAURI_XVFB=1
      else
        cat >&2 <<'EOF'
No GUI session detected (DISPLAY/WAYLAND_DISPLAY unset).

On Linux, Tauri needs a GTK display backend to start. If you are running in a
headless environment, install Xvfb and rerun with xvfb-run:

  sudo apt-get update && sudo apt-get install -y xvfb
  xvfb-run -a npm run tauri dev
EOF
        exit 1
      fi
    fi
  fi

  # Start Vite as a direct child of this script so the sandbox allows the bind.
  npm run dev -- --host 127.0.0.1 --port 15173 --strictPort &
  vite_pid=$!
  trap 'kill "$vite_pid" 2>/dev/null || true' EXIT

  export TAURI_CLI_NO_DEV_SERVER_WAIT=true
  export CARGO_BUILD_JOBS=1
  # Linux WebKitGTK/EGL stability defaults for dev sessions.
  export WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS="${WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS:-1}"
  unset WEBKIT_FORCE_SANDBOX || true
  export LIBGL_ALWAYS_SOFTWARE="${LIBGL_ALWAYS_SOFTWARE:-1}"
  # Explicitly select a known-good toolchain for reproducible dev builds.
  export RUSTUP_TOOLCHAIN="${RUSTUP_TOOLCHAIN:-1.89.0}"
  # Some crates (notably parts of sqlx) can trigger deep compiler stacks on
  # this toolchain; keep this high to avoid rustc SIGSEGVs.
  export RUST_MIN_STACK=1073741824
  # Linker selection is handled in `src-tauri/.cargo/config.toml` (we avoid
  # rustc's self-contained rust-lld on Linux).

  # Workaround for recurring rustc/LLVM SIGSEGVs seen in this environment:
  # - disabling incremental and debuginfo significantly reduces compiler stress.
  export CARGO_INCREMENTAL=0
  export CARGO_PROFILE_DEV_DEBUG=0

  if [[ "${INCREMENTUM_TAURI_XVFB-}" == "1" ]]; then
    # 24-bit color is required by some GTK/WebKit paths.
    xvfb-run -a -s "-screen 0 1280x720x24" tauri dev "$@"
  else
    tauri dev "$@"
  fi
  exit 0
fi

tauri "$cmd" "$@"
