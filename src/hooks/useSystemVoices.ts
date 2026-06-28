/**
 * Loads the device's built-in speech-synthesis voices (Web Speech API).
 *
 * On Android these route through the native android.speech.tts engine (free,
 * offline); on desktop through the OS speech engine. Voices load asynchronously
 * and may update after `onvoiceschanged` fires, so this hook re-reads on that
 * event.
 *
 * Returns the raw SpeechSynthesisVoice[] plus a normalized list of
 * TTSVoiceProfile-shaped entries (id `system-<voiceURI>` / `system-default`)
 * so they can be merged into the existing voice selectors.
 *
 * IMPORTANT — performance: some platforms (notably Linux/KDE via
 * speech-dispatcher + espeak, and Windows with many SAPI5 voices) report
 * hundreds of voices. Rendering every one as a card/option lags the UI, so
 * we (a) de-duplicate by voiceURI, (b) rank the list so the user's locale
 * voices come first, and (c) expose a trimmed "default" list for selectors
 * while still offering the full sorted list behind search.
 */
import { useEffect, useMemo, useState } from "react";
import type { TTSVoiceProfile } from "../utils/ttsSettings";

const SYSTEM_VOICE_PREFIX = "system-";
const SYSTEM_DEFAULT_ID = "system-default";
/** Cap the number of voices exposed to selectors/search by default. Some
 *  Linux speech-dispatcher setups expose 300+ espeak variants; rendering that
 *  many DOM nodes freezes the tab. The full list remains available via the
 *  "show all" affordance in settings. */
export const SYSTEM_VOICE_SELECT_CAP = 40;

function hasSpeechSynthesis(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Locale-aware sort: voices whose language matches the user's locale are
 * placed first (more likely to be the ones they want), then local-service
 * voices (typically higher quality on the device), then alphabetical.
 */
function rankVoices(
  voices: SpeechSynthesisVoice[],
  locale: string,
): SpeechSynthesisVoice[] {
  const langBase = locale.split(/[-_]/)[0].toLowerCase();
  return [...voices].sort((a, b) => {
    const aMatches = a.lang?.toLowerCase().startsWith(langBase) ? 0 : 1;
    const bMatches = b.lang?.toLowerCase().startsWith(langBase) ? 0 : 1;
    if (aMatches !== bMatches) return aMatches - bMatches;
    // Local (on-device) voices are usually higher quality than network ones.
    const aLocal = a.localService ? 0 : 1;
    const bLocal = b.localService ? 0 : 1;
    if (aLocal !== bLocal) return aLocal - bLocal;
    return (a.name || "").localeCompare(b.name || "");
  });
}

/** De-duplicate by voiceURI (espeak/speech-dispatcher frequently lists the
 *  same voice under multiple locale spellings). */
function dedupeVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const seen = new Set<string>();
  const out: SpeechSynthesisVoice[] = [];
  for (const v of voices) {
    const key = v.voiceURI || v.name || `${v.lang}-${v.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
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

  const locale = useMemo(
    () =>
      (typeof navigator !== "undefined" && navigator.language) || "en-US",
    [],
  );

  // De-dupe once per voice-list change. Sorted by locale relevance so the
  // most useful voices surface in selectors first.
  const ranked = useMemo(
    () => rankVoices(dedupeVoices(voices), locale),
    [voices, locale],
  );

  const profiles: TTSVoiceProfile[] = useMemo(
    () =>
      ranked.map((voice, i) => ({
        // voiceURI is the stable platform identifier; fall back to index for
        // the rare voice lacking one. This keeps ids stable across loads
        // (unlike the old pure-index scheme, which silently pointed at a
        // different voice when the device list re-ordered).
        id: `${SYSTEM_VOICE_PREFIX}${voice.voiceURI || i}`,
        provider: "system" as const,
        name: `${voice.name}${voice.lang ? ` (${voice.lang})` : ""}`,
        kind: "builtin" as const,
        createdAt: new Date(0).toISOString(),
      })),
    [ranked],
  );

  return { voices: ranked, profiles, available: hasSpeechSynthesis() };
}

/** True if the given voice id refers to a system (device) voice. */
export function isSystemVoiceId(voiceId: string): boolean {
  return voiceId === SYSTEM_DEFAULT_ID || voiceId.startsWith(SYSTEM_VOICE_PREFIX);
}

/** Resolve a system voice id back to the underlying SpeechSynthesisVoice. */
export function resolveSystemVoice(
  voiceId: string,
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  if (voiceId === SYSTEM_DEFAULT_ID) return voices[0] ?? null;
  if (voiceId.startsWith(SYSTEM_VOICE_PREFIX)) {
    const uri = voiceId.slice(SYSTEM_VOICE_PREFIX.length);
    // Match by voiceURI first (the stable id), then by raw index for
    // backwards-compat with older persisted ids that were numeric.
    const byUri = voices.find((v) => (v.voiceURI || "") === uri);
    if (byUri) return byUri;
    const idx = Number.parseInt(uri, 10);
    if (Number.isFinite(idx)) return voices[idx] ?? null;
  }
  return null;
}
