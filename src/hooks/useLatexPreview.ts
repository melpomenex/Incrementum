import { useMemo, useState } from "react";
import { renderAnkiHtmlWithLatex } from "../utils/ankiLatex";

interface UseLatexPreviewResult {
  html: string;
  isPending: boolean;
}

/**
 * Debounce helper that returns a debounced version of the input.
 * Uses a simple setTimeout approach to avoid re-renders on every keystroke.
 */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useMemo(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook that provides live LaTeX preview for editor inputs.
 *
 * Debounces the input (default 300ms) and renders via the same pipeline
 * used by review surfaces, ensuring consistent output.
 *
 * @param input - The raw text containing LaTeX
 * @param delay - Debounce delay in ms (default 300)
 */
export function useLatexPreview(input: string, delay = 300): UseLatexPreviewResult {
  const debouncedInput = useDebouncedValue(input, delay);
  const isPending = debouncedInput !== input;

  const html = useMemo(() => {
    if (!debouncedInput.trim()) return "";
    try {
      return renderAnkiHtmlWithLatex(debouncedInput);
    } catch {
      return debouncedInput;
    }
  }, [debouncedInput]);

  return { html, isPending };
}
