import { useState, useEffect } from "react";
import { useSettingsStore, defaultSettings } from "../../stores/settingsStore";
import { getSubscribedFeedsAuto, type Feed } from "../../api/rss";
import { useI18n } from "../../lib/i18n";
import { useToast } from "../common/Toast";
import {
  Clock,
  Eye,
  EyeSlash,
  Percent,
  Rss,
  Sliders,
  Tray,
} from "@phosphor-icons/react";

export function RSSSettings() {
  const { t } = useI18n();
  const toast = useToast();
  const { settings, updateSettingsCategory } = useSettingsStore();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);

  const rssSettings = settings.rssQueue ?? defaultSettings.rssQueue;

  // Retrieve feeds on mount
  useEffect(() => {
    let active = true;
    const fetchFeeds = async () => {
      try {
        const loaded = await getSubscribedFeedsAuto();
        if (active) {
          setFeeds(loaded);
          setLoading(false);
        }
      } catch (err) {
        console.error("[RSSSettings] Failed to fetch feeds:", err);
        if (active) setLoading(false);
      }
    };
    fetchFeeds();
    return () => {
      active = false;
    };
  }, []);

  const updateRssSetting = <K extends keyof typeof defaultSettings.rssQueue>(
    key: K,
    value: (typeof defaultSettings.rssQueue)[K]
  ) => {
    const updated = {
      ...rssSettings,
      [key]: value,
    };
    updateSettingsCategory("rssQueue", updated);
  };

  const toggleFeedInclusion = (feedId: string) => {
    const currentIncluded = rssSettings.includedFeedIds ?? [];
    let nextIncluded: string[];
    if (currentIncluded.includes(feedId)) {
      nextIncluded = currentIncluded.filter((id) => id !== feedId);
    } else {
      nextIncluded = [...currentIncluded, feedId];
    }
    updateRssSetting("includedFeedIds", nextIncluded);
  };

  const toggleFeedExclusion = (feedId: string) => {
    const currentExcluded = rssSettings.excludedFeedIds ?? [];
    let nextExcluded: string[];
    if (currentExcluded.includes(feedId)) {
      nextExcluded = currentExcluded.filter((id) => id !== feedId);
    } else {
      nextExcluded = [...currentExcluded, feedId];
    }
    updateRssSetting("excludedFeedIds", nextExcluded);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Introduction Header */}
      <div className="flex flex-col gap-1.5 pb-4 border-b border-border/60">
        <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Rss className="w-5 h-5 text-primary" />
          {t("settings.rss")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("settings.rss.description")}
        </p>
      </div>

      {/* Article Retention & Cleanup */}
      <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-6 space-y-5 shadow-sm transition-all hover:border-border/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">{t("settings.rss.articleRetention")}</h4>
            <p className="text-xs text-muted-foreground">
              {t("settings.rss.articleRetentionDesc")}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{t("settings.rss.keepArticlesFor")}</span>
            <span className="text-sm font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-md border border-primary/20">
              {rssSettings.maxItemAgeDays === 0
                ? t("settings.rss.keepForever")
                : rssSettings.maxItemAgeDays === 1
                ? t("settings.rss.daysCountSingle", { count: rssSettings.maxItemAgeDays })
                : t("settings.rss.daysCountPlural", { count: rssSettings.maxItemAgeDays })}
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="14"
            step="1"
            value={rssSettings.maxItemAgeDays ?? 2}
            onChange={(e) => updateRssSetting("maxItemAgeDays", parseInt(e.target.value))}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          <p className="text-xs text-muted-foreground leading-relaxed">
            {rssSettings.maxItemAgeDays === 0
              ? t("settings.rss.keepIndefinitely")
              : rssSettings.maxItemAgeDays === 1
              ? t("settings.rss.cleanupDescriptionSingle", { days: rssSettings.maxItemAgeDays })
              : t("settings.rss.cleanupDescriptionPlural", { days: rssSettings.maxItemAgeDays })}
          </p>
        </div>
      </div>

      {/* Queue & Session Integration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Queue Tuning */}
        <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-6 space-y-5 shadow-sm hover:border-border/80 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">{t("settings.rss.queueRules")}</h4>
              <p className="text-xs text-muted-foreground">{t("settings.rss.queueRulesDesc")}</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Max Items per Session */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-foreground/80">{t("settings.rss.maxArticlesPerSession")}</span>
                <span className="font-semibold text-primary">
                  {rssSettings.maxItemsPerSession === 0 ? t("settings.rssUnlimited") : rssSettings.maxItemsPerSession}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={rssSettings.maxItemsPerSession ?? 10}
                onChange={(e) => updateRssSetting("maxItemsPerSession", parseInt(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            {/* Percentage weight */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-foreground/80">{t("settings.rss.sessionWeight")}</span>
                <span className="font-semibold text-primary">{rssSettings.percentage ?? 30}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={rssSettings.percentage ?? 30}
                onChange={(e) => updateRssSetting("percentage", parseInt(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <p className="text-[11px] text-muted-foreground">
                {t("settings.rss.sessionWeightDesc")}
              </p>
            </div>
          </div>
        </div>

        {/* Behavior Toggles */}
        <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-6 space-y-4 shadow-sm hover:border-border/80 transition-all">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">{t("settings.rss.interactivePreferences")}</h4>
              <p className="text-xs text-muted-foreground">{t("settings.rss.interactivePreferencesDesc")}</p>
            </div>
          </div>

          <div className="space-y-3.5 pt-2">
            {/* Include in Queue */}
            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{t("settings.rss.includeInSmartQueue")}</span>
                <span className="text-xs text-muted-foreground">{t("settings.rss.includeInSmartQueueDesc")}</span>
              </div>
              <input
                type="checkbox"
                checked={rssSettings.includeInQueue ?? true}
                onChange={(e) => updateRssSetting("includeInQueue", e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary"
              />
            </label>

            {/* Unread Only */}
            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{t("settings.rss.onlyShowUnread")}</span>
                <span className="text-xs text-muted-foreground">{t("settings.rss.onlyShowUnreadDesc")}</span>
              </div>
              <input
                type="checkbox"
                checked={rssSettings.unreadOnly ?? true}
                onChange={(e) => updateRssSetting("unreadOnly", e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary"
              />
            </label>

            {/* Prefer Recent */}
            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{t("settings.rss.preferRecentArticles")}</span>
                <span className="text-xs text-muted-foreground">{t("settings.rss.preferRecentArticlesDesc")}</span>
              </div>
              <input
                type="checkbox"
                checked={rssSettings.preferRecent ?? true}
                onChange={(e) => updateRssSetting("preferRecent", e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Feed Selection / Queue inclusion mapping */}
      <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-6 space-y-4 shadow-sm hover:border-border/80 transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Tray className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">{t("settings.rss.feedQueueInclusions")}</h4>
              <p className="text-xs text-muted-foreground">
                {t("settings.rss.feedQueueInclusionsDesc")}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold bg-muted px-2.5 py-1 rounded-full text-muted-foreground border border-border/50">
            {feeds.length === 1
              ? t("settings.rss.feedsSubscribedSingle", { count: feeds.length })
              : t("settings.rss.feedsSubscribedPlural", { count: feeds.length })}
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            {t("settings.rss.loadingFeeds")}
          </div>
        ) : feeds.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border/50 rounded-lg">
            {t("settings.rss.noSubscriptions")}
          </div>
        ) : (
          <div className="border border-border/50 rounded-lg overflow-hidden bg-background/50 max-h-80 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20 text-muted-foreground font-medium">
                  <th className="p-3 pl-4">{t("settings.rss.feedDetails")}</th>
                  <th className="p-3 text-center w-36">{t("settings.rss.explicitInclusion")}</th>
                  <th className="p-3 text-center w-36">{t("settings.rss.explicitExclusion")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {feeds.map((feed) => {
                  const isIncluded = (rssSettings.includedFeedIds ?? []).includes(feed.id);
                  const isExcluded = (rssSettings.excludedFeedIds ?? []).includes(feed.id);

                  return (
                    <tr key={feed.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 pl-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded bg-muted/60 flex items-center justify-center overflow-hidden flex-shrink-0 text-xs font-semibold text-muted-foreground">
                            {feed.imageUrl ? (
                              <img src={feed.imageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              feed.title.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate max-w-[240px] md:max-w-[320px]">
                              {feed.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[240px] md:max-w-[320px]">
                              {feed.feedUrl}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => toggleFeedInclusion(feed.id)}
                          className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-all ${
                            isIncluded
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                              : "hover:bg-muted text-muted-foreground border-border/40"
                          }`}
                          title={isIncluded ? t("settings.rss.currentlyIncluded") : t("settings.rss.clickToInclude")}
                        >
                          {isIncluded ? <Eye className="w-4 h-4" /> : <EyeSlash className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => toggleFeedExclusion(feed.id)}
                          className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-all ${
                            isExcluded
                              ? "bg-destructive/10 text-destructive border-destructive/30"
                              : "hover:bg-muted text-muted-foreground border-border/40"
                          }`}
                          title={isExcluded ? t("settings.rss.currentlyExcluded") : t("settings.rss.clickToExclude")}
                        >
                          {isExcluded ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
