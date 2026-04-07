/**
 * Shared Sound Service
 * Centralized audio playback with singleton AudioContext management,
 * synthesized tones, and file-based audio support.
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
  | 'bell'
  | 'chime'
  | 'ding'
  | 'complete'
  | 'none';

/** Synthesized tone configurations for haptic/feedback sounds */
const FEEDBACK_TONES: Record<FeedbackType, {
  freq: number;
  duration: number;
  type: OscillatorType;
  volume: number;
  harmonic?: boolean; // play a second tone a major third up
}> = {
  success:         { freq: 880,    duration: 0.15, type: 'sine', volume: 0.2 },
  error:           { freq: 220,    duration: 0.3,  type: 'square', volume: 0.15 },
  warning:         { freq: 440,    duration: 0.2,  type: 'triangle', volume: 0.15 },
  complete:        { freq: 523.25, duration: 0.2,  type: 'sine', volume: 0.25, harmonic: true },
  click:           { freq: 1200,   duration: 0.05, type: 'sine', volume: 0.1 },
  delete:          { freq: 300,    duration: 0.15, type: 'sawtooth', volume: 0.15 },
  'review-complete': { freq: 659.25, duration: 0.25, type: 'sine', volume: 0.2, harmonic: true },
  streak:          { freq: 783.99, duration: 0.3,  type: 'sine', volume: 0.25, harmonic: true },
  milestone:       { freq: 1046.5, duration: 0.4,  type: 'sine', volume: 0.3, harmonic: true },
};

/** Map of notification sound IDs to file paths (in public/sounds/) */
const NOTIFICATION_SOUND_FILES: Record<string, string> = {
  bell: '/sounds/bell.mp3',
  chime: '/sounds/chime.mp3',
  ding: '/sounds/ding.mp3',
  complete: '/sounds/complete.mp3',
};

// ── Singleton AudioContext ──────────────────────────────────────────

let _audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
}

// ── Audio buffer cache for file-based sounds ────────────────────────

const bufferCache = new Map<string, Promise<AudioBuffer>>();

async function getAudioBuffer(url: string): Promise<AudioBuffer> {
  if (bufferCache.has(url)) {
    return bufferCache.get(url)!;
  }
  const promise = fetch(url)
    .then(r => r.arrayBuffer())
    .then(buf => getAudioContext().decodeAudioData(buf));
  bufferCache.set(url, promise);
  return promise;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Play a synthesized feedback tone.
 */
export function playTone(type: FeedbackType, volume = 1): void {
  try {
    const ctx = getAudioContext();
    const cfg = FEEDBACK_TONES[type];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = cfg.freq;
    osc.type = cfg.type;
    gain.gain.value = cfg.volume * volume;
    osc.start();
    osc.stop(ctx.currentTime + cfg.duration);

    if (cfg.harmonic) {
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = cfg.freq * 1.25;
        osc2.type = cfg.type;
        gain2.gain.value = cfg.volume * volume * 0.8;
        osc2.start();
        osc2.stop(ctx.currentTime + cfg.duration * 0.8);
      }, cfg.duration * 500);
    }
  } catch {
    // Audio may not be available
  }
}

/**
 * Play a file-based sound (MP3/OGG from public/sounds/).
 */
export async function playFile(url: string, volume = 1): Promise<void> {
  try {
    const ctx = getAudioContext();
    const buffer = await getAudioBuffer(url);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = volume;
    source.start();
  } catch {
    // File may not exist or AudioContext unavailable
  }
}

/**
 * Play the default notification descending tone (A5 → A4 sweep).
 */
export function playNotificationDefaultTone(volume = 1): void {
  try {
    const ctx = getAudioContext();
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
}

/**
 * Play the focus timer complete sound (two-tone beep).
 */
export function playTimerComplete(volume = 1): void {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.value = 0.3 * volume;
    osc.start();
    osc.stop(ctx.currentTime + 0.2);

    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1000;
      osc2.type = 'sine';
      gain2.gain.value = 0.3 * volume;
      osc2.start();
      osc2.stop(ctx.currentTime + 0.3);
    }, 250);
  } catch {
    // Audio may not be available
  }
}

/**
 * Play a haptic/feedback sound (used by useHapticFeedback).
 */
export function playFeedback(type: FeedbackType, volume = 1): void {
  playTone(type, volume);
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
  { id: 'bell', label: 'Bell' },
  { id: 'chime', label: 'Chime' },
  { id: 'ding', label: 'Ding' },
  { id: 'complete', label: 'Complete' },
  { id: 'none', label: 'None' },
];
