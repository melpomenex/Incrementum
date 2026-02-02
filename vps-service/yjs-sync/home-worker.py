#!/usr/bin/env python3
"""
Home Transcript Worker - Runs on Mac mini
Fetches transcripts from YouTube and sends to VPS via Tailscale
"""

import os
import sys
import json
import time
import requests
from pathlib import Path

# =============================================================================
# CONFIGURATION
# =============================================================================
VPS_URL = os.environ.get("VPS_URL", "http://100.103.106.125:8766")
VPS_API_KEY = os.environ.get("VPS_API_KEY", "change-me-in-production")
WORKER_ID = os.environ.get("WORKER_ID", "mac-mini-1")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "5"))  # seconds

# =============================================================================
# WORK QUEUE
# =============================================================================
WORK_QUEUE_FILE = Path.home() / ".transcript_queue.json"


def load_queue():
    """Load work queue from disk."""
    if WORK_QUEUE_FILE.exists():
        try:
            with open(WORK_QUEUE_FILE, 'r') as f:
                return json.load(f)
        except:
            return []
    return []


def save_queue(queue):
    """Save work queue to disk."""
    with open(WORK_QUEUE_FILE, 'w') as f:
        json.dump(queue, f)


def add_to_queue(video_id):
    """Add a video to the work queue."""
    queue = load_queue()
    if video_id not in queue:
        queue.append(video_id)
        save_queue(queue)
        print(f"[{WORKER_ID}] Added {video_id} to queue")
        return True
    return False


def remove_from_queue(video_id):
    """Remove a video from the work queue."""
    queue = load_queue()
    if video_id in queue:
        queue.remove(video_id)
        save_queue(queue)


# =============================================================================
# TRANSCRIPT FETCHING
# =============================================================================
def fetch_transcript_direct(video_id):
    """Fetch transcript using yt-dlp directly."""
    import subprocess

    video_url = f'https://www.youtube.com/watch?v={video_id}'

    cmd = [
        'yt-dlp',
        '--write-subs',
        '--write-auto-subs',
        '--sub-langs', 'en',
        '--sub-format', 'vtt',
        '--skip-download',
        '--output', f'{video_id}.%(ext)s',
        '--no-playlist',
        video_url
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
            cwd='/tmp'
        )

        if result.returncode != 0:
            error = result.stderr.strip()
            if error:
                return None, f"yt-dlp error: {error[:200]}"
            return None, "yt-dlp failed"

        # Find the downloaded VTT file
        import re
        vtt_file = None
        for f in Path('/tmp').glob(f'{video_id}*.vtt'):
            vtt_file = f
            break

        if not vtt_file:
            return None, "No VTT file found"

        # Read VTT content
        with open(vtt_file, 'r', encoding='utf-8') as f:
            vtt_content = f.read()

        # Clean up
        vtt_file.unlink()
        for f in Path('/tmp').glob(f'{video_id}*'):
            try:
                f.unlink()
            except:
                pass

        return vtt_content, None

    except subprocess.TimeoutExpired:
        return None, "Download timed out"
    except Exception as e:
        return None, str(e)


def parse_vtt_to_segments(vtt_content):
    """Parse VTT content to transcript segments."""
    import re

    segments = []
    lines = vtt_content.split('\n')

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if '-->' in line:
            try:
                parts = line.split('-->')
                start_str = parts[0].strip()
                end_str = parts[1].strip().split()[0]

                start_parts = start_str.split(':')
                if len(start_parts) == 3:
                    start = int(start_parts[0]) * 3600 + int(start_parts[1]) * 60 + float(start_parts[2])
                else:
                    start = int(start_parts[0]) * 60 + float(start_parts[1])

                end_parts = end_str.split(':')
                if len(end_parts) == 3:
                    end = int(end_parts[0]) * 3600 + int(end_parts[1]) * 60 + float(end_parts[2])
                else:
                    end = int(end_parts[0]) * 60 + float(end_parts[1])

                i += 1
                text_lines = []
                while i < len(lines) and '-->' not in lines[i]:
                    text_line = lines[i].strip()
                    text_line = re.sub(r'<[^>]+>', '', text_line)
                    text_line = re.sub(r'^\d+\s*', '', text_line)
                    if text_line:
                        text_lines.append(text_line)
                    i += 1

                text = ' '.join(text_lines).strip()

                if text:
                    segments.append({
                        'start': round(start, 3),
                        'duration': round(end - start, 3),
                        'text': text
                    })

            except Exception as e:
                print(f"[{WORKER_ID}] Warning: Failed to parse timestamp: {line}")

        i += 1

    return segments


