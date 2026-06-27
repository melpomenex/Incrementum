import React, { useState, useEffect } from "react";
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
  isEpub?: boolean;
  /** When true (mobile), render a persistent thumb-reachable bottom action bar
   *  instead of the desktop side-orb + bottom-arrow chrome. */
  isMobile?: boolean;
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
  isEpub = false,
  isMobile = false,
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
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const isDocOrRss = itemType === "document" || itemType === "rss";
  const showRatingButtons = itemType !== "flashcard" && itemType !== "extract";

  // The help hint ("Rate or use Alt+Arrows…") auto-hides a few seconds after the
  // item changes. On mobile/touch the whole overlay stays visible (controls are
  // always reachable), but the hint was covering the podcast controls — so it
  // fades on its own after 3.5s, and re-shows briefly whenever the item changes.
  const [showHint, setShowHint] = useState(true);
  useEffect(() => {
    setShowHint(true);
    const id = setTimeout(() => setShowHint(false), 3500);
    return () => clearTimeout(id);
  }, [itemDocumentId, itemType, currentIndex]);

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
    <>
    {/* The desktop chrome (top bar, side orbs, bottom arrows) fades with
        showControls. On mobile we keep the overlay visible — the auto-hide is
        mouse-move driven (a phone has no mouse-move), and hiding controls while
        watching a video makes rating/navigation unreachable. The mobile bottom
        action bar below is rendered independently so it's always usable. */}
    <div className={cn("fixed inset-0 pointer-events-none transition-opacity duration-300 z-50", (showControls || isMobile || isTouchDevice) ? "opacity-100" : "opacity-0")}>
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 pt-[calc(16px+env(safe-area-inset-top,0px))] px-4 pb-4 bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3 pointer-events-auto">
            <button onClick={onExit} className="p-2 rounded-lg bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors" title={labels?.exit ?? "Exit scroll mode"}>
              <X className="w-5 h-5 text-white" />
            </button>
            <div className="text-white font-medium text-sm bg-black/40 backdrop-blur-sm px-3 py-2 rounded-lg">
              {currentIndex + 1 + sessionOffset} / {totalItems + sessionOffset}
            </div>
          </div>

          <div className="flex items-center gap-3 pointer-events-auto">
            {detailsButton}
            {!isMobile && (
              <>
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
              </>
            )}
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

      {/* Bottom Navigation (desktop/PWA layout — vertical carets) */}
      {true && (
        <div className={cn("absolute left-1/2 -translate-x-1/2 flex flex-col gap-2 pointer-events-auto", isTouchDevice ? "bottom-[calc(24px+env(safe-area-inset-bottom,0px))]" : "bottom-6")}>
          <button onClick={onGoToPrevious} disabled={currentIndex === 0} className={cn("p-3 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all shadow-lg", currentIndex === 0 && "opacity-30 cursor-not-allowed")} title={labels?.previousDocument ?? "Previous"}>
            <CaretUp className="w-6 h-6 text-white" />
          </button>
          <button onClick={onGoToNext} disabled={currentIndex === totalItems - 1} className={cn("p-3 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all shadow-lg", currentIndex === totalItems - 1 && "opacity-30 cursor-not-allowed")} title={labels?.nextDocument ?? "Next"}>
            <CaretDown className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* Mobile Bottom Action Bar — disabled in favor of desktop/PWA layout */}
      {false && isMobile && (
        <div className="absolute bottom-0 left-0 right-0 pointer-events-auto pb-[max(16px,env(safe-area-inset-bottom,0px))] bg-black/80">
          <div className="flex items-center gap-2 px-3 pb-3 pt-2 bg-gradient-to-t from-black/80 via-black/60 to-transparent">
            {/* Previous */}
            <button
              onClick={onGoToPrevious}
              disabled={currentIndex === 0}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1.5 px-2 rounded-lg text-white text-[10px] font-medium transition-colors",
                currentIndex === 0 ? "opacity-30" : "active:bg-white/10"
              )}
              title={labels?.previousDocument ?? "Previous"}
            >
              <CaretUp className="w-6 h-6" weight="bold" />
            </button>

            {/* Rating cluster — mirrors the side-orb logic, horizontal + touch-sized */}
            {showRatingButtons && (
              <div className="flex-1 flex items-center justify-center gap-1.5">
                {itemType === "document" && !isNewDocument ? (
                  <>
                    {/* Reviewed document: full FSRS Again/Hard/Good/Easy */}
                    <MobileRateButton label={labels?.again ?? "Again"} title={labels?.againTitle ?? "Again"} color="bg-red-500/90 active:bg-red-600" disabled={isRating} onClick={() => onRate(1)} />
                    <MobileRateButton label={labels?.hard ?? "Hard"} title={labels?.hardTitle ?? "Hard"} color="bg-orange-500/90 active:bg-orange-600" disabled={isRating} onClick={() => onRate(2)} />
                    <MobileRateButton label={labels?.good ?? "Good"} title={labels?.goodTitle ?? "Good"} color="bg-blue-500/90 active:bg-blue-600" disabled={isRating} onClick={() => onRate(3)} />
                    <MobileRateButton label={labels?.easy ?? "Easy"} title={labels?.easyTitle ?? "Easy"} color="bg-green-500/90 active:bg-green-600" disabled={isRating} onClick={() => onRate(4)} />
                  </>
                ) : (
                  /* New/unreviewed document: single prominent Mark-as-read (rating 3) */
                  <button
                    onClick={() => onRate(3)}
                    disabled={isRating}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500/90 active:bg-orange-600 text-white text-sm font-semibold shadow-lg disabled:opacity-50 transition-colors"
                    title={itemType === "document" ? (labels?.markAsReadGood ?? "Mark as read (Good)") : (labels?.markAsRead ?? "Mark as read")}
                  >
                    <CheckCircle className="w-5 h-5" />
                    {itemType === "document" ? (labels?.markAsReadGood ?? "Mark as Read") : (labels?.markAsRead ?? "Mark as Read")}
                  </button>
                )}
              </div>
            )}

            {/* Dismiss (documents only) */}
            {showRatingButtons && itemType === "document" && (
              <button
                onClick={onDismiss}
                disabled={isRating}
                className="flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1.5 px-2 rounded-lg text-white/80 text-[10px] font-medium active:bg-white/10 transition-colors disabled:opacity-50"
                title={labels?.dismissTitle ?? "Dismiss"}
              >
                <EyeSlash className="w-6 h-6" />
              </button>
            )}

            {/* Next */}
            <button
              onClick={onGoToNext}
              disabled={currentIndex === totalItems - 1}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1.5 px-2 rounded-lg text-white text-[10px] font-medium transition-colors",
                currentIndex === totalItems - 1 ? "opacity-30" : "active:bg-white/10"
              )}
              title={labels?.nextDocument ?? "Next"}
            >
              <CaretDown className="w-6 h-6" weight="bold" />
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar (sits at the very bottom on desktop; raised just above the safe area on touch devices) */}
      <div className={cn("absolute left-0 right-0 h-1 bg-black/20 pointer-events-none", isTouchDevice ? "bottom-[env(safe-area-inset-bottom,0px)]" : "bottom-0")}>
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${((currentIndex + 1 + sessionOffset) / (totalItems + sessionOffset)) * 100}%` }} />
      </div>

      {/* Help Text (auto-hides after a few seconds; see showHint) */}
      {helpText && showHint && (
        <div className={cn("absolute left-1/2 -translate-x-1/2 text-white text-xs bg-black/40 backdrop-blur-sm px-3 py-1 rounded-lg pointer-events-none transition-opacity duration-500", isTouchDevice ? "bottom-[calc(80px+env(safe-area-inset-bottom,0px))]" : "bottom-20")}>
          {helpText}
        </div>
      )}
    </div>
    </>
  );
});

/** Compact touch-friendly rating button for the mobile bottom action bar. */
function MobileRateButton({
  label,
  title,
  color,
  disabled,
  onClick,
}: {
  label: string;
  title: string;
  color: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-white text-[11px] font-medium shadow transition-colors disabled:opacity-50",
        color
      )}
    >
      <span className="leading-tight">{label.split(" ")[0]}</span>
    </button>
  );
}
