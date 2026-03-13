"""
Vercel Serverless Function for fetching YouTube transcripts using yt-dlp
"""
import os
import sys
import json
import re
from http.server import BaseHTTPRequestHandler

# Debug: Log Python version only (avoid leaking secrets)
if os.environ.get('YT_DEBUG') == '1':
    print(f"[yt-dlp DEBUG] Python version: {sys.version}", file=sys.stderr)

DEBUG_YT = os.environ.get('YT_DEBUG') == '1'

# yt-dlp removed to reduce bundle size
# Using direct transcript fetching methods instead
YT_DLP_AVAILABLE = False


# =============================================================================
# VPS SERVICE INTEGRATION
# =============================================================================
VPS_SERVICE_URL = os.environ.get('VPS_TRANSCRIPT_URL', '')
VPS_API_KEY = os.environ.get('VPS_TRANSCRIPT_API_KEY', '')

def fetch_from_vps_service(video_id):
    """Fetch transcript from VPS service (via Tailscale)."""
    if not VPS_SERVICE_URL or not VPS_API_KEY:
        print("[VPS] Not configured - skipping", file=sys.stderr)
        return None

    from urllib.request import Request, urlopen

    # Strip trailing slash from base URL to avoid double slashes
    base_url = VPS_SERVICE_URL.rstrip('/')
    service_url = f"{base_url}/transcript/{video_id}"
    print(f"[VPS] Fetching from: {service_url}", file=sys.stderr)

    try:
        req = Request(service_url)
        req.add_header('X-API-Key', VPS_API_KEY)
        req.add_header('User-Agent', 'Incrementum/1.0')

        response = urlopen(req, timeout=15)

        if response.status == 200:
            data = json.loads(response.read().decode('utf-8'))
            print(f"[VPS] Success: cached={data.get('cached')}, segments={data.get('segment_count')}", file=sys.stderr)
            return data
        else:
            print(f"[VPS] HTTP {response.status}: {response.read().decode('utf-8')[:200]}", file=sys.stderr)
            return None

    except Exception as e:
        print(f"[VPS] Error: {e}", file=sys.stderr)
        return None


def get_proxy_url():
    """Get proxy URL from environment variables"""
    # Check both possible variable names
    decodo = os.environ.get('DECODO_PROXY_URL')
    residential = os.environ.get('RESIDENTIAL_PROXY_URL')
    
    if DEBUG_YT:
        print(f"[yt-dlp DEBUG] DECODO_PROXY_URL: {'SET' if decodo else 'NOT SET'}", file=sys.stderr)
        print(f"[yt-dlp DEBUG] RESIDENTIAL_PROXY_URL: {'SET' if residential else 'NOT SET'}", file=sys.stderr)
    
    return decodo or residential


def extract_video_id(url):
    """Extract video ID from YouTube URL"""
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com/embed/([a-zA-Z0-9_-]{11})',
        r'youtube\.com/v/([a-zA-Z0-9_-]{11})',
        r'youtube\.com/shorts/([a-zA-Z0-9_-]{11})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None


def parse_vtt(content):
    """Parse WebVTT content to segments"""
    segments = []
    cur_start, cur_end, cur_text = 0, 0, ''
    
    for line in content.split('\n'):
        line = line.strip()
        if not line or line == 'WEBVTT' or line.startswith('NOTE'):
            continue
        
        match = re.match(r'(?:(\d{2}):)?(\d{2}):(\d{2}\.\d{3})\s+-->\s+(?:(\d{2}):)?(\d{2}):(\d{2}\.\d{3})', line)
        if match:
            if cur_text and (not segments or cur_text != segments[-1]['text']):
                segments.append({
                    'text': cur_text.strip(),
                    'start': cur_start,
                    'duration': cur_end - cur_start
                })

            cur_start = _parse_vtt_timestamp(match.group(1), match.group(2), match.group(3))
            cur_end = _parse_vtt_timestamp(match.group(4), match.group(5), match.group(6))
            cur_text = ''
        elif line:
            txt = re.sub(r'<[^>]+>', '', line)
            cur_text += ' ' + txt if cur_text else txt
    
    if cur_text and (not segments or cur_text != segments[-1]['text']):
        segments.append({
            'text': cur_text.strip(),
            'start': cur_start,
            'duration': cur_end - cur_start
        })
    
    return segments


