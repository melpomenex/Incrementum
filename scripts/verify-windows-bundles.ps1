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

if (-not $msiFiles) {
  throw "No MSI files found under src-tauri/target/**/release/bundle/msi/"
}
if (-not $exeFiles) {
  throw "No NSIS EXE files found under src-tauri/target/**/release/bundle/nsis/"
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

  $whisperSidecar = Get-ChildItem -Path $RootPath -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "whisper-*" -or $_.Name -eq "whisper.exe" } |
    Select-Object -First 1

  if (-not $whisperSidecar) {
    throw "$Label missing whisper sidecar executable under $RootPath"
  }

  $notebooklmSidecar = Get-ChildItem -Path $RootPath -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -like "notebooklm-*" -or
      $_.Name -eq "notebooklm.exe"
    } |
    Where-Object { $_.FullName -notmatch "notebooklm-runtime" } |
    Select-Object -First 1

  if (-not $notebooklmSidecar) {
    throw "$Label missing notebooklm sidecar executable under $RootPath"
  }

  $runtimeRoot = Get-ChildItem -Path $RootPath -Recurse -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq "notebooklm-runtime" } |
    Select-Object -First 1

  if (-not $runtimeRoot) {
    throw "$Label missing notebooklm runtime directory under $RootPath"
  }

  $runtimePython = Get-ChildItem -Path $runtimeRoot.FullName -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -eq "python.exe" -or
      $_.Name -eq "python3"
    } |
    Select-Object -First 1

  $runtimeNotebookLmModule = Get-ChildItem -Path $runtimeRoot.FullName -Recurse -Directory -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -eq "notebooklm" -and $_.FullName -match "[\\/]site-packages[\\/]"
    } |
    Select-Object -First 1

  if (-not $runtimePython) {
    throw "$Label missing notebooklm runtime python under $($runtimeRoot.FullName)"
  }

  if (-not $runtimeNotebookLmModule) {
    throw "$Label missing notebooklm python module under $($runtimeRoot.FullName)"
  }
}

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

Write-Host "Windows bundle verification passed."
