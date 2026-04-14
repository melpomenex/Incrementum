/**
 * IntelligenceIndicator
 * Displays intelligence score as a colored dot/badge on story items
 * Green = liked, Red = disliked, Gray = neutral
 */

interface IntelligenceIndicatorProps {
  score?: number | null;
  className?: string;
}

export function IntelligenceIndicator({ score, className = "" }: IntelligenceIndicatorProps) {
  if (score == null || score === 0) {
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 ${className}`}
        title="Neutral"
      />
    );
  }

  if (score > 0) {
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full bg-emerald-500 ${className}`}
        title={`Positive (${score.toFixed(1)})`}
      />
    );
  }

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full bg-red-500 ${className}`}
      title={`Negative (${score.toFixed(1)})`}
    />
  );
}
