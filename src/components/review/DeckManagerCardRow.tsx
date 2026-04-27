import { useMemo } from "react";
import { Check, Clock, AlertTriangle, Flame, ChevronRight } from "lucide-react";
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
  New: { label: "New", color: "text-blue-600", bg: "bg-blue-500/15" },
  Learning: { label: "Learn", color: "text-orange-600", bg: "bg-orange-500/15" },
  Review: { label: "Review", color: "text-green-600", bg: "bg-green-500/15" },
  Relearning: { label: "Relearn", color: "text-red-600", bg: "bg-red-500/15" },
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
  return { text: `${Math.round(diffDays)}d`, urgent: false };
}

function DifficultyBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, (value / 10) * 100));
  const color =
    value <= 3 ? "bg-green-500" : value <= 6 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1">
      <div className="w-8 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums w-3 text-right">
        {value}
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
  const truncatedQ =
    card.question.length > 80
      ? card.question.replace(/<[^>]*>/g, "").slice(0, 77) + "..."
      : card.question.replace(/<[^>]*>/g, "");

  return (
    <div
      className={`group flex items-center gap-2 px-3 py-1.5 border-b border-border/50 transition-colors cursor-pointer hover:bg-muted/50 ${
        isExpanded ? "bg-muted/40" : ""
      } ${card.is_suspended ? "opacity-50" : ""}`}
      onClick={() => onExpand(card.id)}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(card.id);
        }}
        className={`flex-shrink-0 w-4 h-4 rounded border transition-colors ${
          isSelected
            ? "bg-primary border-primary text-primary-foreground"
            : "border-border hover:border-primary/50"
        } flex items-center justify-center`}
      >
        {isSelected && <Check className="h-2.5 w-2.5" />}
      </button>

      <span
        className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${stateCfg.bg} ${stateCfg.color}`}
      >
        {stateCfg.label}
      </span>

      <span
        className="flex-1 text-sm truncate"
        dangerouslySetInnerHTML={{ __html: truncatedQ }}
      />

      <div className="flex items-center gap-3 flex-shrink-0">
        {card.lapses >= 5 && (
          <span title="Leech card" className="text-yellow-500">
            <AlertTriangle className="h-3 w-3" />
          </span>
        )}

        <div className="flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
          <Clock className="h-2.5 w-2.5" />
          <span className={due.urgent ? "text-red-500 font-medium" : ""}>
            {due.text}
          </span>
        </div>

        <DifficultyBar value={card.difficulty} />

        <span
          className="text-[10px] text-muted-foreground tabular-nums"
          title={`${card.interval} day interval`}
        >
          {card.interval}d
        </span>

        <span className="text-[10px] text-muted-foreground tabular-nums">
          {card.review_count}×
        </span>

        <ChevronRight
          className={`h-3 w-3 text-muted-foreground transition-transform ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
      </div>
    </div>
  );
}
