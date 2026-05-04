import { Fragment, useState, useRef, useEffect } from "react";
import {
  Play, Pause, Trash2, CalendarClock, EyeOff,
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

function diffCell(d: number | undefined) {
  if (d === undefined) return <span className="text-[11px] text-muted-foreground">—</span>;
  const c = d <= 3 ? "text-green-400" : d <= 5 ? "text-amber-400" : d <= 7 ? "text-orange-400" : "text-red-400";
  return <span className={cn("text-[11px] font-mono tabular-nums", c)}>{d.toFixed(1)}</span>;
}

function stabCell(s: number | undefined) {
  if (s === undefined) return <span className="text-[11px] text-muted-foreground">—</span>;
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

function retCell(r: number | undefined) {
  if (r === undefined) return <span className="text-[11px] text-muted-foreground">—</span>;
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

function sectionLabel(dateStr: string, t: (k: string, vars?: Record<string, string | number>) => string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const date = parseScheduleDate(dateStr);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return t("schedule.today");
  if (diff === 1) return t("schedule.tomorrow");
  return `${date.toLocaleDateString("en-US", { month: "short" })} ${date.getDate()}`;
}

/* ── row ── */

function Row({ item, idx, onPostpone, onOpen, onSuspend, onUnsuspend, onDelete, onDismiss }: {
  item: ScheduleDayItem; idx: number;
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
      <tr className="group border-b border-border/30 hover:bg-muted/40 cursor-default"
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY }); }}
        onDoubleClick={() => onOpen?.(item)}>
        <td className="px-2 py-1.5 text-[11px] font-mono tabular-nums text-muted-foreground/60 w-7 text-right">{idx}</td>
        <td className="px-2 py-1.5 text-[12px] font-medium text-foreground line-clamp-1 max-w-[280px] min-w-[120px]">{item.documentTitle || "Untitled"}</td>
        <td className="px-1.5 py-1.5 w-8 text-center">{typeBadge(item.itemType, t)}</td>
        <td className="px-1.5 py-1.5 w-8 text-center text-[11px] font-mono tabular-nums text-muted-foreground">{item.priority}</td>
        <td className="px-1.5 py-1.5 w-12 text-[11px] font-mono tabular-nums text-muted-foreground text-center">
          {item.interval != null && item.interval > 0 ? fmtInterval(item.interval, t) : "—"}
        </td>
        <td className="px-1.5 py-1.5 w-8 text-center text-[11px] font-mono tabular-nums text-muted-foreground">{item.reps ?? "—"}</td>
        <td className={cn("px-1.5 py-1.5 w-8 text-center text-[11px] font-mono tabular-nums", (item.lapses ?? 0) > 0 ? "text-red-400" : "text-muted-foreground")}>{item.lapses ?? 0}</td>
        <td className="px-1.5 py-1.5 w-14 text-center">{dueCell(item.dueDate, t)}</td>
        <td className="px-1.5 py-1.5 w-10 text-center">{diffCell(item.difficulty)}</td>
        <td className="px-1.5 py-1.5 w-16">{stabCell(item.stability)}</td>
        <td className="px-1.5 py-1.5 w-10 text-center">{retCell(item.retrievability)}</td>
        <td className="px-1.5 py-1.5 w-10 text-center">{progCell(item.progress)}</td>
        <td className="px-1.5 py-1.5 w-10 text-center text-[11px] font-mono tabular-nums text-muted-foreground">{item.estimatedTime > 0 ? `${item.estimatedTime}m` : "—"}</td>
        {canPost ? (
          <td className="px-1.5 py-1.5 w-24 text-right opacity-0 group-hover:opacity-100 transition-opacity">
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

/* ── table ── */

const COLS = 14 as const;

export function ScheduleTable({ groups, onPostpone, onOpen, onSuspend, onUnsuspend, onDelete, onDismiss }: ScheduleTableProps) {
  const { t } = useI18n();
  let idx = 0;

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="bg-background/95 backdrop-blur-sm border-b border-border text-muted-foreground">
            <th className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-right w-7">#</th>
            <th className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-left min-w-[120px]">{t("schedule.title")}</th>
            <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-center w-8">{t("schedule.colType")}</th>
            <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-center w-8">{t("schedule.colPriority")}</th>
            <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-center w-12">{t("schedule.colInterval")}</th>
            <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-center w-8">{t("schedule.colReps")}</th>
            <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-center w-8">{t("schedule.colLapses")}</th>
            <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-center w-14">{t("schedule.colDue")}</th>
            <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-center w-10">{t("schedule.colDifficulty")}</th>
            <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-left w-16">{t("schedule.colStability")}</th>
            <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-center w-10">{t("schedule.colRetrievability")}</th>
            <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-center w-10">{t("schedule.colProgress")}</th>
            <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-center w-10">{t("schedule.colTime")}</th>
            <th className="w-24" />
          </tr>
        </thead>
        <tbody>
          {groups.map((group, gi) => (
            <Fragment key={group.date || `g${gi}`}>
              {group.date && (
                <tr className="bg-muted/30">
                  <td colSpan={COLS} className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                    {sectionLabel(group.date, t)}
                    <span className="ml-2 font-normal text-muted-foreground/70">{t("schedule.itemsDue", { count: group.items.length })}</span>
                  </td>
                </tr>
              )}
              {group.items.map((item) => {
                idx++;
                return (
                  <Row key={item.id} item={item} idx={idx}
                    onPostpone={onPostpone} onOpen={onOpen}
                    onSuspend={onSuspend} onUnsuspend={onUnsuspend}
                    onDelete={onDelete} onDismiss={onDismiss} />
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
