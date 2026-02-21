/**
 * Keyboard Shortcut Tooltip Component
 * Adds keyboard shortcut hints to any tooltip-enabled element
 */

import { useState, ReactNode } from "react";
import {
  Command,
  Shift,
  Ctrl,
  Alt,
  CornerDownLeft,
  Delete,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Escape,
} from "lucide-react";

interface KeyDefinition {
  key: string;
  label?: string;
  icon?: typeof Command;
  isModifier?: boolean;
}

// Common key definitions
export const KEYS: Record<string, KeyDefinition> = {
  // Modifiers
  cmd: { key: "⌘", label: "Command", icon: Command, isModifier: true },
  ctrl: { key: "^", label: "Control", icon: Ctrl, isModifier: true },
  shift: { key: "⇧", label: "Shift", icon: Shift, isModifier: true },
  alt: { key: "⌥", label: "Option", icon: Alt, isModifier: true },

  // Special keys
  enter: { key: "↵", label: "Enter", icon: CornerDownLeft },
  escape: { key: "Esc", label: "Escape", icon: Escape },
  backspace: { key: "⌫", label: "Backspace", icon: Delete },
  delete: { key: "⌦", label: "Delete", icon: Delete },
  space: { key: "Space", label: "Space" },
  tab: { key: "⇥", label: "Tab" },

  // Arrow keys
  up: { key: "↑", label: "Up", icon: ArrowUp },
  down: { key: "↓", label: "Down", icon: ArrowDown },
  left: { key: "←", label: "Left", icon: ArrowLeft },
  right: { key: "→", label: "Right", icon: ArrowRight },

  // Common keys
  "/": { key: "/", label: "/" },
  "?": { key: "?", label: "?" },
  n: { key: "N", label: "N" },
  r: { key: "R", label: "R" },
  q: { key: "Q", label: "Q" },
  g: { key: "G", label: "G" },
  b: { key: "B", label: "B" },
  j: { key: "J", label: "J" },
  k: { key: "K", label: "K" },
  s: { key: "S", label: "S" },
  f: { key: "F", label: "F" },
  p: { key: "P", label: "P" },
  e: { key: "E", label: "E" },
  d: { key: "D", label: "D" },
};

/**
 * Parse shortcut string into key parts
 * Format: "mod+k" or "ctrl+shift+n" or "/"
 */
function parseShortcut(shortcut: string): string[] {
  return shortcut.toLowerCase().split("+").map((k) => k.trim());
}

/**
 * Detect platform for modifier key display
 */
function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

/**
 * Normalize modifier keys based on platform
 */
function normalizeKey(key: string): string {
  if (key === "mod" || key === "meta") {
    return isMac() ? "cmd" : "ctrl";
  }
  return key;
}

/**
 * Single key badge component
 */
interface KeyBadgeProps {
  keyDef: KeyDefinition;
  size?: "sm" | "md" | "lg";
}

function KeyBadge({ keyDef, size = "md" }: KeyBadgeProps) {
  const sizeClasses = {
    sm: "px-1 py-0.5 text-[10px] min-w-[16px]",
    md: "px-1.5 py-0.5 text-xs min-w-[20px]",
    lg: "px-2 py-1 text-sm min-w-[24px]",
  };

  return (
    <kbd
      className={`inline-flex items-center justify-center bg-muted border border-border rounded font-mono font-medium ${sizeClasses[size]}`}
      title={keyDef.label}
    >
      {keyDef.icon ? (
        <keyDef.icon className={size === "sm" ? "w-2.5 h-2.5" : size === "lg" ? "w-3.5 h-3.5" : "w-3 h-3"} />
      ) : (
        keyDef.key
      )}
    </kbd>
  );
}

/**
 * Shortcut display component
 */
interface ShortcutDisplayProps {
  shortcut: string;
  size?: "sm" | "md" | "lg";
  separator?: string;
  className?: string;
}

