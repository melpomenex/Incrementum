#!/usr/bin/env python3
"""
YouTube Transcript Service - Runs on Tailscale VPS
Fetches transcripts using yt-dlp + proxy and caches them locally
"""

import logging
import os
import sys
import json
import re
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
from urllib.parse import quote

# Flask for HTTP server
try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
except ImportError:
    logger = logging.getLogger(__name__)
    logger.warning("Installing required packages...")
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "flask", "flask-cors"], check=True
    )
    from flask import Flask, request, jsonify
    from flask_cors import CORS

<<<<<<< Updated upstream
# =============================================================================
# CONFIGURATION
# =============================================================================
PROXY_HOST = "REDACTED_PROXY"
PROXY_PORT = "10001"
PROXY_USER = "REDACTED_USER"
PROXY_PASS = "REDACTED_PASS"
PROXY_URL = f"http://{PROXY_USER}:{quote(PROXY_PASS, safe='')}@{PROXY_HOST}:{PROXY_PORT}"
=======
logger = logging.getLogger(__name__)

PROXY_HOST = "us.decodo.com"
PROXY_PORT = "10001"
PROXY_USER = "sps486nntn"
PROXY_PASS = "Yi7uqUnrbIK6au=7o0"
PROXY_URL = (
    f"http://{PROXY_USER}:{quote(PROXY_PASS, safe='')}@{PROXY_HOST}:{PROXY_PORT}"
)
>>>>>>> Stashed changes

# API key for authentication (set via env var)
API_KEY = os.environ.get("TRANSCRIPT_API_KEY", "change-me-in-production")

CACHE_DIR = Path("./transcript_cache")
CACHE_DIR.mkdir(exist_ok=True)

# Cache TTL (24 hours)
CACHE_TTL = timedelta(hours=24)

app = Flask(__name__)
CORS(app)


def get_cache_path(video_id):
    """Get cache file path for a video."""
    return CACHE_DIR / f"{video_id}.json"


def is_cache_valid(cache_path):
    """Check if cached file is still valid."""
    if not cache_path.exists():
        return False

    mtime = datetime.fromtimestamp(cache_path.stat().st_mtime)
    return datetime.now() - mtime < CACHE_TTL


def load_from_cache(video_id):
    """Load transcript from cache."""
    cache_path = get_cache_path(video_id)
    if not is_cache_valid(cache_path):
        return None

    try:
        with open(cache_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except (OSError, json.JSONDecodeError) as e:
        logger.error("Error loading cache for %s: %s", video_id, e)
        return None


def save_to_cache(video_id, data):
    """Save transcript to cache."""
    cache_path = get_cache_path(video_id)
    try:
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except OSError as e:
        logger.error("Error saving cache for %s: %s", video_id, e)
        return False


def extract_video_id(url_or_id):
    """Extract video ID from various YouTube URL formats."""
    patterns = [
        r"(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})",
        r"youtube\.com/embed/([a-zA-Z0-9_-]{11})",
        r"youtube\.com/v/([a-zA-Z0-9_-]{11})",
        r"youtube\.com/shorts/([a-zA-Z0-9_-]{11})",
    ]

    if re.match(r"^[a-zA-Z0-9_-]{11}$", url_or_id):
        return url_or_id

    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)

    return None


def get_video_info_ytdlp(video_id, use_proxy=True):
    """Get video info using yt-dlp."""
    video_url = f"https://www.youtube.com/watch?v={video_id}"

    cmd = ["yt-dlp", "--dump-json", "--no-playlist", "--skip-download", video_url]

    # Add proxy if enabled
    if use_proxy:
        cmd.insert(1, "--proxy")
        cmd.insert(2, PROXY_URL)

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if result.returncode != 0:
            error = result.stderr
            # If proxy fails, retry without proxy
            if use_proxy and (
                "data blocks" in error
                or "proxy" in error.lower()
                or "connection" in error.lower()
            ):
                print(
                    f"[{video_id}] Proxy failed for info, retrying without proxy...",
                    file=sys.stderr,
                )
                return get_video_info_ytdlp(video_id, use_proxy=False)
            return None, error

        info = json.loads(result.stdout)
        return info, None

    except Exception as e:
        return None, str(e)


