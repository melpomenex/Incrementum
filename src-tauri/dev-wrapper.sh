#!/bin/bash
# Wrapper script to set environment variables before running Tauri dev
# This fixes WebKitGTK crashes when playing YouTube videos

# WebKitGTK fixes for YouTube video playback
export WEBKIT_DISABLE_COMPOSITING_MODE=1
export WEBKIT_DISABLE_DMABUF_RENDERER=1
export WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1
export WEBKIT_DISABLE_HARDWARE_ACCELERATION=1

# Force software GL rendering
export LIBGL_ALWAYS_SOFTWARE=1

# GStreamer audio settings
export AUDIOSINK=pulsesink
export GST_AUDIOSINK=pulsesink

# Disable Wayland specific features that may cause issues
export GDK_BACKEND=x11

# Run the Tauri dev command
exec npm run tauri dev "$@"
