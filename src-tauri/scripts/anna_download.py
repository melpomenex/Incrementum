#!/usr/bin/env python3
"""Anna's Archive download helper — Playwright-based.

Downloads a book by MD5 hash from Anna's Archive using headless Chromium
to handle Cloudflare challenges and JavaScript-based download flows.

Adapted from: https://github.com/ALBEDO-TABAI/annas-archive-downloader

Usage:
    python3 anna_download.py --md5 <MD5> --output-dir <PATH> [--format epub] [--timeout 180]

Output (JSON on stdout):
    {"success": true, "file_path": "...", "file_name": "...", "file_size": 1234}
    {"success": false, "error": "...", "error_type": "no_mirrors|cloudflare_blocked|..."}
"""

import argparse
import asyncio
import json
import os
import sys


def output_result(data: dict) -> None:
    print(json.dumps(data))
    sys.stdout.flush()


async def download_book(
    md5: str, output_dir: str, fmt: str, timeout: int, mirrors: list[str]
) -> None:
    try:
        from playwright.async_api import async_playwright
    except ImportError as e:
        print(f"Playwright not available: {e}", file=sys.stderr)
        output_result(
            {
                "success": False,
                "error": "Playwright is not installed. Install with: pip install playwright && playwright install chromium",
                "error_type": "playwright_missing",
            }
        )
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled"],
            )
        except Exception as e:
            output_result(
                {
                    "success": False,
                    "error": f"Failed to launch browser: {e}",
                    "error_type": "browser_error",
                }
            )
            sys.exit(1)

        context = await browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            accept_downloads=True,
        )
        page = await context.new_page()

        try:
            for base_url in mirrors:
                try:
                    result = await _try_download_from_mirror(
                        page, base_url, md5, fmt, output_dir, timeout
                    )
                    if result:
                        await browser.close()
                        output_result(result)
                        return
                except Exception as e:
                    print(f"Mirror {base_url} failed: {e}", file=sys.stderr)
                    continue

            await browser.close()
            output_result(
                {
                    "success": False,
                    "error": "All download mirrors failed",
                    "error_type": "no_mirrors",
                }
            )
            sys.exit(1)
        except Exception as e:
            await browser.close()
            output_result(
                {
                    "success": False,
                    "error": str(e),
                    "error_type": "unknown",
                }
            )
            sys.exit(1)


async def _try_download_from_mirror(
    page, base_url: str, md5: str, fmt: str, output_dir: str, timeout: int
) -> dict | None:
    book_url = f"{base_url}/md5/{md5}"

    try:
        await page.goto(book_url, wait_until="networkidle", timeout=timeout * 1000)
    except OSError:
        # Page navigation failed (timeout or network error)
        content = ""
        try:
            content = await page.content()
        except Exception:
            pass
        if "cloudflare" in content.lower() or "just a moment" in content.lower():
            return {
                "success": False,
                "error": f"Blocked by Cloudflare on {base_url}",
                "error_type": "cloudflare_blocked",
            }
        return None

    await asyncio.sleep(2)

    # Check for Cloudflare challenge page
    page_title = await page.title()
    if "just a moment" in page_title.lower() or "cloudflare" in page_title.lower():
        # Wait for challenge to resolve
        try:
            await page.wait_for_url(f"**/md5/{md5}*", timeout=30000)
            await asyncio.sleep(2)
        except Exception:
            return {
                "success": False,
                "error": f"Cloudflare challenge not resolved on {base_url}",
                "error_type": "cloudflare_blocked",
            }

    # Extract download links
    download_links = await _get_download_links(page)

    if not download_links:
        # Try revealing external mirrors
        try:
            show_btn = await page.wait_for_selector(
                "a.js-show-external-button", timeout=3000
            )
            if show_btn:
                await show_btn.click()
                await asyncio.sleep(1)
                download_links = await _get_download_links(page)
        except Exception:
            # No external mirror button found, not critical
            pass

    # Prioritize: slow download → LibGen external → fast download
    slow_links = [item for item in download_links if item.get("isSlow")]
    external_links = [
        item
        for item in download_links
        if item.get("isExternal") and "libgen" in item.get("href", "").lower()
    ]
    fast_links = [item for item in download_links if item.get("isFast")]

    # Try slow download
    if slow_links:
        result = await _try_slow_download(page, slow_links[0], output_dir, timeout)
        if result:
            return result

    # Try LibGen external
    if external_links:
        result = await _try_external_download(
            page, external_links[0], md5, fmt, output_dir, timeout
        )
        if result:
            return result

    # Try fast download (may require membership)
    if fast_links:
        result = await _try_slow_download(page, fast_links[0], output_dir, timeout)
        if result:
            return result

    return None


