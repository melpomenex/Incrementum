/**
 * DiscoverSiteCard
 * Rich card for a discovered site with clearer metadata and primary actions.
 */

import { memo } from "react";
import {
  ArrowSquareOut,
  CheckCircle,
  Plus,
  Rss,
  Trash,
} from "@phosphor-icons/react";
import type { RssDiscoveredSite } from "../../api/rss-discovery";
import { useI18n } from "../../lib/i18n";

interface DiscoverSiteCardProps {
  site: RssDiscoveredSite;
  categoryLabel: string;
  isSubscribed?: boolean;
  isSubscribing?: boolean;
  onSubscribe?: (site: RssDiscoveredSite) => void;
  onDismiss?: (id: string) => void;
}

function getDomainLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
  }
}

export const DiscoverSiteCard = memo(function DiscoverSiteCard({
  site,
  categoryLabel,
  isSubscribed = false,
  isSubscribing = false,
  onSubscribe,
  onDismiss,
}: DiscoverSiteCardProps) {
  const { t } = useI18n();
  const domain = getDomainLabel(site.url);
  const accent = site.title.trim().charAt(0).toUpperCase() || "S";

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 via-amber-500/15 to-transparent text-sm font-semibold text-orange-300 ring-1 ring-orange-500/20">
            {accent}
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border/80 bg-muted/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {categoryLabel}
              </span>
              {site.feed_url && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  <Rss className="h-3 w-3" />
                  {t("discoverSites.feedReady")}
                </span>
              )}
              {isSubscribed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  <CheckCircle className="h-3 w-3" />
                  {t("discoverSites.subscribed")}
                </span>
              )}
            </div>
            <h3 className="line-clamp-2 text-base font-semibold text-foreground">{site.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{domain}</p>
          </div>
        </div>
        <button
          onClick={() => onDismiss?.(site.id)}
          className="rounded-lg p-2 text-muted-foreground opacity-60 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
          title={t("discoverSites.dismissSite")}
        >
          <Trash className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1">
        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
          {site.description?.trim() || t("discoverSites.noSummary")}
        </p>
        <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t("discoverSites.source")}
          </p>
          <p className="mt-1 line-clamp-1 text-xs text-foreground">
            {site.similarity_source || t("discoverSites.discovered")}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {site.feed_url && !isSubscribed && (
          <button
            onClick={() => onSubscribe?.(site)}
            disabled={isSubscribing}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubscribing ? (
              <>
                <Rss className="h-4 w-4 animate-pulse" />
                {t("discoverSites.subscribing")}
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                {t("discoverSites.subscribe")}
              </>
            )}
          </button>
        )}
        {isSubscribed && (
          <div className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary">
            <CheckCircle className="h-4 w-4" />
            {t("discoverSites.addedToLibrary")}
          </div>
        )}
        {!site.feed_url && (
          <div className="inline-flex flex-1 items-center justify-center rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
            {t("discoverSites.feedNotAvailable")}
          </div>
        )}
        <a
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted/50"
          title={t("discoverSites.openSite")}
        >
          <ArrowSquareOut className="h-4 w-4" />
          {t("discoverSites.visit")}
        </a>
      </div>
    </article>
  );
});
