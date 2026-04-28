import { useMemo } from "react";
import {
  Check,
  Clock,
  AlertTriangle,
  MoreHorizontal,
} from "lucide-react";
import type { LearningItem } from "../../api/learning-items";

interface DeckManagerCardRowProps {
  card: LearningItem;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: (id: string) => void;
  onExpand: (id: string) => void;
}

const STATE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  New: { label: "New", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/15" },
  Learning: { label: "Learn", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/15" },
  Review: { label: "Review", color: "text-green-600 dark:text-green-400", bg: "bg-green-500/15" },
  Relearning: { label: "Relearn", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/15" },
};

function relativeDueDate(dueDate: string): { text: string; urgent: boolean } {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < -1) return { text: `${Math.abs(Math.round(diffDays))}d overdue`, urgent: true };
  if (diffDays < 0) return { text: "Overdue", urgent: true };
  if (diffDays < 1) return { text: "Today", urgent: true };
  if (diffDays < 2) return { text: "Tomorrow", urgent: false };
  if (diffDays < 7) return { text: `${Math.round(diffDays)}d`, urgent: false };
  if (diffDays < 30) return { text: `${Math.round(diffDays / 7)}w`, urgent: false };
  return { text: `${Math.round(diffDays / 30)}mo`, urgent: false };
}

function formatLastReview(date?: string): string {
  if (!date) return "—";
  const now = new Date();
  const reviewed = new Date(date);
  const diffMs = now.getTime() - reviewed.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 1) return "Today";
  if (diffDays < 2) return "Yesterday";
  if (diffDays < 7) return `${Math.round(diffDays)}d ago`;
  if (diffDays < 30) return `${Math.round(diffDays / 7)}w ago`;
  return `${Math.round(diffDays / 30)}mo ago`;
}

function DifficultyIndicator({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, (value / 10) * 100));
  const color =
    value <= 3 ? "bg-green-500" : value <= 6 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1">
      <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums w-3 text-right">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export function DeckManagerCardRow({
  card,
  isSelected,
  isExpanded,
  onToggleSelect,
  onExpand,
}: DeckManagerCardRowProps) {
  const stateCfg = STATE_CONFIG[card.state] ?? STATE_CONFIG.New;
  const due = useMemo(() => relativeDueDate(card.due_date), [card.due_date]);
  const truncatedQ = useMemo(() => {
    const plain = card.question.replace(/<[^>]*>/g, "").trim();
    return plain.length > 60 ? plain.slice(0, 57) + "…" : plain;
  }, [card.question]);

  const stability = card.memory_state?.stability ?? card.interval;

  return (
    <div
      className={`group flex items-center gap-2 px-3 py-2 border-b border-border/30 transition-colors cursor-pointer hover:bg-muted/40 text-xs ${
        isExpanded ? "bg-muted/30" : ""
      } ${card.is_suspended ? "opacity-50" : ""}`}
      onClick={() => onExpand(card.id)}
    >
      {/* Checkbox */}
      <div className="w-4 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(card.id);
          }}
          className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
            isSelected
              ? "bg-primary border-primary text-primary-foreground"
              : "border-border hover:border-primary/50"
          }`}
        >
          {isSelected && <Check className="h-2.5 w-2.5" />}
        </button>
      </div>

      {/* Question text */}
      <div className="w-[180px] flex-shrink-0 min-w-0 truncate text-xs leading-tight" title={card.question.replace(/<[^>]*>/g, "")}>
        {truncatedQ}
        {card.lapses >= 5 && (
          <span title="Leech"><AlertTriangle className="h-3 w-3 text-yellow-500 inline ml-1 flex-shrink-0" /></span>
        )}
      </div>

      {/* Type badge */}
      <div className="w-12 flex-shrink-0">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${stateCfg.bg} ${stateCfg.color}`}>
          {stateCfg.label}
        </span>
      </div>

      {/* Due date */}
      <div className={`w-16 flex-shrink-0 text-xs tabular-nums ${due.urgent ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
        {due.text}
      </div>

      {/* Difficulty */}
      <div className="w-20 flex-shrink-0">
        <DifficultyIndicator value={card.difficulty} />
      </div>

      {/* Stability */}
      <div className="w-14 flex-shrink-0 text-xs text-muted-foreground tabular-nums" title={`${stability.toFixed(1)} days stability`}>
        {stability < 1 ? `${(stability * 24).toFixed(0)}h` : stability < 30 ? `${stability.toFixed(0)}d` : `${(stability / 30).toFixed(1)}mo`}
      </div>

      {/* Tags */}
      <div className="flex-1 min-w-0 flex items-center gap-0.5 overflow-hidden">
        {card.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground truncate max-w-[80px]"
            title={tag}
          >
            {tag}
          </span>
        ))}
        {card.tags.length > 2 && (
          <span className="text-[10px] text-muted-foreground">+{card.tags.length - 2}</span>
        )}
      </div>

      {/* Last Review */}
      <div className="w-20 flex-shrink-0 text-xs text-muted-foreground tabular-nums flex items-center gap-0.5">
        <Clock className="h-3 w-3 flex-shrink-0" />
        {formatLastReview(card.last_review_date)}
      </div>

      {/* Menu dots */}
      <div className="w-5 flex-shrink-0 flex items-center justify-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
        >
          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
