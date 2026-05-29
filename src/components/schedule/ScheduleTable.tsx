import { Fragment, useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Play, Pause, Trash2, CalendarClock, EyeOff,
  Clock, AlertTriangle, Repeat, ChevronDown, ChevronRight,
  BookOpen, Layers, Brain,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { parseScheduleDate } from "../../lib/scheduleUtils";
import type { ScheduleDayItem } from "../../types/queue";
import { cn } from "../../utils";

interface ScheduleGroup {
  date: string;
  items: ScheduleDayItem[];
}

interface ScheduleTableProps {
  groups: ScheduleGroup[];
  onPostpone: (itemId: string, days: number, itemType?: string) => Promise<void>;
  onOpen?: (item: ScheduleDayItem) => void;
  onSuspend?: (itemId: string, itemType: string) => Promise<void>;
  onUnsuspend?: (itemId: string, itemType: string) => Promise<void>;
  onDelete?: (itemId: string, itemType: string) => Promise<void>;
  onDismiss?: (itemId: string) => Promise<void>;
}

/* ── helpers ── */

function fmtInterval(days: number, t: (k: string, v?: Record<string, number>) => string): string {
  if (days < 1) {
    const h = Math.round(days * 24);
    return h < 1 ? "<1h" : t("schedule.intervalHours", { count: h });
  }
  if (days < 30) return t("schedule.intervalDays", { count: Math.round(days * 10) / 10 });
  return t("schedule.intervalWeeks", { count: Math.round(days / 7 * 10) / 10 });
}

function typeBadge(type: ScheduleDayItem["itemType"], t: (k: string) => string) {
  const labels: Record<string, string> = {
    document: t("schedule.documentBadge"),
    extract: t("schedule.extractBadge"),
    "learning-item": t("schedule.learningBadge"),
  };
  const colors: Record<string, string> = {
    document: "text-blue-500 bg-blue-500/10",
    extract: "text-amber-500 bg-amber-500/10",
    "learning-item": "text-purple-500 bg-purple-500/10",
  };
  return (
    <span className={cn("px-1 py-px text-[10px] font-medium rounded", colors[type] ?? "text-muted-foreground bg-muted")}>
      {(labels[type] ?? type).charAt(0)}
    </span>
  );
}

function dueCell(dueDate: string, t: (k: string, v?: Record<string, number>) => string) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const due = parseScheduleDate(dueDate);
  if (!due) return <span className="text-[11px] text-muted-foreground">—</span>;
  const d = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  let text: string, color: string;
  if (d < 0) { text = t("schedule.overdue"); color = "text-red-500"; }
  else if (d === 0) { text = t("schedule.today"); color = "text-amber-500"; }
  else if (d === 1) { text = t("schedule.tomorrow"); color = "text-yellow-600 dark:text-yellow-400"; }
  else if (d <= 7) { text = `+${d}d`; color = "text-yellow-600 dark:text-yellow-400"; }
  else { text = `+${d}d`; color = "text-muted-foreground"; }
  return <span className={cn("text-[11px] font-mono tabular-nums", color)}>{text}</span>;
}

function diffCell(d: number | undefined | null) {
  if (d == null) return <span className="text-[11px] text-muted-foreground">—</span>;
  const c = d <= 3 ? "text-green-400" : d <= 5 ? "text-amber-400" : d <= 7 ? "text-orange-400" : "text-red-400";
  return <span className={cn("text-[11px] font-mono tabular-nums", c)}>{d.toFixed(1)}</span>;
}

function stabCell(s: number | undefined | null) {
  if (s == null) return <span className="text-[11px] text-muted-foreground">—</span>;
  const pct = Math.min(100, (s / 30) * 100);
  const c = s >= 21 ? "bg-green-500" : s >= 7 ? "bg-lime-500" : s >= 3 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1">
      <div className="w-8 h-1 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", c)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-mono tabular-nums text-muted-foreground">{s.toFixed(1)}</span>
    </div>
  );
}

