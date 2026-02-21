/**
 * Haptic Feedback System
 * Provides audio and visual feedback for user actions
 */

import { useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Feedback types
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

/**
 * Sound frequencies for different feedback types
 */
const SOUND_FREQUENCIES: Record<FeedbackType, { freq: number; duration: number; type: OscillatorType; volume: number }> = {
  success: { freq: 880, duration: 0.15, type: 'sine', volume: 0.2 },
  error: { freq: 220, duration: 0.3, type: 'square', volume: 0.15 },
  warning: { freq: 440, duration: 0.2, type: 'triangle', volume: 0.15 },
  complete: { freq: 523.25, duration: 0.2, type: 'sine', volume: 0.25 }, // C5
  click: { freq: 1200, duration: 0.05, type: 'sine', volume: 0.1 },
  delete: { freq: 300, duration: 0.15, type: 'sawtooth', volume: 0.15 },
  'review-complete': { freq: 659.25, duration: 0.25, type: 'sine', volume: 0.2 }, // E5
  streak: { freq: 783.99, duration: 0.3, type: 'sine', volume: 0.25 }, // G5
  milestone: { freq: 1046.5, duration: 0.4, type: 'sine', volume: 0.3 }, // C6
};

/**
 * Visual feedback configuration
 */
const VISUAL_CONFIG: Record<FeedbackType, { color: string; animation: string; icon: string }> = {
  success: { color: '#22c55e', animation: 'pulse-success', icon: '✓' },
  error: { color: '#ef4444', animation: 'shake', icon: '✗' },
  warning: { color: '#f59e0b', animation: 'pulse-warning', icon: '⚠' },
  complete: { color: '#3b82f6', animation: 'bounce', icon: '★' },
  click: { color: '#94a3b8', animation: 'scale-click', icon: '' },
  delete: { color: '#f87171', animation: 'fade-out', icon: '🗑' },
  'review-complete': { color: '#a855f7', animation: 'celebration', icon: '🧠' },
  streak: { color: '#fbbf24', animation: 'fire', icon: '🔥' },
  milestone: { color: '#38bdf8', animation: 'confetti', icon: '🎉' },
};

/**
 * Play a sound using Web Audio API
 */
function playSound(type: FeedbackType, volume: number = 1): void {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const config = SOUND_FREQUENCIES[type];

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = config.freq;
    oscillator.type = config.type;
    gainNode.gain.value = config.volume * volume;

    oscillator.start();
    oscillator.stop(audioContext.currentTime + config.duration);

    // Add a second tone for completion sounds
    if (type === 'complete' || type === 'review-complete' || type === 'streak' || type === 'milestone') {
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.value = config.freq * 1.25; // Major third up
        osc2.type = config.type;
        gain2.gain.value = config.volume * volume * 0.8;
        osc2.start();
        osc2.stop(audioContext.currentTime + config.duration * 0.8);
      }, config.duration * 500);
    }
  } catch (e) {
    console.warn('Could not play sound:', e);
  }
}

/**
 * Create a visual feedback element
 */
function createVisualFeedback(
  x: number,
  y: number,
  type: FeedbackType,
  container: HTMLElement = document.body
): void {
  const config = VISUAL_CONFIG[type];

  // Create feedback element
  const element = document.createElement('div');
  element.className = `haptic-feedback haptic-${config.animation}`;
  element.innerHTML = config.icon;
  element.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 9999;
    font-size: 24px;
    color: ${config.color};
    text-shadow: 0 0 10px ${config.color}40;
  `;

  container.appendChild(element);

  // Remove after animation
  setTimeout(() => {
    element.remove();
  }, 1000);
}

/**
 * Create confetti effect for milestones
 */
function createConfetti(x: number, y: number): void {
  const colors = ['#38bdf8', '#a855f7', '#22c55e', '#f59e0b', '#ef4444'];
  const confettiCount = 20;

  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'haptic-confetti';
    confetti.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: 10px;
      height: 10px;
      background: ${colors[i % colors.length]};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      pointer-events: none;
      z-index: 9999;
      animation: confetti-fall 1s ease-out forwards;
      --tx: ${(Math.random() - 0.5) * 200}px;
      --ty: ${-100 - Math.random() * 100}px;
      --r: ${Math.random() * 360}deg;
      animation-delay: ${i * 20}ms;
    `;

    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 1200);
  }
}

