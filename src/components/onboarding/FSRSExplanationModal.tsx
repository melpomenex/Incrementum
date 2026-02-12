/**
 * FSRS Explanation Modal
 * Explains the rating system (Again/Hard/Good/Easy) and how intervals work
 * Shown only on first review session
 */

import { useState, useEffect } from "react";
import {
  X,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  Zap,
  Brain,
  Clock,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Target,
} from "lucide-react";

interface FSRSExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ExplanationStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

const explanationSteps: ExplanationStep[] = [
  {
    id: "welcome",
    title: "Welcome to Spaced Repetition",
    description: "Learn how Incrementum helps you remember what you learn using the FSRS algorithm.",
    icon: Brain,
    content: (
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4">
          <p className="text-sm text-foreground">
            Spaced repetition is a learning technique where you review information at increasing intervals.
            The <strong>FSRS algorithm</strong> (Free Spaced Repetition Scheduler) optimizes these intervals
            based on how well you know each card.
          </p>
        </div>
        <div className="flex items-center gap-4 justify-center">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <Clock className="w-6 h-6 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground">Reviews at optimal times</p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
          <div className="text-center">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="w-6 h-6 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground">Intervals increase as you learn</p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <Brain className="w-6 h-6 text-purple-500" />
            </div>
            <p className="text-xs text-muted-foreground">Long-term retention</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "ratings",
    title: "Rate Your Recall",
    description: "After seeing the answer, rate how well you remembered it.",
    icon: Target,
    content: (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-foreground">Again</div>
                <div className="text-xs text-muted-foreground">Press 1</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              You forgot completely. The card will appear again <strong>very soon</strong>.
            </p>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                <ThumbsDown className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-foreground">Hard</div>
                <div className="text-xs text-muted-foreground">Press 2</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              You remembered, but it was difficult. The interval increases <strong>slightly</strong>.
            </p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <ThumbsUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-foreground">Good</div>
                <div className="text-xs text-muted-foreground">Press 3</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              You remembered correctly. This is the <strong>default</strong> choice for successful recalls.
            </p>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-foreground">Easy</div>
                <div className="text-xs text-muted-foreground">Press 4</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              You knew it instantly. The interval increases <strong>significantly</strong>.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Tip: Be honest with your ratings! The algorithm works best with accurate feedback.
        </p>
      </div>
    ),
  },
  {
    id: "intervals",
    title: "How Intervals Work",
    description: "The time between reviews increases as you successfully recall cards.",
    icon: Clock,
    content: (
      <div className="space-y-4">
        <div className="bg-muted/30 rounded-xl p-4">
          <div className="text-sm font-medium text-foreground mb-3">Example: Learning a new card</div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-16 text-right text-xs text-muted-foreground">Review 1</div>
              <div className="flex-1 h-6 bg-blue-500 rounded flex items-center px-2 text-xs text-white">
                Rate "Good" → Next: 1 day
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-16 text-right text-xs text-muted-foreground">Review 2</div>
              <div className="flex-1 h-6 bg-blue-500/80 rounded flex items-center px-2 text-xs text-white">
                Rate "Good" → Next: 3 days
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-16 text-right text-xs text-muted-foreground">Review 3</div>
              <div className="flex-1 h-6 bg-blue-500/60 rounded flex items-center px-2 text-xs text-white">
                Rate "Good" → Next: 8 days
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-16 text-right text-xs text-muted-foreground">Review 4</div>
              <div className="flex-1 h-6 bg-blue-500/40 rounded flex items-center px-2 text-xs text-white">
                Rate "Good" → Next: 20 days
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-16 text-right text-xs text-muted-foreground">Review 5+</div>
              <div className="flex-1 h-6 bg-green-500/40 rounded flex items-center px-2 text-xs text-white">
                Intervals continue to grow...
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-sm text-foreground">
            <strong>The key insight:</strong> The more you successfully recall something, the longer the interval becomes.
            Eventually, you may only review cards once every few months!
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "tips",
    title: "Tips for Effective Learning",
    description: "Make the most of your review sessions with these best practices.",
    icon: BookOpen,
    content: (
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3 bg-card border border-border rounded-lg">
          <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-green-500 text-sm font-bold">1</span>
          </div>
          <div>
            <div className="font-medium text-foreground text-sm">Review daily</div>
            <p className="text-xs text-muted-foreground">
              Consistent daily reviews are more effective than occasional long sessions.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-card border border-border rounded-lg">
          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-blue-500 text-sm font-bold">2</span>
          </div>
          <div>
            <div className="font-medium text-foreground text-sm">Be honest with ratings</div>
            <p className="text-xs text-muted-foreground">
              Don't rate "Easy" just to skip ahead. Accurate ratings improve the algorithm.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-card border border-border rounded-lg">
          <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-purple-500 text-sm font-bold">3</span>
          </div>
          <div>
            <div className="font-medium text-foreground text-sm">Use keyboard shortcuts</div>
            <p className="text-xs text-muted-foreground">
              Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Space</kbd> to show answer,
              and <kbd className="px-1 py-0.5 bg-muted rounded text-xs">1-4</kbd> to rate.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-card border border-border rounded-lg">
          <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-amber-500 text-sm font-bold">4</span>
          </div>
          <div>
            <div className="font-medium text-foreground text-sm">Trust the intervals</div>
            <p className="text-xs text-muted-foreground">
              If FSRS says review in 30 days, trust it! Fighting the algorithm reduces effectiveness.
            </p>
          </div>
        </div>
      </div>
    ),
  },
];

const STORAGE_KEY = "incrementum_fsrs_explanation_shown";

export function FSRSExplanationModal({ isOpen, onClose }: FSRSExplanationModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = explanationSteps[currentStep];
  const StepIcon = step.icon;
  const isLastStep = currentStep === explanationSteps.length - 1;
  const isFirstStep = currentStep === 0;
  const progress = ((currentStep + 1) / explanationSteps.length) * 100;

  const handleNext = () => {
    if (isLastStep) {
      localStorage.setItem(STORAGE_KEY, "true");
      onClose();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-primary/20 to-primary/5 p-6">
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Close"
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
                Step {currentStep + 1} of {explanationSteps.length}
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
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          <p className="text-muted-foreground mb-4">{step.description}</p>
          {step.content}

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {explanationSteps.map((s, index) => (
              <button
                key={s.id}
                onClick={() => setCurrentStep(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentStep
                    ? "bg-primary w-8"
                    : index < currentStep
                    ? "bg-primary/50"
                    : "bg-muted"
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-muted/20">
          <button
            onClick={handleBack}
            disabled={isFirstStep}
            className="flex items-center gap-2 px-4 py-2 text-foreground/70 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-foreground/70 hover:text-foreground transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              {isLastStep ? "Start Reviewing" : "Next"}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check if FSRS explanation should be shown
 */
export function useFSRSExplanation() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const shown = localStorage.getItem(STORAGE_KEY);
    if (!shown) {
      setShouldShow(true);
    }
  }, []);

  const markShown = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShouldShow(false);
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setShouldShow(true);
  };

  return { shouldShow, markShown, reset };
}

export default FSRSExplanationModal;
