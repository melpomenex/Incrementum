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
