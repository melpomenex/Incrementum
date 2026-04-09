/**
 * FlashcardStudioModal - AI-Powered Flashcard Creation Studio
 * 
 * Best-in-class UX features:
 * - Immersive full-screen modal with glassmorphism effects
 * - Smart document selection with search and quick filters
 * - GRANULAR CONTEXT CONTROL: chapters, page ranges, text excerpts
 * - COST ESTIMATOR: see token usage before sending
 * - INTERACTIVE HIGHLIGHTING: select text directly to use as context
 * - Search within document to find relevant sections quickly
 * - Interactive chat with markdown rendering and syntax highlighting
 * - Live card preview with flip animation
 * - Inline card editing for quick fixes
 * - Bulk operations with keyboard shortcuts
 * - Quick templates for common generation tasks
 * - Progress indicators and smooth transitions
 * - Smart tagging system with autocomplete
 * - TOC section selector with visual hierarchy
 */

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit2,
  FileText,
  Filter,
  FolderOpen,
  Hash,
  Lightbulb,
  Loader2,
  MessageSquare,
  Save,
  Search,
  Send,
  Settings,
  Sparkles,
  Tag,
  Trash2,
  X,
  Zap,
  BookOpen,
  AlignLeft,
  Quote,
  BrainCircuit,
  History,
  CheckCircle2,
  AlertCircle,
  Highlighter,
  Scissors,
  ScrollText,
  DollarSign,
  BarChart3,
  Type,
  ImagePlus,
  ClipboardPaste,
} from "lucide-react";
import { chatWithContext, type LLMMessage } from "../../api/llm";
import {
  notebooklmGenerateArtifact,
  notebooklmGetSettings,
  notebooklmListNotebooks,
  notebooklmPreviewFlashcards,
  notebooklmSelectNotebook,
  type NotebookSummary,
} from "../../api/integrations";
import { callIncrementumMCPTool } from "../../api/mcp";
import { deleteImageAsset, ingestImageBlob, ingestImageFile, listImageAssets, type ImageAsset } from "../../api/image-registry";
import { getVideoTranscript } from "../../api/video-extracts";
import { extractYouTubeID, fetchYouTubeTranscript } from "../../api/youtube";
import { renderMarkdown } from "../../utils/markdown";
import { useDocumentStore, useLLMProvidersStore, useSettingsStore, useStudyDeckStore } from "../../stores";
import { useToast } from "../common/Toast";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../utils";
import { buildChapterQAContext, getChapterTitles } from "../../utils/chapterUtils";

// =============================================================================
// TYPES
// =============================================================================

type DraftCardType = "qa" | "cloze";
type ViewMode = "chat" | "templates" | "history";
type ContextMode = "full" | "chapters" | "pages" | "excerpt" | "search";

interface DraftCard {
  id: string;
  type: DraftCardType;
  question?: string;
  answer?: string;
  text?: string;
  selected: boolean;
  sourceMessageId?: string;
  createdAt: number;
  isEditing?: boolean;
  tags: string[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  cardsGenerated?: number;
  tokensUsed?: number;
}

interface FlashcardStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QuickTemplate {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  prompt: string;
}

interface GenerationHistoryItem {
  id: string;
  prompt: string;
  timestamp: number;
  cardCount: number;
  documentName?: string;
}

interface ContextSelection {
  mode: ContextMode;
  chapters: number[];
  pageRange: { start: number; end: number } | null;
  excerpt: string;
  searchQuery: string;
  searchResults: Array<{ start: number; end: number; preview: string }>;
}

const DEFAULT_CONTEXT_SELECTION: ContextSelection = {
  mode: "full",
  chapters: [],
  pageRange: null,
  excerpt: "",
  searchQuery: "",
  searchResults: [],
};

function normalizeContextSelection(value: unknown): ContextSelection {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<ContextSelection>;
  const mode: ContextMode =
    raw.mode === "full" || raw.mode === "chapters" || raw.mode === "pages" || raw.mode === "excerpt" || raw.mode === "search"
      ? raw.mode
      : DEFAULT_CONTEXT_SELECTION.mode;
  return {
    mode,
    chapters: Array.isArray(raw.chapters) ? raw.chapters : [],
    pageRange:
      raw.pageRange && typeof raw.pageRange.start === "number" && typeof raw.pageRange.end === "number"
        ? raw.pageRange
        : null,
    excerpt: typeof raw.excerpt === "string" ? raw.excerpt : "",
    searchQuery: typeof raw.searchQuery === "string" ? raw.searchQuery : "",
    searchResults: Array.isArray(raw.searchResults) ? raw.searchResults : [],
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY = "flashcard-studio-state-v3";
const HISTORY_KEY = "flashcard-studio-history";
const NOTEBOOKLM_PROVIDER_ID = "__notebooklm__";

// Rough token estimation: ~4 chars per token
const CHARS_PER_TOKEN = 4;
// Cost per 1K tokens (approximate for GPT-4)
const COST_PER_1K_INPUT = 0.01;
const COST_PER_1K_OUTPUT = 0.03;

const SYSTEM_PROMPT = `You are an expert flashcard creation assistant specialized in spaced repetition and active recall learning.

When creating flashcards, return them as JSON in a code block using this exact schema:

\`\`\`json
{
  "cards": [
    { "type": "qa", "question": "...", "answer": "..." },
    { "type": "cloze", "text": "The {{c1::term}} is important because {{c2::reason}}." }
  ]
}
\`\`\`

Return ONLY the JSON code block (no other text) when the user is asking you to create flashcards.

Rules for excellent flashcards:
- Use "qa" for conceptual questions that benefit from detailed explanations
- Use "cloze" for factual recall with {{c1::}} or {{::}} deletions
- Keep cards atomic: one fact per card
- Use clear, specific questions
- Answers should be concise but complete
- For cloze deletions, ensure the context makes the answer inferable
- Create 3-7 cards per request unless specified otherwise
- If the user is just chatting, answer normally without JSON`;

const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    id: "summarize",
    icon: <AlignLeft className="w-4 h-4" />,
    label: "Summarize Key Points",
    description: "Extract main concepts as Q&A cards",
    prompt: "Create flashcards summarizing the key points from this content. Focus on the most important concepts that would be valuable for long-term retention.",
  },
  {
    id: "definitions",
    icon: <BookOpen className="w-4 h-4" />,
    label: "Key Definitions",
    description: "Generate cards for important terms",
    prompt: "Identify all important terminology, definitions, and key terms in this content. Create cloze deletion cards for terms and Q&A cards for conceptual understanding.",
  },
  {
    id: "deep-dive",
    icon: <BrainCircuit className="w-4 h-4" />,
    label: "Deep Understanding",
    description: "Why, how, and implications",
    prompt: "Create cards that test deep understanding: why things work the way they do, how concepts relate to each other, and what the implications are. Avoid simple factual recall.",
  },
  {
    id: "examples",
    icon: <Quote className="w-4 h-4" />,
    label: "Examples & Applications",
    description: "Concrete examples and use cases",
    prompt: "Generate cards based on examples, case studies, or applications mentioned in this content. Create scenario-based questions when possible.",
  },
  {
    id: "compare",
    icon: <Filter className="w-4 h-4" />,
    label: "Compare & Contrast",
    description: "Similarities and differences",
    prompt: "Identify concepts that can be compared and contrasted. Create cards that highlight similarities, differences, relationships, and distinctions between related ideas.",
  },
  {
    id: "mnemonics",
    icon: <Lightbulb className="w-4 h-4" />,
    label: "With Mnemonics",
    description: "Include memory aids",
    prompt: "Create flashcards and include memory aids, mnemonics, or associations where helpful. Make the cards memorable and easy to recall.",
  },
  {
    id: "theorems",
    icon: <BarChart3 className="w-4 h-4" />,
    label: "Theorems & Proofs",
    description: "Mathematical theorems and key steps",
    prompt: "Identify all theorems, lemmas, corollaries, and propositions in this content. For each: create a card with the theorem statement, and optionally cards for key proof steps or applications.",
  },
  {
    id: "formulas",
    icon: <Type className="w-4 h-4" />,
    label: "Formulas & Equations",
    description: "Key formulas with explanations",
    prompt: "Extract important formulas, equations, or mathematical expressions. Create cards that show the formula and test understanding of when and how to apply it.",
  },
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function normalizeCardType(value?: string): DraftCardType | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "qa" || normalized === "q&a" || normalized === "question" || normalized === "question-answer") {
    return "qa";
  }
  if (normalized === "cloze" || normalized === "cloze_deletion" || normalized === "cloze-deletion") {
    return "cloze";
  }
  return null;
}

