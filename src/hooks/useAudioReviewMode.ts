/**
 * Hands-free audio read-aloud review mode.
 *
 * Orchestrates the per-card flow:
 *   speak-question → (auto-flip | await-flip) → speak-answer → advance → repeat
 *
 * Built on top of the existing `useTTS` hook, which already handles provider
 * fallback (fal/groq/pocket → Web Speech API). This hook only adds the
 * state machine and integration glue; all TTS provider logic stays in useTTS.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTTS } from "./useTTS";
import { useSettingsStore } from "../stores/settingsStore";

export type AudioReviewStatus =
  | "idle"
  | "speaking-question"
  | "awaiting-flip"
  | "speaking-answer"
  | "advancing";

export interface AudioReviewModeOptions {
  /** Card identifier currently in view (used to trigger the flow on card change). */
  cardId: string | null;
  /** Plain-text question/prompt to speak. */
  questionText: string;
  /** Plain-text answer to speak (empty = no answer step). */
  answerText: string;
  /** Whether the answer is currently revealed. */
  isAnswerShown: boolean;
  /** Triggered when the flow wants to flip the card. */
  onFlip: () => void;
  /** Triggered when the flow wants to advance to the next card. */
  onAdvance: () => void;
}

export interface AudioReviewModeReturn {
  isEnabled: boolean;
  enable: () => void;
  disable: () => void;
  toggle: () => void;
  status: AudioReviewStatus;
  /** Short-circuit the current utterance and move to the next step. */
  onUserAdvance: () => void;
  lastError: string | null;
  isSupported: boolean;
}

export function useAudioReviewMode(opts: AudioReviewModeOptions): AudioReviewModeReturn {
  const { cardId, questionText, answerText, isAnswerShown, onFlip, onAdvance } = opts;
  const tts = useTTS();
  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  const audioConfig = settings.audioReviewMode ?? {
    enabled: false,
    autoFlip: true,
    autoFlipDelayMs: 1500,
    defaultRating: 3 as const,
  };

  const [isEnabled, setIsEnabled] = useState<boolean>(audioConfig.enabled);
  const [status, setStatus] = useState<AudioReviewStatus>("idle");

  // Refs so the TTS callbacks always see fresh values without re-subscribing.
  const stateRef = useRef({
    questionText,
    answerText,
    isAnswerShown,
    autoFlip: audioConfig.autoFlip,
    autoFlipDelayMs: audioConfig.autoFlipDelayMs,
    onFlip,
    onAdvance,
  });
  stateRef.current = {
    questionText,
    answerText,
    isAnswerShown,
    autoFlip: audioConfig.autoFlip,
    autoFlipDelayMs: audioConfig.autoFlipDelayMs,
    onFlip,
    onAdvance,
  };

  const advanceStepRef = useRef<(() => void) | null>(null);

  const enable = useCallback(() => {
    setIsEnabled(true);
    updateSettings({ audioReviewMode: { ...audioConfig, enabled: true } });
  }, [audioConfig, updateSettings]);

  const disable = useCallback(() => {
    setIsEnabled(false);
    setStatus("idle");
    tts.stop();
    updateSettings({ audioReviewMode: { ...audioConfig, enabled: false } });
  }, [audioConfig, updateSettings, tts]);

  const toggle = useCallback(() => {
    if (isEnabled) disable();
    else enable();
  }, [isEnabled, enable, disable]);

  /**
   * Speak the question, then transition based on autoFlip setting.
   * Bound as the active step so user-advance can short-circuit it.
   */
  const speakQuestion = useCallback(() => {
    if (!stateRef.current.questionText.trim()) {
      // Nothing to speak — proceed straight to flip logic.
      handleQuestionEnd();
      return;
    }
    setStatus("speaking-question");
    advanceStepRef.current = () => {
      tts.stop();
      handleQuestionEnd();
    };
    tts.speak(stateRef.current.questionText).finally(() => {
      // useTTS fires onend internally; if it never fires (e.g. very short),
      // the user-advance path is the fallback. We don't auto-proceed here.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tts]);

  const handleQuestionEnd = useCallback(() => {
    const { autoFlip, autoFlipDelayMs, onFlip } = stateRef.current;
    if (autoFlip) {
      setStatus("awaiting-flip");
      window.setTimeout(() => {
        onFlip();
      }, Math.max(0, autoFlipDelayMs));
    } else {
      setStatus("awaiting-flip");
    }
  }, []);

  const speakAnswer = useCallback(() => {
    const { answerText, onAdvance } = stateRef.current;
    if (!answerText.trim()) {
      // No answer — advance directly.
      handleAnswerEnd();
      return;
    }
    setStatus("speaking-answer");
    advanceStepRef.current = () => {
      tts.stop();
      handleAnswerEnd();
    };
    tts.speak(answerText);
    function handleAnswerEnd() {
      setStatus("advancing");
      advanceStepRef.current = null;
      // Small pause before advancing for natural pacing.
      window.setTimeout(() => {
        onAdvance();
      }, 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tts]);

  const onUserAdvance = useCallback(() => {
    const step = advanceStepRef.current;
    if (step) {
      step();
    } else {
      // No active step — just advance to the next card.
      stateRef.current.onAdvance();
    }
  }, []);

  // Drive the flow: (re)start with the question whenever the card changes.
  useEffect(() => {
    if (!isEnabled || !cardId) {
      setStatus("idle");
      return;
    }
    tts.stop();
    advanceStepRef.current = null;
    speakQuestion();
    return () => {
      tts.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, isEnabled]);

  // When the answer becomes shown (either via auto-flip or manual flip), speak it.
  useEffect(() => {
    if (!isEnabled || !cardId) return;
    if (isAnswerShown && status === "awaiting-flip") {
      speakAnswer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnswerShown, status, isEnabled, cardId]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      tts.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isEnabled,
    enable,
    disable,
    toggle,
    status,
    onUserAdvance,
    lastError: tts.lastError,
    isSupported: tts.isSupported,
  };
}
