/**
 * Loads the device's built-in speech-synthesis voices (Web Speech API).
 *
 * On Android these route through the native android.speech.tts engine (free,
 * offline); on desktop browsers through the OS speech engine. Voices load
 * asynchronously and may update after `onvoiceschanged` fires, so this hook
 * re-reads on that event.
 *
 * Returns the raw SpeechSynthesisVoice[] plus a normalized list of
 * TTSVoiceProfile-shaped entries (id `system-<i>` / `system-default`) so they
 * can be merged into the existing voice selectors.
 */
import { useEffect, useState } from "react";
import type { TTSVoiceProfile } from "../types/settings";

const SYSTEM_VOICE_PREFIX = "system-";

function hasSpeechSynthesis(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function useSystemVoices(): {
  voices: SpeechSynthesisVoice[];
  profiles: TTSVoiceProfile[];
  available: boolean;
} {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!hasSpeechSynthesis()) return;

    const load = () => {
      const list = window.speechSynthesis.getVoices();
      setVoices(list);
    };

    load();
    // Voices often arrive async; re-read when the platform signals they're ready.
    window.speechSynthesis.onvoiceschanged = load;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const profiles: TTSVoiceProfile[] = voices.map((voice, i) => ({
    id: `${SYSTEM_VOICE_PREFIX}${i}`,
    provider: "system",
    name: `${voice.name}${voice.lang ? ` (${voice.lang})` : ""}`,
    kind: "builtin",
    createdAt: new Date().toISOString(),
  }));

  return { voices, profiles, available: hasSpeechSynthesis() };
}

/** True if the given voice id refers to a system (device) voice. */
export function isSystemVoiceId(voiceId: string): boolean {
  return voiceId === "system-default" || voiceId.startsWith(SYSTEM_VOICE_PREFIX);
}

/** Resolve a system voice id back to the underlying SpeechSynthesisVoice. */
export function resolveSystemVoice(
  voiceId: string,
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (voiceId === "system-default") return voices[0] ?? null;
  const idx = voiceId.startsWith(SYSTEM_VOICE_PREFIX)
    ? parseInt(voiceId.slice(SYSTEM_VOICE_PREFIX.length), 10)
    : NaN;
  if (Number.isFinite(idx)) return voices[idx] ?? null;
  return null;
}
