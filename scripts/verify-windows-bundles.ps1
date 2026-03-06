Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$msiFiles = Get-ChildItem -Path "src-tauri/target" -Recurse -File -Filter "*.msi" |
  Where-Object { $_.FullName -match "\\release\\bundle\\msi\\" }
$exeFiles = Get-ChildItem -Path "src-tauri/target" -Recurse -File -Filter "*.exe" |
  Where-Object {
    $_.FullName -match "\\release\\bundle\\nsis\\" -and
    $_.Name -notmatch "\.exe\.zip$"
  }

if (-not $msiFiles -and -not $exeFiles) {
  throw "No Windows installer bundles found under src-tauri/target/**/release/bundle/"
}

$tmpRoot = Join-Path $env:RUNNER_TEMP "incrementum_bundle_verify"
if (Test-Path $tmpRoot) {
  Remove-Item -Recurse -Force $tmpRoot
}
New-Item -ItemType Directory -Path $tmpRoot | Out-Null

function Assert-RequiredSidecars {
  param(
    [Parameter(Mandatory = $true)][string]$RootPath,
    [Parameter(Mandatory = $true)][string]$Label
  )

  # Check for whisper sidecar
  $whisperSidecar = Get-ChildItem -Path $RootPath -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "whisper-*" -or $_.Name -eq "whisper.exe" } |
    Select-Object -First 1

  if (-not $whisperSidecar) {
    throw "$Label missing whisper sidecar executable under $RootPath"
  }

  Write-Host "$Label found whisper sidecar: $($whisperSidecar.FullName)"

  # Check for NotebookLM runtime (venv-based on Windows)
  $notebooklmRuntime = Get-ChildItem -Path $RootPath -Recurse -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq "notebooklm-runtime" } |
    Select-Object -First 1

  if ($notebooklmRuntime) {
    # Check for venv-based NotebookLM installation
    $notebooklmVenv = Get-ChildItem -Path $notebooklmRuntime.FullName -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -eq "notebooklm.exe" -or $_.Name -eq "notebooklm" } |
      Select-Object -First 1

    if ($notebooklmVenv) {
      Write-Host "$Label found NotebookLM runtime: $($notebooklmVenv.FullName)"
    } else {
      Write-Host "$Label WARNING: NotebookLM runtime directory found but no executable detected"
    }
  } else {
    Write-Host "$Label WARNING: NotebookLM runtime directory not found (may be installed on first use)"
  }

  # Check for notebooklm sidecar wrapper (alternative to venv)
  $notebooklmSidecar = Get-ChildItem -Path $RootPath -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "notebooklm-*.cmd" -or $_.Name -like "notebooklm-*.exe" -or $_.Name -eq "notebooklm" } |
    Select-Object -First 1

  if ($notebooklmSidecar) {
    Write-Host "$Label found NotebookLM sidecar: $($notebooklmSidecar.FullName)"
  }
}

if ($msiFiles) {
  foreach ($msi in $msiFiles) {
    $outDir = Join-Path $tmpRoot ("msi_" + [IO.Path]::GetFileNameWithoutExtension($msi.Name))
    New-Item -ItemType Directory -Path $outDir | Out-Null
    $targetArg = "TARGETDIR=$outDir"
    $p = Start-Process -FilePath "msiexec.exe" -ArgumentList @("/a", $msi.FullName, "/qn", $targetArg) -PassThru -Wait
    if ($p.ExitCode -ne 0) {
      throw "MSI admin extraction failed for $($msi.FullName) with exit code $($p.ExitCode)"
    }
    Assert-RequiredSidecars -RootPath $outDir -Label "MSI $($msi.Name)"
  }
} else {
  Write-Host "No MSI bundles found; continuing with NSIS verification."
}

if ($exeFiles) {
  foreach ($exe in $exeFiles) {
    $outDir = Join-Path $tmpRoot ("nsis_" + [IO.Path]::GetFileNameWithoutExtension($exe.Name))
    New-Item -ItemType Directory -Path $outDir | Out-Null
    $installArg = "/D=$outDir"
    $p = Start-Process -FilePath $exe.FullName -ArgumentList @("/S", $installArg) -PassThru -Wait
    if ($p.ExitCode -ne 0) {
      throw "NSIS silent install failed for $($exe.FullName) with exit code $($p.ExitCode)"
    }
    Assert-RequiredSidecars -RootPath $outDir -Label "NSIS $($exe.Name)"
  }
} else {
  Write-Host "No NSIS bundles found; continuing with MSI verification."
}

Write-Host "Windows bundle verification passed."