def get_available_subtitles(info):
    """Get list of available subtitle languages."""
    subtitles = info.get("subtitles", {})
    auto_captions = info.get("automatic_captions", {})

    manual_langs = list(subtitles.keys())
    auto_langs = list(auto_captions.keys())

    return {"manual": manual_langs, "auto": auto_langs}


def download_subtitles_ytdlp(video_id, lang="en", use_proxy=True):
    """Download subtitles using yt-dlp."""
    video_url = f"https://www.youtube.com/watch?v={video_id}"

    cmd = [
        "yt-dlp",
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs",
        lang,
        "--sub-format",
        "vtt",  # Use VTT format (more reliable)
        "--skip-download",
        "--output",
        f"{video_id}.%(ext)s",
        "--no-playlist",
        video_url,
    ]

    # Add proxy if enabled
    if use_proxy:
        cmd.insert(1, "--proxy")
        cmd.insert(2, PROXY_URL)

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=60, cwd=str(CACHE_DIR)
        )

        if result.returncode != 0:
            error_output = result.stderr.strip()
            if error_output:
                # If proxy fails, retry without proxy
                if use_proxy and (
                    "data blocks" in error_output
                    or "proxy" in error_output.lower()
                    or "connection" in error_output.lower()
                ):
                    print(
                        f"[{video_id}] Proxy failed, retrying without proxy...",
                        file=sys.stderr,
                    )
                    return download_subtitles_ytdlp(video_id, lang, use_proxy=False)
                return None, f"yt-dlp error: {error_output[:200]}"
            return None, "yt-dlp failed to download subtitles"

        # Find the downloaded VTT file
        # Try exact match first, then patterns
        patterns = [
            f"{video_id}.{lang}.vtt",
            f"{video_id}.en.vtt",
            f"{video_id}.*.vtt",
        ]

        vtt_file = None
        for pattern in patterns:
            matches = list(CACHE_DIR.glob(pattern))
            if matches:
                vtt_file = matches[0]
                break

        if not vtt_file:
            # List all files to debug
            all_files = list(CACHE_DIR.glob(f"{video_id}*"))
            return None, f"No VTT file found. Downloaded: {[f.name for f in all_files]}"

        # Read VTT content
        with open(vtt_file, "r", encoding="utf-8") as f:
            vtt_content = f.read()

        vtt_file.unlink()

        # Also remove any other files for this video
        for f in CACHE_DIR.glob(f"{video_id}*"):
            try:
                f.unlink()
            except OSError:
                logger.warning("Failed to cleanup cache file %s", f)

        return vtt_content, None

    except subprocess.TimeoutExpired:
        return None, "Download timed out"
    except Exception as e:
        return None, str(e)


def parse_vtt_subtitles(vtt_content):
    """Parse VTT format subtitles to segments."""
    segments = []
    lines = vtt_content.split("\n")

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Look for timestamp line: 00:00:00.000 --> 00:00:05.000
        if "-->" in line:
            try:
                parts = line.split("-->")
                start_str = parts[0].strip()
                end_str = (
                    parts[1].strip().split()[0]
                )  # Take only first part (timestamp) from end

                # Parse start time (handle both HH:MM:SS.mmm and MM:SS.mmm)
                start_parts = start_str.split(":")
                if len(start_parts) == 3:
                    start = (
                        int(start_parts[0]) * 3600
                        + int(start_parts[1]) * 60
                        + float(start_parts[2])
                    )
                else:
                    start = int(start_parts[0]) * 60 + float(start_parts[1])

                end_parts = end_str.split(":")
                if len(end_parts) == 3:
                    end = (
                        int(end_parts[0]) * 3600
                        + int(end_parts[1]) * 60
                        + float(end_parts[2])
                    )
                else:
                    end = int(end_parts[0]) * 60 + float(end_parts[1])

                # Collect text lines (skip empty lines, continue until next timestamp)
                i += 1
                text_lines = []
                while i < len(lines) and "-->" not in lines[i]:
                    text_line = lines[i].strip()
                    text_line = re.sub(r"<[^>]+>", "", text_line)
                    text_line = re.sub(r"^\d+\s*", "", text_line)
                    if text_line:
                        text_lines.append(text_line)
                    i += 1

                text = " ".join(text_lines).strip()

                if text:
                    segments.append(
                        {
                            "start": round(start, 3),
                            "duration": round(end - start, 3),
                            "text": text,
                        }
                    )

            except (ValueError, IndexError) as e:
                logger.warning("Failed to parse VTT timestamp: %s (%s)", line, e)

        i += 1

    return segments