function parseCardsFromResponse(content: string, sourceMessageId: string): { cards: DraftCard[]; cleaned: string } {
  const normalized = content.replace(/\r\n/g, "\n");

  const summaryText = (count: number) =>
    `Generated ${count} draft card${count === 1 ? "" : "s"} (see Draft Cards).`;

  const normalizeJsonLike = (raw: string): string => {
    let s = raw.trim();
    // Some models literally include a leading "json" line.
    s = s.replace(/^\s*json\s*\n/i, "");

    // Common mistake: returning `"cards": [...]` instead of `{ "cards": [...] }`
    if (/^\s*"cards"\s*:/.test(s)) s = `{${s}}`;

    // Allow trailing commas (JSON5-ish) by stripping them.
    s = s.replace(/,\s*([}\]])/g, "$1");

    return s.trim();
  };

  const extractBalancedObjects = (text: string): string[] => {
    // Extract top-level `{...}` objects from a JSON-ish stream. Useful when the model
    // returns a sequence of objects but forgets to wrap them in `[...]` or `{ cards: [...] }`.
    const out: string[] = [];
    let inString = false;
    let escaping = false;
    let depth = 0;
    let start = -1;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (escaping) {
        escaping = false;
        continue;
      }
      if (ch === "\\") {
        if (inString) escaping = true;
        continue;
      }
      if (ch === "\"") {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === "{") {
        if (depth === 0) start = i;
        depth++;
        continue;
      }
      if (ch === "}") {
        depth--;
        if (depth === 0 && start >= 0) {
          out.push(text.slice(start, i + 1));
          start = -1;
        }
      }
    }

    return out;
  };

  const extractBalancedJson = (text: string): string | null => {
    // Heuristic for models that forget to close fences or include extra text around JSON.
    // Extract the first balanced JSON object/array starting at the first "{" or "[".
    const start = Math.min(
      ...[text.indexOf("{"), text.indexOf("[")].filter((i) => i >= 0)
    );
    if (!Number.isFinite(start)) return null;

    let inString = false;
    let escaping = false;
    let depth = 0;
    let started = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escaping) {
        escaping = false;
        continue;
      }
      if (ch === "\\") {
        if (inString) escaping = true;
        continue;
      }
      if (ch === "\"") {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === "{" || ch === "[") {
        started = true;
        depth++;
      } else if (ch === "}" || ch === "]") {
        depth--;
        if (started && depth === 0) {
          const candidate = text.slice(start, i + 1).trim();
          return candidate;
        }
      }
    }
    return null;
  };

  const extractCardsArrayFromLooseKey = (text: string): string | null => {
    const m = /"cards"\s*:\s*\[/i.exec(text);
    if (!m || m.index === undefined) return null;
    const bracketIndex = text.indexOf("[", m.index);
    if (bracketIndex < 0) return null;
    const candidate = extractBalancedJson(text.slice(bracketIndex));
    if (!candidate || !candidate.startsWith("[")) return null;
    return candidate;
  };

  const cardsFromParsedList = (list: unknown[], sourceId: string): DraftCard[] => {
    const cards: DraftCard[] = [];
    list.forEach((entry: unknown) => {
      const e = entry as { type?: string; question?: string; answer?: string; text?: string };
      let type = normalizeCardType(e?.type);

      // If the model forgot "type", infer from fields.
      if (!type) {
        if (typeof e?.question === "string" && typeof e?.answer === "string") type = "qa";
        else if (typeof e?.text === "string") type = "cloze";
      }
      if (!type) return;

      const baseCard = {
        id: `draft-${sourceId}-${cards.length}`,
        type,
        selected: true,
        sourceMessageId: sourceId,
        createdAt: Date.now(),
        tags: [],
      };

      if (type === "qa") {
        const question = typeof e?.question === "string" ? e.question.trim() : "";
        const answer = typeof e?.answer === "string" ? e.answer.trim() : "";
        if (!question || !answer) return;
        cards.push({ ...baseCard, question, answer });
      } else {
        const text = typeof e?.text === "string" ? e.text.trim() : "";
        if (!text) return;
        cards.push({ ...baseCard, text });
      }
    });
    return cards;
  };

  const tryParseJsonishObjectStream = (text: string): DraftCard[] => {
    const objs = extractBalancedObjects(text);
    if (objs.length === 0) return [];

    const parsedObjects: unknown[] = [];
    for (const obj of objs) {
      const raw = normalizeJsonLike(obj);
      try {
        parsedObjects.push(JSON.parse(raw));
      } catch {
        // ignore
      }
    }
    if (parsedObjects.length === 0) return [];
    return cardsFromParsedList(parsedObjects, sourceMessageId);
  };

  const tryParseFromJson = (): { cards: DraftCard[]; cleaned: string } | null => {
    // Prefer explicit json fenced blocks, but accept generic fences too.
    const fences = [...normalized.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
    for (const m of fences) {
      const raw = normalizeJsonLike((m[1] ?? "").trim());
      if (!raw) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { cards?: unknown[] })?.cards)
        ? (parsed as { cards: unknown[] }).cards
        : [];
      if (!Array.isArray(list) || list.length === 0) continue;

      const cards = cardsFromParsedList(list, sourceMessageId);

      if (cards.length === 0) continue;
      const cleaned = normalized.replace(m[0], "").trim();
      return { cards, cleaned: cleaned || summaryText(cards.length) };
    }

    // Models sometimes start a fence but forget to close it.
    const fenceStart = normalized.match(/```(?:json)?\s*\n?/i);
    if (fenceStart?.index !== undefined) {
      const afterFence = normalized.slice(fenceStart.index + fenceStart[0].length).trim();
      const candidate =
        extractCardsArrayFromLooseKey(afterFence) ??
        extractBalancedJson(afterFence);
      if (candidate) {
        try {
          const parsed = JSON.parse(normalizeJsonLike(candidate)) as unknown;
          const list = Array.isArray(parsed)
            ? parsed
            : Array.isArray((parsed as { cards?: unknown[] })?.cards)
            ? (parsed as { cards: unknown[] }).cards
            : [];
          if (Array.isArray(list) && list.length > 0) {
            const rebuilt = `\`\`\`json\n${normalizeJsonLike(candidate)}\n\`\`\``;
            // Recurse through the normal path for consistent validation.
            return tryParseFromJsonFromSingleFence(rebuilt);
          }
        } catch {
          // ignore
        }
      }
    }

    // Finally: attempt to parse JSON even if there's no fence at all.
    const unfencedCandidate =
      extractCardsArrayFromLooseKey(normalized) ??
      extractBalancedJson(normalized);
    if (unfencedCandidate) {
      const rebuilt = `\`\`\`json\n${normalizeJsonLike(unfencedCandidate)}\n\`\`\``;
      return tryParseFromJsonFromSingleFence(rebuilt);
    }

    // If we couldn't parse a full JSON payload, try extracting per-card objects.
    const streamCards = tryParseJsonishObjectStream(normalized);
    if (streamCards.length > 0) {
      return { cards: streamCards, cleaned: summaryText(streamCards.length) };
    }

    return null;
  };

  const tryParseFromJsonFromSingleFence = (fenced: string): { cards: DraftCard[]; cleaned: string } | null => {
    const m = /```(?:json)?\s*([\s\S]*?)```/i.exec(fenced);
    if (!m) return null;
    const raw = normalizeJsonLike((m[1] ?? "").trim());
    if (!raw) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { cards?: unknown[] })?.cards)
      ? (parsed as { cards: unknown[] }).cards
      : [];
    if (!Array.isArray(list) || list.length === 0) return null;

    const cards = cardsFromParsedList(list, sourceMessageId);

    if (cards.length === 0) return null;
    return { cards, cleaned: summaryText(cards.length) };
  };

  const tryParseFromText = (): DraftCard[] => {
    const cards: DraftCard[] = [];

    const pushQa = (questionRaw: string, answerRaw: string) => {
      const question = questionRaw.trim();
      const answer = answerRaw.trim();
      if (!question || !answer) return;
      const id = `draft-${sourceMessageId}-${cards.length}`;
      cards.push({
        id,
        type: "qa",
        question,
        answer,
        selected: true,
        sourceMessageId,
        createdAt: Date.now(),
        tags: [],
      });
    };

    const pushCloze = (textRaw: string) => {
      const text = textRaw.trim();
      if (!text) return;
      const id = `draft-${sourceMessageId}-${cards.length}`;
      cards.push({
        id,
        type: "cloze",
        text,
        selected: true,
        sourceMessageId,
        createdAt: Date.now(),
        tags: [],
      });
    };

    // 1) Prefer explicit "Card N" sections (matches the UI screenshot output).
    const hasCardHeaders = /(?:^|\n)\s*Card\s+\d+\s*:?\s*(?:\n|$)/i.test(normalized);
    if (hasCardHeaders) {
      const parts = normalized.split(/(?:^|\n)\s*Card\s+\d+\s*:?\s*(?:\n|$)/i).slice(1);
      for (const part of parts) {
        const block = part.trim();
        if (!block) continue;

        const qMatch = block.match(/(?:^|\n)\s*(?:Q|Question|Front)\s*:\s*([\s\S]*?)(?=(?:\n\s*(?:A|Answer|Back)\s*:)|$)/i);
        const aMatch = block.match(/(?:^|\n)\s*(?:A|Answer|Back)\s*:\s*([\s\S]*?)(?=$)/i);
        if (qMatch?.[1] && aMatch?.[1]) {
          pushQa(qMatch[1], aMatch[1]);
          continue;
        }

        // If the model outputs a cloze line in a "Card N" section, stage it.
        if (block.includes("{{") && block.includes("}}")) {
          pushCloze(block);
        }
      }

      return cards;
    }

    // 2) Otherwise, try to parse repeated Q/A pairs anywhere in the message.
    const qaRegex = /(?:^|\n)\s*(?:Q|Question|Front)\s*:\s*([\s\S]*?)\n\s*(?:A|Answer|Back)\s*:\s*([\s\S]*?)(?=(?:\n\s*(?:Q|Question|Front)\s*:)|$)/gi;
    let m: RegExpExecArray | null;
    while ((m = qaRegex.exec(normalized)) !== null) {
      const q = m[1] ?? "";
      const a = m[2] ?? "";
      pushQa(q, a);
    }
    if (cards.length > 0) return cards;

    // 3) As a last resort, stage any obvious cloze strings.
    const clozeRegex = /(?:^|\n)\s*(?:Cloze\s*:)?\s*([^\n]*\{\{[^}]+\}\}[^\n]*)/gi;
    while ((m = clozeRegex.exec(normalized)) !== null) {
      const t = m[1] ?? "";
      if (t.includes("{{") && t.includes("}}")) pushCloze(t);
    }

    return cards;
  };

  const jsonResult = tryParseFromJson();
  if (jsonResult) return jsonResult;

  const textCards = tryParseFromText();
  if (textCards.length > 0) return { cards: textCards, cleaned: content };

  return { cards: [], cleaned: content };
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function highlightCloze(text: string): React.ReactElement {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\{\{([^}]+)\}\}$/);
        if (match) {
          const content = match[1].replace(/^c\d+::/, "");
          return (
            <span key={i} className="bg-primary/20 text-primary font-semibold px-1 rounded">
              {content}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function formatTokenCount(count: number): string {
  if (count < 1000) return `${count}`;
  return `${(count / 1000).toFixed(1)}k`;
}

function estimateCost(
  inputTokens: number, 
  outputTokens: number = 500,
  pricing?: { prompt?: number; completion?: number }
): string {
  if (!pricing) {
    // Fallback to default estimates
    const inputCost = (inputTokens / 1000) * COST_PER_1K_INPUT;
    const outputCost = (outputTokens / 1000) * COST_PER_1K_OUTPUT;
    const total = inputCost + outputCost;
    return total < 0.01 ? "< $0.01" : `~ $${total.toFixed(2)}`;
  }
  
  const inputCost = (inputTokens / 1000) * (pricing.prompt || 0);
  const outputCost = (outputTokens / 1000) * (pricing.completion || 0);
  const total = inputCost + outputCost;
  
  if (total === 0) return "Free";
  if (total < 0.001) return `< $0.001`;
  if (total < 0.01) return `~ $${total.toFixed(3)}`;
  return `~ $${total.toFixed(2)}`;
}

// Format price for display
function formatModelPrice(price?: number): string {
  if (price === undefined || price === null) return "N/A";
  if (price === 0) return "Free";
  if (price < 0.001) return `$${(price * 1000000).toFixed(0)} per 1M`;
  return `$${price.toFixed(4)}`;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function CostEstimator({ 
  inputText, 
  isVisible, 
  pricing 
}: { 
  inputText: string; 
  isVisible: boolean;
  pricing?: { prompt?: number; completion?: number };
}) {
  const tokens = useMemo(() => estimateTokens(inputText), [inputText]);
  const cost = useMemo(() => estimateCost(tokens, 500, pricing), [tokens, pricing]);
  
  if (!isVisible) return null;
  
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 rounded-lg text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <BarChart3 className="w-3.5 h-3.5" />
        <span>{formatTokenCount(tokens)} tokens</span>
      </div>
      <div className="w-px h-3 bg-border" />
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <DollarSign className="w-3.5 h-3.5" />
        <span>Est. cost: {cost}</span>
      </div>
      {pricing && (
        <div className="text-muted-foreground" title="Using model's actual pricing">
          ({formatModelPrice(pricing.prompt)} / {formatModelPrice(pricing.completion)} per 1K)
        </div>
      )}
      {tokens > 4000 && (
        <div className="flex items-center gap-1 text-amber-500">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Large context</span>
        </div>
      )}
    </div>
  );
}

function ContextControlPanel({
  document,
  selection,
  onChange,
  maxTokens,
}: {
  document: { id: string; title: string; content?: string } | null;
  selection: ContextSelection;
  onChange: (selection: ContextSelection) => void;
  maxTokens: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageStart, setPageStart] = useState("");
  const [pageEnd, setPageEnd] = useState("");
  const [excerptText, setExcerptText] = useState("");
  
  const chapters = useMemo(() => {
    if (!document?.content) return [];
    return getChapterTitles(document.content);
  }, [document]);
  const selectedChapters = Array.isArray(selection.chapters) ? selection.chapters : [];
  
  const estimatedTokens = useMemo(() => {
    let text = "";
    if (!document?.content) return 0;
    
    switch (selection.mode) {
      case "full":
        text = document.content;
        break;
      case "chapters":
        text = selectedChapters
          .map((num) => buildChapterQAContext(document.title, document.content, num, Math.floor(maxTokens / Math.max(1, selectedChapters.length))))
          .join("\n\n");
        break;
      case "excerpt":
        text = selection.excerpt;
        break;
      default:
        text = document.content.slice(0, maxTokens * CHARS_PER_TOKEN);
    }
    return estimateTokens(text);
  }, [document, selection, maxTokens]);
  
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim() || !document?.content) return;
    
    const query = searchQuery.toLowerCase();
    const content = document.content;
    const results: Array<{ start: number; end: number; preview: string }> = [];
    
    // Simple search: find all occurrences and extract surrounding context
    let index = content.toLowerCase().indexOf(query);
    while (index !== -1) {
      const start = Math.max(0, index - 100);
      const end = Math.min(content.length, index + query.length + 100);
      results.push({
        start,
        end,
        preview: content.slice(start, end),
      });
      index = content.toLowerCase().indexOf(query, index + 1);
    }
    
    onChange({ ...selection, searchResults: results.slice(0, 5) });
  }, [searchQuery, document, selection, onChange]);
  
  if (!document) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-600">
        <AlertCircle className="w-3.5 h-3.5" />
        <span>Select a document to enable granular context control</span>
      </div>
    );
  }
  
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Scissors className="w-4 h-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-foreground">Context Control</div>
            <div className="text-xs text-muted-foreground">
              {selection.mode === "full" && "Using full document"}
              {selection.mode === "chapters" && `${selectedChapters.length} chapter(s) selected`}
              {selection.mode === "pages" && "Page range selected"}
              {selection.mode === "excerpt" && "Custom excerpt"}
              {selection.mode === "search" && "Search results"}
              {" · "}
              {formatTokenCount(estimatedTokens)} tokens
            </div>
          </div>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
      </button>
      
      {isExpanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {/* Mode Selection */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: "full", label: "Full Document", icon: FileText },
              { id: "chapters", label: "Chapters", icon: BookOpen },
              { id: "pages", label: "Page Range", icon: ScrollText },
              { id: "excerpt", label: "Excerpt", icon: Highlighter },
              { id: "search", label: "Search", icon: Search },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => onChange({ ...selection, mode: mode.id as ContextMode })}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  selection.mode === mode.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <mode.icon className="w-3.5 h-3.5" />
                {mode.label}
              </button>
            ))}
          </div>
          
          {/* Chapter Selection */}
          {selection.mode === "chapters" && chapters.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Select chapters:</div>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                {chapters.map((chapter) => (
                  <label
                    key={chapter.number}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedChapters.includes(chapter.number)}
                      onChange={() => {
                        const newChapters = selectedChapters.includes(chapter.number)
                          ? selectedChapters.filter((c) => c !== chapter.number)
                          : [...selectedChapters, chapter.number];
                        onChange({ ...selection, chapters: newChapters });
                      }}
                      className="rounded"
                    />
                    <span className="text-xs text-muted-foreground w-16">Chapter {chapter.number}</span>
                    <span className="text-sm text-foreground truncate">{chapter.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          {/* Page Range */}
          {selection.mode === "pages" && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Enter page range:</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={pageStart}
                  onChange={(e) => setPageStart(e.target.value)}
                  placeholder="Start"
                  className="w-24 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="number"
                  value={pageEnd}
                  onChange={(e) => setPageEnd(e.target.value)}
                  placeholder="End"
                  className="w-24 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                />
                <button
                  onClick={() => {
                    const start = parseInt(pageStart);
                    const end = parseInt(pageEnd);
                    if (!isNaN(start) && !isNaN(end)) {
                      onChange({ ...selection, pageRange: { start, end } });
                    }
                  }}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                >
                  Apply
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Note: Page numbers are approximate based on document structure
              </p>
            </div>
          )}
          
          {/* Excerpt */}
          {selection.mode === "excerpt" && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Paste or type the excerpt:</div>
              <textarea
                value={excerptText}
                onChange={(e) => setExcerptText(e.target.value)}
                placeholder="Paste the text you want to use as context..."
                rows={5}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {formatTokenCount(estimateTokens(excerptText))} tokens
                </span>
                <button
                  onClick={() => {
                    onChange({ ...selection, excerpt: excerptText });
                    setExcerptText("");
                  }}
                  disabled={!excerptText.trim()}
                  className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  Use Excerpt
                </button>
              </div>
            </div>
          )}
          
          {/* Search */}
          {selection.mode === "search" && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Search within document:</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search for theorems, terms, etc..."
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
              
              {selection.searchResults.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto border border-border rounded-lg p-2">
                  {selection.searchResults.map((result, i) => (
                    <button
                      key={i}
                      onClick={() => onChange({ ...selection, excerpt: result.preview })}
                      className="w-full text-left p-2 rounded-md hover:bg-muted/50 text-xs"
                    >
                      <span className="text-muted-foreground">...{result.preview}...</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Token Estimation */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground">
              Estimated: <span className="font-medium text-foreground">{formatTokenCount(estimatedTokens)}</span> tokens
              {selection.mode !== "full" && (
                <span className="text-green-600 ml-2">
                  (saves {formatTokenCount(estimateTokens(document.content) - estimatedTokens)} tokens)
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Max: {formatTokenCount(maxTokens)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CardPreview({
  card,
  isFlipped,
  onFlip,
  isEditing,
  onEdit,
  onSaveEdit,
}: {
  card: DraftCard;
  isFlipped: boolean;
  onFlip: () => void;
  isEditing: boolean;
  onEdit: () => void;
  onSaveEdit: (updates: Partial<DraftCard>) => void;
}) {
  const [editForm, setEditForm] = useState({
    question: card.question || "",
    answer: card.answer || "",
    text: card.text || "",
  });

  if (isEditing) {
    return (
      <div className="space-y-3 p-3">
        {card.type === "qa" ? (
          <>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Question</label>
              <textarea
                value={editForm.question}
                onChange={(e) => setEditForm((f) => ({ ...f, question: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Answer</label>
              <textarea
                value={editForm.answer}
                onChange={(e) => setEditForm((f) => ({ ...f, answer: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={3}
              />
            </div>
          </>
        ) : (
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cloze Text (use {'{{'}...{'}}'} for deletions)</label>
            <textarea
              value={editForm.text}
              onChange={(e) => setEditForm((f) => ({ ...f, text: e.target.value }))}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={4}
            />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onSaveEdit({})}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={() => onSaveEdit(editForm)}
            className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:opacity-90"
          >
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onFlip}
      className="cursor-pointer group perspective-1000"
    >
      <div
        className={cn(
          "relative min-h-[100px] rounded-xl border bg-card p-4 transition-all duration-300",
          "hover:border-primary/30 hover:shadow-md",
          isFlipped && card.type === "qa" ? "ring-2 ring-primary/20" : "border-border"
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1">
            {card.type === "qa" ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">
                  {isFlipped ? "Answer:" : "Question:"}
                </div>
                <div className="text-sm text-foreground/90 leading-relaxed">
                  {isFlipped
                    ? card.answer
                    : card.question}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {isFlipped ? "Click to see question" : "Click to reveal answer"}
                </div>
              </div>
            ) : (
              <div className="text-sm text-foreground/90 leading-relaxed">
                {highlightCloze(card.text || "")}
              </div>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-muted transition-opacity"
          >
            <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  onClick,
}: {
  template: QuickTemplate;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
    >
      <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        {template.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-foreground">{template.label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{template.description}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function DocumentSelector({
  documents,
  selectedId,
  onSelect,
}: {
  documents: { id: string; title: string; content?: string }[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDoc = documents.find((d) => d.id === selectedId);

  const filteredDocs = documents.filter((d) =>
    d.title.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all",
          selectedId
            ? "border-primary/30 bg-primary/5 text-foreground"
            : "border-border bg-background text-muted-foreground hover:text-foreground"
        )}
      >
        <FileText className="w-4 h-4" />
        <span className="max-w-[150px] truncate">
          {selectedDoc?.title || t("flashcardStudio.selectDocument")}
        </span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-muted/50 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <button
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
              }}
              className={cn(
                "w-full px-4 py-2.5 text-sm text-left transition-colors",
                !selectedId ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
              )}
            >
              <span className="flex items-center gap-2">
                <X className="w-4 h-4" />
                No document (general knowledge)
              </span>
            </button>
            {filteredDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => {
                  onSelect(doc.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full px-4 py-2.5 text-sm text-left transition-colors",
                  selectedId === doc.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                )}
              >
                <div className="font-medium truncate">{doc.title}</div>
              </button>
            ))}
            {filteredDocs.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No documents found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DeckSelector({
  decks,
  selectedId,
  onSelect,
}: {
  decks: { id: string; name: string; tagFilters: string[] }[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedDeck = decks.find((d) => d.id === selectedId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all",
          selectedId
            ? "border-primary/30 bg-primary/5 text-foreground"
            : "border-border bg-background text-muted-foreground hover:text-foreground"
        )}
      >
        <FolderOpen className="w-4 h-4" />
        <span className="max-w-[120px] truncate">
          {selectedDeck?.name || "Select deck..."}
        </span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            <button
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
              }}
              className={cn(
                "w-full px-4 py-2.5 text-sm text-left transition-colors",
                !selectedId ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
              )}
            >
              <span className="flex items-center gap-2">
                <X className="w-4 h-4" />
                No deck
              </span>
            </button>
            {decks.map((deck) => (
              <button
                key={deck.id}
                onClick={() => {
                  onSelect(deck.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full px-4 py-2.5 text-sm text-left transition-colors",
                  selectedId === deck.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                )}
              >
                <div className="font-medium">{deck.name}</div>
                {deck.tagFilters.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {deck.tagFilters.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-muted rounded-full">
                        {tag}
                      </span>
                    ))}
                    {deck.tagFilters.length > 3 && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded-full">
                        +{deck.tagFilters.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function FlashcardStudioModal({ isOpen, onClose }: FlashcardStudioModalProps) {
  const { t } = useI18n();
  const toast = useToast();
  const { documents, loadDocuments } = useDocumentStore();
  const { decks, activeDeckId } = useStudyDeckStore();
  const providers = useLLMProvidersStore((state) => state.providers);
  const enabledProviders = useMemo(() => providers.filter((p) => p.enabled), [providers]);
  const maxTokens = useSettingsStore((state) => state.settings.ai.maxTokens) || 4000;
  const preferredProviderType = useSettingsStore((state) => state.settings.ai.provider);
  const notebookLmEnabled = useSettingsStore((state) => state.settings.features.notebooklmEnabled);

  // State
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string>("");
  const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
  const [isNotebookLoading, setIsNotebookLoading] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [resolvedDocumentContent, setResolvedDocumentContent] = useState<string | undefined>(undefined);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [draftCards, setDraftCards] = useState<DraftCard[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [flippedCardId, setFlippedCardId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [generationHistory, setGenerationHistory] = useState<GenerationHistoryItem[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [isTagInputVisible, setIsTagInputVisible] = useState(false);
  const [contextSelection, setContextSelection] = useState<ContextSelection>(DEFAULT_CONTEXT_SELECTION);
  const [imageAssets, setImageAssets] = useState<ImageAsset[]>([]);
  const [selectedImageAssetIds, setSelectedImageAssetIds] = useState<string[]>([]);
  const [isImageImporting, setIsImageImporting] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draftCardsContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  // Initialize provider
  useEffect(() => {
    if (!isOpen) return;
    if (selectedProviderId) return;
    if (enabledProviders.length > 0) {
      const preferred = enabledProviders.find((p) => p.provider === preferredProviderType);
      setSelectedProviderId(preferred?.id ?? enabledProviders[0].id);
      return;
    }
    if (notebookLmEnabled) {
      setSelectedProviderId(NOTEBOOKLM_PROVIDER_ID);
    }
  }, [isOpen, enabledProviders, selectedProviderId, preferredProviderType, notebookLmEnabled]);

  useEffect(() => {
    if (!isOpen || !notebookLmEnabled) return;
    const loadNotebookState = async () => {
      setIsNotebookLoading(true);
      try {
        const [settings, listed] = await Promise.all([notebooklmGetSettings(), notebooklmListNotebooks()]);
        setNotebooks(listed);
        const activeId = settings.activeNotebookId || listed[0]?.id || "";
        if (activeId) {
          setSelectedNotebookId(activeId);
        }
      } catch (error) {
        console.error("Failed to load NotebookLM state", error);
      } finally {
        setIsNotebookLoading(false);
      }
    };
    void loadNotebookState();
  }, [isOpen, notebookLmEnabled]);

  useEffect(() => {
    if (!notebookLmEnabled && selectedProviderId === NOTEBOOKLM_PROVIDER_ID) {
      setSelectedProviderId(enabledProviders[0]?.id ?? null);
    }
  }, [notebookLmEnabled, selectedProviderId, enabledProviders]);

  // Load documents
  useEffect(() => {
    if (!isOpen) return;
    if (documents.length === 0) {
      void loadDocuments();
    }
  }, [isOpen, documents.length, loadDocuments]);

  useEffect(() => {
    if (!isOpen) return;

    const loadImageAssets = async () => {
      try {
        const assets = await listImageAssets();
        setImageAssets(Array.isArray(assets) ? assets : []);
      } catch (error) {
        console.error("Failed to load image registry assets", error);
      }
    };

    void loadImageAssets();
  }, [isOpen]);

  // Load saved state
  useEffect(() => {
    if (!isOpen) return;
    
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.messages)) setMessages(parsed.messages);
        if (Array.isArray(parsed?.draftCards)) setDraftCards(parsed.draftCards);
        if (typeof parsed?.selectedProviderId === "string") setSelectedProviderId(parsed.selectedProviderId);
        if (typeof parsed?.selectedNotebookId === "string") setSelectedNotebookId(parsed.selectedNotebookId);
        if (typeof parsed?.selectedDocumentId === "string") setSelectedDocumentId(parsed.selectedDocumentId);
        if (typeof parsed?.selectedDeckId === "string") setSelectedDeckId(parsed.selectedDeckId);
        else if (activeDeckId) setSelectedDeckId(activeDeckId);
        if (parsed?.contextSelection) setContextSelection(normalizeContextSelection(parsed.contextSelection));
      } catch (error) {
        console.warn("Failed to restore state", error);
        setSelectedDeckId(activeDeckId ?? null);
      }
    } else {
      setSelectedDeckId(activeDeckId ?? null);
    }

    const historyRaw = localStorage.getItem(HISTORY_KEY);
    if (historyRaw) {
      try {
        const parsed = JSON.parse(historyRaw);
        if (Array.isArray(parsed)) setGenerationHistory(parsed.slice(0, 20));
      } catch {
        // ignore
      }
    }
  }, [isOpen, activeDeckId]);

  // Save state
  useEffect(() => {
    if (!isOpen) return;
    const payload = {
      selectedProviderId,
      selectedNotebookId,
      selectedDocumentId,
      selectedDeckId,
      contextSelection,
      messages: messages.slice(-50),
      draftCards: draftCards.slice(0, 100),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [isOpen, selectedProviderId, selectedNotebookId, selectedDocumentId, selectedDeckId, contextSelection, messages, draftCards]);

  // Auto-scroll messages within the container only
  useEffect(() => {
    if (!isOpen) return;
    // Use requestAnimationFrame to ensure DOM is updated before scrolling
    requestAnimationFrame(() => {
      if (messagesContainerRef.current && messagesEndRef.current && shouldAutoScrollRef.current) {
        const container = messagesContainerRef.current;
        // Use scrollHeight; offsetTop math is brittle in nested/fixed layouts.
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }
    });
  }, [messages, isOpen]);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // If the user scrolls up, don't yank them back to the bottom.
    shouldAutoScrollRef.current = distanceToBottom < 80;
  }, []);

  // Auto-scroll draft cards to top when new cards are added (they're prepended)
  useEffect(() => {
    if (!isOpen || draftCards.length === 0) return;
    requestAnimationFrame(() => {
      if (draftCardsContainerRef.current) {
        draftCardsContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }, [draftCards.length, isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.metaKey && !e.ctrlKey) {
        if (editingCardId) {
          setEditingCardId(null);
        } else if (viewMode !== "chat") {
          setViewMode("chat");
        } else {
          onClose();
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (input.trim() && !isSending) {
          void handleSend();
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        const selected = draftCards.filter((c) => c.selected);
        if (selected.length > 0 && !isSaving) {
          void handleSaveSelected();
        }
      }

      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        const activeElement = document.activeElement;
        if (activeElement?.tagName !== "INPUT" && activeElement?.tagName !== "TEXTAREA") {
          setShowShortcuts(true);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, input, isSending, isSaving, draftCards, editingCardId, viewMode, onClose]);

  const currentProvider = useMemo(() => {
    if (!selectedProviderId) return null;
    return enabledProviders.find((p) => p.id === selectedProviderId) || null;
  }, [enabledProviders, selectedProviderId]);
  const isNotebookProviderSelected = selectedProviderId === NOTEBOOKLM_PROVIDER_ID;

  // Get pricing for current provider's selected model
  const currentModelPricing = useMemo(() => {
    if (!currentProvider?.model || !currentProvider?.modelPricing) return undefined;
    const modelInfo = currentProvider.modelPricing[currentProvider.model];
    return modelInfo?.pricing;
  }, [currentProvider]);

  const selectedDocument = useMemo(() => {
    if (!selectedDocumentId) return null;
    return documents.find((d) => d.id === selectedDocumentId) || null;
  }, [documents, selectedDocumentId]);
  const selectedDocumentText = useMemo(() => {
    if (typeof resolvedDocumentContent === "string" && resolvedDocumentContent.trim().length > 0) {
      return resolvedDocumentContent;
    }
    return selectedDocument?.content;
  }, [resolvedDocumentContent, selectedDocument?.content]);

  useEffect(() => {
    if (!isOpen || !selectedDocument) {
      setResolvedDocumentContent(undefined);
      return;
    }

    // If extracted content is already available, prefer it immediately.
    if (selectedDocument.content?.trim()) {
      setResolvedDocumentContent(selectedDocument.content);
      return;
    }

    let cancelled = false;
    const resolveMediaTranscript = async () => {
      try {
        if (selectedDocument.fileType === "video" || selectedDocument.fileType === "audio") {
          const transcript = await getVideoTranscript(selectedDocument.id);
          if (!cancelled) {
            setResolvedDocumentContent(transcript?.transcript?.trim() || undefined);
          }
          return;
        }

        if (selectedDocument.fileType === "youtube") {
          const videoId = extractYouTubeID(selectedDocument.filePath);
          if (!videoId) {
            if (!cancelled) setResolvedDocumentContent(undefined);
            return;
          }
          const segments = await fetchYouTubeTranscript(videoId);
          if (!cancelled) {
            const transcript = segments.map((segment) => segment.text).join(" ").trim();
            setResolvedDocumentContent(transcript || undefined);
          }
          return;
        }

        if (!cancelled) {
          setResolvedDocumentContent(undefined);
        }
      } catch (error) {
        console.warn("Failed to resolve transcript content for flashcard context", error);
        if (!cancelled) {
          setResolvedDocumentContent(undefined);
        }
      }
    };

    void resolveMediaTranscript();
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedDocument]);

  const selectedDeck = useMemo(() => {
    if (!selectedDeckId) return null;
    return decks.find((d) => d.id === selectedDeckId) || null;
  }, [decks, selectedDeckId]);

  const deckTags = useMemo(() => {
    if (!selectedDeck) return [];
    return selectedDeck.tagFilters.length > 0 ? selectedDeck.tagFilters : [selectedDeck.name];
  }, [selectedDeck]);

  // Build context content based on selection
  const contextContent = useMemo(() => {
    if (!selectedDocumentText) return undefined;
    const selectedChapters = Array.isArray(contextSelection.chapters) ? contextSelection.chapters : [];
    
    switch (contextSelection.mode) {
      case "full":
        return selectedDocumentText.slice(0, maxTokens * CHARS_PER_TOKEN);
      
      case "chapters": {
        if (selectedChapters.length === 0) {
          return selectedDocumentText.slice(0, maxTokens * CHARS_PER_TOKEN);
        }
        const perChapterTokens = Math.floor(maxTokens / selectedChapters.length);
        return selectedChapters
          .map((num) => buildChapterQAContext(selectedDocument.title, selectedDocumentText, num, perChapterTokens))
          .join("\n\n---\n\n");
      }
      
      case "excerpt":
        return contextSelection.excerpt || selectedDocumentText.slice(0, maxTokens * CHARS_PER_TOKEN);
      
      case "pages":
        // Approximate: assume 500 words per page, 4 chars per word
        if (contextSelection.pageRange) {
          const charsPerPage = 2000;
          const start = (contextSelection.pageRange.start - 1) * charsPerPage;
          const end = contextSelection.pageRange.end * charsPerPage;
          return selectedDocumentText.slice(start, end);
        }
        return selectedDocumentText.slice(0, maxTokens * CHARS_PER_TOKEN);
      
      case "search":
        return contextSelection.excerpt || selectedDocumentText.slice(0, maxTokens * CHARS_PER_TOKEN);
      
      default:
        return selectedDocumentText.slice(0, maxTokens * CHARS_PER_TOKEN);
    }
  }, [selectedDocument, selectedDocumentText, contextSelection, maxTokens]);

  const stats = useMemo(() => {
    const selected = draftCards.filter((c) => c.selected);
    return {
      total: draftCards.length,
      selected: selected.length,
      qa: selected.filter((c) => c.type === "qa").length,
      cloze: selected.filter((c) => c.type === "cloze").length,
    };
  }, [draftCards]);

  const handleSend = async (customPrompt?: string) => {
    const promptText = customPrompt || input;
    if (!promptText.trim() || isSending) return;
    if (!isNotebookProviderSelected && !currentProvider) {
      toast.error("No LLM provider configured", "Add or enable a provider in Settings → AI Providers.");
      return;
    }
    if (isNotebookProviderSelected && !selectedNotebookId) {
      toast.error("No NotebookLM notebook selected", "Choose a NotebookLM notebook in the provider bar.");
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: promptText.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);
    setViewMode("chat");

    try {
      if (isNotebookProviderSelected) {
        const notebookTitle = notebooks.find((n) => n.id === selectedNotebookId)?.title || "NotebookLM";
        const contextBlocks: string[] = [promptText.trim()];
        if (selectedDocument?.title) {
          contextBlocks.push(`Document title: ${selectedDocument.title}`);
        }
        if (selectedDeck?.name) {
          contextBlocks.push(`Target deck: ${selectedDeck.name}`);
        }
        if (contextContent?.trim()) {
          contextBlocks.push(`Reference context:\n${contextContent.trim()}`);
        }

        const job = await notebooklmGenerateArtifact({
          notebookId: selectedNotebookId,
          artifactType: "flashcards",
          instructions: contextBlocks.join("\n\n"),
        });
        if (job.status === "failed" || job.status === "expired-auth") {
          throw new Error(job.error || `NotebookLM job failed with status ${job.status}`);
        }

        const previewItems = await notebooklmPreviewFlashcards(job.id);
        const generated = previewItems.map((item, index) => ({
          id: `notebooklm-${job.id}-${index}-${Date.now()}`,
          type: "qa" as const,
          question: item.question,
          answer: item.answer,
          selected: true,
          sourceMessageId: job.id,
          createdAt: Date.now(),
          tags: item.tags || [],
        }));
        const payloadFallback = job.payload.flashcards.map((card, index) => ({
          id: `notebooklm-${job.id}-payload-${index}-${Date.now()}`,
          type: "qa" as const,
          question: card.question,
          answer: card.answer,
          selected: true,
          sourceMessageId: job.id,
          createdAt: Date.now(),
          tags: card.tags || [],
        }));
        const cards = generated.length > 0 ? generated : payloadFallback;

        const assistantId = `assistant-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content:
              cards.length > 0
                ? `NotebookLM generated ${cards.length} flashcards from "${notebookTitle}".`
                : `NotebookLM completed the request for "${notebookTitle}", but no flashcards were returned.`,
            timestamp: Date.now(),
            cardsGenerated: cards.length,
          },
        ]);

        if (cards.length > 0) {
          setDraftCards((prev) => [...cards, ...prev]);
          toast.success(`${cards.length} cards generated`, "Review and save the cards you want to keep.");
          const historyItem: GenerationHistoryItem = {
            id: assistantId,
            prompt: promptText.trim(),
            timestamp: Date.now(),
            cardCount: cards.length,
            documentName: selectedDocument?.title,
          };
          setGenerationHistory((prev) => [historyItem, ...prev.slice(0, 19)]);
          localStorage.setItem(HISTORY_KEY, JSON.stringify([historyItem, ...generationHistory.slice(0, 19)]));
        }
        return;
      }

      const history: LLMMessage[] = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const llmMessages: LLMMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
      
      // Add context-specific system messages
      if (selectedDocument?.title) {
        let contextDesc = `Use the document titled "${selectedDocument.title}"`;
        const selectedChapters = Array.isArray(contextSelection.chapters) ? contextSelection.chapters : [];
        
        if (contextSelection.mode === "chapters" && selectedChapters.length > 0) {
          const chapters = getChapterTitles(selectedDocumentText || "");
          const chapterNames = selectedChapters
            .map((num) => chapters.find((c) => c.number === num)?.title || `Chapter ${num}`)
            .join(", ");
          contextDesc += `, focusing on: ${chapterNames}`;
        } else if (contextSelection.mode === "pages" && contextSelection.pageRange) {
          contextDesc += `, pages ${contextSelection.pageRange.start}-${contextSelection.pageRange.end}`;
        } else if (contextSelection.mode === "excerpt") {
          contextDesc += `, specifically the selected excerpt`;
        } else if (contextSelection.mode === "search") {
          contextDesc += `, focusing on search results`;
        }
        
        llmMessages.push({ role: "system", content: contextDesc });
      }
      
      if (selectedDeck) {
        llmMessages.push({
          role: "system",
          content: `Create cards suitable for the "${selectedDeck.name}" deck.`,
        });
      }
      
      llmMessages.push(...history, { role: "user", content: userMessage.content });

      const response = await chatWithContext(
        currentProvider.provider,
        currentProvider.model,
        llmMessages,
        {
          type: selectedDocument ? "document" : "general",
          documentId: selectedDocument?.id,
          content: contextContent,
          contextWindowTokens: maxTokens,
        },
        currentProvider.apiKey,
        currentProvider.baseUrl?.trim() || undefined
      );

      const assistantId = `assistant-${Date.now()}`;
      const { cards, cleaned } = parseCardsFromResponse(response.content, assistantId);
      
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: cleaned || response.content,
        timestamp: Date.now(),
        cardsGenerated: cards.length,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      if (cards.length > 0) {
        setDraftCards((prev) => [...cards, ...prev]);
        toast.success(`${cards.length} cards generated`, "Review and save the cards you want to keep.");
        
        const historyItem: GenerationHistoryItem = {
          id: assistantId,
          prompt: promptText.trim(),
          timestamp: Date.now(),
          cardCount: cards.length,
          documentName: selectedDocument?.title,
        };
        setGenerationHistory((prev) => [historyItem, ...prev.slice(0, 19)]);
        localStorage.setItem(HISTORY_KEY, JSON.stringify([historyItem, ...generationHistory.slice(0, 19)]));
      }
    } catch (error) {
      toast.error("Generation failed", error instanceof Error ? error.message : "Failed to reach the LLM");
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "system",
          content: `Error: ${error instanceof Error ? error.message : "Failed to reach the LLM"}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveSelected = async () => {
    const selected = draftCards.filter((c) => c.selected);
    if (selected.length === 0 || isSaving) return;
    setIsSaving(true);

    const results = await Promise.all(
      selected.map(async (card) => {
        try {
          const baseArgs: Record<string, unknown> = {};
          if (selectedDocument?.id) baseArgs.document_id = selectedDocument.id;
          if (deckTags.length > 0) baseArgs.tags = [...deckTags, ...card.tags];
          if (selectedImageAssetIds.length > 0) baseArgs.image_asset_ids = selectedImageAssetIds;

          if (card.type === "qa") {
            await callIncrementumMCPTool("create_qa_card", {
              ...baseArgs,
              question: card.question,
              answer: card.answer,
            });
          } else {
            await callIncrementumMCPTool("create_cloze_card", {
              ...baseArgs,
              text: card.text,
            });
          }
          return { id: card.id, success: true };
        } catch (error) {
          console.error("Failed to create card", error);
          return { id: card.id, success: false };
        }
      })
    );

    const failedIds = results.filter((r) => !r.success).map((r) => r.id);
    const savedCount = selected.length - failedIds.length;
    
    setDraftCards((prev) => prev.filter((c) => failedIds.includes(c.id)));
    
    if (failedIds.length > 0) {
      toast.error("Some cards failed to save", `${savedCount} saved, ${failedIds.length} failed.`);
    } else {
      toast.success("Cards saved!", `${savedCount} card${savedCount === 1 ? "" : "s"} added to your collection.`);
    }
    setIsSaving(false);
  };

  const handleImportImageClick = () => {
    imageFileInputRef.current?.click();
  };

  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsImageImporting(true);
    try {
      const imported = await Promise.all(Array.from(files).map((file) => ingestImageFile(file)));
      setImageAssets((prev) => {
        const merged = [...imported, ...prev];
        const dedup = new Map(merged.map((asset) => [asset.id, asset]));
        return Array.from(dedup.values());
      });
      const importedIds = imported.map((asset) => asset.id);
      setSelectedImageAssetIds((prev) => Array.from(new Set([...prev, ...importedIds])));
      toast.success("Images imported", `${imported.length} image${imported.length === 1 ? "" : "s"} added to registry.`);
    } catch (error) {
      toast.error("Image import failed", error instanceof Error ? error.message : "Unable to import image.");
    } finally {
      setIsImageImporting(false);
      event.target.value = "";
    }
  };

  const handlePasteImage = async () => {
    setIsImageImporting(true);
    try {
      if (!navigator.clipboard?.read) {
        throw new Error("Clipboard image read is not available in this environment.");
      }
      const clipboardItems = await navigator.clipboard.read();
      const imageBlobPromises: Promise<Blob>[] = [];

      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType) {
          imageBlobPromises.push(item.getType(imageType));
        }
      }

      if (imageBlobPromises.length === 0) {
        throw new Error("Clipboard does not contain an image.");
      }

      const blobs = await Promise.all(imageBlobPromises);
      const imported = await Promise.all(
        blobs.map((blob, index) => ingestImageBlob(blob, `clipboard-image-${Date.now()}-${index}.png`))
      );

      setImageAssets((prev) => {
        const merged = [...imported, ...prev];
        const dedup = new Map(merged.map((asset) => [asset.id, asset]));
        return Array.from(dedup.values());
      });
      const importedIds = imported.map((asset) => asset.id);
      setSelectedImageAssetIds((prev) => Array.from(new Set([...prev, ...importedIds])));
      toast.success("Image pasted", `${imported.length} image${imported.length === 1 ? "" : "s"} added from clipboard.`);
    } catch (error) {
      toast.error("Paste failed", error instanceof Error ? error.message : "Unable to paste clipboard image.");
    } finally {
      setIsImageImporting(false);
    }
  };

  const toggleSelectedImageAsset = (assetId: string) => {
    setSelectedImageAssetIds((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId]
    );
  };

  const handleDeleteSelectedImages = async () => {
    if (selectedImageAssetIds.length === 0) return;
    setIsImageImporting(true);
    try {
      const results = await Promise.all(selectedImageAssetIds.map((id) => deleteImageAsset(id)));
      const deletedIds = selectedImageAssetIds.filter((_, index) => results[index]?.deleted);
      const blockedReasons = results
        .filter((result) => !result.deleted && result.reason)
        .map((result) => result.reason)
        .filter((reason, index, arr) => reason && arr.indexOf(reason) === index);

      if (deletedIds.length > 0) {
        setImageAssets((prev) => prev.filter((asset) => !deletedIds.includes(asset.id)));
      }

      if (blockedReasons.length > 0) {
        toast.warning("Some images could not be deleted", blockedReasons.join(" "));
      }
      if (deletedIds.length > 0) {
        toast.success("Images deleted", `${deletedIds.length} image${deletedIds.length === 1 ? "" : "s"} removed from registry.`);
      }

      setSelectedImageAssetIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
    } catch (error) {
      toast.error("Delete failed", error instanceof Error ? error.message : "Unable to delete selected images.");
    } finally {
      setIsImageImporting(false);
    }
  };

  const handleTemplateSelect = (template: QuickTemplate) => {
    setInput(template.prompt);
    inputRef.current?.focus();
    setViewMode("chat");
    
    if (!selectedDocument) {
      toast.info("Select a document first", "Choose a document to apply this template.");
    }
  };

  const toggleSelectAll = (value: boolean) => {
    setDraftCards((prev) => prev.map((c) => ({ ...c, selected: value })));
  };

  const handleAddTagToSelected = () => {
    if (!bulkTagInput.trim()) return;
    const tags = bulkTagInput.split(",").map((t) => t.trim()).filter(Boolean);
    setDraftCards((prev) =>
      prev.map((c) =>
        c.selected ? { ...c, tags: [...new Set([...c.tags, ...tags])] } : c
      )
    );
    setBulkTagInput("");
    setIsTagInputVisible(false);
    toast.success("Tags added", `Added ${tags.length} tag${tags.length === 1 ? "" : "s"} to selected cards.`);
  };

  const handleDeleteSelected = () => {
    setDraftCards((prev) => prev.filter((c) => !c.selected));
    toast.success("Cards removed", "Selected cards have been discarded.");
  };

  const handleEditCard = (cardId: string, updates: Partial<DraftCard>) => {
    if (Object.keys(updates).length === 0) {
      setEditingCardId(null);
      return;
    }
    setDraftCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, ...updates, isEditing: false } : c))
    );
    setEditingCardId(null);
    toast.success("Card updated", "Your changes have been saved.");
  };

  const duplicateCard = (card: DraftCard) => {
    const newCard: DraftCard = {
      ...card,
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
      selected: true,
    };
    setDraftCards((prev) => [newCard, ...prev]);
    toast.success("Card duplicated", "A copy has been added to your drafts.");
  };

  const handleInputKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (input.trim() && !isSending) {
        void handleSend();
      }
    }
  };

  const handleNotebookSelect = async (id: string) => {
    setSelectedNotebookId(id);
    if (!id) return;
    try {
      await notebooklmSelectNotebook(id);
    } catch (error) {
      toast.error("Notebook selection failed", error instanceof Error ? error.message : "Unable to select notebook.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="flex h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border bg-gradient-to-r from-muted/50 to-muted/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-primary to-primary-600 p-2.5 text-primary-foreground shadow-lg shadow-primary/25">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("flashcardStudio.title")}</h2>
              <p className="text-xs text-muted-foreground">
                {t("flashcardStudio.subtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Tabs */}
            <div className="flex items-center rounded-lg border border-border bg-background p-1">
              <button
                onClick={() => setViewMode("chat")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  viewMode === "chat" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                {t("flashcardStudio.chat")}
              </button>
              <button
                onClick={() => setViewMode("templates")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  viewMode === "templates" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                {t("flashcardStudio.templates")}
              </button>
              <button
                onClick={() => setViewMode("history")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  viewMode === "history" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <History className="w-3.5 h-3.5" />
                {t("flashcardStudio.history")}
                {generationHistory.length > 0 && (
                  <span className="ml-0.5 text-[10px] bg-primary-foreground/20 px-1 rounded-full">
                    {generationHistory.length}
                  </span>
                )}
              </button>
            </div>

            {/* Provider Selector */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={selectedProviderId ?? ""}
                onChange={(e) => setSelectedProviderId(e.target.value || null)}
                className="bg-transparent text-xs text-foreground outline-none min-w-[120px]"
              >
                {enabledProviders.length === 0 && <option value="">{t("flashcardStudio.noProvider")}</option>}
                {notebookLmEnabled && <option value={NOTEBOOKLM_PROVIDER_ID}>NotebookLM</option>}
                {enabledProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            {isNotebookProviderSelected && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                {isNotebookLoading ? (
                  <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
                ) : (
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <select
                  value={selectedNotebookId}
                  onChange={(e) => void handleNotebookSelect(e.target.value)}
                  className="bg-transparent text-xs text-foreground outline-none min-w-[160px]"
                >
                  <option value="">{t("flashcardStudio.selectNotebook")}</option>
                  {notebooks.map((notebook) => (
                    <option key={notebook.id} value={notebook.id}>
                      {notebook.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Context Bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/20 px-6 py-3">
          <DocumentSelector
            documents={documents}
            selectedId={selectedDocumentId}
            onSelect={(id) => {
              setSelectedDocumentId(id);
              // Reset context selection when document changes
              if (id !== selectedDocumentId) {
                setContextSelection({
                  ...DEFAULT_CONTEXT_SELECTION,
                });
              }
            }}
          />

          <DeckSelector
            decks={decks}
            selectedId={selectedDeckId}
            onSelect={setSelectedDeckId}
          />

          {selectedDeck && deckTags.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Tag className="w-3.5 h-3.5" />
              <span className="max-w-[200px] truncate">{deckTags.join(", ")}</span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <input
              ref={imageFileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageFileChange}
            />
            <button
              type="button"
              onClick={handleImportImageClick}
              disabled={isImageImporting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-60"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              {t("flashcardStudio.importImage")}
            </button>
            <button
              type="button"
              onClick={handlePasteImage}
              disabled={isImageImporting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-60"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              {t("flashcardStudio.pasteImage")}
            </button>
            <button
              type="button"
              onClick={handleDeleteSelectedImages}
              disabled={isImageImporting || selectedImageAssetIds.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-background px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t("flashcardStudio.deleteSelected")}
            </button>
          </div>
          {imageAssets.length > 0 && (
            <div className="basis-full mt-2 flex items-center gap-2 overflow-x-auto pb-1">
              {imageAssets.slice(0, 16).map((asset) => {
                const selected = selectedImageAssetIds.includes(asset.id);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => toggleSelectedImageAsset(asset.id)}
                    className={cn(
                      "relative h-12 w-12 overflow-hidden rounded-md border transition-all",
                      selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                    )}
                    title={asset.file_name || asset.id}
                  >
                    <img src={asset.data_url} alt={asset.file_name || "Registry image"} className="h-full w-full object-cover" />
                  </button>
                );
              })}
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {selectedImageAssetIds.length} selected
              </span>
            </div>
          )}
        </div>

        {/* Context Control Panel */}
        {selectedDocument && (
          <div className="px-6 py-3 border-b border-border bg-muted/10">
            <ContextControlPanel
              document={{
                id: selectedDocument.id,
                title: selectedDocument.title,
                content: selectedDocumentText,
              }}
              selection={contextSelection}
              onChange={setContextSelection}
              maxTokens={maxTokens}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="grid flex-1 min-h-0 gap-0 overflow-hidden lg:grid-cols-[1fr_400px]">
          {/* Left Panel */}
          <div className="flex h-full min-h-0 flex-col border-r border-border">
            {viewMode === "chat" && (
              <>
                {/* Messages */}
                <div
                  ref={messagesContainerRef}
                  onScroll={handleMessagesScroll}
                  className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4"
                >
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <Sparkles className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {t("flashcardStudio.welcome")}
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-md mb-4">
                        Describe what you want to learn, or select a template. 
                        Use the <strong>Context Control</strong> above to select specific chapters, 
                        page ranges, or excerpts to save on API costs.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {QUICK_TEMPLATES.slice(0, 3).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => handleTemplateSelect(t)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-border bg-background hover:bg-muted transition-colors"
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "flex flex-col animate-in slide-in-from-bottom-2 duration-200",
                          message.role === "user" ? "items-end" : "items-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-4 py-3",
                            message.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : message.role === "system"
                              ? "bg-destructive/10 text-destructive border border-destructive/20"
                              : "bg-muted text-foreground rounded-bl-md border border-border"
                          )}
                        >
                          {message.role === "assistant" ? (
                            <div
                              className="prose prose-sm dark:prose-invert max-w-none"
                              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                            />
                          ) : (
                            <p className="text-sm leading-relaxed">{message.content}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 px-1">
                          <span className="text-[11px] text-muted-foreground">
                            {formatRelativeTime(message.timestamp)}
                          </span>
                          {message.cardsGenerated && message.cardsGenerated > 0 && (
                            <span className="text-[11px] text-primary font-medium">
                              +{message.cardsGenerated} cards
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-border p-4 bg-card">
                  <div className="relative">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      placeholder={selectedDocument 
                        ? "What flashcards should I create from the selected context?" 
                        : "Ask me to create flashcards on any topic..."}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    />
                    <button
                      onClick={() => handleSend()}
                      disabled={isSending || !input.trim() || (isNotebookProviderSelected && !selectedNotebookId)}
                      className="absolute right-3 bottom-3 p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  
                  {/* Cost Estimator */}
                  <div className="mt-3">
                    <CostEstimator 
                      inputText={isNotebookProviderSelected ? input : input + (contextContent || "")} 
                      isVisible={true} 
                      pricing={currentModelPricing}
                    />
                  </div>
                </div>
              </>
            )}

            {viewMode === "templates" && (
              <div className="flex-1 min-h-0 overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto">
                  <h3 className="text-lg font-semibold text-foreground mb-2">Quick Templates</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Select a template to quickly generate cards with a specific focus. 
                    Use <strong>Context Control</strong> to limit which parts of the document are sent.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {QUICK_TEMPLATES.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onClick={() => handleTemplateSelect(template)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {viewMode === "history" && (
              <div className="flex-1 min-h-0 overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Generation History</h3>
                      <p className="text-sm text-muted-foreground">
                        Reuse previous prompts to generate more cards
                      </p>
                    </div>
                    {generationHistory.length > 0 && (
                      <button
                        onClick={() => {
                          setGenerationHistory([]);
                          localStorage.removeItem(HISTORY_KEY);
                          toast.success("History cleared");
                        }}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  
                  {generationHistory.length === 0 ? (
                    <div className="text-center py-12">
                      <History className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground">No generation history yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {generationHistory.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setInput(item.prompt);
                            setViewMode("chat");
                          }}
                          className="w-full text-left p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                                {item.prompt}
                              </p>
                              {item.documentName && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  from "{item.documentName}"
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs font-medium text-primary">
                                {item.cardCount} cards
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatRelativeTime(item.timestamp)}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Draft Cards */}
          <div className="flex h-full min-h-0 flex-col bg-muted/20">
            {/* Draft Header */}
            <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Draft Cards
                  {stats.total > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({stats.selected}/{stats.total})
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {stats.qa > 0 && `${stats.qa} Q&A`}
                  {stats.qa > 0 && stats.cloze > 0 && " · "}
                  {stats.cloze > 0 && `${stats.cloze} Cloze`}
                  {stats.selected === 0 && "No cards selected"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleSelectAll(true)}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Select all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleSelectAll(false)}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Deselect all"
                >
                  <AlertCircle className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-border mx-1" />
                <button
                  onClick={() => setDraftCards([])}
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title="Clear all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bulk Actions */}
            {stats.selected > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-primary/5">
                {isTagInputVisible ? (
                  <div className="flex-1 flex items-center gap-2">
                    <Hash className="w-4 h-4 text-muted-foreground" />
                    <input
                      autoFocus
                      value={bulkTagInput}
                      onChange={(e) => setBulkTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddTagToSelected();
                        if (e.key === "Escape") setIsTagInputVisible(false);
                      }}
                      placeholder="tags, separated, by, commas"
                      className="flex-1 text-xs bg-transparent outline-none"
                    />
                    <button
                      onClick={handleAddTagToSelected}
                      className="text-xs text-primary font-medium hover:opacity-80"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setIsTagInputVisible(true)}
                      className="flex items-center gap-1.5 text-xs text-primary hover:opacity-80"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      Tag {stats.selected}
                    </button>
                    <button
                      onClick={handleDeleteSelected}
                      className="flex items-center gap-1.5 text-xs text-destructive hover:opacity-80"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Cards List */}
            <div ref={draftCardsContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {draftCards.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">No draft cards yet</p>
                  <p className="text-xs text-muted-foreground">
                    Generate cards using chat or templates
                  </p>
                </div>
              ) : (
                draftCards.map((card, index) => (
                  <div
                    key={card.id}
                    className={cn(
                      "group relative rounded-xl border bg-card overflow-hidden transition-all duration-200",
                      card.selected
                        ? "border-primary/50 shadow-sm shadow-primary/10"
                        : "border-border opacity-70 hover:opacity-100"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Card Header */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
                      <button
                        onClick={() =>
                          setDraftCards((prev) =>
                            prev.map((c) =>
                              c.id === card.id ? { ...c, selected: !c.selected } : c
                            )
                          )
                        }
                        className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                          card.selected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border bg-background hover:border-primary/50"
                        )}
                      >
                        {card.selected && <Check className="w-3.5 h-3.5" />}
                      </button>
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                          card.type === "qa"
                            ? "bg-blue-500/10 text-blue-600"
                            : "bg-purple-500/10 text-purple-600"
                        )}
                      >
                        {card.type === "qa" ? "Q&A" : "Cloze"}
                      </span>
                      {card.tags.length > 0 && (
                        <div className="flex items-center gap-1">
                          {card.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 bg-muted rounded-full text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                          {card.tags.length > 2 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{card.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex-1" />
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => duplicateCard(card)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground"
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingCardId(card.id)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setDraftCards((prev) => prev.filter((c) => c.id !== card.id))
                          }
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Card Content */}
                    <CardPreview
                      card={card}
                      isFlipped={flippedCardId === card.id}
                      onFlip={() =>
                        setFlippedCardId((id) => (id === card.id ? null : card.id))
                      }
                      isEditing={editingCardId === card.id}
                      onEdit={() => setEditingCardId(card.id)}
                      onSaveEdit={(updates) => handleEditCard(card.id, updates)}
                    />
                  </div>
                ))
              )}
            </div>

            {/* Save Action */}
            {draftCards.length > 0 && (
              <div className="border-t border-border bg-card p-4">
                <button
                  onClick={handleSaveSelected}
                  disabled={isSaving || stats.selected === 0}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save {stats.selected} Card{stats.selected === 1 ? "" : "s"}
                </button>
                <p className="text-center text-[10px] text-muted-foreground mt-2">
                  Ctrl+S to save · Cards will be added to your collection
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-card border border-border rounded-xl shadow-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Keyboard Shortcuts</h3>
              <button
                onClick={() => setShowShortcuts(false)}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Send message</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl + Enter</kbd>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Save selected cards</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl + S</kbd>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Close / Cancel</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Esc</kbd>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Show shortcuts</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">?</kbd>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Flip card preview</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Click card</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FlashcardStudioModal;
