import React from "react";
import {
  Brain,
  CaretDown,
  CaretUp,
  CheckCircle,
  EyeSlash,
  Lightbulb,
  List,
  Rss,
  Sliders,
  Sparkle,
  Star,
  TextT,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { cn } from "../../utils";

interface ScrollOverlayControlsProps {
  showControls: boolean;
  currentIndex: number;
  totalItems: number;
  sessionOffset?: number;
  itemType: string;
  itemTitle: string;
  itemDocumentId?: string;
  isNewDocument: boolean;
  isRating: boolean;
  scrollViewMode: string;
  helpText?: string;
  onExit: () => void;
  onShowSettings: () => void;
  onShowRssSettings: () => void;
  onSetScrollViewMode: (mode: "document" | "extracts" | "cards") => void;
  onOpenExtractDialog: () => void;
  onRate: (rating: number) => void;
  onDismiss: () => void;
  onGoToNext: () => void;
  onGoToPrevious: () => void;
  /** Render slot for ItemDetailsPopover in top bar */
  detailsButton?: React.ReactNode;
  /** i18n labels (optional — falls back to English) */
  labels?: {
    exit?: string;
    settings?: string;
    itemDetails?: string;
    rss?: string;
    viewDocument?: string;
    viewExtracts?: string;
    viewLearningCards?: string;
    createExtract?: string;
    again?: string;
    againTitle?: string;
    hard?: string;
    hardTitle?: string;
    good?: string;
    goodTitle?: string;
    easy?: string;
    easyTitle?: string;
    dismissLabel?: string;
    dismissTitle?: string;
    markAsRead?: string;
    markAsReadGood?: string;
    previousDocument?: string;
    nextDocument?: string;
    docShort?: string;
    cardShort?: string;
    rssShort?: string;
    extractShort?: string;
  };
}

export const ScrollOverlayControls = React.memo(function ScrollOverlayControls({
  showControls,
  currentIndex,
  totalItems,
  sessionOffset = 0,
  itemType,
  itemTitle,
  itemDocumentId,
  isNewDocument,
  isRating,
  scrollViewMode,
  helpText,
  onExit,
  onShowSettings,
  onShowRssSettings,
  onSetScrollViewMode,
  onOpenExtractDialog,
  onRate,
  onDismiss,
  onGoToNext,
  onGoToPrevious,
  detailsButton,
  labels,
}: ScrollOverlayControlsProps) {
  const isDocOrRss = itemType === "document" || itemType === "rss";
  const showRatingButtons = itemType !== "flashcard" && itemType !== "extract";

  const typeLabel = itemType === "document"
    ? labels?.docShort ?? "doc"
    : itemType === "flashcard"
      ? labels?.cardShort ?? "card"
      : itemType === "rss"
        ? labels?.rssShort ?? "rss"
        : itemType === "podcast"
          ? "podcast"
          : labels?.extractShort ?? "extract";

  const typeColor = itemType === "document"
    ? "bg-blue-500/30"
    : itemType === "flashcard"
      ? "bg-purple-500/30"
      : itemType === "rss"
        ? "bg-orange-500/30"
        : itemType === "podcast"
          ? "bg-emerald-500/30"
          : "bg-yellow-500/30";

  return (
    <div className={cn("fixed inset-0 pointer-events-none transition-opacity duration-300 z-50", showControls ? "opacity-100" : "opacity-0")}>
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/50 to-transparent pointer-events-auto">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={onExit} className="p-2 rounded-lg bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors" title={labels?.exit ?? "Exit scroll mode"}>
              <X className="w-5 h-5 text-white" />
            </button>
            <div className="text-white font-medium text-sm bg-black/40 backdrop-blur-sm px-3 py-2 rounded-lg">
              {currentIndex + 1 + sessionOffset} / {totalItems + sessionOffset}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {detailsButton}
            <button onClick={onShowSettings} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/40 backdrop-blur-sm text-white text-sm transition-colors hover:bg-black/60" title={labels?.settings ?? "Queue Settings"}>
              <Sliders className="w-4 h-4" />
              {labels?.settings ?? "Settings"}
            </button>
            <button onClick={onShowRssSettings} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/40 backdrop-blur-sm text-white text-sm transition-colors hover:bg-black/60" title={labels?.rss ?? "RSS Settings"}>
              <Rss className="w-4 h-4" />
              {labels?.rss ?? "RSS"}
            </button>
            <div className="text-white text-sm bg-black/40 backdrop-blur-sm px-3 py-2 rounded-lg max-w-[200px] sm:max-w-md truncate">
              <span className="flex items-center gap-2 truncate">
                <span className={cn("px-1.5 py-0.5 rounded text-xs shrink-0", typeColor)}>{typeLabel}</span>
                <span className="truncate">{itemTitle}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Mode Toolbar */}
      {isDocOrRss && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-auto">
          <div className="flex items-center gap-1 px-2 py-1.5 bg-black/40 backdrop-blur-sm rounded-lg">
            {itemDocumentId && (
              <div className="flex items-center gap-0.5 bg-white/10 rounded-md p-0.5">
                <button onClick={() => onSetScrollViewMode("document")} className={cn("p-1.5 rounded-md transition-colors", scrollViewMode === "document" ? "bg-white text-black shadow-sm" : "text-white/70 hover:text-white")} title={labels?.viewDocument ?? "View document"}>
                  <TextT className="w-4 h-4" />
                </button>
                <button onClick={() => onSetScrollViewMode("extracts")} className={cn("p-1.5 rounded-md transition-colors", scrollViewMode === "extracts" ? "bg-white text-black shadow-sm" : "text-white/70 hover:text-white")} title={labels?.viewExtracts ?? "View extracts"}>
                  <List className="w-4 h-4" />
                </button>
                <button onClick={() => onSetScrollViewMode("cards")} className={cn("p-1.5 rounded-md transition-colors", scrollViewMode === "cards" ? "bg-white text-black shadow-sm" : "text-white/70 hover:text-white")} title={labels?.viewLearningCards ?? "View learning cards"}>
                  <Brain className="w-4 h-4" />
                </button>
              </div>
            )}
            {scrollViewMode === "document" && itemType === "document" && (
              <button onClick={onOpenExtractDialog} className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors" title={labels?.createExtract ?? "Create extract"}>
                <Lightbulb className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Side Rating Controls */}
      {(showRatingButtons || itemType === "flashcard" || itemType === "extract") && (
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 pointer-events-auto">
          {itemType === "flashcard" || itemType === "extract" ? (
            <button type="button" onClick={onDismiss} disabled={isRating} className="group p-3 rounded-full bg-slate-500/80 backdrop-blur-sm hover:bg-slate-500 hover:scale-110 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" title={labels?.dismissTitle ?? "Dismiss"}>
              <EyeSlash className="w-6 h-6 text-white" />
              <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{labels?.dismissLabel ?? "Dismiss"}</span>
            </button>
          ) : itemType === "document" && !isNewDocument ? (
            <>
              <button type="button" onClick={() => onRate(1)} disabled={isRating} className="group p-3 rounded-full bg-red-500/80 backdrop-blur-sm hover:bg-red-500 hover:scale-110 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" title={labels?.againTitle ?? "Again"}>
                <WarningCircle className="w-6 h-6 text-white" />
                <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{labels?.again ?? "Again"}</span>
              </button>
              <button type="button" onClick={() => onRate(2)} disabled={isRating} className="group p-3 rounded-full bg-orange-500/80 backdrop-blur-sm hover:bg-orange-500 hover:scale-110 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" title={labels?.hardTitle ?? "Hard"}>
                <Star className="w-6 h-6 text-white" />
                <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{labels?.hard ?? "Hard"}</span>
              </button>
              <button type="button" onClick={() => onRate(3)} disabled={isRating} className="group p-3 rounded-full bg-blue-500/80 backdrop-blur-sm hover:bg-blue-500 hover:scale-110 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" title={labels?.goodTitle ?? "Good"}>
                <CheckCircle className="w-6 h-6 text-white" />
                <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{labels?.good ?? "Good"}</span>
              </button>
              <button type="button" onClick={() => onRate(4)} disabled={isRating} className="group p-3 rounded-full bg-green-500/80 backdrop-blur-sm hover:bg-green-500 hover:scale-110 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" title={labels?.easyTitle ?? "Easy"}>
                <Sparkle className="w-6 h-6 text-white" />
                <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{labels?.easy ?? "Easy"}</span>
              </button>
              {itemType === "document" && (
                <button type="button" onClick={onDismiss} disabled={isRating} className="group p-3 rounded-full bg-slate-500/80 backdrop-blur-sm hover:bg-slate-500 hover:scale-110 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2" title={labels?.dismissTitle ?? "Dismiss"}>
                  <EyeSlash className="w-6 h-6 text-white" />
                  <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{labels?.dismissLabel ?? "Dismiss"}</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" onClick={() => onRate(3)} disabled={isRating} className="group relative p-4 rounded-full bg-orange-500/80 backdrop-blur-sm hover:bg-orange-500 hover:scale-110 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95" title={itemType === "document" ? (labels?.markAsReadGood ?? "Mark as read (Good)") : (labels?.markAsRead ?? "Mark as read")}>
                <CheckCircle className="w-7 h-7 text-white" />
                <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{itemType === "document" ? (labels?.markAsReadGood ?? "Mark as read (Good)") : (labels?.markAsRead ?? "Mark as read")}</span>
              </button>
              {itemType === "document" && (
                <button type="button" onClick={onDismiss} disabled={isRating} className="group p-3 rounded-full bg-slate-500/80 backdrop-blur-sm hover:bg-slate-500 hover:scale-110 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2" title={labels?.dismissTitle ?? "Dismiss"}>
                  <EyeSlash className="w-6 h-6 text-white" />
                  <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{labels?.dismissLabel ?? "Dismiss"}</span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 pointer-events-auto">
        <button onClick={onGoToPrevious} disabled={currentIndex === 0} className={cn("p-3 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all shadow-lg", currentIndex === 0 && "opacity-30 cursor-not-allowed")} title={labels?.previousDocument ?? "Previous"}>
          <CaretUp className="w-6 h-6 text-white" />
        </button>
        <button onClick={onGoToNext} disabled={currentIndex === totalItems - 1} className={cn("p-3 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all shadow-lg", currentIndex === totalItems - 1 && "opacity-30 cursor-not-allowed")} title={labels?.nextDocument ?? "Next"}>
          <CaretDown className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 pointer-events-none">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${((currentIndex + 1 + sessionOffset) / (totalItems + sessionOffset)) * 100}%` }} />
      </div>

      {/* Help Text */}
      {helpText && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white text-xs bg-black/40 backdrop-blur-sm px-3 py-1 rounded-lg pointer-events-none">
          {helpText}
        </div>
      )}
    </div>
  );
});
