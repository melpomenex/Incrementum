/**
 * Interactive Tutorial Component
 * Step-by-step guide for import → extract → review flow
 * Highlights UI elements and explains each step
 */

import { useState, useEffect, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Highlighter,
  Brain,
  RotateCcw,
  Check,
  Target,
  Sparkles,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  targetSelector?: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
  spotlight?: boolean;
}

const getTutorialSteps = (t: (key: string, vars?: Record<string, string | number>) => string): TutorialStep[] => [
  {
    id: "welcome",
    title: t("onboarding.tutorialTitle"),
    description: t("onboarding.tutorialWelcomeDesc"),
    icon: Sparkles,
    position: "center",
  },
  {
    id: "import",
    title: t("onboarding.step1Title"),
    description: t("onboarding.tutorialImportDesc"),
    icon: FileUp,
    targetSelector: "[data-tutorial='import-button']",
    position: "bottom",
    spotlight: true,
  },
  {
    id: "read",
    title: t("onboarding.step2Title"),
    description: t("onboarding.tutorialReadDesc"),
    icon: Highlighter,
    targetSelector: "[data-tutorial='document-list']",
    position: "right",
    spotlight: true,
  },
  {
    id: "extract",
    title: t("onboarding.step3Title"),
    description: t("onboarding.tutorialExtractDesc"),
    icon: Target,
    position: "center",
  },
  {
    id: "review",
    title: t("onboarding.step4Title"),
    description: t("onboarding.tutorialReviewDesc"),
    icon: RotateCcw,
    targetSelector: "[data-tutorial='queue-nav']",
    position: "right",
    spotlight: true,
  },
  {
    id: "learn",
    title: t("onboarding.step5Title"),
    description: t("onboarding.tutorialProgressDesc"),
    icon: Brain,
    targetSelector: "[data-tutorial='analytics-nav']",
    position: "right",
    spotlight: true,
  },
  {
    id: "complete",
    title: t("onboarding.allSet"),
    description: t("onboarding.tutorialCompleteDesc"),
    icon: Check,
    position: "center",
  },
];

interface InteractiveTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
  startStep?: number;
}

