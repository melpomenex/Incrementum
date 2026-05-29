/**
 * Focus Timer Component
 * Pomodoro-style focus timer with circular progress animation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Settings,
  Coffee,
  Brain,
  Sunset,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
} from 'lucide-react';
import {
  getFocusTimerState,
  startFocusTimer,
  pauseFocusTimer,
  resetFocusTimer,
  skipFocusTimerPhase,
  updateFocusTimerConfig,
} from '../../api/focusTimer';
import { DEFAULT_TIMER_CONFIG, type FocusTimerState, type FocusTimerConfig, type TimerPhase } from "../../types/focus-timer";
import { useToast } from '../common/Toast';
import { t } from '../../lib/i18n';

// Format time as MM:SS
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Phase colors and icons (labels are translated via t() at usage sites)
const phaseConfig: Record<TimerPhase, { labelKey: string; color: string; bgColor: string; icon: typeof Brain }> = {
  work: { labelKey: 'focusTimer.focus', color: 'text-primary-400', bgColor: 'bg-primary-400/20', icon: Brain },
  shortbreak: { labelKey: 'focusTimer.shortBreak', color: 'text-emerald-400', bgColor: 'bg-emerald-400/20', icon: Coffee },
  longbreak: { labelKey: 'focusTimer.longBreak', color: 'text-amber-400', bgColor: 'bg-amber-400/20', icon: Sunset },
};

// Circular Progress Component
function CircularProgress({
  progress,
  size = 200,
  strokeWidth = 8,
  color = '#38bdf8',
  trackColor = 'rgba(148, 163, 184, 0.2)',
  children,
}: {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        {/* Track */}
        <circle
          className="transition-opacity duration-300"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          className="transition-all duration-1000 ease-out"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            filter: 'drop-shadow(0 0 8px currentColor)',
          }}
        />
        {/* Glow effect */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth / 2}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          opacity={0.3}
          style={{
            filter: 'blur(4px)',
          }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

function SettingsPanel({
  config,
  onSave,
  onClose,
}: {
  config: FocusTimerConfig;
  onSave: (config: FocusTimerConfig) => void;
  onClose: () => void;
}) {
  const [localConfig, setLocalConfig] = useState(config);

  return (
    <div className="glass-panel p-6 animate-glass-scale-in">
      <h3 className="text-lg font-semibold text-foreground mb-4">{t("focusTimer.timerSettings")}</h3>

      <div className="space-y-4">
        {/* Work Duration */}
        <div>
          <label className="text-sm text-muted-foreground block mb-1">{t("focusTimer.workDuration")}</label>
          <input
            type="number"
            min={1}
            max={60}
            value={localConfig.work_duration}
            onChange={(e) => setLocalConfig({ ...localConfig, work_duration: parseInt(e.target.value) || 25 })}
            className="glass-input w-full px-3 py-2 text-foreground"
          />
        </div>

        {/* Short Break Duration */}
        <div>
          <label className="text-sm text-muted-foreground block mb-1">{t("focusTimer.shortBreakDuration")}</label>
          <input
            type="number"
            min={1}
            max={30}
            value={localConfig.short_break_duration}
            onChange={(e) => setLocalConfig({ ...localConfig, short_break_duration: parseInt(e.target.value) || 5 })}
            className="glass-input w-full px-3 py-2 text-foreground"
          />
        </div>

        {/* Long Break Duration */}
        <div>
          <label className="text-sm text-muted-foreground block mb-1">{t("focusTimer.longBreakDuration")}</label>
          <input
            type="number"
            min={1}
            max={60}
            value={localConfig.long_break_duration}
            onChange={(e) => setLocalConfig({ ...localConfig, long_break_duration: parseInt(e.target.value) || 15 })}
            className="glass-input w-full px-3 py-2 text-foreground"
          />
        </div>

        {/* Sessions before long break */}
        <div>
          <label className="text-sm text-muted-foreground block mb-1">{t("focusTimer.sessionsBeforeLongBreak")}</label>
          <input
            type="number"
            min={1}
            max={10}
            value={localConfig.sessions_before_long_break}
            onChange={(e) => setLocalConfig({ ...localConfig, sessions_before_long_break: parseInt(e.target.value) || 4 })}
            className="glass-input w-full px-3 py-2 text-foreground"
          />
        </div>

        {/* Toggle options */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localConfig.sound_enabled}
              onChange={(e) => setLocalConfig({ ...localConfig, sound_enabled: e.target.checked })}
              className="rounded border-border"
            />
            <span className="text-sm text-foreground flex items-center gap-1">
              {localConfig.sound_enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              {t("focusTimer.soundNotifications")}
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localConfig.notifications_enabled}
              onChange={(e) => setLocalConfig({ ...localConfig, notifications_enabled: e.target.checked })}
              className="rounded border-border"
            />
            <span className="text-sm text-foreground flex items-center gap-1">
              {localConfig.notifications_enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              {t("focusTimer.desktopNotifications")}
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localConfig.auto_start_breaks}
              onChange={(e) => setLocalConfig({ ...localConfig, auto_start_breaks: e.target.checked })}
              className="rounded border-border"
            />
            <span className="text-sm text-foreground">{t("focusTimer.autoStartBreaks")}</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localConfig.auto_start_work}
              onChange={(e) => setLocalConfig({ ...localConfig, auto_start_work: e.target.checked })}
              className="rounded border-border"
            />
            <span className="text-sm text-foreground">{t("focusTimer.autoStartWork")}</span>
          </label>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 glass-button text-muted-foreground hover:text-foreground"
        >
          {t("focusTimer.cancel")}
        </button>
        <button
          onClick={() => {
            onSave(localConfig);
            onClose();
          }}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          {t("focusTimer.save")}
        </button>
      </div>
    </div>
  );
}

