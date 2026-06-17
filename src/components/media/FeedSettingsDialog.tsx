import { useState, useEffect } from "react";
import {
  ArrowsClockwise,
  Download,
  Eye,
  Gear,
  GridFour,
  Star,
  TextT,
  X,
} from "@phosphor-icons/react";
import { useI18n } from "../../lib/i18n";
import { updateFeedAutoFetchPreference, type Feed } from "../../api/rss";
import { setFeedViewPreferencesAuto } from "../../api/rss-folders";

interface FeedSettingsDialogProps {
  feed: Feed | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (feed: Feed) => void;
}

type AutoFetchMode = "always" | "favorites" | "manual";

/**
 * Feed Gear Dialog
 * Configure per-feed settings including auto-fetch mode for full content,
 * auto-mark-as-read timing, view mode, and layout preferences
 */
export function FeedSettingsDialog({ feed, isOpen, onClose, onUpdate }: FeedSettingsDialogProps) {
  const { t: _t } = useI18n();
  const [autoFetchMode, setAutoFetchMode] = useState<AutoFetchMode>("manual");
  const [autoMarkDays, setAutoMarkDays] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<string | null>(null);
  const [layout, setLayout] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (feed && isOpen) {
      setAutoFetchMode((feed.autoFetchFullContent as AutoFetchMode) || "manual");
      setAutoMarkDays(feed.autoMarkAfterDays ?? null);
      setViewMode(feed.viewMode ?? null);
      setLayout(feed.layout ?? null);
    }
  }, [feed, isOpen]);

  if (!isOpen || !feed) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateFeedAutoFetchPreference(feed.id, autoFetchMode);
      if (viewMode || layout || autoMarkDays !== undefined) {
        await setFeedViewPreferencesAuto(feed.id, viewMode ?? undefined, layout ?? undefined, autoMarkDays);
      }
      onUpdate({
        ...feed,
        autoFetchFullContent: autoFetchMode,
        autoMarkAfterDays: autoMarkDays ?? undefined,
        viewMode: viewMode ?? feed.viewMode,
        layout: layout ?? feed.layout,
      });
      onClose();
    } catch (error) {
      console.error("[FeedSettings] Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const autoMarkOptions = [
    { value: null, label: "Never" },
    { value: 1, label: "After 1 day" },
    { value: 3, label: "After 3 days" },
    { value: 7, label: "After 1 week" },
    { value: 14, label: "After 2 weeks" },
    { value: 30, label: "After 1 month" },
    { value: 90, label: "After 3 months" },
    { value: 365, label: "After 1 year" },
  ];

  const viewModeOptions = [
    { value: null, label: "Default" },
    { value: "feed", label: "Feed" },
    { value: "original", label: "Original" },
    { value: "text", label: "Text" },
    { value: "story", label: "Story" },
  ];

  const layoutOptions = [
    { value: null, label: "Default" },
    { value: "list", label: "List" },
    { value: "magazine", label: "Magazine" },
    { value: "grid", label: "Grid" },
  ];

  const modeOptions: {
    value: AutoFetchMode;
    label: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      value: "manual",
      label: "Manual",
      description: "Only fetch full content when you click the button",
      icon: <TextT className="w-4 h-4" />,
    },
    {
      value: "favorites",
      label: "Favorites Only",
      description: "Auto-fetch when you favorite/star an article",
      icon: <Star className="w-4 h-4" />,
    },
    {
      value: "always",
      label: "Always",
      description: "Auto-fetch full content for all new articles",
      icon: <ArrowsClockwise className="w-4 h-4" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
          <div className="flex items-center gap-2">
            <Gear className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Feed Gear</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Feed name */}
          <div className="text-sm">
            <span className="text-muted-foreground">Feed:</span>{" "}
            <span className="font-medium">{feed.title}</span>
          </div>

          {/* Auto-fetch mode section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-muted-foreground" />
              <label className="text-sm font-medium">Full Content Auto-Fetch</label>
            </div>
            <div className="space-y-1.5">
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setAutoFetchMode(option.value)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                    autoFetchMode === option.value
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-border hover:border-muted-foreground/50 hover:bg-muted/50"
                  }`}
                >
                  <div className={`flex-shrink-0 mt-0.5 ${autoFetchMode === option.value ? "text-blue-500" : "text-muted-foreground"}`}>
                    {option.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${autoFetchMode === option.value ? "text-blue-700 dark:text-blue-400" : "text-foreground"}`}>
                      {option.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{option.description}</div>
                  </div>
                  <div className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    autoFetchMode === option.value ? "border-blue-500 bg-blue-500" : "border-muted-foreground/30"
                  }`}>
                    {autoFetchMode === option.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Auto-mark as read (11.3) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <label className="text-sm font-medium" htmlFor="feed-auto-mark">Auto-Mark as Read</label>
            </div>
            <select
              id="feed-auto-mark"
              value={autoMarkDays ?? ""}
              onChange={(e) => setAutoMarkDays(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {autoMarkOptions.map((opt) => (
                <option key={String(opt.value)} value={opt.value ?? ""}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* View mode preference (9.7) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TextT className="w-4 h-4 text-muted-foreground" />
              <label className="text-sm font-medium" htmlFor="feed-view-mode">Default View Mode</label>
            </div>
            <select
              id="feed-view-mode"
              value={viewMode ?? ""}
              onChange={(e) => setViewMode(e.target.value || null)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {viewModeOptions.map((opt) => (
                <option key={String(opt.value)} value={opt.value ?? ""}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Layout preference (16.5) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <GridFour className="w-4 h-4 text-muted-foreground" />
              <label className="text-sm font-medium" htmlFor="feed-layout">Default Layout</label>
            </div>
            <select
              id="feed-layout"
              value={layout ?? ""}
              onChange={(e) => setLayout(e.target.value || null)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {layoutOptions.map((opt) => (
                <option key={String(opt.value)} value={opt.value ?? ""}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-muted/50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
