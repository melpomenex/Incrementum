/**
 * Focus Timer API
 * Tauri command wrappers for the focus timer
 */

import { invokeCommand } from '../lib/tauri';
import type { FocusTimerConfig, FocusTimerState } from '../types/focus-timer';

/**
 * Get the current focus timer state
 */
export async function getFocusTimerState(): Promise<FocusTimerState> {
  return invokeCommand<FocusTimerState>('get_focus_timer_state');
}

/**
 * Start the focus timer
 */
export async function startFocusTimer(): Promise<FocusTimerState> {
  return invokeCommand<FocusTimerState>('start_focus_timer');
}

/**
 * Pause the focus timer
 */
export async function pauseFocusTimer(): Promise<FocusTimerState> {
  return invokeCommand<FocusTimerState>('pause_focus_timer');
}

/**
 * Reset the focus timer
 */
export async function resetFocusTimer(): Promise<FocusTimerState> {
  return invokeCommand<FocusTimerState>('reset_focus_timer');
}

/**
 * Skip to the next phase
 */
export async function skipFocusTimerPhase(): Promise<FocusTimerState> {
  return invokeCommand<FocusTimerState>('skip_focus_timer_phase');
}

/**
 * Update focus timer configuration
 */
export async function updateFocusTimerConfig(config: FocusTimerConfig): Promise<FocusTimerState> {
  return invokeCommand<FocusTimerState>('update_focus_timer_config', { config });
}

/**
 * Get remaining time in seconds
 */
export async function getFocusTimerRemaining(): Promise<number> {
  return invokeCommand<number>('get_focus_timer_remaining');
}

/**
 * Tick the timer (called by frontend interval)
 */
export async function tickFocusTimer(): Promise<FocusTimerState | null> {
  return invokeCommand<FocusTimerState | null>('tick_focus_timer');
}

/**
 * Reset daily statistics
 */
export async function resetFocusTimerDailyStats(): Promise<FocusTimerState> {
  return invokeCommand<FocusTimerState>('reset_focus_timer_daily_stats');
}
