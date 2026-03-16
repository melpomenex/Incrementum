import { useState, useEffect } from "react";
import { Eye, AlertCircle, Star, CheckCircle, Sparkles } from "lucide-react";
import type { LearningItem } from "../../api/learning-items";
import { getImageAssetById } from "../../api/image-registry";
import { cn } from "../../utils";
import { renderAnkiHtmlWithLatex, warmAnkiLatexNormalization } from "../../utils/ankiLatex";

interface FlashcardScrollItemProps {
    learningItem: LearningItem;
    onRate: (rating: number) => void;
}

/**
 * Full-screen flashcard component for scroll mode review.
 * Shows question, allows revealing answer, and provides rating buttons.
 */
export function FlashcardScrollItem({ learningItem, onRate }: FlashcardScrollItemProps) {
    const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
    const [imageUrls, setImageUrls] = useState<string[]>([]);

    // Keyboard shortcuts: Space to reveal, 1-4 to rate
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if typing in input
            if ((e.target as HTMLElement).tagName === "INPUT" ||
                (e.target as HTMLElement).tagName === "TEXTAREA") {
                return;
            }

            // Space or Enter to reveal answer
            if ((e.key === " " || e.key === "Enter") && !isAnswerRevealed) {
                e.preventDefault();
                setIsAnswerRevealed(true);
            }

            // Number keys 1-4 to rate (only when answer is revealed)
            if (isAnswerRevealed) {
                if (e.key === "1") {
                    e.preventDefault();
                    onRate(1);
                } else if (e.key === "2") {
                    e.preventDefault();
                    onRate(2);
                } else if (e.key === "3") {
                    e.preventDefault();
                    onRate(3);
                } else if (e.key === "4") {
                    e.preventDefault();
                    onRate(4);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isAnswerRevealed, onRate]);

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

    // Render cloze text with blanks or revealed answers
    const renderClozeText = () => {
        if (!learningItem.cloze_text) {
            return <span dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(learningItem.question) }} />;
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

        // Fallback: parse [[cN::content]] markers from cloze_text via regex
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

    // Get display content based on item type
    const renderQuestionContent = () => {
        switch (learningItem.item_type) {
            case "Cloze":
                return renderClozeText();
            case "Flashcard":
            case "Qa":
            case "Basic":
            default:
                return <span dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(learningItem.question) }} />;
        }
    };

    const renderAnswerContent = () => {
        if (learningItem.item_type === "Cloze") {
            return null; // Cloze shows answer inline
        }
        if (!learningItem.answer) return null;
        
        return <span dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(learningItem.answer) }} />;
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
        <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-gradient-to-b from-background to-muted/30">
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
                            onClick={() => onRate(1)}
                            className="flex-1 py-4 bg-red-500/90 text-white rounded-xl font-medium hover:bg-red-500 transition-colors flex items-center justify-center gap-2 shadow-lg"
                        >
                            <AlertCircle className="w-5 h-5" />
                            Again
                        </button>
                        <button
                            onClick={() => onRate(2)}
                            className="flex-1 py-4 bg-orange-500/90 text-white rounded-xl font-medium hover:bg-orange-500 transition-colors flex items-center justify-center gap-2 shadow-lg"
                        >
                            <Star className="w-5 h-5" />
                            Hard
                        </button>
                        <button
                            onClick={() => onRate(3)}
                            className="flex-1 py-4 bg-blue-500/90 text-white rounded-xl font-medium hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 shadow-lg"
                        >
                            <CheckCircle className="w-5 h-5" />
                            Good
                        </button>
                        <button
                            onClick={() => onRate(4)}
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
}