def _format_cookie_header(cookies):
    """Format cookies for Cookie header"""
    if not cookies:
        env_cookie = os.environ.get('YOUTUBE_COOKIES') or os.environ.get('YOUTUBE_COOKIE')
        if env_cookie:
            cookies = env_cookie
    if not cookies:
        return None
    if isinstance(cookies, str):
        return ' '.join(cookies.split())
    if isinstance(cookies, dict):
        return '; '.join(f"{k}={v}" for k, v in cookies.items())
    if isinstance(cookies, list):
        parts = []
        for c in cookies:
            if isinstance(c, dict) and c.get('name') and c.get('value') is not None:
                parts.append(f"{c['name']}={c['value']}")
        return '; '.join(parts) if parts else None
    return None


def fetch_transcript_direct(video_id, proxy=None, cookies_header=None):
    """Fetch transcript directly from YouTube's timedtext API (lighter than yt-dlp)"""
    from urllib.request import Request, urlopen, ProxyHandler, build_opener
    from urllib.error import HTTPError
    import html
    
    # Try to get the video page to extract caption tracks
    video_url = f'https://www.youtube.com/watch?v={video_id}'
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    if cookies_header:
        headers['Cookie'] = cookies_header
    
    req = Request(video_url, headers=headers)
    
    try:
        if proxy:
            proxy_handler = ProxyHandler({'http': proxy, 'https': proxy})
            opener = build_opener(proxy_handler)
            response = opener.open(req, timeout=20)
        else:
            response = urlopen(req, timeout=10)
        
        html_content = response.read().decode('utf-8')
    except HTTPError as e:
        if e.code == 429:
            raise Exception('Rate limited by YouTube')
        raise
    
    # Check for bot detection / consent
    if 'Sign in to confirm' in html_content:
        raise Exception('Sign in to confirm you\'re not a bot')
    if 'consent.youtube.com' in html_content or 'Before you continue to YouTube' in html_content:
        raise Exception('YouTube consent required')
    
    # Extract caption tracks from ytInitialPlayerResponse
    import re
    match = re.search(r'ytInitialPlayerResponse\s*=\s*({.+?});', html_content)
    if not match:
        raise Exception('Could not find player response')
    
    player_response = json.loads(match.group(1))
    caption_tracks = player_response.get('captions', {}).get('captionTracks', [])
    
    if not caption_tracks:
        raise Exception('No captions available')
    
    # Find English track
    track = None
    for t in caption_tracks:
        lang = t.get('languageCode', '')
        if lang.startswith('en'):
            track = t
            break
    
    if not track:
        track = caption_tracks[0]  # Use first available
    
    # Fetch transcript XML
    base_url = track['baseUrl']
    transcript_url = base_url + '&fmt=json3'  # Get JSON format
    
    req = Request(transcript_url, headers=headers)
    if proxy:
        response = opener.open(req, timeout=20)
    else:
        response = urlopen(req, timeout=10)
    
    data = json.loads(response.read().decode('utf-8'))
    
    # Parse segments
    segments = []
    for event in data.get('events', []):
        if 'segs' not in event:
            continue
        
        start = event.get('tStartMs', 0) / 1000.0
        duration = event.get('dDurationMs', 0) / 1000.0
        
        text = ''.join(seg.get('utf8', '') for seg in event['segs'])
        text = html.unescape(text).strip()
        
        if text:
            segments.append({
                'text': text,
                'start': start,
                'duration': duration
            })

    if not segments:
        raise Exception('No transcript segments found')
    
    if not segments:
        raise Exception('No transcript segments found')

    return {
        'segments': segments,
        'language': track.get('languageCode', 'en'),
        'title': player_response.get('videoDetails', {}).get('title'),
        'duration': player_response.get('videoDetails', {}).get('lengthSeconds')
    }

