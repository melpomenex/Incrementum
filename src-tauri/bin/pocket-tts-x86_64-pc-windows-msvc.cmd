@echo off
REM Pocket TTS Wrapper Script for Windows
REM
REM This script wraps the system-installed pocket-tts CLI for use as a Tauri sidecar.
REM The pocket-tts package should be installed via: pip install pocket-tts

set SCRIPT_DIR=%~dp0
set RUNTIME=%SCRIPT_DIR%pocket-tts-runtime\x86_64-pc-windows-msvc\.venv\Scripts\pocket-tts.exe

REM Try bundled runtime first
if exist "%RUNTIME%" (
  "%RUNTIME%" %*
  exit /b %ERRORLEVEL%
)

REM Fall back to system-installed pocket-tts
where pocket-tts >nul 2>&1
if %ERRORLEVEL% equ 0 (
  pocket-tts %*
  exit /b %ERRORLEVEL%
)

echo Error: Pocket TTS not found >&2
echo To install: pip install pocket-tts >&2
exit /b 1