export function FocusTimer() {
  const [timerState, setTimerState] = useState<FocusTimerState | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const toast = useToast();

  useEffect(() => {
    loadTimerState();
  }, []);

  useEffect(() => {
    if (timerState?.state === 'running') {
      intervalRef.current = setInterval(async () => {
        try {
          const state = await getFocusTimerState();
          setTimerState(state);

          if (state.state === 'completed') {
            handleTimerComplete(state);
          }
        } catch (error) {
          console.error('Failed to tick timer:', error);
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerState?.state]);

  const loadTimerState = async () => {
    try {
      setIsLoading(true);
      const state = await getFocusTimerState();
      setTimerState(state);
    } catch (error) {
      console.error('Failed to load timer state:', error);
      // Set default state on error
      setTimerState({
        state: 'idle',
        phase: 'work',
        remaining_seconds: DEFAULT_TIMER_CONFIG.work_duration * 60,
        total_seconds: DEFAULT_TIMER_CONFIG.work_duration * 60,
        completed_sessions: 0,
        total_focus_time: 0,
        config: DEFAULT_TIMER_CONFIG,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimerComplete = useCallback((state: FocusTimerState) => {
    const phaseLabel = t(phaseConfig[state.phase].labelKey);

    toast.success(
      t("focusTimer.phaseComplete", { phase: phaseLabel }),
      state.phase === 'work'
        ? t("focusTimer.timeForBreak")
        : t("focusTimer.readyToFocus")
    );

    // Play sound if enabled
    if (state.config.sound_enabled) {
      import('../../utils/soundService').then(({ playTimerComplete }) => playTimerComplete());
    }

    // Show notification if enabled
    if (state.config.notifications_enabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(t("focusTimer.phaseComplete", { phase: phaseLabel }), {
        body: state.phase === 'work' ? t("focusTimer.timeForBreak") : t("focusTimer.readyToFocus"),
        icon: '/favicon.ico',
      });
    }
  }, [toast]);

  const handleStart = async () => {
    try {
      const state = await startFocusTimer();
      setTimerState(state);
    } catch (error) {
      console.error('Failed to start timer:', error);
      toast.error(t("focusTimer.error"), t("focusTimer.failedToStart"));
    }
  };

  const handlePause = async () => {
    try {
      const state = await pauseFocusTimer();
      setTimerState(state);
    } catch (error) {
      console.error('Failed to pause timer:', error);
      toast.error(t("focusTimer.error"), t("focusTimer.failedToPause"));
    }
  };

  const handleReset = async () => {
    try {
      const state = await resetFocusTimer();
      setTimerState(state);
    } catch (error) {
      console.error('Failed to reset timer:', error);
      toast.error(t("focusTimer.error"), t("focusTimer.failedToReset"));
    }
  };

  const handleSkip = async () => {
    try {
      const state = await skipFocusTimerPhase();
      setTimerState(state);
    } catch (error) {
      console.error('Failed to skip phase:', error);
      toast.error(t("focusTimer.error"), t("focusTimer.failedToSkip"));
    }
  };

  const handleConfigUpdate = async (config: FocusTimerConfig) => {
    try {
      const state = await updateFocusTimerConfig(config);
      setTimerState(state);
      toast.success(t("focusTimer.settingsSaved"), t("focusTimer.timerConfigUpdated"));
    } catch (error) {
      console.error('Failed to update config:', error);
      toast.error(t("focusTimer.error"), t("focusTimer.failedToUpdateSettings"));
    }
  };

  if (isLoading) {
    return (
      <div className="glass-panel p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
      </div>
    );
  }

  if (!timerState) {
    return null;
  }

  const { phase, remaining_seconds, total_seconds, completed_sessions, total_focus_time, config, state } = timerState;
  const progress = total_seconds > 0 ? remaining_seconds / total_seconds : 0;
  const currentPhase = phaseConfig[phase];
  const PhaseIcon = currentPhase.icon;

  return (
    <div className="glass-panel-heavy p-8 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${currentPhase.bgColor}`}>
            <PhaseIcon className={`w-5 h-5 ${currentPhase.color}`} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t(currentPhase.labelKey)}</h2>
            <p className="text-xs text-muted-foreground">
              {t("focusTimer.session", { count: completed_sessions + 1 })}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 glass-button rounded-lg"
          title={t("focusTimer.settings")}
        >
          <Settings className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-6">
          <SettingsPanel
            config={config}
            onSave={handleConfigUpdate}
            onClose={() => setShowSettings(false)}
          />
        </div>
      )}

      {/* Timer Display */}
      <div className="flex flex-col items-center mb-8">
        <CircularProgress
          progress={progress}
          size={220}
          strokeWidth={10}
          color={phase === 'work' ? '#38bdf8' : phase === 'shortbreak' ? '#34d399' : '#fbbf24'}
        >
          <div className="flex flex-col items-center">
            <span className="text-4xl font-bold text-foreground font-mono">
              {formatTime(remaining_seconds)}
            </span>
            <span className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
              {state === 'running' ? t("focusTimer.inProgress") : state === 'paused' ? t("focusTimer.paused") : state === 'completed' ? t("focusTimer.done") : t("focusTimer.ready")}
            </span>
          </div>
        </CircularProgress>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mb-6">
        {state === 'running' ? (
          <button
            onClick={handlePause}
            className="p-4 glass-button rounded-full hover:scale-105 transition-transform"
            title={t("focusTimer.pause")}
          >
            <Pause className="w-6 h-6 text-foreground" />
          </button>
        ) : (
          <button
            onClick={handleStart}
            className="p-4 bg-primary-500 rounded-full hover:bg-primary-600 hover:scale-105 transition-all"
            title={t("focusTimer.start")}
          >
            <Play className="w-6 h-6 text-white" />
          </button>
        )}

        <button
          onClick={handleReset}
          className="p-3 glass-button rounded-full"
          title={t("focusTimer.reset")}
        >
          <RotateCcw className="w-5 h-5 text-muted-foreground" />
        </button>

        <button
          onClick={handleSkip}
          className="p-3 glass-button rounded-full"
          title={t("focusTimer.skip")}
        >
          <SkipForward className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Stats */}
      <div className="glass-panel-light p-4 rounded-lg">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-foreground">{completed_sessions}</div>
            <div className="text-xs text-muted-foreground">{t("focusTimer.sessionsToday")}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">
              {Math.floor(total_focus_time / 60)}m
            </div>
            <div className="text-xs text-muted-foreground">{t("focusTimer.focusTime")}</div>
          </div>
        </div>
      </div>

      {/* Session indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: config.sessions_before_long_break }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i < completed_sessions % config.sessions_before_long_break
                ? 'bg-primary-400'
                : 'bg-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default FocusTimer;
