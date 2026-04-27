import { useMemo } from "react";
import {
  BarChart3,
  Clock,
  AlertTriangle,
  Brain,
  TrendingUp,
  Activity,
} from "lucide-react";
import type { LearningItem } from "../../api/learning-items";

interface DeckStatsPanelProps {
  cards: LearningItem[];
  deckName: string;
  onLeechClick?: () => void;
}

function formatRetention(rate: number): { text: string; color: string } {
  if (rate >= 0.9) return { text: `${Math.round(rate * 100)}%`, color: "text-green-500" };
  if (rate >= 0.75) return { text: `${Math.round(rate * 100)}%`, color: "text-yellow-500" };
  return { text: `${Math.round(rate * 100)}%`, color: "text-red-500" };
}

function MaturityBar({
  counts,
}: {
  counts: { new: number; learning: number; young: number; mature: number };
}) {
  const total = counts.new + counts.learning + counts.young + counts.mature;
  if (total === 0) return null;

  const segments = [
    { count: counts.new, color: "bg-blue-500", label: "New" },
    { count: counts.learning, color: "bg-orange-500", label: "Learning" },
    { count: counts.young, color: "bg-green-400", label: "Young" },
    { count: counts.mature, color: "bg-green-600", label: "Mature" },
  ];

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
        {segments.map((s) =>
          s.count > 0 ? (
            <div
              key={s.label}
              className={`${s.color} transition-all`}
              style={{ width: `${(s.count / total) * 100}%` }}
              title={`${s.label}: ${s.count}`}
            />
          ) : null
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1 text-[10px]">
            <div className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-medium tabular-nums">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const barWidth = 100 / data.length;

  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((val, i) => {
        const pct = (val / max) * 100;
        const isToday = i === 0;
        return (
          <div
            key={i}
            className={`flex-1 rounded-t-sm transition-all ${
              isToday ? "bg-primary" : "bg-muted-foreground/20"
            }`}
            style={{ height: `${Math.max(pct, 4)}%` }}
            title={`${val} due`}
          />
        );
      })}
    </div>
  );
}

export function DeckStatsPanel({
  cards,
  deckName,
  onLeechClick,
}: DeckStatsPanelProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const dueToday = cards.filter((c) => c.due_date.slice(0, 10) <= todayStr).length;
    const leeches = cards.filter((c) => c.lapses >= 5);

    const newCards = cards.filter((c) => c.state === "New").length;
    const learningCards = cards.filter((c) => c.state === "Learning").length;
    const reviewCards = cards.filter((c) => c.state === "Review");
    const relearningCards = cards.filter((c) => c.state === "Relearning").length;
    const youngCards = reviewCards.filter((c) => c.interval < 21).length;
    const matureCards = reviewCards.filter((c) => c.interval >= 21).length;

    const avgDifficulty =
      cards.length > 0
        ? cards.reduce((sum, c) => sum + c.difficulty, 0) / cards.length
        : 0;

    const reviewedCards = cards.filter((c) => c.review_count > 0);
    const retentionRate =
      reviewedCards.length > 0
        ? reviewedCards.reduce((sum, c) => {
            const lapseRate = c.review_count > 0 ? c.lapses / c.review_count : 0;
            return sum + (1 - lapseRate);
          }, 0) / reviewedCards.length
        : 0;

    const avgStability =
      cards.length > 0
        ? cards.reduce(
            (sum, c) => sum + (c.memory_state?.stability ?? c.interval),
            0
          ) / cards.length
        : 0;

    const avgMemDifficulty =
      cards.length > 0
        ? cards.reduce(
            (sum, c) => sum + (c.memory_state?.difficulty ?? c.difficulty),
            0
          ) / cards.length
        : 0;

    const dayCounts: number[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().slice(0, 10);
      dayCounts.push(cards.filter((c) => c.due_date.slice(0, 10) <= ds).length);
    }

    const healthColor =
      retentionRate >= 0.85 ? "text-green-500" : retentionRate >= 0.7 ? "text-yellow-500" : "text-red-500";

    return {
      total: cards.length,
      dueToday,
      leeches,
      newCards,
      learningCards,
      youngCards,
      matureCards,
      relearningCards,
      avgDifficulty,
      retentionRate,
      avgStability,
      avgMemDifficulty,
      dayCounts,
      healthColor,
    };
  }, [cards]);

  const retention = formatRetention(stats.retentionRate);

  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{deckName}</h3>
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {stats.total} cards
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-0.5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Due Today
          </div>
          <div className="text-lg font-semibold tabular-nums">{stats.dueToday}</div>
        </div>
        <div className="space-y-0.5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="h-2.5 w-2.5" /> Retention
          </div>
          <div className={`text-lg font-semibold tabular-nums ${retention.color}`}>
            {retention.text}
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Avg Difficulty
          </div>
          <div className="text-lg font-semibold tabular-nums">
            {stats.avgDifficulty.toFixed(1)}
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="h-2.5 w-2.5" /> Leeches
          </div>
          <button
            onClick={onLeechClick}
            disabled={stats.leeches.length === 0}
            className={`text-lg font-semibold tabular-nums ${
              stats.leeches.length > 0
                ? "text-yellow-500 hover:underline cursor-pointer"
                : "text-muted-foreground cursor-default"
            }`}
          >
            {stats.leeches.length}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Activity className="h-2.5 w-2.5" /> Maturity
        </div>
        <MaturityBar
          counts={{
            new: stats.newCards,
            learning: stats.learningCards + stats.relearningCards,
            young: stats.youngCards,
            mature: stats.matureCards,
          }}
        />
      </div>

      <div className="space-y-1.5">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" /> 7-Day Forecast
        </div>
        <Sparkline data={stats.dayCounts} />
      </div>

      <div className="space-y-1.5">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Brain className="h-2.5 w-2.5" /> FSRS Memory
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs">
            <span className="text-muted-foreground">Stability: </span>
            <span className="font-medium tabular-nums">
              {stats.avgStability.toFixed(0)}d
            </span>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Difficulty: </span>
            <span className="font-medium tabular-nums">
              {stats.avgMemDifficulty.toFixed(1)}
            </span>
          </div>
          <div className={`h-2 w-2 rounded-full ${stats.healthColor}`} title="Deck health" />
        </div>
      </div>
    </div>
  );
}
