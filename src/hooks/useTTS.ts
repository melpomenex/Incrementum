/**
 * Text-to-Speech Hook
 * Uses Web Speech API to read text aloud
 */

import { useState, useCallback, useEffect, useRef } from "react";

interface UseTTSOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}

interface UseTTSReturn {
  speak: (text: string) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  setSelectedVoice: (voice: SpeechSynthesisVoice | null) => void;
}

export function useTTS(options: UseTTSOptions = {}): UseTTSReturn {
  const {
    rate = 1,
    pitch = 1,
    volume = 1,
    lang = "en-US",
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check if TTS is supported
  const isSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Load available voices
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);

      // Select default voice for the language
      const defaultVoice = availableVoices.find(
        (voice) => voice.lang.startsWith(lang.split("-")[0])
      );
      if (defaultVoice && !selectedVoice) {
        setSelectedVoice(defaultVoice);
      }
    };

    loadVoices();

    // Chrome loads voices asynchronously
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [isSupported, lang, selectedVoice]);

  // Update speaking state
  useEffect(() => {
    if (!isSupported) return;

    const checkSpeaking = setInterval(() => {
      setIsSpeaking(window.speechSynthesis.speaking);
      setIsPaused(window.speechSynthesis.paused);
    }, 100);

    return () => clearInterval(checkSpeaking);
  }, [isSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) return;

      // Stop any ongoing speech
      window.speechSynthesis.cancel();

      // Clean the text (remove HTML tags)
      const cleanText = text.replace(/<[^>]*>/g, "").trim();
      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;
      utterance.lang = lang;

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported, rate, pitch, volume, lang, selectedVoice]
  );

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, [isSupported]);

  const pause = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
  }, [isSupported]);

  const resume = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.resume();
    setIsPaused(false);
  }, [isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    isPaused,
    isSupported,
    voices,
    selectedVoice,
    setSelectedVoice,
  };
}

export default useTTS;
