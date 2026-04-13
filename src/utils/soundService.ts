import { isPWA, isTauri } from '../lib/tauri';

/**
 * Shared Sound Service
 * Centralized audio playback with singleton AudioContext management,
 * file-based feedback sounds, and vibration support.
 */

export type FeedbackType =
  | 'success'
  | 'error'
  | 'warning'
  | 'complete'
  | 'click'
  | 'delete'
  | 'review-complete'
  | 'streak'
  | 'milestone';

export type NotificationSoundId =
  | 'default'
  | 'glass'
  | 'bloom'
  | 'pulse'
  | 'ascend'
  | 'softbell'
  | 'sonar'
  | 'none';

/** Map of feedback types to tactile UI sound files in public/sounds/. */
const FEEDBACK_SOUND_FILES: Record<FeedbackType, string> = {
  success: '/sounds/success.mp3',
  error: '/sounds/error.mp3',
  warning: '/sounds/warning.mp3',
  complete: '/sounds/ui-complete.mp3',
  click: '/sounds/click.mp3',
  delete: '/sounds/delete.mp3',
  'review-complete': '/sounds/review-complete.mp3',
  streak: '/sounds/streak.mp3',
  milestone: '/sounds/milestone.mp3',
};

/** Map of notification sound IDs to file paths (in public/sounds/). */
export const NOTIFICATION_SOUND_FILES: Record<string, string> = {
  glass: '/sounds/glass.mp3',
  bloom: '/sounds/bloom.mp3',
  pulse: '/sounds/pulse.mp3',
  ascend: '/sounds/ascend.mp3',
  softbell: '/sounds/softbell.mp3',
  sonar: '/sounds/sonar.mp3',
  // Backward-compatible aliases for older saved settings.
  bell: '/sounds/glass.mp3',
  chime: '/sounds/bloom.mp3',
  ding: '/sounds/pulse.mp3',
  complete: '/sounds/ascend.mp3',
};

/** Vibration patterns per feedback type (milliseconds or pattern array) */
export const VIBRATION_PATTERNS: Record<FeedbackType, number | number[]> = {
  click: 10,
  success: 50,
  error: 30,
  warning: 25,
  complete: 50,
  delete: 30,
  'review-complete': [50, 30, 50],
  streak: [50, 30, 80],
  milestone: [100, 50, 100],
};

export function supportsHaptics(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  if (typeof navigator.vibrate !== 'function') return false;
  if (isTauri()) return true;

  const ua = navigator.userAgent;
  const isFirefox = /Firefox\/\d+/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isMobile = isAndroid || isIOS;

  if (isPWA() && isFirefox && isAndroid) return false;
  if (isIOS) return false;
  if (!isMobile) return false;

  return true;
}

// ── Singleton AudioContext ──────────────────────────────────────────

let _audioCtx: AudioContext | null = null;
let _unlockListenersInstalled = false;

function createAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  return new AudioContextCtor();
}

function getOrCreateAudioContext(): AudioContext | null {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = createAudioContext();
  }
  return _audioCtx;
}

async function ensureAudioContextReady(): Promise<AudioContext | null> {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return null;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      return ctx;
    }
  }
  return ctx;
}

function installAudioUnlockListeners(): void {
  if (typeof window === 'undefined' || _unlockListenersInstalled) return;

  const unlock = () => {
    void ensureAudioContextReady();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
    window.removeEventListener('touchstart', unlock, true);
    _unlockListenersInstalled = false;
  };

  _unlockListenersInstalled = true;
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
  window.addEventListener('touchstart', unlock, true);
}

// ── Audio buffer cache for file-based sounds ────────────────────────

const bufferCache = new Map<string, Promise<AudioBuffer>>();
const activeHtmlAudio = new Set<HTMLAudioElement>();

export function resolveSoundUrl(url: string): string {
  if (/^(data:|blob:|https?:)/i.test(url)) {
    return url;
  }

  if (typeof document !== 'undefined') {
    const normalized = url.startsWith('/') ? url.slice(1) : url;
    return new URL(normalized, document.baseURI).toString();
  }

  return url;
}

async function getAudioBuffer(url: string): Promise<AudioBuffer> {
  const resolvedUrl = resolveSoundUrl(url);

  if (bufferCache.has(resolvedUrl)) {
    return bufferCache.get(resolvedUrl)!;
  }

  const promise = fetch(resolvedUrl)
    .then(r => {
      if (!r.ok) {
        throw new Error(`Failed to load sound asset: ${resolvedUrl} (${r.status})`);
      }
      return r.arrayBuffer();
    })
    .then(async (buf) => {
      const ctx = await ensureAudioContextReady();
      if (!ctx) {
        throw new Error('AudioContext is unavailable');
      }
      return ctx.decodeAudioData(buf);
    });

  bufferCache.set(resolvedUrl, promise);
  return promise;
}