async def _get_download_links(page) -> list[dict]:
    return await page.evaluate(
        r"""() => {
            const links = [];
            document.querySelectorAll('a.js-download-link').forEach(a => {
                const href = a.getAttribute('href');
                const text = a.innerText.trim();
                if (href) {
                    links.push({
                        href: href,
                        text: text,
                        isFast: href.includes('/fast_download/'),
                        isSlow: href.includes('/slow_download/'),
                        isExternal: !href.startsWith('/')
                    });
                }
            });
            return links;
        }"""
    )


async def _try_slow_download(
    page, link: dict, output_dir: str, timeout: int
) -> dict | None:
    try:
        btn = await page.query_selector(f'a.js-download-link[href="{link["href"]}"]')
        if not btn:
            return None

        await btn.click()

        # Wait for download page with "Download now" button (up to 60s)
        for attempt in range(12):
            await asyncio.sleep(5)

            try:
                download_btn = await page.query_selector('a:has-text("Download now")')
                if not download_btn:
                    download_btn = await page.query_selector('a:has-text("\U0001f4da")')

                if download_btn:
                    async with page.expect_download(timeout=120000) as download_info:
                        await download_btn.click()

                    download = await download_info.value
                    suggested_name = download.suggested_filename or "book"
                    output_path = os.path.join(output_dir, suggested_name)
                    await download.save_as(output_path)

                    if os.path.exists(output_path):
                        return {
                            "success": True,
                            "file_path": output_path,
                            "file_name": suggested_name,
                            "file_size": os.path.getsize(output_path),
                        }
            except OSError:
                # Download button not found or download failed, try next attempt
                pass

        return None
    except OSError:
        # Unexpected error during slow download attempt
        return None


async def _try_external_download(
    page, link: dict, md5: str, fmt: str, output_dir: str, timeout: int
) -> dict | None:
    try:
        await page.goto(
            link["href"], wait_until="domcontentloaded", timeout=timeout * 1000
        )
        await asyncio.sleep(3)

        # LibGen pages have GET or Download buttons
        get_btn = await page.query_selector('a:has-text("GET"), a:has-text("Download")')
        if not get_btn:
            return None

        async with page.expect_download(timeout=120000) as download_info:
            await get_btn.click()

        download = await download_info.value
        suggested_name = download.suggested_filename or f"{md5}.{fmt}"
        output_path = os.path.join(output_dir, suggested_name)
        await download.save_as(output_path)

        if os.path.exists(output_path):
            return {
                "success": True,
                "file_path": output_path,
                "file_name": suggested_name,
                "file_size": os.path.getsize(output_path),
            }

        return None
    except OSError:
        # Download failed (network error, timeout, or button not found)
        return None


MIRRORS = [
    "https://annas-archive.li",
    "https://annas-archive.gl",
    "https://annas-archive.pk",
    "https://annas-archive.gd",
    "https://annas-archive.pm",
]


def main():
    parser = argparse.ArgumentParser(description="Anna's Archive download helper")
    parser.add_argument("--md5", required=True, help="MD5 hash of the book")
    parser.add_argument(
        "--output-dir", required=True, help="Directory to save the downloaded file"
    )
    parser.add_argument("--format", default="pdf", help="File format (epub, pdf, etc.)")
    parser.add_argument(
        "--timeout",
        type=int,
        default=180,
        help="Timeout in seconds for page loads",
    )
    parser.add_argument("--mirror", default=None, help="Specific mirror URL to use")
    args = parser.parse_args()

    mirrors = [args.mirror] if args.mirror else MIRRORS
    asyncio.run(
        download_book(args.md5, args.output_dir, args.format, args.timeout, mirrors)
    )


if __name__ == "__main__":
    main()
