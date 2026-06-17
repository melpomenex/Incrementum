/**
 * Break Reminder Modal
 * Shows after 30 minutes of continuous review to encourage taking a break
 */

import { useState, useEffect } from "react";
import {
  ArrowsClockwise,
  Brain,
  Coffee,
  Timer,
  X,
} from "@phosphor-icons/react";
import { useI18n } from "../../lib/i18n";

interface BreakReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  sessionMinutes: number;
}

export function BreakReminderModal({
  isOpen,
  onClose,
  onContinue,
  sessionMinutes,
}: BreakReminderModalProps) {
  const { t } = useI18n();
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(30);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full animate-glass-scale-in">
        {/* Header */}
        <div className="relative p-6 text-center border-b border-border bg-gradient-to-b from-amber-500/10 to-transparent">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-muted rounded-full transition-colors"
            aria-label={t("common.close")}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>

          <div className="w-16 h-16 bg-gradient-to-br from-amber-500/30 to-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Coffee className="w-8 h-8 text-amber-500" />
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-1">
            {t("breakReminder.title")}
          </h2>
          <p className="text-muted-foreground">
            {t("breakReminder.reviewingFor", { count: sessionMinutes })}
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Session Stats */}
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Timer className="w-6 h-6 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">{sessionMinutes}</div>
              <div className="text-xs text-muted-foreground">{t("breakReminder.minutes")}</div>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Brain className="w-6 h-6 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">{t("breakReminder.focus")}</div>
              <div className="text-xs text-muted-foreground">{t("breakReminder.greatJob")}</div>
            </div>
          </div>

          {/* Benefits */}
          <div className="bg-muted/30 rounded-xl p-4 mb-6 border border-border">
            <h3 className="text-sm font-medium text-foreground mb-3">
              {t("breakReminder.whyTakeBreak")}
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{t("breakReminder.benefitEyes")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{t("breakReminder.benefitMemory")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{t("breakReminder.benefitFocus")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{t("breakReminder.benefitStretch")}</span>
              </li>
            </ul>
          </div>

          {/* Suggestion */}
          <div className="text-center mb-4">
            <p className="text-sm text-muted-foreground">
              {t("breakReminder.considerTaking")} <strong>{t("breakReminder.fiveMinuteBreak")}</strong> {t("breakReminder.considerSuffix")}
            </p>
          </div>

          {/* Countdown for suggested break */}
          <div className="flex items-center justify-center gap-2 text-amber-500 mb-4">
            <ArrowsClockwise className="w-4 h-4 animate-spin" style={{ animationDuration: "3s" }} />
            <span className="text-sm">{t("breakReminder.suggestedFor", { time: formatTime(countdown) })}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 min-h-[44px] border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
          >
            {t("breakReminder.takeBreak")}
          </button>
          <button
            onClick={() => {
              onContinue();
              onClose();
            }}
            className="flex-1 px-4 py-2.5 min-h-[44px] bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            {t("breakReminder.continueReviewing")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to track session time and show break reminder
 */
export function useBreakReminder(
  sessionStartTime: number | null,
  reminderIntervalMinutes: number = 30
) {
  const [showReminder, setShowReminder] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const [lastReminderTime, setLastReminderTime] = useState(0);
  const [reminderDismissed, setReminderDismissed] = useState(false);

  useEffect(() => {
    if (!sessionStartTime) {
      setShowReminder(false);
      setSessionMinutes(0);
      setLastReminderTime(0);
      setReminderDismissed(false);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - sessionStartTime) / 1000 / 60);
      setSessionMinutes(elapsed);

      // Show reminder if we've crossed a reminder interval threshold
      // and it's been at least one interval since the last reminder
      const reminderThreshold = Math.floor(elapsed / reminderIntervalMinutes);
      if (
        reminderThreshold > lastReminderTime / reminderIntervalMinutes &&
        elapsed >= reminderIntervalMinutes &&
        !reminderDismissed
      ) {
        setShowReminder(true);
        setLastReminderTime(elapsed);
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [sessionStartTime, reminderIntervalMinutes, reminderDismissed]);

  const dismissReminder = () => {
    setShowReminder(false);
    setReminderDismissed(true);
  };

  const continueAfterReminder = () => {
    setShowReminder(false);
    setReminderDismissed(false);
  };

  const resetReminder = () => {
    setShowReminder(false);
    setReminderDismissed(false);
    setLastReminderTime(0);
  };

  return {
    showReminder,
    sessionMinutes,
    dismissReminder,
    continueAfterReminder,
    resetReminder,
  };
}

export default BreakReminderModal;