/**
 * Hook for haptic feedback
 */
export function useHapticFeedback() {
  const settings = useSettingsStore((state) => state.settings);
  const soundEnabled = settings.appearance?.soundEnabled ?? true;
  const visualEnabled = settings.appearance?.visualFeedbackEnabled ?? true;

  const trigger = useCallback((type: FeedbackType, event?: React.MouseEvent | { x: number; y: number }) => {
    // Get position
    const x = event && 'clientX' in event ? event.clientX : event?.x ?? window.innerWidth / 2;
    const y = event && 'clientY' in event ? event.clientY : event?.y ?? window.innerHeight / 2;

    // Play sound
    if (soundEnabled) {
      playSound(type);
    }

    // Visual feedback
    if (visualEnabled) {
      if (type === 'milestone') {
        createConfetti(x, y);
      }
      createVisualFeedback(x, y, type);
    }
  }, [soundEnabled, visualEnabled]);

  /**
   * Trigger success feedback
   */
  const success = useCallback((event?: React.MouseEvent) => {
    trigger('success', event);
  }, [trigger]);

  /**
   * Trigger error feedback
   */
  const error = useCallback((event?: React.MouseEvent) => {
    trigger('error', event);
  }, [trigger]);

  /**
   * Trigger completion feedback (for reviews, tasks)
   */
  const complete = useCallback((event?: React.MouseEvent) => {
    trigger('complete', event);
  }, [trigger]);

  /**
   * Trigger click feedback
   */
  const click = useCallback((event?: React.MouseEvent) => {
    trigger('click', event);
  }, [trigger]);

  /**
   * Trigger delete feedback
   */
  const delete_ = useCallback((event?: React.MouseEvent) => {
    trigger('delete', event);
  }, [trigger]);

  /**
   * Trigger review complete feedback
   */
  const reviewComplete = useCallback((event?: React.MouseEvent) => {
    trigger('review-complete', event);
  }, [trigger]);

  /**
   * Trigger streak feedback
   */
  const streak = useCallback((event?: React.MouseEvent) => {
    trigger('streak', event);
  }, [trigger]);

  /**
   * Trigger milestone feedback (with confetti)
   */
  const milestone = useCallback((event?: React.MouseEvent) => {
    trigger('milestone', event);
  }, [trigger]);

  return {
    trigger,
    success,
    error,
    complete,
    click,
    delete: delete_,
    reviewComplete,
    streak,
    milestone,
  };
}

/**
 * CSS to inject for animations
 */
export const HAPTIC_FEEDBACK_CSS = `
/* Haptic Feedback Animations */
.haptic-feedback {
  animation: haptic-appear 0.3s ease-out forwards;
}

@keyframes haptic-appear {
  0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
  50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
}

@keyframes pulse-success {
  0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
  100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}

@keyframes shake {
  0%, 100% { transform: translate(-50%, -50%) translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translate(-50%, -50%) translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translate(-50%, -50%) translateX(5px); }
}

@keyframes bounce {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.3); }
}

@keyframes scale-click {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  50% { transform: translate(-50%, -50%) scale(0.9); }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
}

@keyframes confetti-fall {
  0% {
    transform: translate(0, 0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translate(var(--tx), var(--ty)) rotate(var(--r));
    opacity: 0;
  }
}

.haptic-confetti {
  animation: confetti-fall 1s ease-out forwards;
}

@keyframes celebration {
  0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
  50% { transform: translate(-50%, -50%) scale(1.5) rotate(180deg); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1) rotate(360deg); opacity: 0; }
}

@keyframes fire {
  0% { transform: translate(-50%, -50%) scale(1); filter: brightness(1); }
  50% { transform: translate(-50%, -50%) scale(1.5); filter: brightness(1.5); }
  100% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
}
`;

export default useHapticFeedback;
