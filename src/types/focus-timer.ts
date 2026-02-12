/**
 * Focus Timer Types
 * TypeScript types for the Pomodoro-style focus timer
 */

export type TimerState = 'idle' | 'running' | 'paused' | 'completed';
export type TimerPhase = 'work' | 'shortbreak' | 'longbreak';

export interface FocusTimerConfig {
  work_duration: number;
  short_break_duration: number;
  long_break_duration: number;
  sessions_before_long_break: number;
  auto_start_breaks: boolean;
  auto_start_work: boolean;
  sound_enabled: boolean;
  notifications_enabled: boolean;
}

export interface FocusTimerState {
  state: TimerState;
  phase: TimerPhase;
  remaining_seconds: number;
  total_seconds: number;
  completed_sessions: number;
  total_focus_time: number;
  config: FocusTimerConfig;
}

export const DEFAULT_TIMER_CONFIG: FocusTimerConfig = {
  work_duration: 25,
  short_break_duration: 5,
  long_break_duration: 15,
  sessions_before_long_break: 4,
  auto_start_breaks: false,
  auto_start_work: false,
  sound_enabled: true,
  notifications_enabled: true,
};
