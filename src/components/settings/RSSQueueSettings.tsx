/**
 * RSS Queue Settings
 * 
 * Configure how RSS feed items appear in the main reading queue:
 * - Enable/disable RSS in queue
 * - Set percentage of queue that should be RSS
 * - Set max items per session
 * - Choose which specific feeds appear in the queue
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  ArrowsVertical,
  Eye,
  EyeSlash,
  Funnel,
  Headphones,
  Percent,
  Rss,
  Sliders,
  X,
} from "@phosphor-icons/react";
import { cn } from "../../utils";
import { defaultSettings, useSettingsStore, type RSSQueueSettings, type PodcastQueueSettings } from "../../stores/settingsStore";
import { getSubscribedFeeds } from "../../api/rss";
import { useToast } from "../common/Toast";
import { useI18n } from "../../lib/i18n";

interface RSSQueueSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RSSQueueSettingsModal({ isOpen, onClose }: RSSQueueSettingsProps) {
  const { t } = useI18n();
  const { settings, updateSettingsCategory } = useSettingsStore();
  const toast = useToast();
  
  const rssSettings = settings.rssQueue ?? defaultSettings.rssQueue;
  const feeds = useMemo(() => getSubscribedFeeds(), [isOpen]);
  
  // Local state for form
  const [includeInQueue, setIncludeInQueue] = useState(rssSettings.includeInQueue);
  const [percentage, setPercentage] = useState(rssSettings.percentage);
  const [maxItems, setMaxItems] = useState(rssSettings.maxItemsPerSession);
  const [maxItemAgeDays, setMaxItemAgeDays] = useState(rssSettings.maxItemAgeDays);
  const [includedFeedIds, setIncludedFeedIds] = useState<string[]>(rssSettings.includedFeedIds);
  const [excludedFeedIds, setExcludedFeedIds] = useState<string[]>(rssSettings.excludedFeedIds);
  const [unreadOnly, setUnreadOnly] = useState(rssSettings.unreadOnly);
  const [preferRecent, setPreferRecent] = useState(rssSettings.preferRecent);
  const [showCoverImage, setShowCoverImage] = useState(rssSettings.showCoverImage ?? false);

  // Podcast queue local state
  const podcastSettings = settings.podcastQueue ?? defaultSettings.podcastQueue;
  const [podcastIncludeInQueue, setPodcastIncludeInQueue] = useState(podcastSettings.includeInQueue);
  const [podcastMaxItems, setPodcastMaxItems] = useState(podcastSettings.maxItemsPerSession);
  const [podcastUnreadOnly, setPodcastUnreadOnly] = useState(podcastSettings.unreadOnly);

  useEffect(() => {
    if (!isOpen) return;
    setIncludeInQueue(rssSettings.includeInQueue);
    setPercentage(rssSettings.percentage);
    setMaxItems(rssSettings.maxItemsPerSession);
    setMaxItemAgeDays(rssSettings.maxItemAgeDays);
    setIncludedFeedIds(rssSettings.includedFeedIds);
    setExcludedFeedIds(rssSettings.excludedFeedIds);
    setUnreadOnly(rssSettings.unreadOnly);
    setPreferRecent(rssSettings.preferRecent);
    setShowCoverImage(rssSettings.showCoverImage ?? false);
    setPodcastIncludeInQueue(podcastSettings.includeInQueue);
    setPodcastMaxItems(podcastSettings.maxItemsPerSession);
    setPodcastUnreadOnly(podcastSettings.unreadOnly);
  }, [isOpen, rssSettings]);
  
  const handleSave = useCallback(() => {
    const newSettings: RSSQueueSettings = {
      includeInQueue,
      percentage,
      maxItemsPerSession: maxItems,
      maxItemAgeDays,
      includedFeedIds,
      excludedFeedIds,
      unreadOnly,
      preferRecent,
      showCoverImage,
    };
    
    updateSettingsCategory("rssQueue", newSettings);

    const newPodcastSettings: PodcastQueueSettings = {
      includeInQueue: podcastIncludeInQueue,
      maxItemsPerSession: podcastMaxItems,
      unreadOnly: podcastUnreadOnly,
    };

    updateSettingsCategory("podcastQueue", newPodcastSettings);
    toast.success(t("common.success"), t("settings.rssSettingsSaved"));
    onClose();
  }, [includeInQueue, percentage, maxItems, maxItemAgeDays, includedFeedIds, excludedFeedIds, unreadOnly, preferRecent, showCoverImage, podcastIncludeInQueue, podcastMaxItems, podcastUnreadOnly, updateSettingsCategory, toast, onClose]);
  
  const toggleFeedInclusion = useCallback((feedId: string) => {
    setIncludedFeedIds(prev => {
      if (prev.includes(feedId)) {
        return prev.filter(id => id !== feedId);
      }
      return [...prev, feedId];
    });
  }, []);
  
  const toggleFeedExclusion = useCallback((feedId: string) => {
    setExcludedFeedIds(prev => {
      if (prev.includes(feedId)) {
        return prev.filter(id => id !== feedId);
      }
      return [...prev, feedId];
    });
  }, []);
  
  const isFeedIncluded = useCallback((feedId: string) => {
    // If includedFeedIds is empty, all feeds are included by default
    if (includedFeedIds.length === 0) return true;
    return includedFeedIds.includes(feedId);
  }, [includedFeedIds]);
  
  const isFeedExcluded = useCallback((feedId: string) => {
    return excludedFeedIds.includes(feedId);
  }, [excludedFeedIds]);
  
  const getFeedStatus = useCallback((feedId: string): "included" | "excluded" | "default" => {
    if (isFeedExcluded(feedId)) return "excluded";
    if (includedFeedIds.length === 0 || isFeedIncluded(feedId)) return "included";
    return "default";
  }, [isFeedIncluded, isFeedExcluded, includedFeedIds.length]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Rss className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t("settings.rssQueueTitle")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("settings.rssQueueDesc")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Main Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              {includeInQueue ? (
                <Eye className="w-5 h-5 text-green-500" />
              ) : (
                <EyeSlash className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <h3 className="font-medium">{t("settings.rssIncludeInQueue")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("settings.rssIncludeInQueueDesc")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIncludeInQueue(!includeInQueue)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                includeInQueue ? "bg-primary" : "bg-muted-foreground/20"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  includeInQueue ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
          
          {includeInQueue && (
            <>
              {/* Percentage Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{t("settings.rssQueuePercentage")}</span>
                  </div>
                  <span className="text-sm font-medium">{percentage}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={percentage}
                  onChange={(e) => setPercentage(parseInt(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <p className="text-sm text-muted-foreground">
                  {t("settings.rssQueuePercentageDesc", { percentage })}
                </p>
              </div>
              
              {/* Max Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Funnel className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{t("settings.rssMaxItemsPerSession")}</span>
                  </div>
                  <span className="text-sm font-medium">
                    {maxItems === 0 ? t("settings.rssUnlimited") : maxItems}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={maxItems}
                  onChange={(e) => setMaxItems(parseInt(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <p className="text-sm text-muted-foreground">
                  {maxItems === 0
                    ? t("settings.rssNoLimitDesc")
                    : t("settings.rssMaxItemsDesc", { max: maxItems })}
                </p>
              </div>
              
              {/* Auto-remove old items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Funnel className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{t("settings.rssAutoRemoveOld")}</span>
                  </div>
                  <span className="text-sm font-medium">
                    {maxItemAgeDays === 0 ? t("settings.rssOff") : `${maxItemAgeDays}d`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="14"
                  value={maxItemAgeDays}
                  onChange={(e) => setMaxItemAgeDays(parseInt(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <p className="text-sm text-muted-foreground">
                  {maxItemAgeDays === 0
                    ? t("settings.rssKeepAllDesc")
                    : t("settings.rssHideOldDesc", { days: maxItemAgeDays, plural: maxItemAgeDays === 1 ? "" : "s" })}
                </p>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-muted-foreground" />
                  {t("settings.options")}
                </h3>
                
                <label className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={unreadOnly}
                    onChange={(e) => setUnreadOnly(e.target.checked)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <div>
                    <span className="font-medium">{t("settings.rssUnreadOnly")}</span>
                    <p className="text-sm text-muted-foreground">
                      {t("settings.rssUnreadOnlyDesc")}
                    </p>
                  </div>
                </label>
                
                <label className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={preferRecent}
                    onChange={(e) => setPreferRecent(e.target.checked)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <div>
                    <span className="font-medium">{t("settings.rssPreferRecent")}</span>
                    <p className="text-sm text-muted-foreground">
                      {t("settings.rssPreferRecentDesc")}
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={showCoverImage}
                    onChange={(e) => setShowCoverImage(e.target.checked)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <div>
                    <span className="font-medium">{t("settings.rssShowCoverImage") || "Show cover images by default"}</span>
                    <p className="text-sm text-muted-foreground">
                      {t("settings.rssShowCoverImageDesc") || "Display the large cover image at the top of RSS articles by default. When disabled, images are compact and can be expanded."}
                    </p>
                  </div>
                </label>
              </div>
              
              {/* Feed Selection */}
              {feeds.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <ArrowsVertical className="w-4 h-4 text-muted-foreground" />
                    {t("settings.rssFeedSelection")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.rssFeedSelectionDesc")}
                  </p>
                  
                  <div className="space-y-2 max-h-64 overflow-y-auto border border-border rounded-lg">
                    {feeds.map((feed) => {
                      const status = getFeedStatus(feed.id);
                      return (
                        <div
                          key={feed.id}
                          className={cn(
                            "flex items-center justify-between p-3 hover:bg-muted/30 transition-colors",
                            status === "excluded" && "opacity-50"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {feed.imageUrl ? (
                              <img
                                src={feed.imageUrl}
                                alt=""
                                className="w-8 h-8 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                                <Rss className="w-4 h-4 text-orange-500" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-medium truncate">{feed.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {t("settings.rssUnreadCount", { count: feed.unreadCount })}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {status === "excluded" ? (
                              <button
                                onClick={() => toggleFeedExclusion(feed.id)}
                                className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors"
                              >
                                {t("settings.rssInclude")}
                              </button>
                            ) : (
                              <>
                                {includedFeedIds.length > 0 && (
                                  <button
                                    onClick={() => toggleFeedInclusion(feed.id)}
                                    className={cn(
                                      "px-3 py-1.5 text-sm rounded-md transition-colors",
                                      status === "included"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted hover:bg-muted/80"
                                    )}
                                  >
                                    {status === "included" ? t("settings.rssInQueue") : t("settings.rssInclude")}
                                  </button>
                                )}
                                <button
                                  onClick={() => toggleFeedExclusion(feed.id)}
                                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                  title={t("settings.rssExcludeFromQueue")}
                                >
                                  <EyeSlash className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Quick actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIncludedFeedIds([]);
                        setExcludedFeedIds([]);
                      }}
                      className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors"
                    >
                      {t("settings.rssIncludeAll")}
                    </button>
                    <button
                      onClick={() => {
                        setIncludedFeedIds([]);
                        setExcludedFeedIds(feeds.map(f => f.id));
                      }}
                      className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors"
                    >
                      {t("settings.rssExcludeAll")}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Podcast Queue Settings */}
          <div className="border-t border-border pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Headphones className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Podcast Queue</h2>
                <p className="text-sm text-muted-foreground">
                  Include podcast episodes in the scroll queue
                </p>
              </div>
            </div>

            {/* Podcast Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg mb-4">
              <div className="flex items-center gap-3">
                {podcastIncludeInQueue ? (
                  <Eye className="w-5 h-5 text-green-500" />
                ) : (
                  <EyeSlash className="w-5 h-5 text-muted-foreground" />
                )}
                <div>
                  <h3 className="font-medium">Include podcasts in queue</h3>
                  <p className="text-sm text-muted-foreground">
                    Show unplayed podcast episodes while scrolling
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPodcastIncludeInQueue(!podcastIncludeInQueue)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  podcastIncludeInQueue ? "bg-primary" : "bg-muted-foreground/20"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    podcastIncludeInQueue ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            {podcastIncludeInQueue && (
              <>
                {/* Max Episodes */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Funnel className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Max episodes per session</span>
                    </div>
                    <span className="text-sm font-medium">
                      {podcastMaxItems === 0 ? "Unlimited" : podcastMaxItems}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={podcastMaxItems}
                    onChange={(e) => setPodcastMaxItems(parseInt(e.target.value))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Unread Only */}
                <label className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={podcastUnreadOnly}
                    onChange={(e) => setPodcastUnreadOnly(e.target.checked)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <div>
                    <span className="font-medium">Unplayed only</span>
                    <p className="text-sm text-muted-foreground">
                      Only include episodes you haven't listened to yet
                    </p>
                  </div>
                </label>
              </>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
          >
            {t("settings.saveSettings")}
          </button>
        </div>
      </div>
    </div>
  );
}