def fetch_transcript(video_id):
    """Main function to fetch transcript with caching."""
    cached = load_from_cache(video_id)
    if cached:
        print(f"[{video_id}] Cache hit")
        return {"success": True, "cached": True, "videoId": video_id, **cached}

    print(f"[{video_id}] Cache miss, fetching...")

    info, error = get_video_info_ytdlp(video_id)
    if not info:
        return {
            "success": False,
            "error": f"Failed to get video info: {error}",
            "code": "VIDEO_INFO_FAILED",
        }

    title = info.get("title", "Unknown")
    duration = info.get("duration", 0)

    available = get_available_subtitles(info)

    if not available["manual"] and not available["auto"]:
        return {
            "success": False,
            "error": "No captions available for this video",
            "code": "NO_CAPTIONS",
            "available": available,
        }

    # Try to download subtitles
    subtitle_data, error = download_subtitles_ytdlp(video_id)

    if not subtitle_data:
        return {
            "success": False,
            "error": f"Failed to download subtitles: {error}",
            "code": "DOWNLOAD_FAILED",
            "available": available,
        }

    segments = parse_vtt_subtitles(subtitle_data)

    if not segments:
        return {
            "success": False,
            "error": "No transcript segments found",
            "code": "NO_SEGMENTS",
        }

    result = {
        "title": title,
        "duration": duration,
        "language": "en",
        "segments": segments,
        "segment_count": len(segments),
        "available_languages": available,
    }

    save_to_cache(video_id, result)

    return {"success": True, "cached": False, "videoId": video_id, **result}


pending_worker_queue = []
# Workers that have recently checked in (worker_id -> last_checkin_time)
active_workers = {}

WORKER_TIMEOUT_SECONDS = 60  # Worker considered dead after 60s


def is_worker_available():
    """Check if any workers are available."""
    global active_workers
    cutoff = datetime.now() - timedelta(seconds=WORKER_TIMEOUT_SECONDS)
    active_workers = {wid: t for wid, t in active_workers.items() if t > cutoff}
    return len(active_workers) > 0


def add_to_worker_queue(video_id):
    """Add a video to the worker queue."""
    if video_id not in pending_worker_queue:
        pending_worker_queue.append(video_id)
        print(f"[{video_id}] Added to worker queue")


def require_auth():
    """Check API key authentication."""
    auth_header = request.headers.get("Authorization", "")
    bearer_token = request.headers.get("X-API-Key", "")

    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    elif bearer_token:
        token = bearer_token

    return token == API_KEY


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify(
        {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "cache_size": len(list(CACHE_DIR.glob("*.json"))),
            "workers_available": len(active_workers),
            "pending_queue_size": len(pending_worker_queue),
        }
    )


@app.route("/worker/poll", methods=["GET"])
def worker_poll():
    """Worker poll endpoint - returns pending videos to process."""
    if not require_auth():
        return jsonify({"error": "Unauthorized"}), 401

    worker_id = request.headers.get("X-Worker-ID", "unknown")
    active_workers[worker_id] = datetime.now()

    to_process = pending_worker_queue[:5]
    to_return = list(to_process)

    # Remove from queue temporarily (will be re-added if upload fails)
    for vid in to_process:
        if vid in pending_worker_queue:
            pending_worker_queue.remove(vid)

    return jsonify({"pending": len(to_return) > 0, "video_ids": to_return})