function retCell(r: number | undefined | null) {
  if (r == null) return <span className="text-[11px] text-muted-foreground">—</span>;
  const p = Math.round(r * 100);
  const c = p >= 90 ? "text-green-500" : p >= 70 ? "text-amber-500" : "text-red-500";
  return <span className={cn("text-[11px] font-mono tabular-nums", c)}>{p}%</span>;
}

function progCell(p: number) {
  if (p <= 0) return <span className="text-[11px] text-muted-foreground">—</span>;
  const pct = Math.round(p * 100);
  const c = pct >= 100 ? "text-green-500" : pct >= 50 ? "text-blue-500" : "text-muted-foreground";
  return <span className={cn("text-[11px] font-mono tabular-nums", c)}>{pct}%</span>;
}

/* ── shared algo helpers (expanded panel) ── */

function stabilityColor(s: number): string {
  if (s >= 21) return "bg-green-500";
  if (s >= 7) return "bg-lime-500";
  if (s >= 3) return "bg-amber-500";
  return "bg-red-500";
}

function difficultyDot(d: number): string {
  if (d <= 3) return "bg-green-400";
  if (d <= 5) return "bg-amber-400";
  if (d <= 7) return "bg-orange-400";
  return "bg-red-400";
}

function retrievColor(r: number): string {
  if (r >= 90) return "text-green-500";
  if (r >= 70) return "text-amber-500";
  return "text-red-500";
}

function getTypeIcon(type: ScheduleDayItem["itemType"]) {
  switch (type) {
    case "document": return BookOpen;
    case "extract": return Layers;
    case "learning-item": return Brain;
    default: return BookOpen;
  }
}

function getTypeBg(type: ScheduleDayItem["itemType"]) {
  switch (type) {
    case "document": return "bg-blue-500/10 text-blue-500";
    case "extract": return "bg-amber-500/10 text-amber-500";
    case "learning-item": return "bg-purple-500/10 text-purple-500";
    default: return "bg-muted text-muted-foreground";
  }
}

function dueLabel(dueDate: string, t: (k: string, v?: Record<string, number>) => string) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const due = parseScheduleDate(dueDate);
  if (!due) return { label: "", color: "text-muted-foreground" };
  const d = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  if (d < 0) return { label: t("schedule.overdue"), color: "text-red-500" };
  if (d === 0) return { label: t("schedule.today"), color: "text-amber-500" };
  if (d === 1) return { label: t("schedule.tomorrow"), color: "text-yellow-600 dark:text-yellow-400" };
  return { label: t("schedule.inDays", { count: d }), color: "text-muted-foreground" };
}

function sectionLabel(dateStr: string, t: (k: string, vars?: Record<string, string | number>) => string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const date = parseScheduleDate(dateStr);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return t("schedule.today");
  if (diff === 1) return t("schedule.tomorrow");
  return `${date.toLocaleDateString("en-US", { month: "short" })} ${date.getDate()}`;
}

/* ── row ── */

