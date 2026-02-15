/**
 * Focus Theme
 * 
 * A low-contrast, high-readability theme optimized for deep cognitive work.
 * Based on Phase 4: Cognitive State Optimization
 * 
 * Characteristics:
 * - UI chrome is incredibly muted (dark gray on darker gray)
 * - Only the reading content has high contrast
 * - No streaks, daily targets, or gamification elements
 * - Subtle session timer that fades when inactive
 */

import type { Theme } from "./ThemeSystem";

export const FOCUS_THEME: Theme = {
  id: "focus",
  name: "Focus",
  mode: "dark" as const,
  colors: {
    // Extremely muted UI chrome
    primary: "#4a5568",
    secondary: "#2d3748",
    accent: "#718096",
    
    // Background layers - subtle variations
    background: "#0d1117",
    foreground: "#8b949e",
    
    card: "#161b22",
    cardForeground: "#c9d1d9",
    
    popover: "#1c2128",
    popoverForeground: "#adbac7",
    
    // Even more muted secondary elements
    muted: "#21262d",
    mutedForeground: "#484f58",
    
    // Borders barely visible
    border: "#30363d",
    input: "#21262d",
    
    // Status colors - desaturated
    destructive: "#f85149",
    destructiveForeground: "#ffffff",
    success: "#238636",
    warning: "#9e6a03",
    info: "#58a6ff",
  },
  fonts: {
    // Premium serif for reading content
    sans: { 
      family: "Charter, 'Iowan Old Style', 'Source Serif 4', Georgia, serif", 
      size: 16, 
      lineHeight: 1.7 
    },
    // Monospace for UI and metadata
    mono: { 
      family: "'JetBrains Mono', 'Fira Code', monospace", 
      size: 13, 
      lineHeight: 1.5 
    },
    // UI font - clean sans
    ui: { 
      family: "Inter, -apple-system, system-ui, sans-serif", 
      size: 13, 
      lineHeight: 1.5 
    },
  },
  borderRadius: {
    sm: "2px",
    md: "4px",
    lg: "6px",
    xl: "8px",
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
  },
  shadows: {
    sm: "none",
    md: "0 2px 8px rgba(0,0,0,0.2)",
    lg: "0 4px 12px rgba(0,0,0,0.3)",
    xl: "0 8px 24px rgba(0,0,0,0.4)",
  },
};

// Compact mode variant - terminal-like density
export const FOCUS_COMPACT_THEME: Theme = {
  ...FOCUS_THEME,
  id: "focus-compact",
  name: "Focus (Compact)",
  fonts: {
    sans: { 
      family: "'JetBrains Mono', monospace", 
      size: 14, 
      lineHeight: 1.4 
    },
    mono: { 
      family: "'JetBrains Mono', monospace", 
      size: 13, 
      lineHeight: 1.4 
    },
    ui: { 
      family: "'JetBrains Mono', monospace", 
      size: 12, 
      lineHeight: 1.4 
    },
  },
  spacing: {
    xs: "0.125rem",
    sm: "0.25rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
  },
};

// Hook to check if focus theme is active
export function useIsFocusTheme(currentThemeId: string): boolean {
  return currentThemeId.startsWith("focus");
}

// Component wrapper that applies focus-specific styles
export function FocusModeWrapper({ 
  children,
  isActive 
}: { 
  children: React.ReactNode;
  isActive: boolean;
}) {
  if (!isActive) return <>{children}</>;
  
  return (
    <div 
      className="focus-mode"
      style={{
        // Reduce motion
        "--animation-duration-fast": "0ms",
        "--animation-duration-normal": "0ms",
        "--animation-duration-slow": "50ms",
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
