/**
 * RelevanceIndicator
 * Displays relevance score as a colored dot on queue items
 * Green = high relevance (>0.7), Red = low relevance (<0.3), Gray = neutral
 */

interface RelevanceIndicatorProps {
  score?: number | null;
  className?: string;
}

export function RelevanceIndicator({ score, className = "" }: RelevanceIndicatorProps) {
  if (score == null) {
    return null;
  }

  if (score > 0.7) {
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full bg-emerald-500 ${className}`}
        title={`High relevance (${(score * 100).toFixed(0)}%)`}
      />
    );
  }

  if (score < 0.3) {
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full bg-red-400 ${className}`}
        title={`Low relevance (${(score * 100).toFixed(0)}%)`}
      />
    );
  }

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 ${className}`}
      title={`Neutral relevance (${(score * 100).toFixed(0)}%)`}
    />
  );
}
