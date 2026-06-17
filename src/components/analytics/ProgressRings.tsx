/**
 * Progress Ring Component
 * Circular progress indicators for daily, weekly, and monthly goals
 */

import {
  CheckCircle,
  Flame,
  Target,
  TrendUp,
} from "@phosphor-icons/react";

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  children?: React.ReactNode;
  showPercentage?: boolean;
  animated?: boolean;
}

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  color = "hsl(var(--primary))",
  bgColor = "hsl(var(--muted))",
  children,
  showPercentage = false,
  animated = true,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  const center = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={animated ? "transition-all duration-1000 ease-out" : ""}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children || (showPercentage && (
          <span className="text-2xl font-bold text-foreground">
            {Math.round(progress)}%
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Dashboard Progress Rings
 * Shows daily goal, weekly goal, and streak progress
 */
interface DashboardProgressRingsProps {
  dailyGoal: number;
  dailyProgress: number;
  weeklyGoal: number;
  weeklyProgress: number;
  streakDays: number;
  longestStreak: number;
  className?: string;
}

export function DashboardProgressRings({
  dailyGoal,
  dailyProgress,
  weeklyGoal,
  weeklyProgress,
  streakDays,
  longestStreak,
  className = "",
}: DashboardProgressRingsProps) {
  const dailyPercent = Math.min(100, (dailyProgress / dailyGoal) * 100);
  const weeklyPercent = Math.min(100, (weeklyProgress / weeklyGoal) * 100);
  const streakPercent = longestStreak > 0 ? Math.min(100, (streakDays / longestStreak) * 100) : 0;

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`}>
      {/* Daily Goal */}
      <div className="flex flex-col items-center p-6 bg-card border border-border rounded-2xl">
        <ProgressRing
          progress={dailyPercent}
          size={100}
          strokeWidth={8}
          color="hsl(var(--primary))"
        >
          <div className="text-center">
            <div className="text-xl font-bold text-foreground">{dailyProgress}</div>
            <div className="text-xs text-muted-foreground">/ {dailyGoal}</div>
          </div>
        </ProgressRing>
        <div className="mt-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-foreground">
            <Target className="w-4 h-4 text-primary" />
            Daily Goal
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {dailyProgress >= dailyGoal
              ? "Goal completed! 🎉"
              : `${dailyGoal - dailyProgress} more to go`}
          </p>
        </div>
      </div>

      {/* Weekly Goal */}
      <div className="flex flex-col items-center p-6 bg-card border border-border rounded-2xl">
        <ProgressRing
          progress={weeklyPercent}
          size={100}
          strokeWidth={8}
          color="hsl(142 76% 36%)" // green-500
        >
          <div className="text-center">
            <div className="text-xl font-bold text-foreground">{weeklyProgress}</div>
            <div className="text-xs text-muted-foreground">/ {weeklyGoal}</div>
          </div>
        </ProgressRing>
        <div className="mt-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-foreground">
            <TrendUp className="w-4 h-4 text-green-500" />
            Weekly Goal
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {weeklyProgress >= weeklyGoal
              ? "Weekly goal achieved! 🌟"
              : `${weeklyGoal - weeklyProgress} cards remaining`}
          </p>
        </div>
      </div>

      {/* Streak */}
      <div className="flex flex-col items-center p-6 bg-card border border-border rounded-2xl">
        <ProgressRing
          progress={streakPercent}
          size={100}
          strokeWidth={8}
          color="hsl(24 95% 53%)" // orange-500
        >
          <div className="text-center">
            <div className="text-xl font-bold text-foreground">{streakDays}</div>
            <div className="text-xs text-muted-foreground">days</div>
          </div>
        </ProgressRing>
        <div className="mt-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-foreground">
            <Flame className="w-4 h-4 text-orange-500" />
            Current Streak
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {streakDays > 0
              ? `Best: ${longestStreak} days`
              : "Start your streak today!"}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact progress ring for inline display
 */
interface MiniProgressRingProps {
  progress: number;
  size?: number;
  color?: string;
  label?: string;
}

export function MiniProgressRing({
  progress,
  size = 32,
  color = "hsl(var(--primary))",
  label,
}: MiniProgressRingProps) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  const center = size / 2;

  return (
    <div className="inline-flex items-center gap-2">
      <div className="relative">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        {progress >= 100 && (
          <CheckCircle className="absolute inset-0 m-auto w-3 h-3 text-green-500" />
        )}
      </div>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}

/**
 * Progress ring with inner content slots
 */
interface ProgressRingCardProps {
  progress: number;
  title: string;
  subtitle?: string;
  icon?: typeof Target;
  color?: string;
  size?: number;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

export function ProgressRingCard({
  progress,
  title,
  subtitle,
  icon: Icon = Target,
  color = "hsl(var(--primary))",
  size = 80,
  children,
  footer,
}: ProgressRingCardProps) {
  return (
    <div className="p-4 bg-card border border-border rounded-xl">
      <div className="flex items-center gap-4">
        <ProgressRing progress={progress} size={size} strokeWidth={6} color={color}>
          <Icon className="w-6 h-6" style={{ color }} />
        </ProgressRing>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-foreground">{title}</h4>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
          {children}
        </div>
      </div>
      {footer && <div className="mt-3 pt-3 border-t border-border">{footer}</div>}
    </div>
  );
}

export default ProgressRing;