function Row({ item, idx, isExpanded, onToggleExpand, onPostpone, onOpen, onSuspend, onUnsuspend, onDelete, onDismiss }: {
  item: ScheduleDayItem; idx: number; isExpanded: boolean;
  onToggleExpand: () => void;
  onPostpone: (id: string, d: number, t?: string) => Promise<void>;
  onOpen?: (i: ScheduleDayItem) => void;
  onSuspend?: (id: string, t: string) => Promise<void>;
  onUnsuspend?: (id: string, t: string) => Promise<void>;
  onDelete?: (id: string, t: string) => Promise<void>;
  onDismiss?: (id: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctx) return;
    const off = () => setCtx(null);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setCtx(null); };
    const tid = setTimeout(() => {
      document.addEventListener("click", off);
      document.addEventListener("scroll", off, true);
      document.addEventListener("keydown", esc);
    }, 0);
    return () => { clearTimeout(tid); document.removeEventListener("click", off); document.removeEventListener("scroll", off, true); document.removeEventListener("keydown", esc); };
  }, [ctx]);

  useEffect(() => {
    if (!ctx || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    let { x, y } = ctx;
    if (x + 240 > window.innerWidth) x = window.innerWidth - 248;
    if (y + r.height > window.innerHeight) y = window.innerHeight - r.height - 8;
    if (x < 0) x = 4; if (y < 0) y = 4;
    ref.current.style.left = `${x}px`; ref.current.style.top = `${y}px`;
  }, [ctx]);

  const postpone = async (d: number) => { setBusy(true); setCtx(null); try { await onPostpone(item.id, d, item.itemType); } finally { setBusy(false); } };
  const canPost = item.itemType === "learning-item" || item.itemType === "document";

  return (
    <>
      <tr className={cn(
        "group border-b border-border/30 hover:bg-muted/40 cursor-pointer transition-colors",
        isExpanded && "bg-muted/30 border-b-0",
      )}
        onClick={onToggleExpand}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY }); }}
        onDoubleClick={() => onOpen?.(item)}>
        <td className="px-2 py-1 text-[11px] font-mono tabular-nums text-muted-foreground/60 w-7 text-right">
          <span className="inline-flex items-center gap-0.5">
            {isExpanded
              ? <ChevronDown className="w-3 h-3 text-muted-foreground/80" />
              : <ChevronRight className="w-3 h-3 text-muted-foreground/80" />}
            {idx}
          </span>
        </td>
        <td className="px-2 py-1 text-[12px] font-medium text-foreground line-clamp-1 max-w-[280px] min-w-[120px]">{item.documentTitle || "Untitled"}</td>
        <td className="px-1.5 py-1 w-8 text-center">{typeBadge(item.itemType, t)}</td>
        <td className="px-1.5 py-1 w-8 text-center text-[11px] font-mono tabular-nums text-muted-foreground">{item.priority}</td>
        <td className="px-1.5 py-1 w-12 text-[11px] font-mono tabular-nums text-muted-foreground text-center">
          {item.interval != null && item.interval > 0 ? fmtInterval(item.interval, t) : "—"}
        </td>
        <td className="px-1.5 py-1 w-8 text-center text-[11px] font-mono tabular-nums text-muted-foreground">{item.reps ?? "—"}</td>
        <td className={cn("px-1.5 py-1 w-8 text-center text-[11px] font-mono tabular-nums", (item.lapses ?? 0) > 0 ? "text-red-400" : "text-muted-foreground")}>{item.lapses ?? 0}</td>
        <td className="px-1.5 py-1 w-14 text-center">{dueCell(item.dueDate, t)}</td>
        <td className="px-1.5 py-1 w-8 text-center">{diffCell(item.difficulty)}</td>
        <td className="px-1.5 py-1 w-16">{stabCell(item.stability)}</td>
        <td className="px-1.5 py-1 w-10 text-center">{retCell(item.retrievability)}</td>
        <td className="px-1.5 py-1 w-10 text-center">{progCell(item.progress)}</td>
        <td className="px-1.5 py-1 w-10 text-center text-[11px] font-mono tabular-nums text-muted-foreground">{item.estimatedTime > 0 ? `${item.estimatedTime}m` : "—"}</td>
        {canPost ? (
          <td className="px-1.5 py-1 w-24 text-right opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center justify-end gap-0.5">
              {([1, 3, 7] as const).map(d => (
                <button key={d} onClick={e => { e.stopPropagation(); postpone(d); }} disabled={busy}
                  className="px-1 py-0.5 text-[10px] font-mono rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                  +{d}d
                </button>
              ))}
            </div>
          </td>
        ) : <td className="w-24" />}
      </tr>
      {ctx && (
        <>
          <div className="fixed inset-0 z-[9998]" />
          <div ref={ref} className="fixed z-[9999] bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[220px] animate-in fade-in-0 zoom-in-95 duration-100"
            style={{ left: ctx.x, top: ctx.y }}>
            {onOpen && <button className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/80 flex items-center gap-2" onClick={() => { setCtx(null); onOpen(item); }}>
              <Play className="w-4 h-4 text-emerald-500" />{item.itemType === "learning-item" ? t("queue.studyNow") : t("queue.openDocument")}
            </button>}
            {item.itemType === "learning-item" && onSuspend && <button className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/80 flex items-center gap-2" onClick={() => { setCtx(null); onSuspend(item.id, item.itemType); }}>
              <Pause className="w-4 h-4 text-amber-500" />{t("queue.suspend")}
            </button>}
            {item.itemType === "learning-item" && onUnsuspend && <button className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/80 flex items-center gap-2" onClick={() => { setCtx(null); onUnsuspend(item.id, item.itemType); }}>
              <Play className="w-4 h-4 text-emerald-500" />{t("queue.unsuspend")}
            </button>}
            {canPost && (<>
              <div className="h-px bg-border my-1" /><div className="px-3 py-1 text-xs text-muted-foreground font-medium">{t("queue.postpone")}</div>
              {[1, 3, 7, 14, 30].map(d => (
                <button key={d} className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/80 flex items-center gap-2" onClick={() => void postpone(d)}>
                  <CalendarClock className="w-4 h-4 text-blue-400" />+{d}{d === 1 ? t("queue.day") : t("queue.days")}
                </button>
              ))}
            </>)}
            {item.itemType === "document" && onDismiss && (<>
              <div className="h-px bg-border my-1" /><button className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/80 flex items-center gap-2" onClick={() => { setCtx(null); onDismiss(item.id); }}>
                <EyeOff className="w-4 h-4 text-slate-400" />{t("queue.dismiss")}
              </button>
            </>)}
            {onDelete && (<>
              <div className="h-px bg-border my-1" /><button className="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2" onClick={() => { setCtx(null); onDelete(item.id, item.itemType); }}>
                <Trash2 className="w-4 h-4" />{t("queue.delete")}
              </button>
            </>)}
          </div>
        </>
      )}
    </>
  );
}

