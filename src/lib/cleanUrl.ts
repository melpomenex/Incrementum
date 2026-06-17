/**
 * URL cleaning helpers for shareable links.
 *
 * Used when copying an article/story link so the recipient sees a clean,
 * canonical URL without feed-specific or tracking cruft.
 */

/**
 * Query-parameter names (exact match) that are well-known tracking identifiers
 * or platform share tokens. Stripped before a link is copied/shared.
 */
const TRACKING_PARAMS = new Set([
  // Google / Urchin
  "gclid",
  "dclid",
  "gbraid",
  "wbraid",
  "ga_source",
  "ga_medium",
  "ga_term",
  "ga_content",
  "ga_campaign",
  "ga_place",
  "_ga",
  "_gl",
  // Facebook / Meta
  "fbclid",
  "fb_action_ids",
  "fb_action_types",
  "fb_ref",
  "fb_source",
  "mkt_tok",
  "hootPostID",
  // Mailchimp
  "mc_cid",
  "mc_eid",
  // YouTube
  "si",
  "feature",
  // HubSpot
  "_hsenc",
  "_hsmi",
  "hsCtaTracking",
  // Yandex / Microsoft / Twitter
  "yclid",
  "msclkid",
  "twclid",
  // Instagram / Vero
  "igshid",
  "vero_id",
  // TikTok
  "ttclid",
  // LinkedIn
  "trk",
  "trkInfo",
  "li_fat_id",
  // Misc referrer/share tokens
  "ref",
  "ref_src",
  "ref_url",
  "referrer",
  "source",
  // Generic share
  "share",
  "shared",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_name",
  "utm_referrer",
  "utm_social",
  "utm_social-type",
]);

/**
 * Remove tracking/marketing query parameters from a URL while preserving
 * everything else (path, hash, and legitimate query params).
 *
 * Strips all `utm_*` params, plus known click-IDs and platform share tokens
 * (fbclid, gclid, mc_cid, si, etc.).
 *
 * Non-parseable input (relative paths, plain strings, empty) is returned as-is
 * so callers can safely pass any value without a try/catch.
 */
export function stripTrackingParams(url: string): string {
  if (!url || typeof url !== "string") return url;

  let parsed: URL;
  try {
    // URL requires an absolute URL with a protocol. Relative paths / bare
    // strings throw — fall through to the unchanged return.
    parsed = new URL(url);
  } catch {
    return url;
  }

  const params = parsed.searchParams;
  if (params.size === 0) return url;

  for (const key of [...params.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      params.delete(key);
    }
  }

  // Re-serialize: only include the search string when params remain.
  const search = params.toString();
  return (
    parsed.origin +
    parsed.pathname +
    (search ? `?${search}` : "") +
    parsed.hash
  );
}