export function ShortcutDisplay({
  shortcut,
  size = "md",
  separator = "+",
  className = "",
}: ShortcutDisplayProps) {
  const keys = parseShortcut(shortcut).map(normalizeKey);
  const gapClass = size === "sm" ? "gap-0.5" : size === "lg" ? "gap-1.5" : "gap-1";

  return (
    <div className={`inline-flex items-center ${gapClass} ${className}`}>
      {keys.map((key, index) => {
        const keyDef = KEYS[key] || { key: key.toUpperCase(), label: key.toUpperCase() };
        return (
          <span key={index} className="inline-flex items-center">
            <KeyBadge keyDef={keyDef} size={size} />
            {index < keys.length - 1 && (
              <span className="text-muted-foreground/50 text-[10px] mx-0.5">{separator}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Tooltip with shortcut hint
 */
interface ShortcutTooltipProps {
  children: ReactNode;
  label: string;
  shortcut?: string;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
  className?: string;
}

export function ShortcutTooltip({
  children,
  label,
  shortcut,
  position = "bottom",
  delay = 300,
  className = "",
}: ShortcutTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsVisible(false);
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {isVisible && (
        <div
          className={`absolute z-50 ${positionClasses[position]} pointer-events-none animate-in fade-in-0 zoom-in-95 duration-150 ${className}`}
        >
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-popover border border-border rounded-lg shadow-lg">
            <span className="text-xs font-medium text-popover-foreground whitespace-nowrap">
              {label}
            </span>
            {shortcut && (
              <ShortcutDisplay shortcut={shortcut} size="sm" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Button with built-in shortcut tooltip
 */
interface ShortcutButtonProps {
  children: ReactNode;
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "ghost" | "outline" | "primary";
  size?: "sm" | "md" | "lg";
}

export function ShortcutButton({
  children,
  label,
  shortcut,
  onClick,
  disabled = false,
  className = "",
  variant = "default",
  size = "md",
}: ShortcutButtonProps) {
  const variantClasses = {
    default: "bg-muted hover:bg-muted/80 text-foreground",
    ghost: "bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground",
    outline: "bg-transparent border border-border hover:bg-muted",
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  };

  const sizeClasses = {
    sm: "p-1.5",
    md: "p-2",
    lg: "p-2.5",
  };

  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );

  if (!shortcut) {
    return button;
  }

  return (
    <ShortcutTooltip label={label} shortcut={shortcut}>
      {button}
    </ShortcutTooltip>
  );
}

/**
 * Keyboard shortcut badge for inline display
 */
interface InlineShortcutProps {
  shortcut: string;
  description?: string;
  className?: string;
}

export function InlineShortcut({
  shortcut,
  description,
  className = "",
}: InlineShortcutProps) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <ShortcutDisplay shortcut={shortcut} size="sm" />
      {description && (
        <span className="text-xs text-muted-foreground">{description}</span>
      )}
    </div>
  );
}

/**
 * Hook to get keyboard shortcut display
 */
export function useShortcutDisplay(shortcut: string) {
  const keys = parseShortcut(shortcut).map(normalizeKey);
  const displayKeys = keys.map((key) => {
    const keyDef = KEYS[key] || { key: key.toUpperCase(), label: key.toUpperCase() };
    return keyDef.key;
  });

  const ariaLabel = displayKeys.join(" then ");

  return {
    keys: displayKeys,
    ariaLabel,
    display: displayKeys.join(" + "),
  };
}

/**
 * Shortcut help item for help panels
 */
interface ShortcutHelpItemProps {
  shortcut: string;
  description: string;
  category?: string;
  className?: string;
}

export function ShortcutHelpItem({
  shortcut,
  description,
  className = "",
}: ShortcutHelpItemProps) {
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <span className="text-sm text-foreground">{description}</span>
      <ShortcutDisplay shortcut={shortcut} size="md" />
    </div>
  );
}

/**
 * Shortcut category group for help panels
 */
interface ShortcutCategoryProps {
  title: string;
  shortcuts: Array<{ shortcut: string; description: string }>;
  className?: string;
}

export function ShortcutCategory({
  title,
  shortcuts,
  className = "",
}: ShortcutCategoryProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h4>
      <div className="space-y-1.5">
        {shortcuts.map((item, index) => (
          <ShortcutHelpItem
            key={index}
            shortcut={item.shortcut}
            description={item.description}
          />
        ))}
      </div>
    </div>
  );
}

export default ShortcutTooltip;