async function playWithHtmlAudio(url: string, volume: number): Promise<void> {
  const resolvedUrl = resolveSoundUrl(url);
  const audio = new Audio(resolvedUrl);
  audio.volume = volume;
  audio.preload = 'auto';

  // Keep a strong reference until playback completes. Some desktop webviews
  // can drop very short sounds if the element becomes unreachable immediately.
  activeHtmlAudio.add(audio);
  const cleanup = () => {
    audio.onended = null;
    audio.onpause = null;
    audio.onerror = null;
    activeHtmlAudio.delete(audio);
  };
  audio.onended = cleanup;
  audio.onerror = cleanup;
  audio.onpause = () => {
    if (audio.ended) cleanup();
  };

  audio.load();
  await audio.play();
}

// ── Vibration ───────────────────────────────────────────────────────

/**
 * Trigger device vibration for haptic feedback.
 * Silently no-ops on platforms that don't support the Vibration API.
 */
export function vibrate(type: FeedbackType): void {
  try {
    if (supportsHaptics()) {
      (navigator as Navigator & { vibrate(pattern: number | number[]): boolean }).vibrate(VIBRATION_PATTERNS[type]);
    }
  } catch {
    // Vibration API not available — ignore
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Play a file-based sound from the buffer cache.
 */
export async function playFile(url: string, volume = 1): Promise<void> {
  try {
    // Tauri's asset protocol is more reliable with plain HTMLAudio playback
    // than fetch+decodeAudioData for very short UI sound effects.
    if (isTauri()) {
      await playWithHtmlAudio(url, volume);
      return;
    }

    const ctx = await ensureAudioContextReady();
    if (!ctx) {
      await playWithHtmlAudio(url, volume);
      return;
    }
    const buffer = await getAudioBuffer(url);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = volume;
    source.start();
  } catch (error) {
    try {
      await playWithHtmlAudio(url, volume);
    } catch {
      console.warn('[soundService] Sound playback failed:', error);
    }
  }
}

/**
 * Play the default notification descending tone (A5 → A4 sweep).
 */
export function playNotificationDefaultTone(volume = 1): void {
  void (async () => {
    try {
      const ctx = await ensureAudioContextReady();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3 * volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // Audio may not be available
    }
  })();
}

/**
 * Play the focus timer complete sound (two-tone beep).
 * Uses AudioContext.currentTime for sample-accurate scheduling.
 */
export function playTimerComplete(volume = 1): void {
  void (async () => {
    try {
      const ctx = await ensureAudioContextReady();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.value = 800;
      osc1.type = 'sine';
      gain1.gain.setValueAtTime(0.3 * volume, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc1.start(now);
      osc1.stop(now + 0.2);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1000;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.3 * volume, now + 0.25);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
      osc2.start(now + 0.25);
      osc2.stop(now + 0.55);
    } catch {
      // Audio may not be available
    }
  })();
}

/**
 * Play a feedback sound for the given feedback type.
 * Reads feedbackVolume and feedbackSoundsEnabled from localStorage settings.
 */
export function playFeedback(type: FeedbackType, volume = 1): void {
  try {
    const raw = localStorage.getItem('incrementum-settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      const { notifications } = parsed.state?.settings || {};
      if (!notifications?.feedbackSoundsEnabled) return;
      const settingVol: number = notifications.feedbackVolume ?? 0.3;
      volume = settingVol;
    }

    const url = FEEDBACK_SOUND_FILES[type];
    if (url) {
      playFile(url, volume);
    }
  } catch {
    // Settings may be unavailable
  }
}

/**
 * Play a feedback sound only when notification sounds are enabled.
 * Uses the notification volume setting so celebratory events follow
 * the user's notification sound preference rather than the feedback toggle.
 */
export function playNotificationGatedFeedback(type: FeedbackType): void {
  try {
    const raw = localStorage.getItem('incrementum-settings');
    if (!raw) return;

    const parsed = JSON.parse(raw);
    const { notifications } = parsed.state?.settings || {};
    if (!notifications?.soundEnabled) return;

    const volume: number = notifications.soundVolume ?? 0.5;
    const url = FEEDBACK_SOUND_FILES[type];
    if (url) {
      playFile(url, volume);
    }
  } catch {
    // Settings may be unavailable
  }
}

/**
 * Play the configured notification sound.
 * Reads `notificationSound` and `soundVolume` from localStorage settings.
 */
export function playNotificationSound(): void {
  try {
    const raw = localStorage.getItem('incrementum-settings');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const { notifications } = parsed.state?.settings || {};
    if (!notifications?.soundEnabled) return;

    const soundId: string = notifications.notificationSound ?? 'default';
    const volume: number = notifications.soundVolume ?? 0.5;

    if (soundId === 'none') return;

    if (NOTIFICATION_SOUND_FILES[soundId]) {
      playFile(NOTIFICATION_SOUND_FILES[soundId], volume);
    } else {
      playNotificationDefaultTone(volume);
    }
  } catch {
    // Settings may be unavailable
  }
}

/**
 * Available notification sound options for the settings UI.
 */
export const NOTIFICATION_SOUND_OPTIONS: { id: NotificationSoundId; label: string }[] = [
  { id: 'default', label: 'Default Tone' },
  { id: 'glass', label: 'Glass' },
  { id: 'bloom', label: 'Bloom' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'ascend', label: 'Ascend' },
  { id: 'softbell', label: 'Soft Bell' },
  { id: 'sonar', label: 'Sonar' },
  { id: 'none', label: 'None' },
];

installAudioUnlockListeners();
