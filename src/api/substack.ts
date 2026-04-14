/**
 * Substack Public API Client
 *
 * Wraps Substack's public /api/v1/ JSON endpoints with typed interfaces.
 * Uses Tauri commands in desktop mode, direct fetch in browser mode.
 * Includes client-side rate limiting (30 req/min default).
 */

import { invokeCommand, isTauri } from "../lib/tauri";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SubstackByline {
  id: number | null;
  name: string;
  bio: string | null;
  photo_url: string | null;
  handle: string | null;
}

export interface SubstackPostTag {
  id: string;
  name: string;
  slug: string;
  hidden: boolean;
  publication_id: number | null;
}

export interface SubstackPost {
  id: number;
  publication_id: number;
  title: string;
  subtitle: string | null;
  slug: string;
  post_date: string | null;
  audience: string | null;
  canonical_url: string | null;
  cover_image: string | null;
  description: string | null;
  wordcount: number | null;
  body_html: string | null;
  body_json: Record<string, unknown> | null;
  truncated_body_text: string | null;
  reaction_count: number | null;
  comment_count: number | null;
  child_comment_count: number | null;
  restacks: number | null;
  podcast_url: string | null;
  podcast_duration: number | null;
  free_unlock_required: boolean | null;
  is_geoblocked: boolean | null;
  section_id: number | null;
  section_slug: string | null;
  section_name: string | null;
  tags: SubstackPostTag[];
  bylines: SubstackByline[];
}

export interface SubstackPublication {
  id: number;
  name: string;
  subdomain: string;
  base_url: string | null;
  custom_domain: string | null;
  author_name: string | null;
  author_handle: string | null;
  author_bio: string | null;
  author_photo_url: string | null;
  logo_url: string | null;
  hero_image: string | null;
  description: string | null;
  free_subscriber_count: number | null;
  podcast_enabled: boolean | null;
  community_enabled: boolean | null;
}

export interface SubstackProfile {
  id: number;
  name: string;
  handle: string;
  photo_url: string | null;
  bio: string | null;
}

export interface SubstackSearchItem {
  type: "post" | "comment" | "profileSearchResults";
  profiles?: SubstackProfile[];
  post?: SubstackPost;
  publication?: SubstackPublication;
  comment?: Record<string, unknown>;
}

export interface SubstackSearchResponse {
  items: SubstackSearchItem[];
  nextCursor: string | null;
}

export interface SubstackCategory {
  id: number;
  name: string;
  slug: string;
  emoji: string | null;
  active: boolean;
  rank: number | null;
  leaderboard_description: string | null;
}

export interface SubstackFeedItem {
  entity_key: string;
  type: "post" | "comment" | "note";
  post?: SubstackPost;
  publication?: SubstackPublication;
  comment?: Record<string, unknown>;
  parentComments?: Record<string, unknown>[];
  context?: string | null;
}

export interface SubstackFeedResponse {
  items: SubstackFeedItem[];
  nextCursor: string | null;
}

export interface SubstackPubHomepage {
  topPosts: SubstackPost[];
  newPosts: SubstackPost[];
  pinnedPosts: SubstackPost[];
}

export class SubstackApiError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly isCorsError?: boolean,
  ) {
    super(message);
    this.name = "SubstackApiError";
  }
}

// ── Rate Limiter ───────────────────────────────────────────────────────────

class RateLimiter {
  private minInterval: number;
  private lastRequest = 0;

  constructor(maxPerMinute: number = 30) {
    this.minInterval = 60000 / maxPerMinute;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const wait = this.minInterval - (now - this.lastRequest);
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    this.lastRequest = Date.now();
  }
}

const rateLimiter = new RateLimiter(30);

// ── Transport ──────────────────────────────────────────────────────────────

const SUBSTACK_BASE = "https://substack.com/api/v1";

async function substackFetch<T>(path: string): Promise<T> {
  await rateLimiter.wait();
  const url = `${SUBSTACK_BASE}${path}`;

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      },
    });

    if (!resp.ok) {
      throw new SubstackApiError(
        `Substack API returned ${resp.status}`,
        undefined,
        false,
      );
    }

    return (await resp.json()) as T;
  } catch (err) {
    if (err instanceof SubstackApiError) throw err;

    // Detect CORS errors: TypeError with no message or message containing "CORS"/"cross-origin"
    const msg = err instanceof Error ? err.message : String(err);
    if (
      err instanceof TypeError &&
      (msg === "Failed to fetch" ||
        msg.toLowerCase().includes("cors") ||
        msg.toLowerCase().includes("cross-origin") ||
        msg.toLowerCase().includes("network"))
    ) {
      throw new SubstackApiError(
        `Cannot reach Substack API — CORS is likely blocking the request. Try using the desktop app for full functionality.`,
        err,
        true,
      );
    }

    throw new SubstackApiError(`Substack API request failed: ${msg}`, err, false);
  }
}