/* ── expanded detail row ── */

function ExpandedRow({ item, onPostpone, onOpen, busyId, setBusyId }: {
  item: ScheduleDayItem;
  onPostpone: (id: string, d: number, t?: string) => Promise<void>;
  onOpen?: (i: ScheduleDayItem) => void;
  busyId: string | null;
  setBusyId: (id: string | null) => void;
}) {
  const { t } = useI18n();
  const canPost = item.itemType === "learning-item" || item.itemType === "document";
  const hasAlgoData = item.stability != null || item.difficulty != null
    || item.interval != null || item.reps != null;
  const { label: daysText, color: daysColor } = dueLabel(item.dueDate, t);
  const Icon = getTypeIcon(item.itemType);
  const iconBg = getTypeBg(item.itemType);

  const handlePostpone = async (itemId: string, days: number, itemType?: string) => {
    setBusyId(itemId);
    try { await onPostpone(itemId, days, itemType); } finally { setBusyId(null); }
  };

  return (
    <tr className="bg-muted/30 border-b border-border/30">
      <td colSpan={COLS} className="px-4 pt-1 pb-3">
        <div className="flex flex-col gap-3 max-w-3xl">
          <div className="flex items-start gap-3">
            <div className={cn("flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center", iconBg)}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground leading-snug">
                {item.documentTitle || "Untitled"}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {daysText && (
                  <span className={cn("flex items-center gap-0.5 text-[11px] font-medium", daysColor)}>
                    <Clock className="w-3 h-3" />
                    {daysText}
                  </span>
                )}
                {item.estimatedTime > 0 && (
                  <span className="text-[11px] text-muted-foreground">~{item.estimatedTime}m</span>
                )}
                {item.priority != null && (
                  <span className="text-[11px] text-muted-foreground">P:{item.priority.toFixed(1)}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {onOpen && (
                <button
                  onClick={(e) => { e.stopPropagation(); onOpen(item); }}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  {item.itemType === "learning-item" ? t("queue.studyNow") : t("queue.openDocument")}
                </button>
              )}
              {canPost && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); void handlePostpone(item.id, 1, item.itemType); }}
                    disabled={busyId === item.id}
                    className="px-1.5 py-1 text-[10px] font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground transition-colors disabled:opacity-50"
                  >+1d</button>
                  <button onClick={(e) => { e.stopPropagation(); void handlePostpone(item.id, 3, item.itemType); }}
                    disabled={busyId === item.id}
                    className="px-1.5 py-1 text-[10px] font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground transition-colors disabled:opacity-50"
                  >+3d</button>
                  <button onClick={(e) => { e.stopPropagation(); void handlePostpone(item.id, 7, item.itemType); }}
                    disabled={busyId === item.id}
                    className="px-1.5 py-1 text-[10px] font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground transition-colors disabled:opacity-50"
                  >+7d</button>
                </>
              )}
            </div>
          </div>
          {hasAlgoData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 ml-11">
              {item.stability != null && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-medium">{t("schedule.stability")}</span>
                    <span className="text-[10px] font-mono text-foreground">{item.stability.toFixed(2)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", stabilityColor(item.stability))}
                      style={{ width: `${Math.min(100, (item.stability / 30) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {item.difficulty != null && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-medium">{t("schedule.difficulty")}</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((d) => (
                        <span
                          key={d}
                          className={cn("w-2 h-2 rounded-full transition-colors",
                            d <= Math.round(item.difficulty / 2) ? difficultyDot(item.difficulty) : "bg-muted")}
                        />
                      ))}
                      <span className="text-[10px] font-mono text-foreground ml-0.5">{item.difficulty.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              )}
              {item.interval != null && item.interval > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-medium">{t("schedule.interval")}</span>
                    <span className="text-[10px] font-mono text-foreground">{fmtInterval(item.interval, t)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${Math.min(100, (item.interval / 60) * 100)}%` }} />
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {item.reps != null && (
                    <span className="flex items-center gap-0.5">
                      <Repeat className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-mono text-foreground">{item.reps}</span>
                    </span>
                  )}
                  {item.lapses != null && item.lapses > 0 && (
                    <span className="flex items-center gap-0.5">
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                      <span className="text-[10px] font-mono text-red-400">{item.lapses}</span>
                    </span>
                  )}
                  {item.retrievability != null && (
                    <span className={cn("text-[10px] font-mono", retrievColor(item.retrievability))}>
                      R:{Math.round(item.retrievability * 100)}%
                    </span>
                  )}
                </div>
                {(item.tags.length > 0 || item.category) && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {item.category && (
                      <span className="px-1.5 py-0.5 text-[9px] rounded bg-accent/50 text-accent-foreground">
                        {item.category}
                      </span>
                    )}
                    {item.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 text-[9px] rounded bg-muted text-muted-foreground">{tag}</span>
                    ))}
                    {item.tags.length > 4 && (
                      <span className="text-[9px] text-muted-foreground">+{item.tags.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ── table ── */

const COLS = 14 as const;
const ROW_H = 32;
const HEADER_H = 28;

export function ScheduleTable({ groups, onPostpone, onOpen, onSuspend, onUnsuspend, onDelete, onDismiss }: ScheduleTableProps) {
  const { t } = useI18n();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handlePostpone = async (itemId: string, days: number, itemType?: string) => {
    setBusyId(itemId);
    try { await onPostpone(itemId, days, itemType); } finally { setBusyId(null); }
  };

  // Virtualization: count total rows and determine visible range based on scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setContainerHeight(el.clientHeight);
    update();
    let rafId: number | null = null;
    const ro = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    });
    ro.observe(el);
    return () => { ro.disconnect(); if (rafId) cancelAnimationFrame(rafId); };
  }, []);

  type FlatRow =
    | { kind: "header"; groupDate: string; count: number }
    | { kind: "item"; item: ScheduleDayItem; idx: number };

  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = [];
    let idx = 0;
    for (const group of groups) {
      rows.push({ kind: "header", groupDate: group.date, count: group.items.length });
      for (const item of group.items) {
        idx++;
        rows.push({ kind: "item", item, idx });
      }
    }
    return rows;
  }, [groups]);

  // Estimate row heights (header rows and data rows have known fixed heights)
  const rowHeights = useMemo(() => {
    return flatRows.map(r => {
      if (r.kind === "header") return HEADER_H;
      return ROW_H;
    });
  }, [flatRows]);

  const totalHeight = useMemo(() => rowHeights.reduce((a, b) => a + b, 0), [rowHeights]);

  // Find cumulative offsets for quick lookup
  const offsets = useMemo(() => {
    const off = new Int32Array(flatRows.length + 1);
    for (let i = 0; i < flatRows.length; i++) off[i + 1] = off[i] + rowHeights[i];
    return off;
  }, [flatRows, rowHeights]);

  const overscan = 10;

  // Binary search for start row
  const findStart = () => {
    let lo = 0, hi = flatRows.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (offsets[mid] <= scrollTop) lo = mid;
      else hi = mid - 1;
    }
    return Math.max(0, lo - overscan);
  };

  const findEnd = (start: number) => {
    const target = scrollTop + containerHeight + overscan * ROW_H;
    let i = start;
    while (i < flatRows.length && offsets[i] < target) i++;
    return Math.min(flatRows.length, i + overscan);
  };

  const startIdx = findStart();
  const endIdx = findEnd(startIdx);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop), []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [groups]);

  if (flatRows.length === 0) {
    return <div className="flex-1 overflow-auto" />;
  }

  const spacerBefore = offsets[startIdx];
  const spacerAfter = totalHeight - offsets[endIdx];

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto" onScroll={handleScroll}>
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="bg-background/95 backdrop-blur-sm border-b border-border text-muted-foreground">
            <th className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-right w-7">#</th>
            <th className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-left min-w-[120px]">{t("schedule.title")}</th>
            <th className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-center w-8">{t("schedule.colType")}</th>
            <th className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-center w-8">{t("schedule.colPriority")}</th>
            <th className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-center w-12">{t("schedule.colInterval")}</th>
            <th className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-center w-8">{t("schedule.colReps")}</th>
            <th className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-center w-8">{t("schedule.colLapses")}</th>
            <th className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-center w-14">{t("schedule.colDue")}</th>
            <th className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-center w-10">{t("schedule.colDifficulty")}</th>
            <th className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-left w-16">{t("schedule.colStability")}</th>
            <th className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-center w-10">{t("schedule.colRetrievability")}</th>
            <th className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-center w-10">{t("schedule.colProgress")}</th>
            <th className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-center w-10">{t("schedule.colTime")}</th>
            <th className="w-24" />
          </tr>
        </thead>
        <tbody>
          {/* Top spacer — occupies space for rows above the visible range */}
          {spacerBefore > 0 && (
            <tr><td colSpan={COLS} style={{ height: spacerBefore, padding: 0, border: "none" }} /></tr>
          )}

          {/* Visible rows */}
          {flatRows.slice(startIdx, endIdx).map((row) => {
            if (row.kind === "header") {
              return (
                <tr key={`h-${row.groupDate}`} className="bg-muted/30">
                  <td colSpan={COLS} className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                    {sectionLabel(row.groupDate, t)}
                    <span className="ml-2 font-normal text-muted-foreground/70">{t("schedule.itemsDue", { count: row.count })}</span>
                  </td>
                </tr>
              );
            }

            const isExpanded = expandedId === row.item.id;
            return (
              <Fragment key={row.item.id}>
                <Row item={row.item} idx={row.idx} isExpanded={isExpanded}
                  onToggleExpand={() => toggleExpand(row.item.id)}
                  onPostpone={handlePostpone} onOpen={onOpen}
                  onSuspend={onSuspend} onUnsuspend={onUnsuspend}
                  onDelete={onDelete} onDismiss={onDismiss} />
                {isExpanded && (
                  <ExpandedRow item={row.item} onPostpone={handlePostpone} onOpen={onOpen}
                    busyId={busyId} setBusyId={setBusyId} />
                )}
              </Fragment>
            );
          })}

          {/* Bottom spacer — occupies space for rows below the visible range */}
          {spacerAfter > 0 && (
            <tr><td colSpan={COLS} style={{ height: spacerAfter, padding: 0, border: "none" }} /></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
