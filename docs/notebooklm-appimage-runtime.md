# NotebookLM AppImage Runtime

## Minimum Bundled Runtime Layout

For Linux AppImage builds, NotebookLM must be bundled under:

- `usr/bin/notebooklm`
- `usr/bin/notebooklm-runtime/<target-triple>/runtime-manifest.json`
- `usr/bin/notebooklm-runtime/<target-triple>/python/bin/python3`
- `usr/bin/notebooklm-runtime/<target-triple>/site-packages/notebooklm/`
- `usr/bin/notebooklm-runtime/<target-triple>/playwright/`

The runtime manifest (`runtime-manifest.json`) is the canonical contract for runtime
integrity checks and should include:

- `layout`
- `built_with`
- `target`
- `python_executable`
- `site_packages`
- `playwright_dir`
- `required_paths`

## Release Validation Steps

Run Linux packaged validation with:

```bash
scripts/ci-build-appimage.sh
```

The AppImage build flow now runs:

```bash
scripts/verify-notebooklm-runtime.sh "$APPDIR/usr/bin"
```

This verifies runtime completeness and performs smoke checks:

- imports `notebooklm` using bundled Python + bundled site-packages
- executes `notebooklm --version`
- executes `notebooklm status --help`

If verification fails, AppImage packaging is considered not release-ready.

## Trade-offs

- Bundling Python + NotebookLM + Playwright increases AppImage size.
- Runtime refresh requires regenerating `src-tauri/bin/notebooklm-runtime/<target>/` and committing updated manifest/runtime assets.
- Deterministic bundled runtime improves reliability versus first-run dynamic installs but increases release artifact footprint.
