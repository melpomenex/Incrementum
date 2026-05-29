//! Focus Timer Commands
//!
//! Pomodoro-style focus timer for productive work sessions.
//! Includes work sessions, short breaks, and long breaks.

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

/// Timer state enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TimerState {
    Idle,
    Running,
    Paused,
    Completed,
}

/// Timer phase enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TimerPhase {
    Work,
    ShortBreak,
    LongBreak,
}

/// Focus timer configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusTimerConfig {
    /// Work session duration in minutes
    pub work_duration: u32,
    /// Short break duration in minutes
    pub short_break_duration: u32,
    /// Long break duration in minutes
    pub long_break_duration: u32,
    /// Number of work sessions before a long break
    pub sessions_before_long_break: u32,
    /// Auto-start breaks
    pub auto_start_breaks: bool,
    /// Auto-start work sessions
    pub auto_start_work: bool,
    /// Play sound on completion
    pub sound_enabled: bool,
    /// Show notifications
    pub notifications_enabled: bool,
}

impl Default for FocusTimerConfig {
    fn default() -> Self {
        Self {
            work_duration: 25,
            short_break_duration: 5,
            long_break_duration: 15,
            sessions_before_long_break: 4,
            auto_start_breaks: false,
            auto_start_work: false,
            sound_enabled: true,
            notifications_enabled: true,
        }
    }
}

/// Focus timer state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusTimerState {
    /// Current timer state
    pub state: TimerState,
    /// Current phase (work, short break, long break)
    pub phase: TimerPhase,
    /// Remaining time in seconds
    pub remaining_seconds: u32,
    /// Total time for current session in seconds
    pub total_seconds: u32,
    /// Number of completed work sessions
    pub completed_sessions: u32,
    /// Total focus time in seconds (today)
    pub total_focus_time: u64,
    /// Configuration
    pub config: FocusTimerConfig,
}

impl Default for FocusTimerState {
    fn default() -> Self {
        let config = FocusTimerConfig::default();
        let total_seconds = config.work_duration * 60;
        Self {
            state: TimerState::Idle,
            phase: TimerPhase::Work,
            remaining_seconds: total_seconds,
            total_seconds,
            completed_sessions: 0,
            total_focus_time: 0,
            config,
        }
    }
}

/// Focus timer state managed by Tauri
pub struct FocusTimer {
    state: Arc<Mutex<FocusTimerState>>,
    start_time: Arc<Mutex<Option<Instant>>>,
    paused_at: Arc<Mutex<Option<u32>>>,
}

impl FocusTimer {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(FocusTimerState::default())),
            start_time: Arc::new(Mutex::new(None)),
            paused_at: Arc::new(Mutex::new(None)),
        }
    }

    /// Get current state
    pub fn get_state(&self) -> FocusTimerState {
        let state = self.state.lock().unwrap();
        state.clone()
    }

    /// Start the timer
    pub fn start(&self) -> FocusTimerState {
        let mut state = self.state.lock().expect("focus timer mutex poisoned");
        let mut start_time = self.start_time.lock().expect("focus timer mutex poisoned");
        let mut paused_at = self.paused_at.lock().expect("focus timer mutex poisoned");

        if state.state == TimerState::Running {
            return state.clone();
        }

        state.state = TimerState::Running;

        // If resuming from pause
        if let Some(paused_remaining) = *paused_at {
            state.remaining_seconds = paused_remaining;
            *paused_at = None;
        }

        *start_time = Some(Instant::now());
        state.clone()
    }

    /// Pause the timer
    pub fn pause(&self) -> FocusTimerState {
        let mut state = self.state.lock().expect("focus timer mutex poisoned");
        let mut start_time = self.start_time.lock().expect("focus timer mutex poisoned");
        let mut paused_at = self.paused_at.lock().expect("focus timer mutex poisoned");

        if state.state != TimerState::Running {
            return state.clone();
        }

        // Calculate elapsed time and remaining time
        if let Some(start) = *start_time {
            let elapsed = start.elapsed().as_secs() as u32;
            if elapsed < state.remaining_seconds {
                state.remaining_seconds -= elapsed;
            } else {
                state.remaining_seconds = 0;
            }
        }

        state.state = TimerState::Paused;
        *paused_at = Some(state.remaining_seconds);
        *start_time = None;
        state.clone()
    }

    /// Reset the timer
    pub fn reset(&self) -> FocusTimerState {
        let mut state = self.state.lock().expect("focus timer mutex poisoned");
        let mut start_time = self.start_time.lock().expect("focus timer mutex poisoned");
        let mut paused_at = self.paused_at.lock().expect("focus timer mutex poisoned");

        state.state = TimerState::Idle;
        state.remaining_seconds = state.total_seconds;
        *start_time = None;
        *paused_at = None;
        state.clone()
    }

    /// Skip to next phase
    pub fn skip(&self) -> FocusTimerState {
        let mut state = self.state.lock().expect("focus timer mutex poisoned");
        let mut start_time = self.start_time.lock().expect("focus timer mutex poisoned");
        let mut paused_at = self.paused_at.lock().expect("focus timer mutex poisoned");

        if state.phase == TimerPhase::Work && state.state == TimerState::Running {
            if let Some(start) = *start_time {
                let elapsed = start.elapsed().as_secs();
                state.total_focus_time += elapsed;
            }
            state.completed_sessions += 1;
        }

        // Determine next phase
        let next_phase = match state.phase {
            TimerPhase::Work => {
                if state.completed_sessions > 0
                    && state.completed_sessions % state.config.sessions_before_long_break == 0
                {
                    TimerPhase::LongBreak
                } else {
                    TimerPhase::ShortBreak
                }
            }
            TimerPhase::ShortBreak | TimerPhase::LongBreak => TimerPhase::Work,
        };

        state.phase = next_phase.clone();
        state.total_seconds = match &next_phase {
            TimerPhase::Work => state.config.work_duration * 60,
            TimerPhase::ShortBreak => state.config.short_break_duration * 60,
            TimerPhase::LongBreak => state.config.long_break_duration * 60,
        };
        state.remaining_seconds = state.total_seconds;
        state.state = TimerState::Idle;
        *start_time = None;
        *paused_at = None;
        state.clone()
    }

    /// Update configuration
    pub fn update_config(&self, config: FocusTimerConfig) -> FocusTimerState {
        let mut state = self.state.lock().expect("focus timer mutex poisoned");
        state.config = config;

        if state.state == TimerState::Idle {
            state.total_seconds = match state.phase {
                TimerPhase::Work => state.config.work_duration * 60,
                TimerPhase::ShortBreak => state.config.short_break_duration * 60,
                TimerPhase::LongBreak => state.config.long_break_duration * 60,
            };
            state.remaining_seconds = state.total_seconds;
        }

        state.clone()
    }

    /// Tick the timer (called periodically)
    pub fn tick(&self) -> Option<FocusTimerState> {
        let mut state = self.state.lock().expect("focus timer mutex poisoned");
        let start_time = self.start_time.lock().expect("focus timer mutex poisoned");

        if state.state != TimerState::Running {
            return None;
        }

        if let Some(start) = *start_time {
            let elapsed = start.elapsed().as_secs() as u32;
            if elapsed >= state.remaining_seconds {
                state.state = TimerState::Completed;
                state.remaining_seconds = 0;

                if state.phase == TimerPhase::Work {
                    state.total_focus_time += state.total_seconds as u64;
                    state.completed_sessions += 1;
                }

                return Some(state.clone());
            }
        }

        None
    }

    /// Get remaining seconds (calculated from start time)
    pub fn get_remaining_seconds(&self) -> u32 {
        let state = self.state.lock().expect("focus timer mutex poisoned");
        let start_time = self.start_time.lock().expect("focus timer mutex poisoned");

        if state.state != TimerState::Running {
            return state.remaining_seconds;
        }

        if let Some(start) = *start_time {
            let elapsed = start.elapsed().as_secs() as u32;
            if elapsed < state.remaining_seconds {
                return state.remaining_seconds - elapsed;
            }
        }

        0
    }

    /// Reset daily stats
    pub fn reset_daily_stats(&self) {
        let mut state = self.state.lock().unwrap();
        state.completed_sessions = 0;
        state.total_focus_time = 0;
    }
}