export function InteractiveTutorial({
  onComplete,
  onSkip,
  startStep = 0,
}: InteractiveTutorialProps) {
  const { t } = useI18n();
  const tutorialSteps = getTutorialSteps(t);
  const [currentStep, setCurrentStep] = useState(startStep);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);

  const step = tutorialSteps[currentStep];
  const StepIcon = step.icon;
  const isLastStep = currentStep === tutorialSteps.length - 1;
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

  // Handle spotlight positioning
  useEffect(() => {
    if (step.targetSelector && step.spotlight) {
      const element = document.querySelector(step.targetSelector) as HTMLElement;
      if (element) {
        setHighlightedElement(element);
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("tutorial-spotlight-highlight");
      }
    } else {
      setHighlightedElement(null);
    }

    return () => {
      if (highlightedElement) {
        highlightedElement.classList.remove("tutorial-spotlight-highlight");
      }
    };
  }, [step.targetSelector, step.spotlight]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.querySelectorAll(".tutorial-spotlight-highlight").forEach((el) => {
        el.classList.remove("tutorial-spotlight-highlight");
      });
    };
  }, []);

  const handleNext = () => {
    if (highlightedElement) {
      highlightedElement.classList.remove("tutorial-spotlight-highlight");
    }

    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (highlightedElement) {
      highlightedElement.classList.remove("tutorial-spotlight-highlight");
    }
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    if (highlightedElement) {
      highlightedElement.classList.remove("tutorial-spotlight-highlight");
    }
    onSkip();
  };

  // Calculate tooltip position
  const getTooltipStyle = useCallback(() => {
    if (!step.targetSelector || !highlightedElement || step.position === "center") {
      return {};
    }

    const rect = highlightedElement.getBoundingClientRect();
    const tooltipWidth = 400;
    const tooltipHeight = 300;
    const padding = 16;

    let top = 0;
    let left = 0;

    switch (step.position) {
      case "bottom":
        top = rect.bottom + padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "top":
        top = rect.top - tooltipHeight - padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + padding;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - padding;
        break;
    }

    // Keep within viewport
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

    return {
      position: "fixed" as const,
      top: `${top}px`,
      left: `${left}px`,
    };
  }, [step, highlightedElement]);

  const isCentered = step.position === "center";

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-[100] transition-opacity duration-300 ${
          step.spotlight ? "bg-black/60" : "bg-black/50"
        }`}
        onClick={handleSkip}
      />

      {/* Spotlight cutout effect */}
      {step.spotlight && highlightedElement && (
        <SpotlightOverlay element={highlightedElement} />
      )}

      {/* Tutorial tooltip */}
      <div
        className={`z-[101] ${
          isCentered
            ? "fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
            : ""
        }`}
        style={isCentered ? undefined : getTooltipStyle()}
      >
        <div
          className={`pointer-events-auto ${
            isCentered ? "max-w-2xl w-full" : "w-[400px]"
          } bg-card border border-border rounded-2xl shadow-2xl overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative bg-gradient-to-r from-primary/20 to-primary/5 p-6">
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
              aria-label={t("onboarding.closeTutorial")}
            >
              <X className="w-5 h-5 text-foreground/60" />
            </button>

            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-primary/20 rounded-xl">
                <StepIcon className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{step.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("onboarding.stepOf", { current: currentStep + 1, total: tutorialSteps.length })}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-lg text-foreground leading-relaxed mb-6">
              {step.description}
            </p>

            {/* Step-specific visual content */}
            {step.id === "import" && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { icon: "📄", name: "PDF", desc: t("onboarding.formatPdf") },
                  { icon: "📖", name: "EPUB", desc: t("onboarding.formatEpub") },
                  { icon: "🎬", name: "YouTube", desc: t("onboarding.formatYoutube") },
                  { icon: "🌐", name: "Web", desc: t("onboarding.formatWeb") },
                ].map((format) => (
                  <div
                    key={format.name}
                    className="p-3 bg-muted/30 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{format.icon}</span>
                      <span className="font-medium text-foreground text-sm">
                        {format.name}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{format.desc}</p>
                  </div>
                ))}
              </div>
            )}

            {step.id === "extract" && (
              <div className="space-y-3 mb-6">
                {[
                  { type: t("onboarding.qaCard"), desc: t("onboarding.qaCardDesc") },
                  { type: t("onboarding.cloze"), desc: t("onboarding.clozeDesc") },
                  { type: t("onboarding.extractType"), desc: t("onboarding.extractTypeDesc") },
                ].map((item) => (
                  <div
                    key={item.type}
                    className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="p-1 bg-primary/20 rounded mt-0.5">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground text-sm">
                        {item.type}
                      </div>
                      <div className="text-xs text-muted-foreground">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {step.id === "review" && (
              <div className="bg-muted/30 rounded-lg p-4 mb-6">
                <div className="text-xs text-muted-foreground mb-2">
                  {t("onboarding.fsrsRatingButtons")}
                </div>
                <div className="flex gap-2">
                  {[
                    { label: t("review.again"), color: "bg-red-500/20 text-red-400" },
                    { label: t("review.hard"), color: "bg-orange-500/20 text-orange-400" },
                    { label: t("review.good"), color: "bg-green-500/20 text-green-400" },
                    { label: t("review.easy"), color: "bg-blue-500/20 text-blue-400" },
                  ].map((btn) => (
                    <span
                      key={btn.label}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${btn.color}`}
                    >
                      {btn.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {step.id === "complete" && (
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <span className="font-medium text-foreground">{t("onboarding.tutorialQuickTips")}</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>{t("onboarding.tutorialShortcutsHint", { key: "?" })}</li>
                  <li>{t("onboarding.tutorialCommandPaletteHint", { key: "Ctrl/⌘ + K" })}</li>
                  <li>{t("onboarding.tutorialDailyReviews")}</li>
                </ul>
              </div>
            )}

            {/* Step indicators */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {tutorialSteps.map((s, index) => (
                <button
                  key={s.id}
                  onClick={() => {
                    if (highlightedElement) {
                      highlightedElement.classList.remove("tutorial-spotlight-highlight");
                    }
                    setCurrentStep(index);
                  }}
                  className={`w-3 h-3 rounded-full transition-all ${
                    index === currentStep
                      ? "bg-primary w-8"
                      : index < currentStep
                      ? "bg-primary/50"
                      : "bg-muted"
                  }`}
                  aria-label={t("onboarding.goToStep", { step: index + 1 })}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-border bg-muted/20">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-4 py-2 text-foreground/70 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {t("common.back")}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-foreground/70 hover:text-foreground transition-colors"
              >
                {t("onboarding.skipTutorial")}
              </button>
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                {isLastStep ? t("onboarding.startLearning") : t("common.next")}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Spotlight overlay that creates a cutout effect around the target element
 */
function SpotlightOverlay({ element }: { element: HTMLElement }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const updateRect = () => {
      setRect(element.getBoundingClientRect());
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [element]);

  if (!rect) return null;

  const padding = 8;
  const borderRadius = 8;

  return (
    <svg
      className="fixed inset-0 z-[100] pointer-events-none"
      style={{ width: "100vw", height: "100vh" }}
    >
      <defs>
        <mask id="tutorial-spotlight-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect
            x={rect.left - padding}
            y={rect.top - padding}
            width={rect.width + padding * 2}
            height={rect.height + padding * 2}
            rx={borderRadius}
            ry={borderRadius}
            fill="black"
          />
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0, 0, 0, 0.6)"
        mask="url(#tutorial-spotlight-mask)"
      />
      {/* Highlight border */}
      <rect
        x={rect.left - padding}
        y={rect.top - padding}
        width={rect.width + padding * 2}
        height={rect.height + padding * 2}
        rx={borderRadius}
        ry={borderRadius}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        className="animate-pulse"
      />
    </svg>
  );
}

/**
 * Hook to manage tutorial state and persistence
 */
export function useInteractiveTutorial() {
  const [shouldShow, setShouldShow] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const completed = localStorage.getItem("incrementum_tutorial_completed");
    const hasDocuments = localStorage.getItem("incrementum_has_documents");

    // Show tutorial if not completed and user is new (no documents)
    if (!completed && !hasDocuments) {
      setShouldShow(true);
    }
  }, []);

  const markCompleted = () => {
    localStorage.setItem("incrementum_tutorial_completed", "true");
    setShouldShow(false);
  };

  const skip = () => {
    localStorage.setItem("incrementum_tutorial_completed", "skipped");
    setShouldShow(false);
  };

  const reset = () => {
    localStorage.removeItem("incrementum_tutorial_completed");
    setShouldShow(true);
    setCurrentStep(0);
  };

  return {
    shouldShow,
    currentStep,
    setCurrentStep,
    markCompleted,
    skip,
    reset,
  };
}

/**
 * Feature spotlight component for highlighting specific UI elements
 */
interface FeatureSpotlightProps {
  targetId: string;
  title: string;
  description: string;
  onDismiss: () => void;
  position?: "top" | "bottom" | "left" | "right";
}

export function FeatureSpotlight({
  targetId,
  title,
  description,
  onDismiss,
  position = "bottom",
}: FeatureSpotlightProps) {
  const { t } = useI18n();
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const element = document.querySelector(`[data-tutorial='${targetId}']`) as HTMLElement;
    if (element) {
      setTargetElement(element);
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [targetId]);

  if (!targetElement) return null;

  const rect = targetElement.getBoundingClientRect();
  const padding = 16;
  const tooltipWidth = 320;

  let top = 0;
  let left = 0;

  switch (position) {
    case "bottom":
      top = rect.bottom + padding;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      break;
    case "top":
      top = rect.top - 150 - padding;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      break;
    default:
      top = rect.bottom + padding;
      left = rect.left;
  }

  // Keep within viewport
  left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));

  return (
    <>
      <SpotlightOverlay element={targetElement} />
      <div
        className="fixed z-[101] w-80"
        style={{ top: `${top}px`, left: `${left}px` }}
      >
        <div className="bg-card border border-border rounded-xl shadow-2xl p-4">
          <h3 className="font-semibold text-foreground mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground mb-3">{description}</p>
          <button
            onClick={onDismiss}
            className="w-full px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            {t("onboarding.gotIt")}
          </button>
        </div>
      </div>
    </>
  );
}

export default InteractiveTutorial;
