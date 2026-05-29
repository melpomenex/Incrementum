import React, { useState, useEffect, useMemo, useRef } from "react";
import { Eye, AlertCircle, Star, CheckCircle, Sparkles, Scissors, MessageSquare } from "lucide-react";
import type { LearningItem } from "../../api/learning-items";
import { getImageAssetById } from "../../api/image-registry";
import { cn } from "../../utils";
import { renderAnkiHtmlWithLatex, warmAnkiLatexNormalization } from "../../utils/ankiLatex";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";

interface FlashcardScrollItemProps {
    learningItem: LearningItem;
    onRate: (rating: number) => void;
    onCreateFlashcard?: (excerpt: string, extractId?: string, documentId?: string) => void;
    onCreateCloze?: (selectedText: string, range: [number, number]) => void;
    onCreateQA?: () => void;
}

/**
 * Full-screen flashcard component for scroll mode review.
 * Shows question, allows revealing answer, and provides rating buttons.
 */
export const FlashcardScrollItem = React.memo(function FlashcardScrollItem({ 
    learningItem, 
    onRate, 
    onCreateFlashcard,
    onCreateCloze,
    onCreateQA
}: FlashcardScrollItemProps) {
    const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const { click } = useHapticFeedback();
    const containerRef = useRef<HTMLDivElement>(null);

    const handleCreateCloze = () => {
        if (!onCreateCloze) return;
        const selection = window.getSelection();
        const selectedText = selection ? selection.toString().trim() : "";
        if (!selectedText) return;

        const questionText = learningItem.question;
        const start = questionText.indexOf(selectedText);
        const end = start + selectedText.length;
        if (start !== -1) {
            onCreateCloze(selectedText, [start, end]);
        } else {
            onCreateCloze(selectedText, [0, 0]);
        }
    };

    // Keyboard shortcuts: Space to reveal, 1-4 to rate, C for Cloze, Q for QA
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if typing in input
            if ((e.target as HTMLElement).tagName === "INPUT" ||
                (e.target as HTMLElement).tagName === "TEXTAREA") {
                return;
            }
            if (!containerRef.current?.contains(e.target as Node)) return;

            // Space or Enter to reveal answer
            if ((e.key === " " || e.key === "Enter") && !isAnswerRevealed) {
                e.preventDefault();
                setIsAnswerRevealed(true);
            }

            if (e.key === "c" || e.key === "C") {
                e.preventDefault();
                handleCreateCloze();
            } else if (e.key === "q" || e.key === "Q") {
                if (onCreateQA) {
                    e.preventDefault();
                    onCreateQA();
                }
            }

            // Number keys 1-4 to rate (only when answer is revealed)
            if (isAnswerRevealed) {
                if (e.key === "1") {
                    e.preventDefault();
                    click();
                    onRate(1);
                } else if (e.key === "2") {
                    e.preventDefault();
                    click();
                    onRate(2);
                } else if (e.key === "3") {
                    e.preventDefault();
                    click();
                    onRate(3);
                } else if (e.key === "4") {
                    e.preventDefault();
                    click();
                    onRate(4);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isAnswerRevealed, onRate, onCreateQA, learningItem.question]);

    useEffect(() => {
        let isCancelled = false;
        const ids = learningItem.image_asset_ids || [];

        if (ids.length === 0) {
            setImageUrls([]);
            return;
        }

        const load = async () => {
            const results = await Promise.all(ids.map((id) => getImageAssetById(id)));
            if (isCancelled) return;
            setImageUrls(results.filter((item): item is NonNullable<typeof item> => Boolean(item)).map((item) => item.data_url));
        };

        void load();
        return () => {
            isCancelled = true;
        };
    }, [learningItem.id, learningItem.image_asset_ids]);

    useEffect(() => {
        warmAnkiLatexNormalization([learningItem.question, learningItem.answer, learningItem.cloze_text]);
    }, [learningItem.question, learningItem.answer, learningItem.cloze_text]);

    // Memoize rendered HTML to avoid re-computing on every render
    const questionHtml = useMemo(() => renderAnkiHtmlWithLatex(learningItem.question), [learningItem.question]);
    const answerHtml = useMemo(() => learningItem.answer ? renderAnkiHtmlWithLatex(learningItem.answer) : "", [learningItem.answer]);

    const renderClozeText = () => {
        if (!learningItem.cloze_text) {
            return <span dangerouslySetInnerHTML={{ __html: questionHtml }} />;
        }

        // If cloze_ranges are available, use range-based rendering
        if (learningItem.cloze_ranges) {

        const text = learningItem.cloze_text;
        const ranges = learningItem.cloze_ranges;
        let lastIndex = 0;
        const parts: React.ReactNode[] = [];

        ranges.forEach(([start, end], index) => {
            // Add text before this cloze
            if (start > lastIndex) {
                parts.push(
                    <span 
                        key={`text-${index}`} 
                        dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(text.slice(lastIndex, start)) }} 
                    />
                );
            }

            // Add cloze blank or revealed answer
            const clozeContent = text.slice(start, end);
            if (isAnswerRevealed) {
                parts.push(
                    <span
                        key={`cloze-${index}`}
                        className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-semibold"
                        dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(clozeContent) }}
                    />
                );
            } else {
                parts.push(
                    <span
                        key={`cloze-${index}`}
                        className="bg-primary/30 px-4 py-0.5 rounded mx-1"
                    >
                        [...]
                    </span>
                );
            }

            lastIndex = end;
        });

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push(
                <span 
                    key="text-end" 
                    dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(text.slice(lastIndex)) }} 
                />
            );
        }

        return <>{parts}</>;
        }

        // Fallback: parse {{cN::content}} or [[cN::content]] markers from cloze_text
        const rawClozePattern = /\{\{c(\d+)::(.+?)(?:::(.+?))?\}\}/g;
        if (rawClozePattern.test(learningItem.cloze_text)) {
            rawClozePattern.lastIndex = 0;
            const parts: React.ReactNode[] = [];
            let lastIndex = 0;
            let match;
            while ((match = rawClozePattern.exec(learningItem.cloze_text)) !== null) {
                if (match.index > lastIndex) {
                    parts.push(
                        <span key={`t-${parts.length}`} dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(learningItem.cloze_text.slice(lastIndex, match.index)) }} />
                    );
                }
                const hint = match[3];
                if (isAnswerRevealed) {
                    parts.push(
                        <span key={`c-${parts.length}`} className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-semibold" dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(match[2]) }} />
                    );
                } else {
                    parts.push(
                        <span key={`c-${parts.length}`} className="bg-primary/30 px-4 py-0.5 rounded mx-1">
                            {hint || "[...]"}
                        </span>
                    );
                }
                lastIndex = match.index + match[0].length;
            }
            if (lastIndex < learningItem.cloze_text.length) {
                parts.push(
                    <span key={`t-end`} dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(learningItem.cloze_text.slice(lastIndex)) }} />
                );
            }
            return <span className="text-lg leading-relaxed">{parts}</span>;
        }

        const parts = learningItem.cloze_text.split(/\[\[c(\d+)::(.*?)\]\]/g);
        return (
            <span className="text-lg leading-relaxed">
                {parts.map((part, idx) => {
                    if (idx % 3 === 1) return null; // Skip the cloze number
                    if (idx % 3 === 2) {
                        if (isAnswerRevealed) {
                            return (
                                <span
                                    key={idx}
                                    className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-semibold"
                                    dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(part) }}
                                />
                            );
                        }
                        return (
                            <span
                                key={idx}
                                className="bg-primary/30 px-4 py-0.5 rounded mx-1"
                            >
                                [...]
                            </span>
                        );
                    }
                    return <span key={idx} dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(part) }} />;
                })}
            </span>
        );
    };

    const renderQuestionContent = () => {
        switch (learningItem.item_type) {
            case "Cloze":
                return renderClozeText();
            case "Flashcard":
            case "Qa":
            case "Basic":
            default:
                return <span dangerouslySetInnerHTML={{ __html: questionHtml }} />;
        }
    };

    const renderAnswerContent = () => {
        if (learningItem.item_type === "Cloze") {
            return null; // Cloze shows answer inline
        }
        if (!learningItem.answer) return null;
        
        return <span dangerouslySetInnerHTML={{ __html: answerHtml }} />;
    };

    const answerContent = renderAnswerContent();
    const stateLabel = learningItem.state === "New"
        ? "New Card"
        : learningItem.state === "Learning"
            ? "Learning"
            : learningItem.state === "Review"
                ? "Review"
                : "Relearning";

    return (
        <div ref={containerRef} className="h-full w-full flex flex-col items-center justify-center p-8 bg-gradient-to-b from-background to-muted/30">
            {/* Card Type Badge */}
            <div className="absolute top-6 left-6 flex items-center gap-2">
                <span className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium">
                    {learningItem.item_type}
                </span>
                <span className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium">
                    {stateLabel}
                </span>
                {learningItem.review_count > 0 && (
                    <span className="px-2 py-1 text-xs text-muted-foreground">
                        Reviewed {learningItem.review_count}x
                    </span>
                )}
            </div>

            {/* Flashcard Container */}
            <div className="w-full max-w-3xl">
                {/* Actions Bar */}
                {(onCreateFlashcard || onCreateCloze || onCreateQA) && (learningItem.tags?.includes("kindle") || learningItem.extract_id) && (
                    <div className="flex items-center justify-center gap-3 mb-5 pointer-events-auto">
                        {onCreateFlashcard && (
                            <button
                                onClick={() => onCreateFlashcard(learningItem.question, learningItem.extract_id, learningItem.document_id)}
                                className="px-4 py-2 bg-purple-600/10 dark:bg-purple-600/20 hover:bg-purple-600/20 dark:hover:bg-purple-600/30 text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-all shadow-sm border border-purple-300 dark:border-purple-500/30 hover:border-purple-500"
                                title="Turn this highlight into real flashcards (Cloze, Q&A, etc.)"
                            >
                                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                <span>Create Flashcard...</span>
                            </button>
                        )}
                        {onCreateCloze && (
                            <button
                                onClick={handleCreateCloze}
                                className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg font-medium text-sm flex items-center gap-2 transition-all shadow-sm border border-border"
                                title="Select text in the highlight and click here or press 'C' to create a Cloze deletion card"
                            >
                                <Scissors className="w-4 h-4 text-muted-foreground" />
                                <span>Create Cloze (C)</span>
                            </button>
                        )}
                        {onCreateQA && (
                            <button
                                onClick={onCreateQA}
                                className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg font-medium text-sm flex items-center gap-2 transition-all shadow-sm border border-border"
                                title="Click here or press 'Q' to create a Question & Answer card from this highlight"
                            >
                                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                                <span>Create Q&A (Q)</span>
                            </button>
                        )}
                    </div>
                )}

                {/* Question */}
                <div className="bg-card border border-border rounded-2xl p-8 shadow-xl mb-6">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-4">
                        Question
                    </div>
                    {imageUrls.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                            {imageUrls.map((url, index) => (
                                <img
                                    key={`${learningItem.id}-img-${index}`}
                                    src={url}
                                    alt={`Flashcard visual ${index + 1}`}
                                    className="w-full max-h-64 object-contain rounded-lg border border-border bg-muted/20"
                                />
                            ))}
                        </div>
                    )}
                    <div className="text-2xl leading-relaxed text-foreground [&_img]:my-2 [&_img]:max-h-72 [&_img]:w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-border [&_img]:object-contain [&_audio]:my-2 [&_audio]:w-full [&_video]:my-2 [&_video]:w-full [&_video]:rounded-lg">
                        {renderQuestionContent()}
                    </div>
                </div>

                {/* Answer Section */}
                {answerContent && (
                    <div
                        className={cn(
                            "bg-card border border-border rounded-2xl p-8 shadow-xl transition-all duration-300",
                            isAnswerRevealed ? "opacity-100" : "opacity-0 pointer-events-none h-0 p-0 overflow-hidden"
                        )}
                    >
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-4">
                            Answer
                        </div>
                        <div className="text-xl leading-relaxed text-green-400 [&_img]:my-2 [&_img]:max-h-72 [&_img]:w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-border [&_img]:object-contain [&_audio]:my-2 [&_audio]:w-full [&_video]:my-2 [&_video]:w-full [&_video]:rounded-lg">
                            {answerContent}
                        </div>
                    </div>
                )}

                {/* Show Answer Button */}
                {!isAnswerRevealed && (
                    <button
                        onClick={() => setIsAnswerRevealed(true)}
                        className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-medium text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-3 shadow-lg"
                    >
                        <Eye className="w-5 h-5" />
                        Show Answer
                    </button>
                )}

                {/* Rating Buttons - show after answer is revealed */}
                {isAnswerRevealed && (
                    <div className="flex items-center justify-center gap-4 mt-6">
                        <button
                            onClick={() => { click(); onRate(1); }}
                            className="flex-1 py-4 bg-red-500/90 text-white rounded-xl font-medium hover:bg-red-500 transition-colors flex items-center justify-center gap-2 shadow-lg"
                        >
                            <AlertCircle className="w-5 h-5" />
                            Again
                        </button>
                        <button
                            onClick={() => { click(); onRate(2); }}
                            className="flex-1 py-4 bg-orange-500/90 text-white rounded-xl font-medium hover:bg-orange-500 transition-colors flex items-center justify-center gap-2 shadow-lg"
                        >
                            <Star className="w-5 h-5" />
                            Hard
                        </button>
                        <button
                            onClick={() => { click(); onRate(3); }}
                            className="flex-1 py-4 bg-blue-500/90 text-white rounded-xl font-medium hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 shadow-lg"
                        >
                            <CheckCircle className="w-5 h-5" />
                            Good
                        </button>
                        <button
                            onClick={() => { click(); onRate(4); }}
                            className="flex-1 py-4 bg-green-500/90 text-white rounded-xl font-medium hover:bg-green-500 transition-colors flex items-center justify-center gap-2 shadow-lg"
                        >
                            <Sparkles className="w-5 h-5" />
                            Easy
                        </button>
                    </div>
                )}

                {/* Keyboard hints */}
                <div className="mt-8 text-center text-xs text-muted-foreground">
                    {!isAnswerRevealed ? (
                        "Press Space to reveal answer"
                    ) : (
                        "Press 1-4 to rate • 1=Again, 2=Hard, 3=Good, 4=Easy"
                    )}
                </div>
            </div>
        </div>
    );
});
