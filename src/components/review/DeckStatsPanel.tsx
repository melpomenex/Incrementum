import { useMemo } from "react";
import {
  BarChart3,
  Clock,
  Activity,
  GraduationCap,
  Plus,
  Download,
  Upload,
  Tag,
  Info,
  Cpu,
} from "lucide-react";
import type { LearningItem } from "../../api/learning-items";
import type { StudyDeck } from "../../types/study-decks";
import { useSettingsStore } from "../../stores/settingsStore";

interface DeckStatsPanelProps {
  cards: LearningItem[];
  deck: StudyDeck;
  onLeechClick?: () => void;
}

function formatRetention(rate: number): { text: string; color: string } {
  if (rate >= 0.9) return { text: `${Math.round(rate * 100)}%`, color: "text-green-500" };
  if (rate >= 0.75) return { text: `${Math.round(rate * 100)}%`, color: "text-yellow-500" };
  return { text: `${Math.round(rate * 100)}%`, color: "text-red-500" };
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
      {icon}
      {label}
    </div>
  );
}

function StatRow({ label, value, color, onClick }: { label: string; value: string | number; color?: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex items-center justify-between w-full text-[11px] py-0.5 ${onClick ? "hover:bg-muted/50 rounded px-1 -mx-1" : ""}`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums font-medium ${color ?? "text-foreground"}`}>
        {value}
      </span>
    </button>
  );
}

const ALGO_NAMES: Record<string, string> = {
  fsrs: "FSRS-6",
  sm2: "SuperMemo 2",
  sm18: "SuperMemo 18",
  sm20: "SuperMemo 20",
};

