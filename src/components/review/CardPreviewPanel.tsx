import { useState, useCallback } from "react";
import {
  Eye,
  Pencil,
  Clock,
  Tag,
  Save,
  X,
  Loader2,
  BarChart3,
  FileText,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { useToast } from "../common/Toast";
import { useI18n } from "../../lib/i18n";
import {
  updateLearningItemContentWithVersion,
  type LearningItem,
} from "../../api/learning-items";
import { renderAnkiHtmlWithLatex } from "../../utils/ankiLatex";

interface CardPreviewPanelProps {
  card: LearningItem | null;
  onCardUpdate?: (updated: LearningItem) => void;
  onEditInStudio?: (card: LearningItem) => void;
}

type Tab = "preview" | "edit" | "history";

function formatRelativeDate(date?: string): string {
  if (!date) return "—";
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "Today";
  if (diffDays < 1) return "Today";
  if (diffDays < 2) return "Yesterday";
  if (diffDays < 7) return `${Math.round(diffDays)}d ago`;
  if (diffDays < 30) return `${Math.round(diffDays / 7)}w ago`;
  return `${Math.round(diffDays / 30)}mo ago`;
}

function formatInterval(days: number): string {
  if (days < 1) return `${(days * 24).toFixed(0)}h`;
  if (days < 30) return `${days.toFixed(0)}d`;
  return `${(days / 30).toFixed(1)}mo`;
}

export function CardPreviewPanel({
  card,
  onCardUpdate,
  onEditInStudio,
}: CardPreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("preview");

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center text-muted-foreground gap-2 p-4 h-full">
        <FileText className="h-10 w-10 opacity-30" />
        <p className="text-xs text-center">Select a card to preview</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border px-1 flex-shrink-0">
        {(["preview", "edit", "history"] as const).map((tab) => {
          const icons = {
            preview: <Eye className="h-3 w-3" />,
            edit: <Pencil className="h-3 w-3" />,
            history: <Clock className="h-3 w-3" />,
          };
          const labels = { preview: "Preview", edit: "Edit", history: "History" };
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 transition-colors border-b-2 ${
                isActive
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {icons[tab]}
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "preview" && <PreviewTab card={card} onEditInStudio={onEditInStudio} />}
        {activeTab === "edit" && (
          <EditTab card={card} onSave={onCardUpdate} />
        )}
        {activeTab === "history" && <HistoryTab card={card} />}
      </div>

      {/* Tags */}
      <div className="border-t border-border px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
          <Tag className="h-3 w-3" />
          Tags
        </div>
        <div className="flex flex-wrap gap-1">
          {card.tags.length > 0 ? (
            card.tags.map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                {tag}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-muted-foreground">No tags</span>
          )}
        </div>
      </div>
    </div>
  );
}

const proseClass = "prose prose-sm dark:prose-invert max-w-none w-full [&_.math-expression-block]:my-3 [&_.katex-display]:my-3";

function PreviewTab({
  card,
  onEditInStudio,
}: {
  card: LearningItem;
  onEditInStudio?: (card: LearningItem) => void;
}) {
  const isCloze = card.item_type === "Cloze";
  const isComplex = card.interaction_metadata?.interactionType;

  const renderedQuestion = renderAnkiHtmlWithLatex(
    isCloze ? card.cloze_text || card.question : card.question
  );
  const renderedAnswer = isCloze
    ? null
    : card.answer
      ? renderAnkiHtmlWithLatex(card.answer)
      : null;

  return (
    <div className="p-4 space-y-4">
      {/* Quick stats */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        <StateChip state={card.state} />
        <span className="tabular-nums">{card.review_count} reviews</span>
        {card.lapses > 0 && (
          <span className="flex items-center gap-0.5 text-yellow-600">
            <AlertTriangle className="h-2.5 w-2.5" />
            {card.lapses} lapses
          </span>
        )}
        <span className="tabular-nums">
          Int: {formatInterval(card.memory_state?.stability ?? card.interval)}
        </span>
        <span>Reviewed {formatRelativeDate(card.last_review_date)}</span>
      </div>

      {/* Question */}
      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          {isCloze ? "Cloze Text" : "Question"}
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4 min-h-[80px]">
          <div
            className={proseClass}
            dangerouslySetInnerHTML={{ __html: renderedQuestion }}
          />
        </div>
      </div>

      {/* Answer (not for cloze) */}
      {!isCloze && renderedAnswer !== null && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Answer
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4 min-h-[60px]">
            <div
              className={proseClass}
              dangerouslySetInnerHTML={{ __html: renderedAnswer }}
            />
          </div>
        </div>
      )}

      {/* Complex type notice */}
      {isComplex && onEditInStudio && (
        <button
          onClick={() => onEditInStudio(card)}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <FileText className="h-3 w-3" />
          Edit in Studio
        </button>
      )}
    </div>
  );
}

function EditTab({
  card,
  onSave,
}: {
  card: LearningItem;
  onSave?: (updated: LearningItem) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [question, setQuestion] = useState(card.question);
  const [answer, setAnswer] = useState(card.answer ?? "");
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState(card.tags.join(", "));

  const hasChanges =
    question !== card.question ||
    answer !== (card.answer ?? "") ||
    tags !== card.tags.join(", ");

  const handleSave = useCallback(async () => {
    setSaving(true);
    const newTags = tags.split(",").map((tg) => tg.trim()).filter(Boolean);
    const updated = { ...card, question, answer, tags: newTags };
    onSave?.(updated);
    try {
      await updateLearningItemContentWithVersion(card.id, question, answer || undefined, "Edited via Deck Manager");
      toast.success(t("review.deckManager.saved"));
    } catch {
      onSave?.(card);
      toast.error(t("review.deckManager.saveError"));
    } finally {
      setSaving(false);
    }
  }, [card, question, answer, tags, onSave, toast, t]);

  const handleCancel = useCallback(() => {
    setQuestion(card.question);
    setAnswer(card.answer ?? "");
    setTags(card.tags.join(", "));
  }, [card]);

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Question</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[100px] resize-y focus:outline-none focus:ring-1 focus:ring-primary font-mono leading-relaxed"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Answer</label>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[100px] resize-y focus:outline-none focus:ring-1 focus:ring-primary font-mono leading-relaxed"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Tags</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="tag1, tag2, tag3"
        />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Save
        </button>
        <button
          onClick={handleCancel}
          disabled={!hasChanges}
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-40"
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
      </div>
    </div>
  );
}

function HistoryTab({ card }: { card: LearningItem }) {
  const stability = card.memory_state?.stability ?? card.interval ?? 0;
  const difficulty = card.memory_state?.difficulty ?? card.difficulty ?? 0;

  return (
    <div className="p-4 space-y-5">
      {/* Review stats grid */}
      <section>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          <BarChart3 className="h-3 w-3" />
          Review Stats
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatBox label="Total Reviews" value={card.review_count} />
          <StatBox label="Lapses" value={card.lapses} color={card.lapses > 0 ? "text-yellow-600" : undefined} />
          <StatBox label="Interval" value={formatInterval(stability)} />
          <StatBox label="Difficulty" value={difficulty.toFixed(2)} />
          <StatBox label="Ease Factor" value={(card.ease_factor ?? 2.5).toFixed(2)} />
          <StatBox label="Last Review" value={formatRelativeDate(card.last_review_date)} />
        </div>
      </section>

      {/* FSRS Memory State */}
      {card.memory_state && (
        <section>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            <Layers className="h-3 w-3" />
            Memory State
          </div>
          <div className="rounded-md border border-border/60 p-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Stability</span>
              <span className="tabular-nums">{formatInterval(card.memory_state.stability ?? 0)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Difficulty</span>
              <span className="tabular-nums">{(card.memory_state.difficulty ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Retention Est.</span>
              <span className={`tabular-nums ${(card.memory_state.difficulty ?? 0) <= 5 ? "text-green-500" : (card.memory_state.difficulty ?? 0) <= 7 ? "text-yellow-500" : "text-red-500"}`}>
                {Math.max(50, 100 - card.memory_state.difficulty * 5)}%
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Scheduling */}
      <section>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          <Clock className="h-3 w-3" />
          Scheduling
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Due</span>
            <span className={`tabular-nums ${card.due_date ? (() => {
              const diff = (new Date(card.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
              return diff < 0 ? "text-red-500" : diff < 1 ? "text-yellow-500" : "text-foreground";
            })() : "text-muted-foreground"}`}>
              {card.due_date
                ? (() => {
                    const diff = (new Date(card.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                    if (diff < -1) return `${Math.abs(Math.round(diff))}d overdue`;
                    if (diff < 0) return "Overdue";
                    if (diff < 1) return "Today";
                    if (diff < 2) return "Tomorrow";
                    return `${Math.round(diff)}d`;
                  })()
                : "—"}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">State</span>
            <StateChip state={card.state} />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Algorithm</span>
            <span className="text-foreground capitalize">{card.algorithm_type ?? "default"}</span>
          </div>
          {card.is_suspended && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Status</span>
              <span className="text-yellow-600 font-medium">Suspended</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-md border border-border/60 px-3 py-2">
      <div className="text-[10px] text-muted-foreground leading-none">{label}</div>
      <div className={`text-sm font-semibold tabular-nums mt-0.5 ${color ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}

function StateChip({ state }: { state: string }) {
  const config: Record<string, { color: string; bg: string }> = {
    New: { color: "text-blue-500", bg: "bg-blue-500/15" },
    Learning: { color: "text-orange-500", bg: "bg-orange-500/15" },
    Review: { color: "text-green-500", bg: "bg-green-500/15" },
    Relearning: { color: "text-red-400", bg: "bg-red-400/15" },
  };
  const cfg = config[state] ?? { color: "text-muted-foreground", bg: "bg-muted" };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
      {state}
    </span>
  );
}
