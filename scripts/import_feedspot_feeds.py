#!/usr/bin/env python3
"""
Fetch public Feedspot category pages, extract feed URLs, dedupe against the
existing curated Rust list, and write generated JSON for the Tauri backend.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
CURATED_RS = ROOT / "src-tauri" / "src" / "commands" / "curated_feeds.rs"
OUTPUT_JSON = ROOT / "src-tauri" / "src" / "commands" / "generated" / "feedspot_curated_feeds.json"
OUTPUT_REPORT = ROOT / "src-tauri" / "src" / "commands" / "generated" / "feedspot_curated_feeds_report.json"
DIRECTORY_URL = "https://rss.feedspot.com/rss_directory/"
USER_AGENT = "IncrementumFeedImporter/1.0 (+https://github.com/melpomenex/incrementum-tauri)"

TARGET_CATEGORIES = [
    "Artificial Intelligence RSS Feeds",
    "Data Science RSS Feeds",
    "Science RSS Feeds",
    "Technology News RSS Feeds",
    "Software Development RSS Feeds",
    "Programming RSS Feeds",
    "Web Development RSS Feeds",
    "Information Security RSS Feeds",
    "SAAS RSS Feeds",
    "Political RSS Feeds",
    "Economics RSS Feeds",
    "Personal Finance RSS Feeds",
    "Travel RSS Feeds",
    "Photography RSS Feeds",
    "Food RSS Feeds",
]

CATEGORY_ALIASES = {
    "Artificial Intelligence RSS Feeds": "AI",
    "Data Science RSS Feeds": "AI",
    "Science RSS Feeds": "Science",
    "Technology News RSS Feeds": "Tech",
    "Software Development RSS Feeds": "Programming",
    "Programming RSS Feeds": "Programming",
    "Web Development RSS Feeds": "Programming",
    "Information Security RSS Feeds": "Security",
    "SAAS RSS Feeds": "Startups",
    "Political RSS Feeds": "Politics",
    "Economics RSS Feeds": "Business & Finance",
    "Personal Finance RSS Feeds": "Personal Finance",
    "Travel RSS Feeds": "Travel",
    "Photography RSS Feeds": "Photography",
    "Food RSS Feeds": "Food",
}

FALLBACK_CATEGORY_URLS = {
    "Artificial Intelligence RSS Feeds": "https://rss.feedspot.com/ai_rss_feeds/",
    "Data Science RSS Feeds": "https://rss.feedspot.com/data_science_rss_feeds/",
    "Science RSS Feeds": "https://rss.feedspot.com/science_rss_feeds/",
    "Technology News RSS Feeds": "https://rss.feedspot.com/tech_news_rss_feeds/",
    "Software Development RSS Feeds": "https://rss.feedspot.com/software_development_rss_feeds/",
    "Programming RSS Feeds": "https://rss.feedspot.com/programming_rss_feeds/",
    "Web Development RSS Feeds": "https://rss.feedspot.com/web_development_rss_feeds/",
    "Information Security RSS Feeds": "https://rss.feedspot.com/information_security_rss_feeds/",
    "SAAS RSS Feeds": "https://rss.feedspot.com/saas_rss_feeds/",
    "Political RSS Feeds": "https://rss.feedspot.com/political_rss_feeds/",
    "Economics RSS Feeds": "https://rss.feedspot.com/economics_rss_feeds/",
    "Personal Finance RSS Feeds": "https://rss.feedspot.com/personal_finance_rss_feeds/",
    "Travel RSS Feeds": "https://rss.feedspot.com/travel_rss_feeds/",
    "Photography RSS Feeds": "https://rss.feedspot.com/photography_rss_feeds/",
    "Food RSS Feeds": "https://rss.feedspot.com/food_rss_feeds/",
}

LOW_QUALITY_HOSTS = {
    "blogspot.com",
    "wordpress.com",
    "wixsite.com",
    "blogger.com",
}

LOW_QUALITY_TITLE_PREFIXES = (":", "-", "|")

LOW_QUALITY_TITLE_PATTERNS = [
    re.compile(r"web development,\s*mobile app development", re.I),
    re.compile(r"\byour tutor friend\b", re.I),
]

SERVICE_BLOG_PATTERNS = [
    re.compile(r"\b(app|web|software|digital|seo|marketing|development|devops|consulting|outsourcing)\b", re.I),
    re.compile(r"\b(technologies|solutions|labs|infotech|agency|soft|apps|systems|crm)\b", re.I),
]

TRUSTED_DOMAIN_HINTS = [
    "edu",
    "gov",
    "npr.org",
    "nytimes.com",
    "ft.com",
    "theguardian.com",
    "arstechnica.com",
    "berkeley.edu",
    "mit.edu",
    "googleblog.com",
    "research.google",
    "aws.amazon.com",
    "kaggle.com",
    "databricks.com",
    "economist.com",
    "sciencenews.org",
]

QUALITY_ALLOWLIST = {
    "gregmankiw.blogspot.com",
    "statmodeling.stat.columbia.edu",
    "buzzmachine.com",
    "crooksandliars.com",
    "hanselman.com",
    "simonwillison.net",
    "bair.berkeley.edu",
    "research.google",
    "developers.googleblog.com",
    "security.googleblog.com",
    "martinfowler.com",
    "kentcdodds.com",
    "stefanjudis.com",
    "johndcook.com",
}

CATEGORY_MIN_SCORE = {
    "Programming": 2,
    "Tech": 2,
    "Startups": 2,
    "Science": 2,
    "AI": 2,
    "Security": 2,
    "Politics": 1,
    "Business & Finance": 2,
    "Personal Finance": 1,
    "Travel": 1,
    "Photography": 1,
    "Food": 1,
}

CATEGORY_DENY_HOSTS = {
    "Programming": {
        "appverticals.com",
        "blog.bootsgrid.com",
        "brsoftech.com",
        "captivix.com",
        "cmsminds.com",
        "esferasoft.com",
        "globetechsoft.com",
        "inventcolabssoftware.com",
        "krishangtechnolab.com",
        "prisomtechnology.com",
        "richestsoft.com",
        "ripenapps.com",
        "yesitlabs.com",
        "zenesys.com",
        "zobiwebsolutions.com",
        "sphinx-solution.com",
        "semidotinfotech.com",
        "star-knowledge.com",
        "sataware.com",
        "netmaxims.com",
        "newtum.com",
        "inexture.com",
        "ibiixo.com",
        "vapediabox.com",
        "vamediabox.com",
        "uplogictech.com",
        "techcronus.com",
        "mindk.com",
        "cmolds.com",
        "c-metric.com",
        "brickweb.co.uk",
        "botreetechnologies.com",
        "asperbrothers.com",
        "archerimagine.com",
        "allinonecluster.com",
        "algoberry.com",
        "abundantcode.com",
        "storyofprogrammer.com",
    },
    "Tech": {
        "developer-tech.com",
        "digitechbytes.com",
        "flipshope.com",
        "gadgetsinnepal.com.np",
        "insiderpaper.com",
        "latesttechno.in",
        "newskart.com",
        "techfeeddata.com",
        "technologydrift.com",
        "chinatechnews.com",
        "futurefive.co.nz",
        "naval-technology.com",
    },
    "Startups": {
        "blogsaas.com",
        "cloudkettle.com",
        "growfusely.com",
        "inturact.com",
        "kunocreative.com",
        "newbreedrevenue.com",
        "poweredbysearch.com",
        "predictablerevenue.com",
        "blog.saasholic.com",
        "saasmetrics.co",
        "sutisoft.com",
        "workwithagility.com",
        "cardinpartners.com",
        "encharge.io",
        "howtobuysaas.com",
        "insidesales.com",
    },
    "Science": {
        "worldofweirdthings.com",
        "express.co.uk",
        "dailymail.co.uk",
        "evincism.com",
        "gbnews.com",
        "dnatured.com",
        "aracnidotaxonomy.com",
        "civicsciencemedia.org",
    },
    "AI": {
        "1reddrop.com",
        "aicorr.com",
        "anyinstructor.com",
        "artisse.ai",
        "algobeans.com",
        "anotherdatum.com",
        "nyheter.aitool.se",
        "airevolution.blog",
    },
    "Politics": {
        "altondrewtrades.blog",
        "borntorunthenumbers.com",
        "commentsonnationalamnesia.net",
        "flaming-liberal.com",
        "garyhasissues.com",
        "politic-ed.com",
    },
}


def fetch(url: str, *, delay: float) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Failed to fetch {url}: {exc}") from exc
    time.sleep(delay)
    return body


def normalize_url(url: str) -> str:
    return url.strip().rstrip("/").lower()


def clean_text(value: str) -> str:
    value = html.unescape(value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def get_hostname(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.netloc or parsed.path.split("/")[0]
    return host.lower().replace("www.", "")


def clean_title(title: str) -> str:
    title = re.sub(r"\s+RSS Feed$", "", title, flags=re.I).strip()
    title = re.sub(r"\s+Blog$", "", title, flags=re.I).strip()
    title = re.sub(r"\s+", " ", title)
    return title


def quality_score(entry: dict[str, str]) -> tuple[int, list[str]]:
    title = entry["title"]
    site_host = get_hostname(entry["site_url"])
    category = entry["category"]
    score = 0
    reasons: list[str] = []

    if site_host in QUALITY_ALLOWLIST:
        score += 4
        reasons.append("allowlist")

    if entry["site_url"].startswith("https://") and entry["feed_url"].startswith(("https://", "http://")):
        score += 1
        reasons.append("valid_urls")

    if entry["category"] in {"Politics", "Science", "AI", "Security", "Business & Finance"}:
        score += 1
        reasons.append("priority_category")

    if any(hint in site_host for hint in TRUSTED_DOMAIN_HINTS):
        score += 3
        reasons.append("trusted_domain")

    if len(title) >= 8 and not any(title.startswith(prefix) for prefix in LOW_QUALITY_TITLE_PREFIXES):
        score += 1
        reasons.append("clean_title")

    if any(site_host == host or site_host.endswith(f".{host}") for host in LOW_QUALITY_HOSTS):
        score -= 4
        reasons.append("hosted_blog")

    denied_hosts = CATEGORY_DENY_HOSTS.get(category, set())
    if site_host in denied_hosts:
        score -= 5
        reasons.append("category_deny_host")

    if any(pattern.search(title) for pattern in LOW_QUALITY_TITLE_PATTERNS):
        score -= 4
        reasons.append("bad_title_pattern")

    if "|" in title or title.count(",") >= 2:
        score -= 2
        reasons.append("noisy_title")

    if entry["category"] in {"Programming", "Startups", "Tech"} and any(
        pattern.search(title) or pattern.search(site_host.replace("-", " "))
        for pattern in SERVICE_BLOG_PATTERNS
    ):
        score -= 3
        reasons.append("service_vendor_blog")

    if site_host.count("-") >= 2:
        score -= 1
        reasons.append("hyphenated_domain")

    return score, reasons


def parse_existing_feeds() -> tuple[set[str], set[str]]:
    content = CURATED_RS.read_text()
    entries = re.findall(
        r'cf\("(?P<title>(?:[^"\\]|\\.)*)",\s*"(?P<feed>(?:[^"\\]|\\.)*)",\s*"(?P<site>(?:[^"\\]|\\.)*)",\s*"(?P<category>(?:[^"\\]|\\.)*)"\)',
        content,
    )
    existing_feed_urls = set()
    existing_site_urls = set()
    for _title, feed_url, site_url, _category in entries:
        existing_feed_urls.add(normalize_url(feed_url))
        existing_site_urls.add(normalize_url(site_url))
    return existing_feed_urls, existing_site_urls


def discover_category_urls(directory_html: str) -> dict[str, str]:
    discovered = {}
    for href, label in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>([^<]+RSS Feeds)</a>', directory_html, flags=re.I):
        label = clean_text(label)
        if label in TARGET_CATEGORIES:
            if href.startswith("/"):
                href = f"https://rss.feedspot.com{href}"
            discovered[label] = href
    return discovered


def extract_entries(page_html: str, source_category: str) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    pattern = re.compile(
        r'<h3[^>]*class="[^"]*feed_heading[^"]*"[^>]*>(?P<title>.*?)</h3>\s*<p[^>]*class="[^"]*trow[^"]*"[^>]*>(?P<body>.*?)</p>',
        flags=re.I | re.S,
    )
    for match in pattern.finditer(page_html):
        title_html = match.group("title")
        title_link = re.search(r'<a[^>]*>(?P<title>.*?)</a>', title_html, flags=re.I | re.S)
        title = clean_text(title_link.group("title") if title_link else title_html)
        body = match.group("body")

        feed_match = re.search(
            r'<strong>\s*RSS Feed\s*</strong>\s*<a[^>]+href="(?P<feed>https?://[^"]+)"',
            body,
            flags=re.I | re.S,
        )
        site_match = re.search(
            r'<strong>\s*(?:RSS )?Website\s*</strong>\s*<a[^>]+href="(?P<site>https?://[^"]+)"',
            body,
            flags=re.I | re.S,
        )

        if not title or not feed_match or not site_match:
            continue

        description_match = re.search(
            r'</a>\s*(?P<description>.*?)(?:Export RSS feeds list|Get access to|Email us|<h3|$)',
            body,
            flags=re.I | re.S,
        )

        entries.append(
            {
                "title": title.replace(" RSS Feed", "").strip(),
                "feed_url": clean_text(feed_match.group("feed")),
                "site_url": clean_text(site_match.group("site")),
                "category": CATEGORY_ALIASES.get(source_category, source_category.replace(" RSS Feeds", "")),
                "source_category": source_category,
                "description": clean_text(description_match.group("description")) if description_match else "",
            }
        )
    return entries


def dedupe_entries(
    entries: list[dict[str, str]],
    existing_feed_urls: set[str],
    existing_site_urls: set[str],
) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    deduped = []
    dropped = []
    seen_local = set()
    for entry in entries:
        entry = dict(entry)
        entry["title"] = clean_title(entry["title"])
        feed_key = normalize_url(entry["feed_url"])
        site_key = normalize_url(entry["site_url"])
        if not feed_key or not site_key:
            continue
        if feed_key in existing_feed_urls or site_key in existing_site_urls:
            continue
        if (feed_key, site_key) in seen_local:
            continue
        score, reasons = quality_score(entry)
        min_score = CATEGORY_MIN_SCORE.get(entry["category"], 1)
        if score < min_score:
            dropped.append({
                "title": entry["title"],
                "feed_url": entry["feed_url"],
                "site_url": entry["site_url"],
                "category": entry["category"],
                "source_category": entry["source_category"],
                "score": score,
                "min_score": min_score,
                "reasons": reasons,
            })
            continue
        seen_local.add((feed_key, site_key))
        deduped.append(
            {
                "title": entry["title"],
                "feed_url": entry["feed_url"],
                "site_url": entry["site_url"],
                "category": entry["category"],
                "source_category": entry["source_category"],
                "_quality_score": score,
            }
        )
    return deduped, dropped


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--delay", type=float, default=1.0, help="Delay between requests in seconds")
    parser.add_argument("--limit-per-category", type=int, default=40, help="Cap imported entries per category")
    args = parser.parse_args()

    existing_feed_urls, existing_site_urls = parse_existing_feeds()
    directory_html = fetch(DIRECTORY_URL, delay=args.delay)
    category_urls = discover_category_urls(directory_html)

    for category, url in FALLBACK_CATEGORY_URLS.items():
        category_urls.setdefault(category, url)

    missing = [category for category in TARGET_CATEGORIES if category not in category_urls]
    if missing:
        print("Missing Feedspot categories:", ", ".join(missing), file=sys.stderr)

    imported_entries: list[dict[str, str]] = []
    dropped_entries: list[dict[str, str]] = []
    report: dict[str, object] = {
        "directory_url": DIRECTORY_URL,
        "target_categories": TARGET_CATEGORIES,
        "resolved_categories": category_urls,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "counts": {},
    }

    for category in TARGET_CATEGORIES:
        url = category_urls.get(category)
        if not url:
            continue
        try:
            page_html = fetch(url, delay=args.delay)
        except RuntimeError as exc:
            report["counts"][category] = {
                "url": url,
                "error": str(exc),
                "extracted": 0,
                "imported": 0,
            }
            continue
        extracted = extract_entries(page_html, category)
        deduped, dropped = dedupe_entries(extracted, existing_feed_urls, existing_site_urls)
        deduped.sort(key=lambda item: (-item["_quality_score"], item["title"].lower()))
        limited = deduped[: args.limit_per_category]
        dropped_entries.extend(dropped)

        imported_entries.extend(limited)
        report["counts"][category] = {
            "url": url,
            "extracted": len(extracted),
            "passed_quality": len(deduped),
            "dropped_quality": len(dropped),
            "imported": len(limited),
        }

        for entry in limited:
            existing_feed_urls.add(normalize_url(entry["feed_url"]))
            existing_site_urls.add(normalize_url(entry["site_url"]))

    for entry in imported_entries:
        entry.pop("_quality_score", None)

    imported_entries.sort(key=lambda item: (item["category"], item["title"].lower()))
    dropped_entries.sort(key=lambda item: (item["category"], item["score"], item["title"].lower()))
    OUTPUT_JSON.write_text(json.dumps(imported_entries, indent=2, ensure_ascii=True) + "\n")
    report["dropped_samples"] = dropped_entries[:200]
    OUTPUT_REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=True) + "\n")

    print(f"Wrote {len(imported_entries)} imported Feedspot feeds to {OUTPUT_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
