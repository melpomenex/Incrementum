/**
 * Text-to-Speech Hook
 * Supports Fal.ai generation with local fallback to Web Speech API.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { generateSpeech } from "../api/tts";
import { useSettingsStore } from "../stores/settingsStore";

interface UseTTSOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}

interface SpeakOverrides {
  voiceId?: string;
  presetId?: string;
}

interface UseTTSReturn {
  speak: (text: string, overrides?: SpeakOverrides) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isSpeaking: boolean;
  isPaused: boolean;
  isGenerating: boolean;
  lastError: string | null;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  setSelectedVoice: (voice: SpeechSynthesisVoice | null) => void;
}

function cleanText(text: string): string {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function useTTS(options: UseTTSOptions = {}): UseTTSReturn {
  const {
    rate = 1,
    pitch = 1,
    volume = 1,
    lang = "en-US",
  } = options;

  const settings = useSettingsStore((state) => state.settings);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const hasSpeechSynthesis = typeof window !== "undefined" && "speechSynthesis" in window;
  const hasAudioPlayback = typeof window !== "undefined" && typeof Audio !== "undefined";
  const isSupported = hasSpeechSynthesis || hasAudioPlayback;

  const ttsSettings = settings.tts;

  // Pocket TTS is always "configured" when enabled since it doesn't need API keys
  const isPocketProvider = ttsSettings?.provider === "pocket";
  // System TTS uses the device speech engine — always "configured", no key/URL.
  const isSystemProvider = ttsSettings?.provider === "system";
  const directKey =
    ttsSettings?.provider === "groq"
      ? (ttsSettings.apiKey?.trim() || settings.audioTranscription?.groq?.apiKey?.trim() || "")
      : (ttsSettings?.apiKey?.trim() || "");

  const providerConfigured =
    ttsSettings?.enabled &&
    (isPocketProvider || isSystemProvider
      ? true // Pocket & System TTS don't need API keys
      : ttsSettings.requestMode === "proxy"
        ? Boolean(ttsSettings.proxyUrl?.trim())
        : Boolean(directKey));

  const stop = useCallback(() => {
    if (hasSpeechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    setIsGenerating(false);
    setIsSpeaking(false);
    setIsPaused(false);
  }, [hasSpeechSynthesis]);

  useEffect(() => {
    if (!hasSpeechSynthesis) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);

      const defaultVoice = availableVoices.find(
        (voice) => voice.lang.startsWith(lang.split("-")[0])
      );
      if (defaultVoice && !selectedVoice) {
        setSelectedVoice(defaultVoice);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [hasSpeechSynthesis, lang, selectedVoice]);

  const speakWithWebSpeech = useCallback((text: string) => {
    if (!hasSpeechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    utterance.lang = lang;

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onstart = () => {
      setLastError(null);
      setIsSpeaking(true);
      setIsPaused(false);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utterance.onerror = () => {
      setLastError("Web Speech API failed to read this text.");
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [hasSpeechSynthesis, rate, pitch, volume, lang, selectedVoice]);

  const speakWithFal = useCallback(async (text: string, overrides?: SpeakOverrides) => {
    if (!hasAudioPlayback) {
      throw new Error("Audio playback is not supported on this platform.");
    }

    setIsGenerating(true);
    setLastError(null);

    const result = await generateSpeech(settings, {
      text,
      voiceId: overrides?.voiceId,
      presetId: overrides?.presetId,
    });

    const audio = new Audio(result.audioUrl);
    audio.playbackRate = rate;
    audioRef.current = audio;

    audio.onplay = () => {
      setIsGenerating(false);
      setIsSpeaking(true);
      setIsPaused(false);
    };
    audio.onpause = () => {
      if (audio.ended) return;
      setIsPaused(true);
      setIsSpeaking(false);
    };
    audio.onended = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      setIsGenerating(false);
    };
    audio.onerror = () => {
      setIsGenerating(false);
      setIsSpeaking(false);
      setIsPaused(false);
      setLastError("Failed to play generated audio.");
    };

    await audio.play();
  }, [settings, hasAudioPlayback, rate]);

  const speak = useCallback(async (text: string, overrides?: SpeakOverrides) => {
    if (!isSupported) return;

    stop();
    const normalizedText = cleanText(text);
    if (!normalizedText) return;

    try {
      // System TTS synthesizes directly via the device engine (no audio URL).
      if (isSystemProvider && hasSpeechSynthesis) {
        speakWithWebSpeech(normalizedText);
        return;
      }

      if (providerConfigured) {
        await speakWithFal(normalizedText, overrides);
        return;
      }

      speakWithWebSpeech(normalizedText);
    } catch (error) {
      setIsGenerating(false);
      setIsSpeaking(false);
      setIsPaused(false);
      setLastError(error instanceof Error ? error.message : "TTS generation failed.");

      if (hasSpeechSynthesis) {
        speakWithWebSpeech(normalizedText);
      }
    }
  }, [isSupported, stop, providerConfigured, isSystemProvider, hasSpeechSynthesis, speakWithFal, speakWithWebSpeech]);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPaused(true);
      setIsSpeaking(false);
      return;
    }

    if (hasSpeechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, [hasSpeechSynthesis]);

  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current
        .play()
        .then(() => {
          setIsPaused(false);
          setIsSpeaking(true);
        })
        .catch((error) => {
          setLastError(error instanceof Error ? error.message : "Failed to resume playback.");
        });
      return;
    }

    if (hasSpeechSynthesis && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsSpeaking(true);
    }
  }, [hasSpeechSynthesis]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    isPaused,
    isGenerating,
    lastError,
    isSupported,
    voices,
    selectedVoice,
    setSelectedVoice,
  };
}

export default useTTS;