/// Get the current focus timer state
#[tauri::command]
pub fn get_focus_timer_state(app: AppHandle) -> FocusTimerState {
    let timer = app.state::<FocusTimer>();
    timer.get_state()
}

/// Start the focus timer
#[tauri::command]
pub fn start_focus_timer(app: AppHandle) -> FocusTimerState {
    let timer = app.state::<FocusTimer>();
    let state = timer.start();

    let _ = app.emit("focus-timer-started", &state);

    state
}

/// Pause the focus timer
#[tauri::command]
pub fn pause_focus_timer(app: AppHandle) -> FocusTimerState {
    let timer = app.state::<FocusTimer>();
    let state = timer.pause();

    let _ = app.emit("focus-timer-paused", &state);

    state
}

/// Reset the focus timer
#[tauri::command]
pub fn reset_focus_timer(app: AppHandle) -> FocusTimerState {
    let timer = app.state::<FocusTimer>();
    let state = timer.reset();

    let _ = app.emit("focus-timer-reset", &state);

    state
}

/// Skip to the next phase
#[tauri::command]
pub fn skip_focus_timer_phase(app: AppHandle) -> FocusTimerState {
    let timer = app.state::<FocusTimer>();
    let state = timer.skip();

    let _ = app.emit("focus-timer-phase-changed", &state);

    state
}

/// Update focus timer configuration
#[tauri::command]
pub fn update_focus_timer_config(app: AppHandle, config: FocusTimerConfig) -> FocusTimerState {
    let timer = app.state::<FocusTimer>();
    timer.update_config(config)
}

/// Get remaining time in seconds
#[tauri::command]
pub fn get_focus_timer_remaining(app: AppHandle) -> u32 {
    let timer = app.state::<FocusTimer>();
    timer.get_remaining_seconds()
}

/// Tick the timer (called by frontend interval)
#[tauri::command]
pub fn tick_focus_timer(app: AppHandle) -> Option<FocusTimerState> {
    let timer = app.state::<FocusTimer>();

    if let Some(state) = timer.tick() {
        // Timer completed - emit event
        let _ = app.emit("focus-timer-completed", &state);
        Some(state)
    } else {
        let mut state = timer.get_state();
        state.remaining_seconds = timer.get_remaining_seconds();
        Some(state)
    }
}

/// Reset daily statistics
#[tauri::command]
pub fn reset_focus_timer_daily_stats(app: AppHandle) -> FocusTimerState {
    let timer = app.state::<FocusTimer>();
    timer.reset_daily_stats();
    timer.get_state()
}
