/**
 * Toast notification system
 * Enhanced with stack limit, progress bar, and better animations
 */

import { useState, useCallback, useMemo } from "react";
import { create } from "zustand";
import {
  Check,
  Info,
  Warning,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { playFeedback, vibrate } from "../../utils/soundService";

/**
 * Toast types
 */
export enum ToastType {
  Success = "success",
  Error = "error",
  Warning = "warning",
  Info = "info",
}

/**
 * Toast notification
 */
export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** @deprecated Kept for compat; progress is now driven by CSS transition */
  progress?: number;
}

/**
 * Toast store
 */
interface ToastStore {
  toasts: ToastData[];
  addToast: (toast: Omit<ToastData, "id" | "progress">) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
  /** @deprecated No longer used; progress is now CSS-driven */
  updateProgress: (id: string, progress: number) => void;
}

const MAX_VISIBLE_TOASTS = 4;

/**
 * Use toast store
 */
export const useToastStore = create<ToastStore>((set, _get) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastData = { ...toast, id, progress: 100 };

    set((state) => {
      const toasts = state.toasts.length >= MAX_VISIBLE_TOASTS
        ? state.toasts.slice(1)
        : state.toasts;
      return { toasts: [...toasts, newToast] };
    });

    // Animate progress bar
    // NOTE: progress animation is now driven entirely by CSS transition
    // on the ToastItem progress bar. We no longer use setInterval to
    // update progress in the store, which previously caused excessive
    // Zustand re-renders (React max-update-depth errors) in heavy
    // components like DocumentViewer.

    // Auto-remove after duration
    const duration = toast.duration ?? 5000;
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);

    return id;
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  clearAll: () => {
    set({ toasts: [] });
  },
  updateProgress: (id, progress) => {
    set((state) => {
      const target = state.toasts.find((t) => t.id === id);
      if (target && target.progress === progress) return state;
      return {
        toasts: state.toasts.map((t) =>
          t.id === id ? { ...t, progress } : t
        ),
      };
    });
  },
}));

/**
 * Toast icons
 */
const ToastIcons = {
  [ToastType.Success]: Check,
  [ToastType.Error]: WarningCircle,
  [ToastType.Warning]: Warning,
  [ToastType.Info]: Info,
};

const ToastStyles = {
  [ToastType.Success]: {
    container: "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400",
    progress: "bg-green-500",
    icon: "text-green-500",
  },
  [ToastType.Error]: {
    container: "bg-destructive/10 border-destructive/20 text-destructive",
    progress: "bg-destructive",
    icon: "text-destructive",
  },
  [ToastType.Warning]: {
    container: "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    progress: "bg-yellow-500",
    icon: "text-yellow-500",
  },
  [ToastType.Info]: {
    container: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
    progress: "bg-blue-500",
    icon: "text-blue-500",
  },
};

/**
 * Individual toast item with animation and progress bar
 */
function ToastItem({ toast, onRemove }: { toast: ToastData; onRemove: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const Icon = ToastIcons[toast.type];
  const styles = ToastStyles[toast.type];

  const handleRemove = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 200);
  }, [toast.id, onRemove]);

  return (
    <div
      className={`
        relative min-w-[320px] max-w-md p-4 rounded-lg shadow-lg border 
        backdrop-blur-sm overflow-hidden
        transition-all duration-200 ease-out
        ${styles.container}
        ${isExiting ? "opacity-0 translate-x-full" : "opacity-100 translate-x-0 animate-slide-up"}
      `}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="alert"
      aria-live="polite"
    >
      {/* Progress bar — CSS animation drives the shrink, no JS state updates */}
      <div
        className={`absolute bottom-0 left-0 h-0.5 ${styles.progress} toast-progress-bar`}
        style={{
          animationDuration: `${toast.duration ?? 5000}ms`,
          animationPlayState: isPaused ? "paused" : "running",
        }}
        aria-hidden="true"
      />

      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.icon}`} aria-hidden="true" />
        <div className="flex-1 min-w-0 pr-6">
          <p className="text-sm font-medium text-foreground">{toast.title}</p>
          {toast.message && (
            <p className="text-sm opacity-90 mt-0.5 text-foreground/80">{toast.message}</p>
          )}
          {toast.action && (
            <button
              onClick={() => {
                toast.action?.onClick();
                handleRemove();
              }}
              className="text-sm underline mt-2 hover:opacity-80 font-medium"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={handleRemove}
          className="absolute top-2 right-2 p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-md opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition-all focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Toast container component
 */
export function Toast() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-full p-4 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onRemove={removeToast} />
        </div>
      ))}
    </div>
  );
}

/**
 * Hook to show toast notifications
 */
export function useToast() {
  const addToast = useToastStore((s) => s.addToast);
  const removeToast = useToastStore((s) => s.removeToast);

  const promiseFn = useCallback(<T,>(
    promise: Promise<T>,
    success: string,
    error?: string
  ): Promise<T> => {
    return promise
      .then((result) => {
        addToast({ type: ToastType.Success, title: success });
        return result;
      })
      .catch((err) => {
        addToast({
          type: ToastType.Error,
          title: error || "An error occurred",
          message: err?.message || String(err),
        });
        throw err;
      });
  }, [addToast]);

  const success = useCallback((title: string, message?: string, options?: Partial<ToastData>) => {
    playFeedback('success');
    return addToast({ type: ToastType.Success, title, message, ...options });
  }, [addToast]);

  const error = useCallback((title: string, message?: string, options?: Partial<ToastData>) => {
    playFeedback('error');
    vibrate('error');
    return addToast({ type: ToastType.Error, title, message, ...options });
  }, [addToast]);

  const warning = useCallback((title: string, message?: string, options?: Partial<ToastData>) => {
    playFeedback('warning');
    return addToast({ type: ToastType.Warning, title, message, ...options });
  }, [addToast]);

  const info = useCallback((title: string, message?: string, options?: Partial<ToastData>) => {
    return addToast({ type: ToastType.Info, title, message, ...options });
  }, [addToast]);

  return useMemo(() => ({
    success,
    error,
    warning,
    info,
    promise: promiseFn,
    dismiss: removeToast,
  }), [success, error, warning, info, promiseFn, removeToast]);
}

/**
 * Toast container provider
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toast />
    </>
  );
}

// Add custom animation styles
const toastStyles = `
  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes toast-shrink {
    from { width: 100%; }
    to   { width: 0%; }
  }

  .animate-slide-up {
    animation: slide-up 0.2s ease-out;
  }

  .toast-progress-bar {
    /* Width shrinks from 100% to 0%; actual duration set via inline style */
    animation-name: toast-shrink;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
    animation-play-state: running;
  }

`;

// Inject styles if not already present
if (typeof document !== "undefined") {
  const styleId = "toast-animations";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = toastStyles;
    document.head.appendChild(style);
  }
}

export default Toast;