/**
 * Generic call that routes through Tauri command or browser fetch.
 */
async function substackInvoke<T>(
  command: string,
  args: Record<string, unknown>,
): Promise<T> {
  if (isTauri()) {
    await rateLimiter.wait();
    return invokeCommand<T>(command, args);
  }
  throw new SubstackApiError(
    "Substack API commands require the Tauri desktop app",
    undefined,
    true,
  );
}

// ── Parsing helpers ────────────────────────────────────────────────────────

function parsePublication(d: Record<string, unknown>): SubstackPublication {
  return {
    id: (d.id as number) ?? 0,
    name: (d.name as string) ?? "",
    subdomain: (d.subdomain as string) ?? "",
    base_url: (d.base_url as string) ?? null,
    custom_domain: (d.custom_domain as string) ?? null,
    author_name: (d.author_name as string) ?? null,
    author_handle: (d.author_handle as string) ?? null,
    author_bio: (d.author_bio as string) ?? null,
    author_photo_url: (d.author_photo_url as string) ?? null,
    logo_url: (d.logo_url as string) ?? null,
    hero_image: (d.hero_image as string) ?? null,
    description: (d.description as string) ?? null,
    free_subscriber_count: (d.freeSubscriberCount as number) ?? null,
    podcast_enabled: (d.podcast_enabled as boolean) ?? null,
    community_enabled: (d.community_enabled as boolean) ?? null,
  };
}

function parsePost(d: Record<string, unknown>): SubstackPost {
  return {
    id: (d.id as number) ?? 0,
    publication_id: (d.publication_id as number) ?? 0,
    title: (d.title as string) ?? "",
    subtitle: (d.subtitle as string) ?? null,
    slug: (d.slug as string) ?? "",
    post_date: (d.post_date as string) ?? null,
    audience: (d.audience as string) ?? null,
    canonical_url: (d.canonical_url as string) ?? null,
    cover_image: (d.cover_image as string) ?? null,
    description: (d.description as string) ?? null,
    wordcount: (d.wordcount as number) ?? null,
    body_html: (d.body_html as string) ?? null,
    body_json: (d.body_json as Record<string, unknown>) ?? null,
    truncated_body_text: (d.truncated_body_text as string) ?? null,
    reaction_count: (d.reaction_count as number) ?? null,
    comment_count: (d.comment_count as number) ?? null,
    child_comment_count: (d.child_comment_count as number) ?? null,
    restacks: (d.restacks as number) ?? null,
    podcast_url: (d.podcast_url as string) ?? null,
    podcast_duration: (d.podcast_duration as number) ?? null,
    free_unlock_required: (d.free_unlock_required as boolean) ?? null,
    is_geoblocked: (d.is_geoblocked as boolean) ?? null,
    section_id: (d.section_id as number) ?? null,
    section_slug: (d.section_slug as string) ?? null,
    section_name: (d.section_name as string) ?? null,
    tags: Array.isArray(d.postTags)
      ? d.postTags.map((t: Record<string, unknown>) => ({
          id: (t.id as string) ?? "",
          name: (t.name as string) ?? "",
          slug: (t.slug as string) ?? "",
          hidden: (t.hidden as boolean) ?? false,
          publication_id: (t.publication_id as number) ?? null,
        }))
      : [],
    bylines: Array.isArray(d.publishedBylines)
      ? d.publishedBylines.map((b: Record<string, unknown>) => ({
          id: (b.id as number) ?? null,
          name: (b.name as string) ?? "",
          bio: (b.bio as string) ?? null,
          photo_url: (b.photo_url as string) ?? null,
          handle: (b.handle as string) ?? null,
        }))
      : [],
  };
}