export function DeckStatsPanel({
  cards,
  deck,
  onLeechClick,
}: DeckStatsPanelProps) {
  const desiredRetention = useSettingsStore((s) => s.settings?.learning?.fsrsParams?.desiredRetention ?? null);
  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const dueToday = cards.filter((c) => !c.is_suspended && c.due_date.slice(0, 10) <= todayStr).length;
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

    // Today forecast — due at different time ranges
    const todayDueNow = cards.filter((c) => !c.is_suspended && c.due_date.slice(0, 10) <= todayStr).length;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const dueTomorrow = cards.filter((c) => !c.is_suspended && c.due_date.slice(0, 10) === tomorrowStr).length;
    const in3d = new Date(now);
    in3d.setDate(in3d.getDate() + 3);
    const in3Str = in3d.toISOString().slice(0, 10);
    const dueIn3 = cards.filter((c) => !c.is_suspended && c.due_date.slice(0, 10) > todayStr && c.due_date.slice(0, 10) <= in3Str).length;
    const in7d = new Date(now);
    in7d.setDate(in7d.getDate() + 7);
    const in7Str = in7d.toISOString().slice(0, 10);
    const dueIn7 = cards.filter((c) => !c.is_suspended && c.due_date.slice(0, 10) > todayStr && c.due_date.slice(0, 10) <= in7Str).length;

    // Top tags
    const tagCounts = new Map<string, number>();
    for (const card of cards) {
      for (const tag of card.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    // Algorithm breakdown — per-algorithm metrics
    const algorithmGroups = new Map<string, LearningItem[]>();
    for (const card of cards) {
      const algo = card.algorithm_type ?? "unknown";
      if (!algorithmGroups.has(algo)) algorithmGroups.set(algo, []);
      algorithmGroups.get(algo)!.push(card);
    }

    const algorithmMetrics = Array.from(algorithmGroups.entries()).map(([algo, algoCards]) => {
      const n = algoCards.length;
      const reviewed = algoCards.filter(c => c.review_count > 0);
      const algoRetention = reviewed.length > 0
        ? reviewed.reduce((s, c) => s + (1 - (c.review_count > 0 ? c.lapses / c.review_count : 0)), 0) / reviewed.length
        : 0;
      const algoAvgDifficulty = n > 0 ? algoCards.reduce((s, c) => s + c.difficulty, 0) / n : 0;
      const algoAvgStability = n > 0
        ? algoCards.reduce((s, c) => s + (c.memory_state?.stability ?? c.interval), 0) / n
        : 0;
      const algoAvgEase = n > 0 ? algoCards.reduce((s, c) => s + c.ease_factor, 0) / n : 0;
      const algoAvgInterval = n > 0 ? algoCards.reduce((s, c) => s + c.interval, 0) / n : 0;
      const leechCount = algoCards.filter(c => c.lapses >= 5).length;
      return { algo, count: n, retention: algoRetention, avgDifficulty: algoAvgDifficulty, avgStability: algoAvgStability, avgEase: algoAvgEase, avgInterval: algoAvgInterval, leeches: leechCount };
    });

    return {
      total: cards.length,
      dueToday,
      leeches: leeches.length,
      newCards,
      learningCards,
      youngCards,
      matureCards,
      relearningCards,
      avgDifficulty,
      retentionRate,
      avgStability,
      avgMemDifficulty,
      todayDueNow,
      dueTomorrow,
      dueIn3,
      dueIn7,
      topTags,
      suspended: cards.filter((c) => c.is_suspended).length,
      algorithmMetrics,
    };
  }, [cards]);

  const retention = formatRetention(stats.retentionRate);

  // Maturity breakdown bar data
  const maturityTotal = stats.newCards + stats.learningCards + stats.relearningCards + stats.youngCards + stats.matureCards;
  const maturitySegments = [
    { count: stats.newCards, color: "bg-blue-500", label: "New" },
    { count: stats.learningCards, color: "bg-orange-500", label: "Learning" },
    { count: stats.relearningCards, color: "bg-red-400", label: "Relearning" },
    { count: stats.youngCards, color: "bg-green-400", label: "Young" },
    { count: stats.matureCards, color: "bg-green-600", label: "Mature" },
  ];

  return (
    <div className="p-2.5 space-y-3">
      {/* Deck Details */}
      <section>
        <SectionHeader icon={<Info className="h-3 w-3" />} label="Deck Details" />
        <div className="mt-1 space-y-0.5 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{deck.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tags</span>
            <span className="text-[10px] text-foreground truncate max-w-[140px]" title={deck.tagFilters.join(", ")}>
              {deck.tagFilters.length > 0 ? deck.tagFilters.join(", ") : "—"}
            </span>
          </div>
          {deck.createdAt && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="text-muted-foreground tabular-nums">
                {new Date(deck.createdAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Deck Stats */}
      <section>
        <SectionHeader icon={<BarChart3 className="h-3 w-3" />} label="Deck Stats" />
        <div className="mt-1 space-y-0">
          <StatRow label="Total Cards" value={stats.total} />
          <StatRow label="Due Today" value={stats.dueToday} color={stats.dueToday > 0 ? "text-primary" : undefined} />
          <StatRow label="New" value={stats.newCards} color="text-blue-500" />
          <StatRow label="Learning" value={stats.learningCards + stats.relearningCards} color="text-orange-500" />
          <StatRow label="Young" value={stats.youngCards} color="text-green-400" />
          <StatRow label="Mature" value={stats.matureCards} color="text-green-600" />
          <StatRow label="Suspended" value={stats.suspended} color="text-yellow-600" />
          <StatRow label="Leeches" value={stats.leeches} color={stats.leeches > 0 ? "text-yellow-500" : undefined} onClick={stats.leeches > 0 ? onLeechClick : undefined} />
        </div>
        {/* Maturity bar */}
        {maturityTotal > 0 && (
          <div className="mt-1.5">
            <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
              {maturitySegments.map((s) =>
                s.count > 0 ? (
                  <div
                    key={s.label}
                    className={`${s.color} transition-all`}
                    style={{ width: `${(s.count / maturityTotal) * 100}%` }}
                    title={`${s.label}: ${s.count}`}
                  />
                ) : null
              )}
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0 mt-1">
              {maturitySegments.filter(s => s.count > 0).map((s) => (
                <div key={s.label} className="flex items-center gap-1 text-[9px]">
                  <div className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-medium tabular-nums">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Today Forecast */}
      <section>
        <SectionHeader icon={<Clock className="h-3 w-3" />} label="Today Forecast" />
        <div className="mt-1 space-y-0">
          <StatRow label="Due Now" value={stats.todayDueNow} color={stats.todayDueNow > 0 ? "text-primary" : undefined} />
          <StatRow label="Tomorrow" value={stats.dueTomorrow} />
          <StatRow label="Next 3 Days" value={stats.dueIn3} />
          <StatRow label="Next 7 Days" value={stats.dueIn7} />
        </div>
      </section>

      {/* Algorithm Metrics — dynamic per algorithm */}
      {stats.algorithmMetrics.length > 0 && (
        <section>
          <SectionHeader icon={<Cpu className="h-3 w-3" />} label="Algorithm Metrics" />
          <div className="mt-1.5 space-y-2">
            {stats.algorithmMetrics.map(({ algo, count, retention: algoRet, avgDifficulty: algoDiff, avgStability: algoStab, avgEase, avgInterval, leeches: algoLeeches }) => {
              const ret = formatRetention(algoRet);
              const displayName = ALGO_NAMES[algo] ?? algo;
              const isSm2 = algo === "sm2";
              const isSm18 = algo === "sm18";
              const isSm20 = algo === "sm20";
              const isFsrs = algo === "fsrs";
              return (
                <div key={algo} className="rounded-md border border-border/60 p-1.5 space-y-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-semibold text-foreground">{displayName}</span>
                    <span className="text-[9px] text-muted-foreground tabular-nums">{count} card{count !== 1 ? "s" : ""}</span>
                  </div>
                  {/* Shared metrics */}
                  <StatRow label="Retention" value={ret.text} color={ret.color} />
                  <StatRow label="Avg Difficulty" value={algoDiff.toFixed(2)} />
                  {/* FSRS / SM-18 / SM-20: stability + difficulty from memory_state */}
                  {(isFsrs || isSm18 || isSm20) && (
                    <StatRow
                      label="Avg Stability"
                      value={algoStab < 1 ? `${(algoStab * 24).toFixed(0)}h` : `${algoStab.toFixed(1)}d`}
                    />
                  )}
                  {/* SM-2: ease factor */}
                  {isSm2 && (
                    <StatRow label="Avg Ease Factor" value={avgEase.toFixed(2)} />
                  )}
                  {/* SM-2: average interval */}
                  {isSm2 && (
                    <StatRow
                      label="Avg Interval"
                      value={avgInterval < 1 ? `${(avgInterval * 24).toFixed(0)}h` : `${avgInterval.toFixed(1)}d`}
                    />
                  )}
                  {/* FSRS: desired retention from settings */}
                  {isFsrs && desiredRetention != null && (
                    <StatRow label="Target Retention" value={`${Math.round(desiredRetention * 100)}%`} />
                  )}
                  {/* Per-algorithm leech count */}
                  {algoLeeches > 0 && (
                    <StatRow label="Leeches" value={algoLeeches} color="text-yellow-500" />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Top Tags */}
      {stats.topTags.length > 0 && (
        <section>
          <SectionHeader icon={<Tag className="h-3 w-3" />} label="Top Tags" />
          <div className="mt-1 flex flex-wrap gap-1">
            {stats.topTags.map(([tag, count]) => (
              <span
                key={tag}
                className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary tabular-nums"
                title={`${count} cards`}
              >
                {tag} ({count})
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section>
        <SectionHeader icon={<Activity className="h-3 w-3" />} label="Quick Actions" />
        <div className="mt-1 space-y-1">
          <button className="w-full flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <GraduationCap className="h-3 w-3" />
            Study Now
            {stats.dueToday > 0 && (
              <span className="ml-auto text-[9px] bg-primary-foreground/20 rounded px-1 py-0.5 tabular-nums">
                {stats.dueToday}
              </span>
            )}
          </button>
          <button className="w-full flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Plus className="h-3 w-3" />
            New Card
          </button>
          <button className="w-full flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Download className="h-3 w-3" />
            Import
          </button>
          <button className="w-full flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Upload className="h-3 w-3" />
            Export
          </button>
        </div>
      </section>
    </div>
  );
}
