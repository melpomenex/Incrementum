#!/usr/bin/env bash
set -euo pipefail

BIN_ROOT="${1:-src-tauri/bin}"
RUNTIME_TRIPLE="${2:-x86_64-unknown-linux-gnu}"

NOTEBOOKLM_BIN="$BIN_ROOT/notebooklm"
NOTEBOOKLM_BIN_ALT="$BIN_ROOT/notebooklm-$RUNTIME_TRIPLE"
RUNTIME_BASE="$BIN_ROOT/notebooklm-runtime/$RUNTIME_TRIPLE"
MANIFEST="$RUNTIME_BASE/runtime-manifest.json"
PYTHON="$RUNTIME_BASE/python/bin/python3"
SITE_PACKAGES="$RUNTIME_BASE/site-packages"
NOTEBOOKLM_MODULE="$SITE_PACKAGES/notebooklm"
PLAYWRIGHT="$RUNTIME_BASE/playwright"

if [[ ! -x "$NOTEBOOKLM_BIN" ]]; then
  if [[ -x "$NOTEBOOKLM_BIN_ALT" ]]; then
    NOTEBOOKLM_BIN="$NOTEBOOKLM_BIN_ALT"
  else
    echo "NotebookLM wrapper missing or not executable: $NOTEBOOKLM_BIN or $NOTEBOOKLM_BIN_ALT"
    exit 1
  fi
fi

if [[ ! -d "$RUNTIME_BASE" ]]; then
  echo "NotebookLM runtime base missing: $RUNTIME_BASE"
  exit 1
fi

if [[ ! -f "$MANIFEST" ]]; then
  echo "NotebookLM runtime manifest missing: $MANIFEST"
  exit 1
fi

if [[ ! -x "$PYTHON" ]]; then
  echo "NotebookLM runtime python missing or not executable: $PYTHON"
  exit 1
fi

if [[ ! -d "$SITE_PACKAGES" ]]; then
  echo "NotebookLM site-packages missing: $SITE_PACKAGES"
  exit 1
fi

if [[ ! -d "$NOTEBOOKLM_MODULE" ]]; then
  echo "NotebookLM module missing: $NOTEBOOKLM_MODULE"
  exit 1
fi

if [[ ! -d "$PLAYWRIGHT" ]]; then
  echo "NotebookLM playwright directory missing: $PLAYWRIGHT"
  exit 1
fi

# Lightweight smoke checks that the bundled runtime can execute and run commands.
PYTHONPATH="$SITE_PACKAGES" "$PYTHON" -c "import notebooklm" >/dev/null
"$NOTEBOOKLM_BIN" --version >/dev/null
"$NOTEBOOKLM_BIN" status --help >/dev/null

echo "NotebookLM runtime verification passed for $RUNTIME_BASE"