function parseProfile(r: Record<string, unknown>): SubstackProfile {
  return {
    id: (r.id as number) ?? 0,
    name: (r.name as string) ?? "",
    handle: (r.handle as string) ?? "",
    photo_url: (r.photo_url as string) ?? null,
    bio: (r.bio as string) ?? null,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Search Substack for publications, posts, and profiles.
 */
export async function searchSubstack(
  query: string,
  cursor?: string,
): Promise<SubstackSearchResponse> {
  const args: Record<string, unknown> = { query };
  if (cursor) args.cursor = cursor;

  const data = isTauri()
    ? await substackInvoke<Record<string, unknown>>("substack_search", args)
    : await substackFetch<Record<string, unknown>>(
        `/top/search?query=${encodeURIComponent(query)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      );

  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items: SubstackSearchItem[] = rawItems.map((d: Record<string, unknown>) => {
    const type = (d.type as string) ?? "";
    if (type === "profileSearchResults") {
      return {
        type: "profileSearchResults" as const,
        profiles: Array.isArray(d.results)
          ? d.results.map(parseProfile)
          : [],
      };
    }
    return {
      type: type as "post" | "comment",
      post: d.post ? parsePost(d.post as Record<string, unknown>) : undefined,
      publication: d.publication
        ? parsePublication(d.publication as Record<string, unknown>)
        : undefined,
      comment: d.comment as Record<string, unknown> | undefined,
    };
  });

  return {
    items,
    nextCursor: (data.nextCursor as string) ?? null,
  };
}

/**
 * Fetch all Substack content categories.
 */
export async function getSubstackCategories(): Promise<SubstackCategory[]> {
  const data = isTauri()
    ? await substackInvoke<Record<string, unknown>[]>(  "substack_categories", {})
    : await substackFetch<Record<string, unknown>[]>("/categories");

  return data.map((c) => ({
    id: (c.id as number) ?? 0,
    name: (c.name as string) ?? "",
    slug: (c.slug as string) ?? "",
    emoji: (c.emoji as string) ?? null,
    active: (c.active as boolean) ?? true,
    rank: (c.rank as number) ?? null,
    leaderboard_description: (c.leaderboard_description as string) ?? null,
  }));
}

/**
 * Fetch publication homepage data.
 */
export async function getSubstackPublication(
  subdomain: string,
): Promise<SubstackPubHomepage> {
  const data = isTauri()
    ? await substackInvoke<Record<string, unknown>>("substack_pub_homepage", {
        subdomain,
      })
    : await substackFetch<Record<string, unknown>>(
        // homepage_data is on the publication's own subdomain
        "",
      );

  // In browser mode, need to fetch from the publication subdomain directly
  if (!isTauri()) {
    await rateLimiter.wait();
    const resp = await fetch(
      `https://${subdomain}.substack.com/api/v1/homepage_data`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        },
      },
    );
    if (!resp.ok) {
      throw new SubstackApiError(
        `Failed to fetch publication homepage: ${resp.status}`,
      );
    }
    const pubData = (await resp.json()) as Record<string, unknown>;
    return parsePubHomepage(pubData);
  }

  return parsePubHomepage(data);
}

function parsePubHomepage(d: Record<string, unknown>): SubstackPubHomepage {
  return {
    topPosts: Array.isArray(d.topPosts)
      ? d.topPosts.map((p) => parsePost(p as Record<string, unknown>))
      : [],
    newPosts: Array.isArray(d.newPosts)
      ? d.newPosts.map((p) => parsePost(p as Record<string, unknown>))
      : [],
    pinnedPosts: Array.isArray(d.pinnedPosts)
      ? d.pinnedPosts.map((p) => parsePost(p as Record<string, unknown>))
      : [],
  };
}

/**
 * Fetch reader feed for a specific category.
 */
export async function getSubstackCategoryFeed(
  categoryId: string,
  cursor?: string,
): Promise<SubstackFeedResponse> {
  const args: Record<string, unknown> = { categoryId };
  if (cursor) args.cursor = cursor;

  const data = isTauri()
    ? await substackInvoke<Record<string, unknown>>("substack_category_feed", args)
    : await substackFetch<Record<string, unknown>>(
        `/reader/feed?tab=${encodeURIComponent(categoryId)}&type=category${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      );

  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items: SubstackFeedItem[] = rawItems.map((d: Record<string, unknown>) => ({
    entity_key: (d.entity_key as string) ?? "",
    type: (d.type as "post" | "comment" | "note") ?? "post",
    post: d.post ? parsePost(d.post as Record<string, unknown>) : undefined,
    publication: d.publication
      ? parsePublication(d.publication as Record<string, unknown>)
      : undefined,
    comment: d.comment as Record<string, unknown> | undefined,
    parentComments: d.parentComments as Record<string, unknown>[] | undefined,
    context: (d.context as string) ?? null,
  }));

  return {
    items,
    nextCursor: (data.nextCursor as string) ?? null,
  };
}

/**
 * Derive the RSS feed URL for a Substack publication.
 */
export function deriveSubstackFeedUrl(
  publication: SubstackPublication,
): string {
  if (publication.custom_domain) {
    return `https://${publication.custom_domain.replace(/^https?:\/\//, "")}/feed`;
  }
  return `https://${publication.subdomain}.substack.com/feed`;
}

/**
 * Derive the RSS feed URL from a subdomain string directly.
 */
export function deriveFeedUrlFromSubdomain(subdomain: string): string {
  return `https://${subdomain}.substack.com/feed`;
}
