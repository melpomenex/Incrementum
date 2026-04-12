import { useState, useEffect } from "react";
import { X, Settings, Download, FileText, Star, RefreshCw, HelpCircle } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import type { Feed } from "../../api/rss";
import { updateFeedAutoFetchPreference } from "../../api/rss";

interface FeedSettingsDialogProps {
  feed: Feed | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (feed: Feed) => void;
}

type AutoFetchMode = "always" | "favorites" | "manual";

/**
 * Feed Settings Dialog
 * Configure per-feed settings including auto-fetch mode for full content
 */
export function FeedSettingsDialog({ feed, isOpen, onClose, onUpdate }: FeedSettingsDialogProps) {
  const { t } = useI18n();
  const [autoFetchMode, setAutoFetchMode] = useState<AutoFetchMode>("manual");
  const [isSaving, setIsSaving] = useState(false);

  // Load current settings when dialog opens
  useEffect(() => {
    if (feed && isOpen) {
      setAutoFetchMode((feed.autoFetchFullContent as AutoFetchMode) || "manual");
    }
  }, [feed, isOpen]);

  if (!isOpen || !feed) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateFeedAutoFetchPreference(feed.id, autoFetchMode);
      onUpdate({ ...feed, autoFetchFullContent: autoFetchMode });
      onClose();
    } catch (error) {
      console.error("[FeedSettings] Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

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
      icon: <FileText className="w-4 h-4" />,
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
      icon: <RefreshCw className="w-4 h-4" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Feed Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
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
              <div className="relative group">
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 text-xs bg-popover border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  Choose when to automatically fetch the full article content from the source
                  website. This helps you read complete articles without leaving the app.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-popover" />
                </div>
              </div>
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
                  <div
                    className={`flex-shrink-0 mt-0.5 ${
                      autoFetchMode === option.value ? "text-blue-500" : "text-muted-foreground"
                    }`}
                  >
                    {option.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-medium ${
                        autoFetchMode === option.value
                          ? "text-blue-700 dark:text-blue-400"
                          : "text-foreground"
                      }`}
                    >
                      {option.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{option.description}</div>
                  </div>
                  <div
                    className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      autoFetchMode === option.value
                        ? "border-blue-500 bg-blue-500"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {autoFetchMode === option.value && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                </button>
              ))}
            </div>
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
            onClick={handleSave}
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
