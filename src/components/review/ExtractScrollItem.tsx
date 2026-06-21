import { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowCounterClockwise,
  ChatCircle,
  CheckCircle,
  CircleNotch,
  Clock,
  Eye,
  EyeSlash,
  PencilLine,
  Scissors,
  Sparkle,
  Star,
  TextT,
  Trophy,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  updateExtract,
  forgetExtract,
  dismissExtract,
  graduateExtract,
  type Extract,
} from "../../api/extracts";
import { generateProgressiveSummaries } from "../../api/ai";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../utils";

interface ExtractScrollItemProps {
    extract: Extract;
    documentTitle: string;
    onRate: (rating: number) => void;
    onCreateCloze: (selectedText: string, range: [number, number]) => void;
    onCreateQA: () => void;
    onCreateFlashcard?: (selectedText: string) => void;
    onUpdate?: (updates: { content: string; notes?: string }) => void;
}

/**
 * Full-screen extract component for scroll mode review.
 * Shows extract content, allows creating flashcards, and provides rating buttons.
 */
export function ExtractScrollItem({
    extract,
    documentTitle,
    onRate,
    onCreateCloze,
    onCreateQA,
    onCreateFlashcard,
    onUpdate
}: ExtractScrollItemProps) {
    const { t } = useI18n();
    const [content, setContent] = useState(extract.content);
    const [notes, setNotes] = useState(extract.notes ?? "");
    const [saveStatus, setSaveStatus] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
    const contentRef = useRef<HTMLTextAreaElement>(null);
    const lastSavedRef = useRef({ content: extract.content, notes: extract.notes ?? "" });
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMountedRef = useRef(true);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [summaries, setSummaries] = useState(extract.progressive_summaries ?? []);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; selectedText: string } | null>(null);

    const formatDateTime = (dateStr?: string | Date) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
        });
    };

    const hasBeenModified = useMemo(() => {
        const created = new Date(extract.date_created).getTime();
        const modified = new Date(extract.date_modified).getTime();
        return modified > created + 1000 || saveStatus === "saved";
    }, [extract.date_created, extract.date_modified, saveStatus]);

    // Generate progressive summaries on mount if needed
    useEffect(() => {
        if (
            extract.max_disclosure_level > 0 &&
            (!extract.progressive_summaries || extract.progressive_summaries.length === 0)
        ) {
            setIsGeneratingSummary(true);
            setSummaryError(null);
            generateProgressiveSummaries(extract.id)
                .then((result) => {
                    if (isMountedRef.current) {
                        setSummaries(result);
                    }
                })
                .catch((err) => {
                    console.error("Failed to generate progressive summaries:", err);
                    if (isMountedRef.current) {
                        setSummaryError(t("extractScrollItem.summaryError"));
                    }
                })
                .finally(() => {
                    if (isMountedRef.current) {
                        setIsGeneratingSummary(false);
                    }
                });
        }
    }, [extract.id, extract.max_disclosure_level, t]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        setContent(extract.content);
        setNotes(extract.notes ?? "");
        lastSavedRef.current = { content: extract.content, notes: extract.notes ?? "" };
        setSaveStatus("idle");
    }, [extract.id, extract.content, extract.notes]);

    // Keyboard shortcuts: 1-4 to rate, C for Cloze, Q for QA
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if typing in input
            if ((e.target as HTMLElement).tagName === "INPUT" ||
                (e.target as HTMLElement).tagName === "TEXTAREA") {
                return;
            }

            if (e.key === "c" || e.key === "C") {
                e.preventDefault();
                handleCreateCloze();
            } else if (e.key === "q" || e.key === "Q") {
                e.preventDefault();
                onCreateQA();
            } else if (e.key === "1") {
                onRate(1);
            } else if (e.key === "2") {
                onRate(2);
            } else if (e.key === "3") {
                onRate(3);
            } else if (e.key === "4") {
                onRate(4);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onRate, onCreateQA, onCreateCloze]);

    useEffect(() => {
        if (content === lastSavedRef.current.content && notes === lastSavedRef.current.notes) {
            return;
        }

        setSaveStatus("dirty");

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            setSaveStatus("saving");
            try {
                await updateExtract({ id: extract.id, content, note: notes });
                if (!isMountedRef.current) return;
                lastSavedRef.current = { content, notes };
                onUpdate?.({ content, notes });
                setSaveStatus("saved");
                if (statusTimeoutRef.current) {
                    clearTimeout(statusTimeoutRef.current);
                }
                statusTimeoutRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                        setSaveStatus("idle");
                    }
                }, 2000);
            } catch (error) {
                if (!isMountedRef.current) return;
                console.error("Failed to save extract edits:", error);
                setSaveStatus("error");
            }
        }, 800);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [content, notes, extract.id, onUpdate]);

    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            if (statusTimeoutRef.current) {
                clearTimeout(statusTimeoutRef.current);
            }
        };
    }, []);

    const getDisplayContent = (): { text: string; isSummary: boolean; levelLabel: string | null } => {
        const maxLevel = extract.max_disclosure_level;
        const currentLevel = extract.progressive_disclosure_level;

        // Progressive disclosure disabled
        if (maxLevel <= 0) {
            return { text: extract.content, isSummary: false, levelLabel: null };
        }

        // Already at or past max level - show full content
        if (currentLevel >= maxLevel) {
            return { text: extract.content, isSummary: false, levelLabel: t("extractScrollItem.fullContent") };
        }

        // First half of levels use AI summaries
        const numAiLevels = Math.ceil(maxLevel / 2);

        if (currentLevel < numAiLevels) {
            if (summaries.length > 0) {
                const summaryIndex = Math.min(currentLevel, summaries.length - 1);
                const summary = summaries[summaryIndex];
                return {
                    text: summary.summary,
                    isSummary: true,
                    levelLabel: t("extractScrollItem.aiSummaryLevel", { current: currentLevel + 1, total: maxLevel }),
                };
            }
            // No summaries yet (still generating or failed) - fall through to text reveal
            if (isGeneratingSummary) {
                return { text: "", isSummary: true, levelLabel: null };
            }
            if (summaryError) {
                return { text: extract.content, isSummary: false, levelLabel: null };
            }
        }

        // Progressive text reveal phase (second half of levels)
        const textLevels = maxLevel - numAiLevels;
        const textLevelIndex = currentLevel - numAiLevels;
        const fraction = (textLevelIndex + 1) / (textLevels + 1);
        const charCount = Math.floor(extract.content.length * fraction);
        let cutoff = charCount;
        if (cutoff < extract.content.length) {
            const nextSpace = extract.content.indexOf(" ", cutoff);
            if (nextSpace !== -1 && nextSpace < cutoff + 50) {
                cutoff = nextSpace;
            }
        }
        const isFull = cutoff >= extract.content.length;
        return {
            text: isFull ? extract.content : extract.content.slice(0, cutoff) + "...",
            isSummary: false,
            levelLabel: isFull ? t("extractScrollItem.fullContent") : t("extractScrollItem.revealingPercent", { count: Math.round(fraction * 100) }),
        };
    };

    const handleCreateCloze = () => {
        const textarea = contentRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;
        if (start === end) return;

        const selectedText = textarea.value.slice(start, end).trim();
        if (!selectedText) return;

        onCreateCloze(selectedText, [start, end]);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        const textarea = contentRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;
        const selectedText = textarea.value.slice(start, end).trim();
        if (!selectedText) return;
        setContextMenu({ x: e.clientX, y: e.clientY, selectedText });
    };

    const stateLabel = extract.review_count === 0
        ? t("extractScrollItem.newExtract")
        : t("extractScrollItem.review");

    const renderSaveStatus = () => {
        if (saveStatus === "saving") {
            return (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                    {t("extractScrollItem.saving")}
                </span>
            );
        }
        if (saveStatus === "saved") {
            return (
                <span className="flex items-center gap-2 text-xs text-emerald-500">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {t("extractScrollItem.saved")}
                </span>
            );
        }
        if (saveStatus === "error") {
            return (
                <span className="flex items-center gap-2 text-xs text-red-500">
                    <WarningCircle className="w-3.5 h-3.5" />
                    {t("extractScrollItem.saveFailed")}
                </span>
            );
        }
        if (saveStatus === "dirty") {
            return (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <PencilLine className="w-3.5 h-3.5" />
                    {t("extractScrollItem.unsaved")}
                </span>
            );
        }
        return null;
    };

    return (
        <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-gradient-to-b from-background to-muted/30">
            {/* Card Type Badge */}
            <div className="absolute top-6 left-6 flex items-center gap-2">
                <span className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm font-medium flex items-center gap-2">
                    <TextT className="w-4 h-4" />
                    {t("extractScrollItem.extract")}
                </span>
                <span className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium">
                    {stateLabel}
                </span>
                {extract.review_count > 0 && (
                    <span className="px-2 py-1 text-xs text-muted-foreground">
                        {t("extractScrollItem.reviewedCount", { count: extract.review_count })}
                    </span>
                )}
                {extract.max_disclosure_level > 0 && (
                    <span className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                        <Eye className="w-3 h-3" />
                        {t("extractScrollItem.level", { current: extract.progressive_disclosure_level, total: extract.max_disclosure_level })}
                    </span>
                )}
            </div>

            <div className="absolute top-6 right-6 text-sm text-muted-foreground max-w-md flex items-center gap-4">
                <span className="truncate">
                    {t("extractScrollItem.from")} <span className="font-medium text-foreground">{documentTitle}</span>
                    {extract.page_number && <span className="ml-2 opacity-70">{t("extractScrollItem.pageShort", { count: extract.page_number })}</span>}
                </span>
                {renderSaveStatus()}
            </div>

            {/* Extract Container */}
            <div className="w-full max-w-4xl flex flex-col gap-6">
                {/* Actions Bar */}
                <div className="flex items-center justify-end gap-3">
                    {onCreateFlashcard && (
                        <button
                            onClick={() => onCreateFlashcard(extract.content)}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
                            title={t("extractScrollItem.createFlashcardHint")}
                        >
                            <Sparkle className="w-4 h-4" />
                            {t("extractScrollItem.createFlashcard")}
                        </button>
                    )}
                    <button
                        onClick={handleCreateCloze}
                        className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
                        title={t("extractScrollItem.createClozeHint")}
                    >
                        <Scissors className="w-4 h-4" />
                        {t("extractScrollItem.createCloze")}
                    </button>
                    <button
                        onClick={onCreateQA}
                        className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
                        title={t("extractScrollItem.createQaHint")}
                    >
                        <ChatCircle className="w-4 h-4" />
                        {t("extractScrollItem.createQa")}
                    </button>
                </div>

                {/* Content Editor / Progressive Disclosure */}
                <div data-extract-scroll="true" className="bg-card border border-border rounded-2xl shadow-xl min-h-[300px] max-h-[60vh] overflow-y-auto relative">
                    {(() => {
                        const { text, isSummary, levelLabel } = getDisplayContent();

                        // Disclosure disabled or at max level — show editable textarea
                        if (!levelLabel || levelLabel === "Full content") {
                            return (
                                <textarea
                                    ref={contentRef}
                                    value={content}
                                    onChange={(event) => setContent(event.target.value)}
                                    placeholder={t("extractScrollItem.editContentPlaceholder")}
                                    className="w-full min-h-[300px] p-10 bg-transparent text-lg leading-relaxed text-foreground outline-none resize-none"
                                    onContextMenu={handleContextMenu}
                                />
                            );
                        }

                        if (isGeneratingSummary && isSummary) {
                            return (
                                <div className="flex flex-col items-center justify-center min-h-[300px] text-muted-foreground gap-3">
                                    <CircleNotch className="w-6 h-6 animate-spin" />
                                    <span className="text-sm">{t("extractScrollItem.generatingSummary")}</span>
                                </div>
                            );
                        }

                        if (summaryError && isSummary) {
                            return (
                                <div className="p-10">
                                    <div className="text-xs text-amber-400 mb-2">{summaryError}</div>
                                    <textarea
                                        ref={contentRef}
                                        value={content}
                                        onChange={(event) => setContent(event.target.value)}
                                        placeholder={t("extractScrollItem.editContentPlaceholder")}
                                        className="w-full min-h-[300px] bg-transparent text-lg leading-relaxed text-foreground outline-none resize-none"
                                        onContextMenu={handleContextMenu}
                                    />
                                </div>
                            );
                        }

                        return (
                            <>
                                {levelLabel && (
                                    <div className={cn(
                                        "absolute top-3 right-3 z-10 px-3 py-1 rounded-lg text-xs font-medium",
                                        isSummary
                                            ? "bg-amber-500/20 text-amber-400"
                                            : "bg-blue-500/20 text-blue-400"
                                    )}>
                                        {isSummary && <Sparkle className="w-3 h-3 inline mr-1" />}
                                        {levelLabel}
                                    </div>
                                )}
                                    <div className="p-10 text-lg leading-relaxed text-foreground">
                                        {text}
                                    </div>
                                </>
                            );
                        })()}

                        {hasBeenModified && (
                            <div 
                                className="absolute bottom-4 right-4 flex items-center gap-1.5 px-2.5 py-1 bg-muted/80 backdrop-blur-sm border border-border rounded-lg text-xs text-muted-foreground cursor-help select-none hover:text-foreground hover:bg-muted transition-all shadow-sm z-20 pointer-events-auto"
                                title={`Last edited: ${formatDateTime(extract.date_modified)}\nCreated: ${formatDateTime(extract.date_created)}`}
                            >
                                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                <span>Edited</span>
                            </div>
                        )}
                    </div>

                {/* Notes Editor */}
                <div className={cn(
                    "bg-muted/50 border border-border/50 rounded-xl p-4",
                    "text-sm text-muted-foreground"
                )}>
                    <div className="font-semibold text-xs uppercase tracking-wider mb-2 opacity-70">{t("extractScrollItem.notes")}</div>
                    <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder={t("extractScrollItem.notesPlaceholder")}
                        className="w-full min-h-[90px] bg-transparent text-sm text-foreground outline-none resize-none"
                    />
                </div>

                {/* Lifecycle actions: Forget / Dismiss / Done (SuperMemo-style) */}
                <div className="flex items-center justify-center gap-2 mt-3">
                    <button
                        onClick={() => {
                            void forgetExtract(extract.id).then(() => onRate(1));
                        }}
                        className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
                        title="Reset memory state and return to new queue"
                    >
                        <ArrowCounterClockwise className="w-3.5 h-3.5" />
                        Forget
                    </button>
                    <button
                        onClick={() => {
                            void dismissExtract(extract.id, !extract.is_dismissed).then(() => onRate(3));
                        }}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
                            extract.is_dismissed
                                ? "border-primary/40 text-primary bg-primary/10"
                                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                        title={extract.is_dismissed ? "Restore to review queue" : "Remove from review queue (keep in library)"}
                    >
                        <EyeSlash className="w-3.5 h-3.5" />
                        {extract.is_dismissed ? "Undismiss" : "Dismiss"}
                    </button>
                    <button
                        onClick={() => {
                            void graduateExtract(extract.id).then(() => onRate(4));
                        }}
                        className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
                        title="Mark mastered — schedule ~5 years out"
                    >
                        <Trophy className="w-3.5 h-3.5" />
                        Done
                    </button>
                </div>

                {/* Rating Buttons */}
                <div className="flex items-center justify-center gap-4 mt-2">
                    <button
                        onClick={() => onRate(1)}
                        className="flex-1 py-4 bg-red-500/90 text-white rounded-xl font-medium hover:bg-red-500 transition-colors flex items-center justify-center gap-2 shadow-lg"
                    >
                        <WarningCircle className="w-5 h-5" />
                        {t("extractScrollItem.again")}
                    </button>
                    <button
                        onClick={() => onRate(2)}
                        className="flex-1 py-4 bg-orange-500/90 text-white rounded-xl font-medium hover:bg-orange-500 transition-colors flex items-center justify-center gap-2 shadow-lg"
                    >
                        <Star className="w-5 h-5" />
                        {t("extractScrollItem.hard")}
                    </button>
                    <button
                        onClick={() => onRate(3)}
                        className="flex-1 py-4 bg-blue-500/90 text-white rounded-xl font-medium hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 shadow-lg"
                    >
                        <CheckCircle className="w-5 h-5" />
                        {t("extractScrollItem.good")}
                    </button>
                    <button
                        onClick={() => onRate(4)}
                        className="flex-1 py-4 bg-green-500/90 text-white rounded-xl font-medium hover:bg-green-500 transition-colors flex items-center justify-center gap-2 shadow-lg"
                    >
                        <Sparkle className="w-5 h-5" />
                        {t("extractScrollItem.easy")}
                    </button>
                </div>

                {/* Keyboard hints */}
                <div className="text-center text-xs text-muted-foreground">
                    {t("extractScrollItem.keyboardHints")}
                </div>
            </div>

            {/* Right-click context menu */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-[9999]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
                    <div
                        className="fixed z-[10000] bg-card border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                    >
                        {onCreateCloze && (
                            <button
                                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                                onClick={() => {
                                    setContextMenu(null);
                                    onCreateCloze(contextMenu.selectedText, [0, 0]);
                                }}
                            >
                                <Scissors className="w-4 h-4 text-muted-foreground" />
                                {t("extractScrollItem.createCloze")}
                            </button>
                        )}
                        {onCreateQA && (
                            <button
                                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                                onClick={() => {
                                    setContextMenu(null);
                                    onCreateQA();
                                }}
                            >
                                <ChatCircle className="w-4 h-4 text-muted-foreground" />
                                {t("extractScrollItem.createQa")}
                            </button>
                        )}
                        {onCreateFlashcard && (
                            <button
                                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setContextMenu(null);
                                    onCreateFlashcard(contextMenu.selectedText);
                                }}
                            >
                                <Sparkle className="w-4 h-4 text-muted-foreground" />
                                {t("extractScrollItem.createFlashcard")}
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