def fetch_transcript(video_id, cookies_header=None):
    """Fetch transcript using multiple methods"""
    proxy = get_proxy_url()
    force_proxy = os.environ.get('YT_FORCE_PROXY') == '1'

    print(f"[yt-dlp] Config: proxy={'yes' if proxy else 'no'}, cookies={'yes' if cookies_header else 'no'}, force_proxy={force_proxy}", file=sys.stderr)

    bot_detected = False
    
    # Method 1: Direct API (fastest) - skip if force_proxy is set
    if not force_proxy:
        print(f"[yt-dlp] Method 1: Direct API (no proxy)", file=sys.stderr)
        try:
            return fetch_transcript_direct(video_id, proxy=None, cookies_header=cookies_header)
        except Exception as e:
            error = str(e)
            print(f"[yt-dlp] Method 1 failed: {error[:80]}", file=sys.stderr)
            bot_detected = 'bot' in error.lower() or 'sign in' in error.lower()
    else:
        print(f"[yt-dlp] Skipping Method 1 (force_proxy=1)", file=sys.stderr)
        bot_detected = True  # Assume we need proxy
    
    # Method 2: Direct API with proxy (if bot detected or force_proxy)
    if proxy and bot_detected:
        print(f"[yt-dlp] Method 2: Direct API with proxy", file=sys.stderr)
        try:
            return fetch_transcript_direct(video_id, proxy=proxy, cookies_header=cookies_header)
        except Exception as e2:
            print(f"[yt-dlp] Method 2 failed: {str(e2)[:80]}", file=sys.stderr)
    elif not proxy and bot_detected:
        print(f"[yt-dlp] Method 2 skipped: No proxy configured", file=sys.stderr)
    
    # Method 3 removed - was using yt-dlp which is too large for Vercel
    print(f"[yt-dlp] All methods failed", file=sys.stderr)
    raise Exception("All transcript fetch methods failed. Try with cookies or proxy.")


class handler(BaseHTTPRequestHandler):
    """Vercel Python serverless function handler"""
    
    def log_message(self, format, *args):
        print(f"[API] {format % args}", file=sys.stderr)
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def send_json(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def do_GET(self):
        from urllib.parse import urlparse, parse_qs
        
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        
        self._handle_request(query, None)
    
    def do_POST(self):
        from urllib.parse import urlparse, parse_qs

        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else b''
        cookies = None
        if body:
            try:
                payload = json.loads(body.decode('utf-8'))
                cookies = payload.get('cookies') or payload.get('cookie')
            except Exception as e:
                print(f"[API] Failed to parse JSON body: {e}", file=sys.stderr)

        self._handle_request(query, cookies)

    def _handle_request(self, query, cookies):
        # Health check
        if query.get('status', [''])[0] == 'true':
            proxy = get_proxy_url()
            cookies_header = _format_cookie_header(cookies)
            self.send_json(200, {
                'success': True,
                'proxy_configured': bool(proxy),
                'proxy_preview': proxy[:30] + '...' if proxy else None,
                'cookies_received': bool(cookies_header),
                'vps_service': {
                    'configured': bool(VPS_SERVICE_URL and VPS_API_KEY),
                    'url': VPS_SERVICE_URL if VPS_SERVICE_URL else None
                }
            })
            return

        # Get video ID
        video_id = query.get('videoId', [''])[0]
        url = query.get('url', [''])[0]
        
        if not video_id and url:
            video_id = extract_video_id(url)
        
        if not video_id:
            self.send_json(400, {'success': False, 'error': 'Missing videoId'})
            return
        
        # Fetch transcript
        try:
            cookies_header = _format_cookie_header(cookies)

            # TRY VPS SERVICE FIRST (via Tailscale)
            vps_result = fetch_from_vps_service(video_id)
            if vps_result and vps_result.get('success'):
                # Return VPS result with segment format matching local fetch
                self.send_json(200, {
                    'success': True,
                    'videoId': video_id,
                    'segments': vps_result.get('segments', []),
                    'language': vps_result.get('language', 'en'),
                    'title': vps_result.get('title'),
                    'duration': vps_result.get('duration')
                })
                return

            # FALLBACK: Local fetch methods
            print("[VPS] Failed or not configured, trying local methods...", file=sys.stderr)
            result = fetch_transcript(video_id, cookies_header=cookies_header)
            if not result.get('segments'):
                raise Exception('No transcript segments found')
            self.send_json(200, {
                'success': True,
                'videoId': video_id,
                'segments': result['segments'],
                'language': result['language'],
                'title': result.get('title'),
                'duration': result.get('duration')
            })
        except Exception as e:
            print(f"[yt-dlp] Error: {e}", file=sys.stderr)
            error = str(e)
            
            if 'Sign in to confirm' in error:
                self.send_json(503, {
                    'success': False,
                    'error': 'YouTube bot detection - proxy may not be working',
                    'code': 'YOUTUBE_BOT_DETECTED',
                    'proxy_was_configured': bool(get_proxy_url())
                })
            elif 'consent' in error.lower():
                self.send_json(503, {
                    'success': False,
                    'error': 'YouTube requires consent; cookies are needed',
                    'code': 'YOUTUBE_CONSENT_REQUIRED',
                    'proxy_was_configured': bool(get_proxy_url())
                })
            elif 'No captions' in error:
                self.send_json(404, {'success': False, 'error': error, 'code': 'NO_CAPTIONS'})
            else:
                self.send_json(500, {'success': False, 'error': error})
