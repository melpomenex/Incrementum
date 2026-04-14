/**
 * Newsletter Preview Modal
 *
 * Shows publication metadata and recent posts for a Substack publication
 * before the user subscribes. Used for both curated entries and live search results.
 */

import { useState, useEffect } from "react";
import {
  X,
  Rss,
  ExternalLink,
  Check,
  User,
  Clock,
  FileText,
  Loader2,
  Globe,
  Users,
} from "lucide-react";
import {
  getSubstackPublication,
  deriveSubstackFeedUrl,
  type SubstackPublication,
  type SubstackPubHomepage,
  SubstackApiError,
} from "../../api/substack";
import { subscribeToFeedAuto, fetchFeed as fetchRssFeed, type Feed } from "../../api/rss";

interface NewsletterPreviewModalProps {
  publication: SubstackPublication;
  onClose: () => void;
  onSubscribe?: (feed: Feed) => void;
  initiallySubscribed?: boolean;
}

export function NewsletterPreviewModal({
  publication,
  onClose,
  onSubscribe,
  initiallySubscribed = false,
}: NewsletterPreviewModalProps) {
  const [homepage, setHomepage] = useState<SubstackPubHomepage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(initiallySubscribed);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!publication.subdomain) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const hp = await getSubstackPublication(publication.subdomain);
        if (!cancelled) setHomepage(hp);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof SubstackApiError) {
            setError(err.message);
          } else {
            setError("Failed to load publication preview");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [publication.subdomain]);

  const handleSubscribe = async () => {
    if (subscribing) return;
    setSubscribing(true);

    try {
      const feedUrl = deriveSubstackFeedUrl(publication);

      // Fetch the RSS feed first so articles are available immediately
      let items: Feed["items"] = [];
      try {
        const fetched = await fetchRssFeed(feedUrl);
        if (fetched) items = fetched.items;
      } catch {
        // Feed fetch failed — still subscribe, articles will come on next cycle
      }

      const feed: Feed = {
        id: `substack-${publication.id}`,
        title: publication.name,
        description: publication.description ?? "",
        link: publication.base_url
          ? `https://${publication.base_url}`
          : `https://${publication.subdomain}.substack.com`,
        feedUrl,
        imageUrl: publication.logo_url ?? undefined,
        category: undefined,
        lastUpdated: new Date().toISOString(),
        lastFetched: new Date().toISOString(),
        updateInterval: 60,
        items,
        subscribeDate: new Date().toISOString(),
        unreadCount: 0,
      };

      await subscribeToFeedAuto(feed);
      setSubscribed(true);
      onSubscribe?.(feed);
    } catch (err) {
      console.error("Failed to subscribe:", err);
      alert(`Failed to subscribe: ${(err as Error).message}`);
    } finally {
      setSubscribing(false);
    }
  };

  const webUrl = publication.custom_domain
    ? `https://${publication.custom_domain}`
    : `https://${publication.subdomain}.substack.com`;

  const allPosts = [
    ...(homepage?.topPosts ?? []),
    ...(homepage?.newPosts ?? []),
  ];
  // Deduplicate by post id
  const uniquePosts = Array.from(
    new Map(allPosts.map((p) => [p.id, p])).values(),
  ).slice(0, 5);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              {publication.logo_url ? (
                <img
                  src={publication.logo_url}
                  alt={publication.name}
                  className="w-14 h-14 rounded-xl object-cover border border-border"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-2xl border border-orange-200 dark:border-orange-800">
                  <Rss className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-semibold">{publication.name}</h2>
                {publication.author_name && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                    {publication.author_name}
                    {publication.author_handle && (
                      <span className="text-muted-foreground/70">
                        @{publication.author_handle}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {publication.description && (
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
              {publication.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800">
              Substack
            </span>
            {publication.free_subscriber_count != null && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                {publication.free_subscriber_count.toLocaleString()} subscribers
              </span>
            )}
            <a
              href={webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              {publication.custom_domain ?? `${publication.subdomain}.substack.com`}
            </a>
          </div>
        </div>

        {/* Content: Recent Posts */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">
                Loading preview...
              </span>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{error}</p>
            </div>
          ) : uniquePosts.length > 0 ? (
            <div>
              <h3 className="font-medium text-sm text-muted-foreground mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Recent Posts ({uniquePosts.length})
              </h3>
              <div className="space-y-3">
                {uniquePosts.map((post) => (
                  <a
                    key={post.id}
                    href={post.canonical_url ?? `https://${publication.subdomain}.substack.com/p/${post.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors group"
                  >
                    <h4 className="font-medium group-hover:text-primary transition-colors">
                      {post.title}
                    </h4>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {post.post_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(post.post_date)}
                        </span>
                      )}
                      {post.wordcount != null && (
                        <span>{post.wordcount.toLocaleString()} words</span>
                      )}
                    </div>
                    {post.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {post.description}
                      </p>
                    )}
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No recent posts found.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-muted/20">
          <div className="flex gap-3">
            {subscribed ? (
              <button
                disabled
                className="flex-1 px-4 py-2.5 bg-green-500/10 text-green-600 dark:text-green-400 font-medium rounded-lg cursor-default flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Subscribed
              </button>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={subscribing}
                className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              >
                {subscribing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Subscribing...
                  </>
                ) : (
                  <>
                    <Rss className="w-4 h-4" />
                    Subscribe via RSS
                  </>
                )}
              </button>
            )}
            <a
              href={webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-background border border-border font-medium rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Visit
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