@app.route("/worker/upload", methods=["POST"])
def worker_upload():
    """Worker upload endpoint - receives processed transcript from worker."""
    if not require_auth():
        return jsonify({"error": "Unauthorized"}), 401

    worker_id = request.headers.get("X-Worker-ID", "unknown")
    active_workers[worker_id] = datetime.now()

    data = request.get_json()
    video_id = data.get("video_id")
    segments = data.get("segments", [])

    if not video_id or not segments:
        return jsonify({"error": "Missing video_id or segments"}), 400

    result = {
        "title": f"Video {video_id}",  # Worker doesn't send title
        "duration": segments[-1]["start"] + segments[-1]["duration"] if segments else 0,
        "language": "en",
        "segments": segments,
        "segment_count": len(segments),
        "available_languages": {"auto": ["en"], "manual": []},
        "_worker_fetched": True,  # Flag indicating this came from a worker
    }

    save_to_cache(video_id, result)

    print(
        f"[{video_id}] Received transcript from worker {worker_id}: {len(segments)} segments"
    )

    return jsonify({"success": True, "cached": True})


@app.route("/transcript/<video_id>", methods=["GET", "POST"])
def get_transcript(video_id):
    """Get transcript for a video."""
    if not require_auth():
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    extracted_id = extract_video_id(video_id)
    if not extracted_id:
        return jsonify({"success": False, "error": "Invalid video ID"}), 400

    video_id = extracted_id

    cached = load_from_cache(video_id)
    if cached:
        print(f"[{video_id}] Cache hit")
        return jsonify(
            {"success": True, "cached": True, "videoId": video_id, **cached}
        ), 200

    print(f"[{video_id}] Cache miss, fetching...")

    if is_worker_available():
        if video_id not in pending_worker_queue:
            add_to_worker_queue(video_id)
            return jsonify(
                {
                    "success": False,
                    "code": "PROCESSING",
                    "error": "Transcript is being processed by worker. Please retry in a few seconds.",
                    "retry_after": 5,
                }
            ), 202
        else:
            return jsonify(
                {
                    "success": False,
                    "code": "PROCESSING",
                    "error": "Transcript is already being processed. Please retry in a few seconds.",
                    "retry_after": 5,
                }
            ), 202

    # No workers available, fetch directly using yt-dlp + proxy
    try:
        result = fetch_transcript(video_id)
    except Exception as e:
        logger.error("ERROR in fetch_transcript: %s", e, exc_info=True)
        return jsonify(
            {
                "success": False,
                "error": f"Internal error: {str(e)}",
                "code": "INTERNAL_ERROR",
            }
        ), 500

    if result.get("success"):
        return jsonify(result), 200
    else:
        error_code = result.get("code", "UNKNOWN")
        status_code = 404 if error_code == "NO_CAPTIONS" else 500
        print(f"Transcript fetch failed: {result}", file=sys.stderr)
        return jsonify(result), status_code


@app.route("/cache/stats", methods=["GET"])
def cache_stats():
    """Get cache statistics."""
    if not require_auth():
        return jsonify({"error": "Unauthorized"}), 401

    cache_files = list(CACHE_DIR.glob("*.json"))
    total_size = sum(f.stat().st_size for f in cache_files)

    stats = {
        "total_files": len(cache_files),
        "total_size_bytes": total_size,
        "total_size_mb": round(total_size / (1024 * 1024), 2),
        "cache_dir": str(CACHE_DIR.absolute()),
    }

    return jsonify(stats)


@app.route("/cache/clear", methods=["POST"])
def cache_clear():
    """Clear all cached transcripts."""
    if not require_auth():
        return jsonify({"error": "Unauthorized"}), 401

    count = 0
    for f in CACHE_DIR.glob("*.json"):
        f.unlink()
        count += 1

    return jsonify({"cleared": count, "message": f"Cleared {count} cached files"})


if __name__ == "__main__":
    print("=" * 50)
    print("YouTube Transcript Service (Tailscale VPS)")
    print("=" * 50)
    print(f"Cache directory: {CACHE_DIR.absolute()}")
    print(f"Proxy: {PROXY_HOST}:{PROXY_PORT}")
    print(f"API Key: {'Set' if API_KEY else 'NOT SET - using default'}")
    print("=" * 50)

    app.run(host="0.0.0.0", port=8766, debug=False)
