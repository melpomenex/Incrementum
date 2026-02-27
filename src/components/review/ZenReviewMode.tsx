/**
 * Zen Review Mode
 * 
 * Absolute minimal UI for distraction-free review sessions.
 * Philosophy: Only the card text exists. Everything else is invisible.
 * 
 * Features:
 * - No visible buttons, progress bars, or headers
 * - Pure keyboard grading (1-4, Space)
 * - Subtle FSRS metadata (10px monospace, bottom-right)
 * - Context Peek: Hold Alt to see source document context
 * - Instant card transitions (no animations)
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useReviewStore, type ReviewSessionItem } from "../../stores/reviewStore";
import { ReviewRating, formatInterval } from "../../api/review";
import { cn } from "../../utils";
import { renderAnkiHtmlWithLatex } from "../../utils/ankiLatex";

interface ZenReviewModeProps {
  onExit: () => void;
}

// Minimal card display - just the content
function ZenCard({ 
  item, 
  showAnswer,
  onShowAnswer 
}: { 
  item: ReviewSessionItem; 
  showAnswer: boolean;
  onShowAnswer: () => void;
}) {
  const isDocument = (item as any).itemType === "document";
  
  if (isDocument) {
    const docItem = item as any;
    return (
      <div className="max-w-3xl mx-auto">
        <div className="text-xs text-muted-foreground/50 mb-4 font-mono tracking-wide">
          {docItem.documentTitle || "Document Review"}
        </div>
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <div 
            className="text-foreground/90 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: docItem.extractContent || docItem.content || "" }}
          />
        </div>
      </div>
    );
  }

  const card = item as any;
  
  return (
    <div className="max-w-2xl mx-auto text-center">
      {/* Question */}
      <div 
        className={cn(
          "prose prose-xl dark:prose-invert max-w-none transition-opacity duration-75",
          showAnswer && "opacity-60"
        )}
        dangerouslySetInnerHTML={{ 
          __html: renderAnkiHtmlWithLatex(card.question || card.cloze_text || "No question") 
        }}
      />
      
      {/* Answer reveal */}
      {!showAnswer ? (
        <button
          onClick={onShowAnswer}
          className="mt-12 text-sm text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors tracking-widest uppercase"
        >
          Press Space to reveal
        </button>
      ) : (
        <div className="mt-8 pt-8 border-t border-border/20">
          <div 
            className="prose prose-lg dark:prose-invert max-w-none text-foreground/80"
            dangerouslySetInnerHTML={{ 
              __html: renderAnkiHtmlWithLatex(card.answer || "No answer") 
            }}
          />
        </div>
      )}
    </div>
  );
}

// Subtle FSRS metadata display
function FSRSMetadata({ 
  stability, 
  difficulty, 
  retrievability,
  interval 
}: { 
  stability?: number; 
  difficulty?: number; 
  retrievability?: number;
  interval?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!stability && !difficulty && !retrievability) return null;
  
  return (
    <div 
      className="fixed bottom-4 right-4 z-50 text-right select-none"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {isExpanded ? (
        <div className="text-[11px] font-mono text-muted-foreground/40 space-y-0.5 bg-background/80 backdrop-blur-sm px-3 py-2 rounded">
          <div>S: {stability?.toFixed(1) || "-"}d</div>
          <div>R: {retrievability ? `${(retrievability * 100).toFixed(0)}%` : "-"}</div>
          <div>D: {difficulty?.toFixed(1) || "-"}</div>
          <div>I: {interval ? formatInterval(interval) : "-"}</div>
        </div>
      ) : (
        <div className="text-[10px] font-mono text-muted-foreground/30">
          S:{stability?.toFixed(0) || "-"}d R:{retrievability ? `${(retrievability * 100).toFixed(0)}` : "-"}%
        </div>
      )}
    </div>
  );
}

// Context Peek - shows source context when Alt is held
function ContextPeek({ 
  item,
  isVisible 
}: { 
  item: ReviewSessionItem | null;
  isVisible: boolean;
}) {
  if (!item || !isVisible) return null;
  
  const context = (item as any).context || (item as any).extractContext || (item as any).documentContext;
  const title = (item as any).documentTitle || (item as any).sourceTitle || "Source";
  
  if (!context) return null;
  
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-8 pointer-events-none">
      <div className="absolute inset-0 bg-background/95 backdrop-blur-sm" />
      <div className="relative max-w-3xl max-h-[70vh] overflow-auto bg-card border border-border/50 rounded-lg p-6 shadow-2xl">
        <div className="text-xs font-mono text-muted-foreground/60 mb-3 uppercase tracking-wider">
          {title}
        </div>
        <div 
          className="prose prose-sm dark:prose-invert text-foreground/80"
          dangerouslySetInnerHTML={{ __html: context }}
        />
        <div className="mt-4 text-xs text-muted-foreground/40 text-center">
          Release Alt to return
        </div>
      </div>
    </div>
  );
}