# =============================================================================
# VPS COMMUNICATION
# =============================================================================
def send_transcript_to_vps(video_id, segments):
    """Send fetched transcript to VPS."""
    url = f"{VPS_URL}/worker/upload"
    headers = {"X-API-Key": VPS_API_KEY, "X-Worker-ID": WORKER_ID}

    payload = {
        'worker_id': WORKER_ID,
        'video_id': video_id,
        'segments': segments,
        'segment_count': len(segments)
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        if response.status_code == 200:
            print(f"[{WORKER_ID}] Successfully sent transcript for {video_id} to VPS")
            return True
        else:
            print(f"[{WORKER_ID}] Failed to send to VPS: {response.status_code} {response.text}")
            return False
    except Exception as e:
        print(f"[{WORKER_ID}] Error sending to VPS: {e}")
        return False


def poll_vps_for_work():
    """Poll VPS for pending transcript requests."""
    url = f"{VPS_URL}/worker/poll"
    headers = {"X-API-Key": VPS_API_KEY, "X-Worker-ID": WORKER_ID}

    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('pending'):
                return data.get('video_ids', [])
        return []
    except Exception as e:
        print(f"[{WORKER_ID}] Error polling VPS: {e}")
        return []


# =============================================================================
# MAIN LOOP
# =============================================================================
def process_video(video_id):
    """Process a single video."""
    print(f"[{WORKER_ID}] Processing {video_id}...")

    # Fetch transcript
    vtt_content, error = fetch_transcript_direct(video_id)
    if not vtt_content:
        print(f"[{WORKER_ID}] Failed to fetch {video_id}: {error}")
        return False

    # Parse to segments
    segments = parse_vtt_to_segments(vtt_content)
    if not segments:
        print(f"[{WORKER_ID}] No segments found for {video_id}")
        return False

    print(f"[{WORKER_ID}] Parsed {len(segments)} segments from {video_id}")

    # Send to VPS
    success = send_transcript_to_vps(video_id, segments)
    if success:
        remove_from_queue(video_id)
    return success


def main():
    """Main worker loop."""
    print(f"[{WORKER_ID}] Home Transcript Worker Starting")
    print(f"[{WORKER_ID}] VPS URL: {VPS_URL}")
    print(f"[{WORKER_ID}] Poll interval: {POLL_INTERVAL}s")
    print("=" * 50)

    # Check dependencies
    try:
        subprocess.run(['yt-dlp', '--version'], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("ERROR: yt-dlp not found. Install with: brew install yt-dlp")
        sys.exit(1)

    while True:
        try:
            # Poll VPS for work
            pending = poll_vps_for_work()

            # Also check local queue
            queue = load_queue()
            all_work = list(set(pending + queue))

            if all_work:
                print(f"[{WORKER_ID}] Found {len(all_work)} videos to process")

                for video_id in all_work[:5]:  # Process up to 5 at a time
                    process_video(video_id)
                    time.sleep(1)  # Small delay between videos
            else:
                print(f"[{WORKER_ID}] No work, sleeping...")

        except KeyboardInterrupt:
            print(f"[{WORKER_ID}] Shutting down...")
            break
        except Exception as e:
            print(f"[{WORKER_ID}] Error in main loop: {e}")

        time.sleep(POLL_INTERVAL)


if __name__ == '__main__':
    import subprocess
    main()