// Session timer - subtle fade when inactive
function SessionTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);
  
  // Fade out after inactivity
  useEffect(() => {
    const handleActivity = () => {
      setIsVisible(true);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = setTimeout(() => setIsVisible(false), 3000);
    };
    
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    fadeTimeoutRef.current = setTimeout(() => setIsVisible(false), 3000);
    
    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, []);
  
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  
  return (
    <div 
      className={cn(
        "fixed top-4 left-1/2 -translate-x-1/2 text-xs font-mono text-muted-foreground/30 transition-opacity duration-500",
        !isVisible && "opacity-0"
      )}
    >
      {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
    </div>
  );
}

export function ZenReviewMode({ onExit }: ZenReviewModeProps) {
  const {
    currentCard,
    queue,
    isLoading,
    isAnswerShown,
    isSubmitting,
    error,
    currentIndex,
    previewIntervals: _previewIntervals,
    showAnswer,
    submitRating,
    nextCard,
    sessionStartTime,
  } = useReviewStore();
  
  const [contextPeekVisible, setContextPeekVisible] = useState(false);
  const [justRated, setJustRated] = useState(false);
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt key for context peek
      if (e.key === "Alt") {
        e.preventDefault();
        setContextPeekVisible(true);
        return;
      }
      
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Exit on Escape
      if (e.key === "Escape") {
        onExit();
        return;
      }
      
      // Space to show answer
      if (e.key === " " && !isAnswerShown && currentCard) {
        e.preventDefault();
        showAnswer();
        return;
      }
      
      // Rating keys (only when answer shown)
      if (isAnswerShown && currentCard && !isSubmitting && !justRated) {
        const key = e.key;
        if (key >= "1" && key <= "4") {
          e.preventDefault();
          const rating = parseInt(key) as ReviewRating;
          handleRating(rating);
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setContextPeekVisible(false);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isAnswerShown, currentCard, isSubmitting, justRated, onExit, showAnswer]);
  
  const handleRating = useCallback(async (rating: ReviewRating) => {
    if (justRated || isSubmitting) return;
    
    setJustRated(true);
    await submitRating(rating);
    
    // Instant transition - no animation delay
    setTimeout(() => {
      nextCard();
      setJustRated(false);
    }, 50);
  }, [justRated, isSubmitting, submitRating, nextCard]);
  
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground/30 text-sm">Loading...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-muted-foreground mb-4">Error: {error}</div>
          <button onClick={onExit} className="text-sm text-primary hover:underline">
            Exit
          </button>
        </div>
      </div>
    );
  }
  
  if (queue.length === 0 || !currentCard) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-4 opacity-30">◉</div>
          <div className="text-muted-foreground/50 mb-6">Session complete</div>
          <button 
            onClick={onExit}
            className="text-sm text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
          >
            Press Escape to exit
          </button>
        </div>
      </div>
    );
  }
  
  const currentCardData = currentCard as any;
  
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 md:p-16 relative">
      {/* Session Timer */}
      {sessionStartTime && <SessionTimer startTime={sessionStartTime} />}
      
      {/* Card Content */}
      <div className={cn(
        "w-full flex-1 flex items-center justify-center",
        justRated && "opacity-0"
      )}>
        <ZenCard 
          item={currentCard} 
          showAnswer={isAnswerShown}
          onShowAnswer={showAnswer}
        />
      </div>
      
      {/* Subtle hint at bottom */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/20">
        {isAnswerShown ? (
          <span className="tracking-widest">1 2 3 4</span>
        ) : (
          <span className="tracking-wide">Space</span>
        )}
      </div>
      
      {/* FSRS Metadata */}
      <FSRSMetadata 
        stability={currentCardData.stability}
        difficulty={currentCardData.difficulty}
        retrievability={currentCardData.retrievability}
        interval={currentCardData.interval}
      />
      
      {/* Context Peek Overlay */}
      <ContextPeek 
        item={currentCard} 
        isVisible={contextPeekVisible}
      />
      
      {/* Progress indicator - ultra subtle dots */}
      <div className="fixed top-4 right-4 flex gap-1">
        {queue.slice(0, 20).map((_, i) => (
          <div 
            key={i}
            className={cn(
              "w-1 h-1 rounded-full transition-colors duration-75",
              i < currentIndex ? "bg-muted-foreground/20" : 
              i === currentIndex ? "bg-muted-foreground/40" : 
              "bg-muted-foreground/5"
            )}
          />
        ))}
        {queue.length > 20 && (
          <div className="text-[8px] text-muted-foreground/20 ml-1">
            +{queue.length - 20}
          </div>
        )}
      </div>
    </div>
  );
}
