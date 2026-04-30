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
import { useLatexPreview } from "../../hooks/useLatexPreview";
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
  Images,
  Expand,
} from "lucide-react";
import {
  createLearningItem,
  generateLearningItemsFromExtract,
  type CreateLearningItemInput,
} from "../../api/learning-items";
import { getExtracts, type Extract } from "../../api/extracts";
import { chatWithContext, type LLMMessage, type LLMMessageContentPart } from "../../api/llm";
import {
  notebooklmGenerateArtifact,
  notebooklmGetSettings,
  notebooklmListNotebooks,
  notebooklmPreviewFlashcards,
  notebooklmSelectNotebook,
  type NotebookSummary,
} from "../../api/integrations";
import { getImageAssetById, ingestImageFile, listImageAssets, type ImageAsset } from "../../api/image-registry";
import { getVideoTranscript } from "../../api/video-extracts";
import { extractYouTubeID, fetchYouTubeTranscript } from "../../api/youtube";
import { renderMarkdown } from "../../utils/markdown";
import { useDocumentStore, useLLMProvidersStore, useSettingsStore, useStudyDeckStore } from "../../stores";
import { useToast } from "../common/Toast";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../utils";
import { buildChapterQAContext, getChapterTitles } from "../../utils/chapterUtils";
import type { ImageOcclusionRegion, MultipleChoiceOption } from "../../types/learningItemInteractions";
import { ImageRegistryLibrary } from "../image-registry/ImageRegistryLibrary";
import { ExtractBrowserPanel } from "./ExtractBrowserPanel";

// =============================================================================
// TYPES
// =============================================================================

type DraftCardType = "qa" | "cloze" | "multiple-choice" | "image-occlusion";
type ViewMode = "chat" | "templates" | "history" | "extracts";
type ContextMode = "full" | "chapters" | "pages" | "excerpt" | "search";

interface DraftCard {
  id: string;
  type: DraftCardType;
  question?: string;
  answer?: string;
  text?: string;
  multipleChoiceOptions?: MultipleChoiceOption[];
  multipleChoiceCorrectOptionId?: string;
  imageOcclusionAssetId?: string;
  imageOcclusionRegions?: ImageOcclusionRegion[];
  selected: boolean;
  sourceMessageId?: string;
  createdAt: number;
  isEditing?: boolean;
  tags: string[];
  /** If true, this card was already persisted to the DB (e.g. via generateLearningItemsFromExtract)
   *  and should NOT be re-created by handleSaveSelected. */
  alreadyPersisted?: boolean;
  /** The DB id of the already-persisted learning item (if alreadyPersisted). */
  persistedItemId?: string;
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
  seed?: FlashcardStudioSeed | null;
}

interface FlashcardStudioSeed {
  key: string;
  documentId?: string | null;
  excerpt?: string;
  draftCardType?: DraftCardType;
  resetDraftCards?: boolean;
  autoEditDraft?: boolean;
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
    { "type": "cloze", "text": "The {{c1::term}} is important because {{c2::reason}}." },
    {
      "type": "multiple-choice",
      "question": "...",
      "answer": "Optional explanation shown after reveal",
      "options": [
        { "id": "a", "text": "Choice A" },
        { "id": "b", "text": "Choice B" }
      ],
      "correctOptionId": "b"
    }
  ]
}
\`\`\`

Return ONLY the JSON code block (no other text) when the user is asking you to create flashcards.

Rules for excellent flashcards:
- Use "qa" for conceptual questions that benefit from detailed explanations
- Use "cloze" for factual recall with {{c1::}} or {{::}} deletions
- Use "multiple-choice" when plausible distractors will improve recall
- Keep cards atomic: one fact per card
- Use clear, specific questions
- Answers should be concise but complete
- For cloze deletions, ensure the context makes the answer inferable
- Create 3-7 cards per request unless specified otherwise
- If the user is just chatting, answer normally without JSON`;

const IMAGE_OCCLUSION_SYSTEM_PROMPT = `You create image occlusion flashcards from one or more study images.

Return a JSON code block with this exact schema:

\`\`\`json
{
  "cards": [
    {
      "type": "image-occlusion",
      "imageAssetId": "exact-registry-asset-id",
      "question": "What is hidden here?",
      "answer": "Short reveal explanation",
      "regions": [
        { "x": 12.5, "y": 18.2, "width": 24.0, "height": 10.4, "label": "optional short label" }
      ]
    }
  ]
}
\`\`\`

Rules:
- Return ONLY the JSON code block.
- Use the provided imageAssetId values exactly as given.
- Regions use percentages from 0 to 100 relative to the full image.
- Create 1-4 useful hidden regions per image when the image supports it.
- Hide labels, terms, callouts, diagram parts, answers, or key visual anchors.
- Do not create tiny unusable boxes. Keep regions readable and reasonably tight.
- Skip images that do not contain good occlusion targets.
- Keep the question and answer concise.
- Never invent imageAssetId values that were not provided.`;

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
  if (normalized === "multiple-choice" || normalized === "multiple_choice" || normalized === "mcq") {
    return "multiple-choice";
  }
  if (normalized === "image-occlusion" || normalized === "image_occlusion") {
    return "image-occlusion";
  }
  return null;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function normalizeOcclusionRegions(value: unknown): ImageOcclusionRegion[] {
  if (!Array.isArray(value)) return [];
  const normalized: ImageOcclusionRegion[] = [];
  value.forEach((entry, index) => {
      const region = entry as Partial<ImageOcclusionRegion>;
      const x = clampPercent(Number(region.x));
      const y = clampPercent(Number(region.y));
      const width = clampPercent(Number(region.width));
      const height = clampPercent(Number(region.height));
      if (width <= 0 || height <= 0) return;
      normalized.push({
        id: region.id || `region-${index + 1}`,
        x,
        y,
        width: Math.min(width, 100 - x),
        height: Math.min(height, 100 - y),
        label: typeof region.label === "string" ? region.label : undefined,
        color: typeof region.color === "string" ? region.color : undefined,
      });
    });
  return normalized;
}

function modelSupportsImageInput(provider: string, model?: string, baseUrl?: string): boolean {
  const normalizedModel = (model || "").trim().toLowerCase();
  const normalizedBaseUrl = (baseUrl || "").trim().toLowerCase();

  if (!normalizedModel) return false;

  if (provider === "anthropic") {
    return /claude-3|claude-3-5|claude-3\.5|claude-3-7|claude-sonnet|claude-opus|claude-haiku/.test(normalizedModel);
  }

  if (provider === "openai") {
    return /gpt-4o|gpt-4\.1|gpt-4-turbo|vision|vl|llava|glm-4v|qwen.*vl|minicpm-v|gemma3|llama-3\.2-vision/.test(normalizedModel)
      || (normalizedBaseUrl.includes("localhost") && /llava|vision|vl|glm-4v|qwen.*vl|minicpm-v|gemma3/.test(normalizedModel));
  }

  if (provider === "openrouter") {
    return /gpt-4o|claude|gemini|vision|vl|llava|pixtral|glm-4v|qwen.*vl|minicpm-v|gemma3|llama-3\.2-vision/.test(normalizedModel);
  }

  if (provider === "ollama") {
    return /llava|bakllava|vision|vl|qwen.*vl|minicpm-v|gemma3|llama-3\.2-vision/.test(normalizedModel);
  }

  return false;
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
      const e = entry as {
        type?: string;
        question?: string;
        answer?: string;
        text?: string;
        options?: Array<string | MultipleChoiceOption>;
        correctOptionId?: string;
        imageAssetId?: string;
        imageOcclusionAssetId?: string;
        regions?: unknown;
        imageOcclusionRegions?: unknown;
      };
      let type = normalizeCardType(e?.type);

      // If the model forgot "type", infer from fields.
      if (!type) {
        if (typeof e?.question === "string" && typeof e?.answer === "string") type = "qa";
        else if (typeof e?.question === "string" && Array.isArray(e?.options)) type = "multiple-choice";
        else if ((typeof e?.imageAssetId === "string" || typeof e?.imageOcclusionAssetId === "string") && (Array.isArray(e?.regions) || Array.isArray(e?.imageOcclusionRegions))) type = "image-occlusion";
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
      } else if (type === "cloze") {
        const text = typeof e?.text === "string" ? e.text.trim() : "";
        if (!text) return;
        cards.push({ ...baseCard, text });
      } else if (type === "multiple-choice") {
        const question = typeof e?.question === "string" ? e.question.trim() : "";
        const options = (Array.isArray(e?.options) ? e.options : [])
          .map((option, index): MultipleChoiceOption => {
            if (typeof option === "string") {
              return { id: `choice-${index + 1}`, text: option };
            }
            return {
              id: option.id || `choice-${index + 1}`,
              text: option.text,
              isCorrect: option.isCorrect,
              feedback: option.feedback,
            };
          })
          .filter((option) => typeof option.text === "string" && option.text.trim().length > 0);
        const correctOptionId =
          (typeof e.correctOptionId === "string" ? e.correctOptionId : undefined) ||
          options.find((option) => option.isCorrect)?.id;
        if (!question || options.length < 2 || !correctOptionId) return;
        cards.push({
          ...baseCard,
          type: "multiple-choice",
          question,
          answer: typeof e.answer === "string" ? e.answer.trim() : "",
          multipleChoiceOptions: options,
          multipleChoiceCorrectOptionId: correctOptionId,
        });
      } else if (type === "image-occlusion") {
        const imageOcclusionAssetId =
          typeof e.imageAssetId === "string"
            ? e.imageAssetId.trim()
            : typeof e.imageOcclusionAssetId === "string"
            ? e.imageOcclusionAssetId.trim()
            : "";
        const imageOcclusionRegions = normalizeOcclusionRegions(e.regions ?? e.imageOcclusionRegions);
        if (!imageOcclusionAssetId || imageOcclusionRegions.length === 0) return;
        cards.push({
          ...baseCard,
          type: "image-occlusion",
          question: typeof e.question === "string" ? e.question.trim() : "",
          answer: typeof e.answer === "string" ? e.answer.trim() : "",
          imageOcclusionAssetId,
          imageOcclusionRegions,
        });
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

function stripClozeMarkup(text: string): string {
  return text.replace(/\{\{(.*?)\}\}/g, "$1");
}

function mapPlainOffsetToMarkedOffset(markedText: string, plainOffset: number): number {
  if (plainOffset <= 0) return 0;

  let plainIndex = 0;
  let markedIndex = 0;

  while (markedIndex < markedText.length) {
    if (markedText.startsWith("{{", markedIndex) || markedText.startsWith("}}", markedIndex)) {
      markedIndex += 2;
      continue;
    }
    if (plainIndex === plainOffset) {
      return markedIndex;
    }
    plainIndex += 1;
    markedIndex += 1;
  }

  return markedText.length;
}

function wrapMarkedTextByPlainOffsets(markedText: string, startOffset: number, endOffset: number): string {
  const openIndex = mapPlainOffsetToMarkedOffset(markedText, startOffset);
  const closeIndex = mapPlainOffsetToMarkedOffset(markedText, endOffset);
  if (openIndex >= closeIndex) return markedText;

  const before = markedText.slice(Math.max(0, openIndex - 2), openIndex);
  const after = markedText.slice(closeIndex, closeIndex + 2);
  if (before === "{{" && after === "}}") {
    return markedText;
  }

  return `${markedText.slice(0, openIndex)}{{${markedText.slice(openIndex, closeIndex)}}}${markedText.slice(closeIndex)}`;
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
  const { t } = useI18n();
  const tokens = useMemo(() => estimateTokens(inputText), [inputText]);
  const cost = useMemo(() => estimateCost(tokens, 500, pricing), [tokens, pricing]);
  
  if (!isVisible) return null;
  
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 rounded-lg text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <BarChart3 className="w-3.5 h-3.5" />
        <span>{t("flashcardStudio.tokensWithCount", { count: formatTokenCount(tokens) })}</span>
      </div>
      <div className="w-px h-3 bg-border" />
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <DollarSign className="w-3.5 h-3.5" />
        <span>{t("flashcardStudio.estimatedCost", { cost })}</span>
      </div>
      {pricing && (
        <div className="text-muted-foreground" title={t("flashcardStudio.modelPricingTitle")}>
          {t("flashcardStudio.modelPricingValue", {
            prompt: formatModelPrice(pricing.prompt),
            completion: formatModelPrice(pricing.completion),
          })}
        </div>
      )}
      {tokens > 4000 && (
        <div className="flex items-center gap-1 text-amber-500">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{t("flashcardStudio.largeContext")}</span>
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
  const { t } = useI18n();
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
        <span>{t("flashcardStudio.selectDocumentForContext")}</span>
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
            <div className="text-sm font-medium text-foreground">{t("flashcardStudio.contextControlTitle")}</div>
            <div className="text-xs text-muted-foreground">
              {selection.mode === "full" && t("flashcardStudio.contextModeFullSummary")}
              {selection.mode === "chapters" && t("flashcardStudio.contextModeChaptersSummary", { count: selectedChapters.length })}
              {selection.mode === "pages" && t("flashcardStudio.contextModePagesSummary")}
              {selection.mode === "excerpt" && t("flashcardStudio.contextModeExcerptSummary")}
              {selection.mode === "search" && t("flashcardStudio.contextModeSearchSummary")}
              {" · "}
              {t("flashcardStudio.tokensWithCount", { count: formatTokenCount(estimatedTokens) })}
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
              { id: "full", label: t("flashcardStudio.contextModeFull"), icon: FileText },
              { id: "chapters", label: t("flashcardStudio.contextModeChapters"), icon: BookOpen },
              { id: "pages", label: t("flashcardStudio.contextModePages"), icon: ScrollText },
              { id: "excerpt", label: t("flashcardStudio.contextModeExcerpt"), icon: Highlighter },
              { id: "search", label: t("flashcardStudio.contextModeSearch"), icon: Search },
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
              <div className="text-xs font-medium text-muted-foreground">{t("flashcardStudio.selectChapters")}</div>
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
                    <span className="text-xs text-muted-foreground w-16">{t("flashcardStudio.chapterNumber", { count: chapter.number })}</span>
                    <span className="text-sm text-foreground truncate">{chapter.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          {/* Page Range */}
          {selection.mode === "pages" && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">{t("flashcardStudio.enterPageRange")}</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={pageStart}
                  onChange={(e) => setPageStart(e.target.value)}
                  placeholder={t("flashcardStudio.start")}
                  className="w-24 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                />
                <span className="text-muted-foreground">{t("flashcardStudio.to")}</span>
                <input
                  type="number"
                  value={pageEnd}
                  onChange={(e) => setPageEnd(e.target.value)}
                  placeholder={t("flashcardStudio.end")}
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
                  {t("flashcardStudio.apply")}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("flashcardStudio.pageRangeNote")}
              </p>
            </div>
          )}
          
          {/* Excerpt */}
          {selection.mode === "excerpt" && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">{t("flashcardStudio.pasteExcerptPrompt")}</div>
              <textarea
                value={excerptText}
                onChange={(e) => setExcerptText(e.target.value)}
                placeholder={t("flashcardStudio.excerptPlaceholder")}
                rows={5}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t("flashcardStudio.tokensWithCount", { count: formatTokenCount(estimateTokens(excerptText)) })}
                </span>
                <button
                  onClick={() => {
                    onChange({ ...selection, excerpt: excerptText });
                    setExcerptText("");
                  }}
                  disabled={!excerptText.trim()}
                  className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {t("flashcardStudio.useExcerpt")}
                </button>
              </div>
            </div>
          )}
          
          {/* Search */}
          {selection.mode === "search" && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">{t("flashcardStudio.searchWithinDocument")}</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder={t("flashcardStudio.searchWithinDocumentPlaceholder")}
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
              {t("flashcardStudio.estimatedTokensPrefix")} <span className="font-medium text-foreground">{formatTokenCount(estimatedTokens)}</span> {t("flashcardStudio.tokens")}
              {selection.mode !== "full" && (
                <span className="text-green-600 ml-2">
                  {t("flashcardStudio.savesTokens", { count: formatTokenCount(estimateTokens(document.content) - estimatedTokens) })}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("flashcardStudio.maxTokens", { count: formatTokenCount(maxTokens) })}
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
  sourceExcerpt,
  imageAssets,
  defaultImageAssetId,
}: {
  card: DraftCard;
  isFlipped: boolean;
  onFlip: () => void;
  isEditing: boolean;
  onEdit: () => void;
  onSaveEdit: (updates: Partial<DraftCard>) => void;
  sourceExcerpt?: string;
  imageAssets: ImageAsset[];
  defaultImageAssetId?: string;
}) {
  const { t } = useI18n();
  const clozeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const sourceExcerptRef = useRef<HTMLDivElement>(null);
  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false);
  const [isEditLightboxOpen, setIsEditLightboxOpen] = useState(false);
  const [canUndoCloze, setCanUndoCloze] = useState(false);
  const lastClozeTextRef = useRef<string | null>(null);
  const [sourceSelection, setSourceSelection] = useState<{
    text: string;
    startOffset: number;
    endOffset: number;
  } | null>(null);
  const [editForm, setEditForm] = useState<Partial<DraftCard>>({
    type: card.type,
    question: card.question || "",
    answer: card.answer || "",
    text: card.text || "",
    multipleChoiceOptions: card.multipleChoiceOptions || [
      { id: "choice-1", text: "" },
      { id: "choice-2", text: "" },
    ],
    multipleChoiceCorrectOptionId: card.multipleChoiceCorrectOptionId,
    imageOcclusionAssetId: card.imageOcclusionAssetId || defaultImageAssetId,
    imageOcclusionRegions: card.imageOcclusionRegions || [],
  });

  useEffect(() => {
    setEditForm({
      type: card.type,
      question: card.question || "",
      answer: card.answer || "",
      text: card.text || "",
      multipleChoiceOptions: card.multipleChoiceOptions || [
        { id: "choice-1", text: "" },
        { id: "choice-2", text: "" },
      ],
      multipleChoiceCorrectOptionId: card.multipleChoiceCorrectOptionId,
      imageOcclusionAssetId: card.imageOcclusionAssetId || defaultImageAssetId,
      imageOcclusionRegions: card.imageOcclusionRegions || [],
    });
    setSourceSelection(null);
  }, [card, defaultImageAssetId]);

  const activeType = (editForm.type as DraftCardType | undefined) || card.type;
  const previewContent = activeType === "qa"
    ? `${editForm.question || ""}\n---\n${editForm.answer || ""}`
    : activeType === "cloze"
    ? (editForm.text || "")
    : activeType === "multiple-choice"
    ? `${editForm.question || ""}\n${(editForm.multipleChoiceOptions || []).map((option) => option.text).join("\n")}\n${editForm.answer || ""}`
    : `${editForm.question || ""}\n${editForm.answer || ""}`;
  const { html: previewHtml, isPending: previewPending } = useLatexPreview(previewContent);
  const previewAssetId = (editForm.imageOcclusionAssetId as string | undefined) || defaultImageAssetId;
  const previewAsset = imageAssets.find((asset) => asset.id === previewAssetId) || null;
  const trimmedSourceExcerpt = sourceExcerpt?.trim() || "";

  const setType = (type: DraftCardType) => {
    setEditForm((form) => ({
      ...form,
      type,
      question: type === "cloze" ? undefined : (form.question as string) || "",
      answer: type === "cloze" ? undefined : (form.answer as string) || "",
      text:
        type === "cloze"
          ? ((form.text as string) || trimmedSourceExcerpt || "")
          : undefined,
      multipleChoiceOptions:
        type === "multiple-choice"
          ? (Array.isArray(form.multipleChoiceOptions) && form.multipleChoiceOptions.length > 0
              ? form.multipleChoiceOptions
              : [{ id: "choice-1", text: "" }, { id: "choice-2", text: "" }])
          : undefined,
      multipleChoiceCorrectOptionId:
        type === "multiple-choice"
          ? (form.multipleChoiceCorrectOptionId as string | undefined) || "choice-1"
          : undefined,
      imageOcclusionAssetId:
        type === "image-occlusion"
          ? ((form.imageOcclusionAssetId as string | undefined) || defaultImageAssetId)
          : undefined,
      imageOcclusionRegions:
        type === "image-occlusion"
          ? (Array.isArray(form.imageOcclusionRegions) ? form.imageOcclusionRegions : [])
          : undefined,
    }));
  };

  const wrapClozeSelection = () => {
    const textarea = clozeTextareaRef.current;
    const currentText = ((editForm.text as string) || "");
    if (!textarea || textarea.selectionStart === textarea.selectionEnd) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = currentText.slice(start, end);
    const wrapped = `{{${selectedText}}}`;
    const nextText = currentText.slice(0, start) + wrapped + currentText.slice(end);

    lastClozeTextRef.current = currentText;
    setCanUndoCloze(true);
    setEditForm((form) => ({ ...form, text: nextText }));
    requestAnimationFrame(() => {
      if (!clozeTextareaRef.current) return;
      clozeTextareaRef.current.focus();
      clozeTextareaRef.current.selectionStart = start;
      clozeTextareaRef.current.selectionEnd = start + wrapped.length;
    });
  };

  const undoClozeWrap = () => {
    if (lastClozeTextRef.current === null) return;
    setEditForm((form) => ({ ...form, text: lastClozeTextRef.current! }));
    lastClozeTextRef.current = null;
    setCanUndoCloze(false);
  };

  const updateSourceSelection = useCallback(() => {
    const selection = window.getSelection();
    const container = sourceExcerptRef.current;
    if (!selection || selection.isCollapsed || !container || !selection.rangeCount) {
      setSourceSelection(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      setSourceSelection(null);
      return;
    }

    const preRange = range.cloneRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;
    const text = selection.toString();
    const endOffset = startOffset + text.length;

    if (!text.trim() || endOffset <= startOffset) {
      setSourceSelection(null);
      return;
    }

    setSourceSelection({
      text,
      startOffset,
      endOffset,
    });
  }, []);

  const applySourceSelectionAsCloze = () => {
    if (!sourceSelection || !trimmedSourceExcerpt) return;

    const currentText = ((editForm.text as string) || "").trim();
    const hasCompatibleBase =
      currentText.length > 0 && stripClozeMarkup(currentText) === trimmedSourceExcerpt;
    const baseText = hasCompatibleBase ? currentText : trimmedSourceExcerpt;
    const nextText = wrapMarkedTextByPlainOffsets(
      baseText,
      sourceSelection.startOffset,
      sourceSelection.endOffset
    );

    lastClozeTextRef.current = baseText;
    setCanUndoCloze(true);
    setEditForm((form) => ({ ...form, text: nextText }));
    setSourceSelection(null);
    window.getSelection()?.removeAllRanges();
    requestAnimationFrame(() => clozeTextareaRef.current?.focus());
  };

  const editLightbox = (
    <CardEditLightbox
      isOpen={isEditLightboxOpen}
      card={card}
      editForm={editForm}
      onEditFormChange={setEditForm}
      sourceExcerpt={sourceExcerpt}
      imageAssets={imageAssets}
      defaultImageAssetId={defaultImageAssetId}
      onSave={() => {
        onSaveEdit(editForm);
        setIsEditLightboxOpen(false);
      }}
      onCancel={() => setIsEditLightboxOpen(false)}
      onClose={() => setIsEditLightboxOpen(false)}
    />
  );

  if (isEditing) {
    return (
      <>
      <div className="space-y-3 p-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">{t("flashcardStudio.cardTypeLabel")}</label>
          <button
            type="button"
            onClick={() => setIsEditLightboxOpen(true)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={t("flashcardStudio.expandEditor")}
          >
            <Expand className="w-3.5 h-3.5" />
          </button>
        </div>
        <select
          value={activeType}
          onChange={(e) => setType(e.target.value as DraftCardType)}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="qa">{t("flashcardStudio.cardTypeQaShort")}</option>
          <option value="cloze">{t("flashcardStudio.cardTypeCloze")}</option>
          <option value="multiple-choice">{t("flashcardStudio.cardTypeMultipleChoice")}</option>
          <option value="image-occlusion">{t("flashcardStudio.cardTypeImageOcclusion")}</option>
        </select>

        {activeType === "qa" ? (
          <>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t("flashcardStudio.question")}</label>
              <textarea
                value={(editForm.question as string) || ""}
                onChange={(e) => setEditForm((f) => ({ ...f, question: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t("flashcardStudio.answer")}</label>
              <textarea
                value={(editForm.answer as string) || ""}
                onChange={(e) => setEditForm((f) => ({ ...f, answer: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={3}
              />
            </div>
          </>
        ) : activeType === "cloze" ? (
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("flashcardStudio.clozeTextLabel")}</label>
            {trimmedSourceExcerpt && (
              <div className="mt-1.5 mb-2 rounded-md border border-border/60 bg-muted/20 p-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Source Extract
                  </span>
                  <div className="flex items-center gap-2">
                    {sourceSelection && (
                      <button
                        type="button"
                        onClick={applySourceSelectionAsCloze}
                        className="rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:opacity-90"
                      >
                        Cloze selection
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditForm((form) => ({ ...form, text: trimmedSourceExcerpt }))}
                      className="text-[10px] font-medium text-primary hover:opacity-80"
                    >
                      Use full extract
                    </button>
                  </div>
                </div>
                <div
                  ref={sourceExcerptRef}
                  onMouseUp={updateSourceSelection}
                  onKeyUp={updateSourceSelection}
                  className="max-h-32 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground select-text rounded-md border border-transparent px-1 py-0.5"
                >
                  {trimmedSourceExcerpt}
                </div>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <p className="text-[11px] text-muted-foreground">
                    Highlight a word or phrase in the extract, then use <span className="font-medium text-foreground">Cloze selection</span> to hide it in context.
                  </p>
                  {sourceSelection && (
                    <div className="max-w-[45%] rounded-md bg-background/80 px-2 py-1 text-[10px] text-muted-foreground">
                      Selected: <span className="text-foreground">{sourceSelection.text.trim()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <textarea
              ref={clozeTextareaRef}
              value={(editForm.text as string) || ""}
              onChange={(e) => setEditForm((f) => ({ ...f, text: e.target.value }))}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
                  e.preventDefault();
                  wrapClozeSelection();
                }
              }}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={4}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                Select text and press <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">Ctrl+B</kbd> to wrap it as a Cloze deletion.
              </p>
              <div className="flex items-center gap-1.5">
                {canUndoCloze && (
                  <button
                    type="button"
                    onClick={undoClozeWrap}
                    className="shrink-0 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  >
                    {t("flashcardStudio.undoCloze")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={wrapClozeSelection}
                  className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/15"
                >
                  Wrap selection
                </button>
              </div>
            </div>
          </div>
        ) : activeType === "multiple-choice" ? (
          <>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t("flashcardStudio.question")}</label>
              <textarea
                value={(editForm.question as string) || ""}
                onChange={(e) => setEditForm((f) => ({ ...f, question: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">{t("flashcardStudio.choices")}</label>
                <button
                  type="button"
                  onClick={() =>
                    setEditForm((form) => ({
                      ...form,
                      multipleChoiceOptions: [
                        ...(form.multipleChoiceOptions || []),
                        {
                          id: `choice-${(form.multipleChoiceOptions?.length || 0) + 1}`,
                          text: "",
                        },
                      ],
                    }))
                  }
                  className="text-xs text-primary hover:opacity-80"
                >
                  {t("flashcardStudio.addChoice")}
                </button>
              </div>
              {(editForm.multipleChoiceOptions || []).map((option, index) => (
                <div key={option.id || index} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${card.id}`}
                    checked={editForm.multipleChoiceCorrectOptionId === option.id}
                    onChange={() =>
                      setEditForm((form) => ({
                        ...form,
                        multipleChoiceCorrectOptionId: option.id,
                      }))
                    }
                  />
                  <input
                    value={option.text}
                    onChange={(e) =>
                      setEditForm((form) => ({
                        ...form,
                        multipleChoiceOptions: (form.multipleChoiceOptions || []).map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, text: e.target.value } : entry
                        ),
                      }))
                    }
                    placeholder={t("flashcardStudio.choiceNumber", { count: index + 1 })}
                    className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t("flashcardStudio.explanationOptional")}</label>
              <textarea
                value={(editForm.answer as string) || ""}
                onChange={(e) => setEditForm((f) => ({ ...f, answer: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={2}
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t("flashcardStudio.prompt")}</label>
              <textarea
                value={(editForm.question as string) || ""}
                onChange={(e) => setEditForm((f) => ({ ...f, question: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={2}
                placeholder={t("flashcardStudio.imagePromptPlaceholder")}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t("flashcardStudio.revealExplanation")}</label>
              <textarea
                value={(editForm.answer as string) || ""}
                onChange={(e) => setEditForm((f) => ({ ...f, answer: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t("flashcardStudio.sourceImage")}</label>
              <select
                value={(editForm.imageOcclusionAssetId as string | undefined) || ""}
                onChange={(e) =>
                  setEditForm((form) => ({
                    ...form,
                    imageOcclusionAssetId: e.target.value || undefined,
                  }))
                }
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">{t("flashcardStudio.selectImportedImage")}</option>
                {imageAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.file_name || asset.id}
                  </option>
                ))}
              </select>
            </div>
            <ImageOcclusionEditor
              asset={previewAsset}
              regions={(editForm.imageOcclusionRegions as ImageOcclusionRegion[] | undefined) || []}
              onChange={(regions) => setEditForm((form) => ({ ...form, imageOcclusionRegions: regions }))}
            />
          </>
        )}
        {previewHtml && (
          <div className="rounded-md border border-border/50 bg-muted/30 p-2 text-sm">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("flashcardStudio.preview")} {previewPending && <span className="opacity-50">...</span>}
            </div>
            <div
              className="prose prose-sm max-w-none [&_.math-expression-block]:my-1 [&_.math-expression-block]:flex [&_.math-expression-block]:justify-center"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onSaveEdit({})}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {t("flashcardStudio.cancel")}
          </button>
          <button
            onClick={() => onSaveEdit(editForm)}
            className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:opacity-90"
          >
            {t("flashcardStudio.saveChanges")}
          </button>
        </div>
      </div>
      {editLightbox}
      </>
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
                  {isFlipped ? t("flashcardStudio.answerLabel") : t("flashcardStudio.questionLabel")}
                </div>
                <div className="text-sm text-foreground/90 leading-relaxed">
                  {isFlipped
                    ? card.answer
                    : card.question}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {isFlipped ? t("flashcardStudio.clickToSeeQuestion") : t("flashcardStudio.clickToRevealAnswer")}
                </div>
              </div>
            ) : card.type === "multiple-choice" ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">{card.question}</div>
                <div className="space-y-1.5">
                  {(card.multipleChoiceOptions || []).map((option) => (
                    <div
                      key={option.id}
                      className={cn(
                        "rounded-md border px-2.5 py-2 text-sm",
                        isFlipped && card.multipleChoiceCorrectOptionId === option.id
                          ? "border-green-500/40 bg-green-500/10"
                          : "border-border bg-background"
                      )}
                    >
                      {option.text}
                    </div>
                  ))}
                </div>
                {isFlipped && card.answer && (
                  <div className="text-xs text-muted-foreground">{card.answer}</div>
                )}
              </div>
            ) : card.type === "image-occlusion" ? (
              <div className="space-y-3">
                <div className="text-sm font-medium text-foreground">{card.question || t("flashcardStudio.imageOcclusionCard")}</div>
                {previewAsset ? (
                  <div className="relative overflow-hidden rounded-lg border border-border bg-muted/30">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsImageLightboxOpen(true);
                      }}
                      className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-black/80"
                    >
                      <Expand className="h-3 w-3" />
                      {t("flashcardStudio.expandImage")}
                    </button>
                    <img src={previewAsset.data_url} alt={previewAsset.file_name || t("flashcardStudio.occlusionSource")} className="w-full object-contain" />
                    {!isFlipped &&
                      (card.imageOcclusionRegions || []).map((region, index) => (
                        <div
                          key={region.id || `${region.x}-${region.y}-${index}`}
                          className="absolute rounded border border-white/30 bg-slate-950/80"
                          style={{
                            left: `${region.x}%`,
                            top: `${region.y}%`,
                            width: `${region.width}%`,
                            height: `${region.height}%`,
                          }}
                        />
                      ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                    {t("flashcardStudio.selectImageForOcclusion")}
                  </div>
                )}
                {isFlipped && card.answer && (
                  <div className="text-xs text-muted-foreground">{card.answer}</div>
                )}
                {previewAsset ? (
                  <ImageOcclusionLightbox
                    isOpen={isImageLightboxOpen}
                    asset={previewAsset}
                    regions={(card.imageOcclusionRegions || []) as ImageOcclusionRegion[]}
                    title={card.question || previewAsset.file_name || t("flashcardStudio.imageOcclusionCard")}
                    onClose={() => setIsImageLightboxOpen(false)}
                  />
                ) : null}
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
      {editLightbox}
    </div>
  );
}

function ImageOcclusionEditor({
  asset,
  regions,
  onChange,
}: {
  asset: ImageAsset | null;
  regions: ImageOcclusionRegion[];
  onChange: (regions: ImageOcclusionRegion[]) => void;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [draftRegion, setDraftRegion] = useState<ImageOcclusionRegion | null>(null);

  const clamp = (value: number) => Math.max(0, Math.min(100, value));

  const getPoint = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100),
    };
  };

  const commitDraft = () => {
    if (draftRegion && draftRegion.width > 1 && draftRegion.height > 1) {
      onChange([...regions, draftRegion]);
    }
    setOrigin(null);
    setDraftRegion(null);
  };

  if (!asset) {
    return (
      <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
        {t("flashcardStudio.importImageForOcclusion")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg border border-border bg-muted/20 touch-none"
        onPointerDown={(event) => {
          const point = getPoint(event);
          if (!point) return;
          setOrigin(point);
          setDraftRegion({
            id: `region-${Date.now()}`,
            x: point.x,
            y: point.y,
            width: 0,
            height: 0,
          });
        }}
        onPointerMove={(event) => {
          if (!origin) return;
          const point = getPoint(event);
          if (!point) return;
          setDraftRegion({
            id: `region-${Date.now()}`,
            x: Math.min(origin.x, point.x),
            y: Math.min(origin.y, point.y),
            width: Math.abs(point.x - origin.x),
            height: Math.abs(point.y - origin.y),
          });
        }}
        onPointerUp={commitDraft}
        onPointerLeave={commitDraft}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIsLightboxOpen(true);
          }}
          className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-black/80"
        >
          <Expand className="h-3 w-3" />
          {t("flashcardStudio.expandImage")}
        </button>
        <img src={asset.data_url} alt={asset.file_name || t("flashcardStudio.occlusionEditor")} className="w-full object-contain select-none" />
        {[...regions, ...(draftRegion ? [draftRegion] : [])].map((region, index) => (
          <div
            key={region.id || `${region.x}-${region.y}-${index}`}
            className="absolute rounded border border-white/40 bg-slate-950/75"
            style={{
              left: `${region.x}%`,
              top: `${region.y}%`,
              width: `${region.width}%`,
              height: `${region.height}%`,
            }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t("flashcardStudio.dragHiddenRegion")}</span>
        <button
          type="button"
          onClick={() => onChange(regions.slice(0, -1))}
          disabled={regions.length === 0}
          className="text-primary hover:opacity-80 disabled:opacity-40"
        >
          {t("flashcardStudio.undoRegion")}
        </button>
      </div>
      <ImageOcclusionLightbox
        isOpen={isLightboxOpen}
        asset={asset}
        regions={regions}
        title={asset.file_name || t("flashcardStudio.occlusionEditor")}
        onClose={() => setIsLightboxOpen(false)}
      />
    </div>
  );
}

function ImageOcclusionLightbox({
  isOpen,
  asset,
  regions,
  title,
  onClose,
}: {
  isOpen: boolean;
  asset: ImageAsset | null;
  regions: ImageOcclusionRegion[];
  title: string;
  onClose: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !asset) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 text-white">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="text-xs text-slate-300">{t("flashcardStudio.imageLightboxHint")}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 text-slate-100 transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          <div className="relative mx-auto w-full overflow-hidden rounded-2xl bg-black/40">
            <img
              src={asset.data_url}
              alt={asset.file_name || title}
              className="mx-auto block max-h-[calc(92vh-8rem)] w-full object-contain"
            />
            {regions.map((region, index) => (
              <div
                key={region.id || `${region.x}-${region.y}-${index}`}
                className="absolute rounded border border-white/50 bg-slate-950/75"
                style={{
                  left: `${region.x}%`,
                  top: `${region.y}%`,
                  width: `${region.width}%`,
                  height: `${region.height}%`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardEditLightbox({
  isOpen,
  card,
  editForm,
  onEditFormChange,
  sourceExcerpt,
  imageAssets,
  defaultImageAssetId,
  onSave,
  onCancel,
  onClose,
}: {
  isOpen: boolean;
  card: DraftCard;
  editForm: Partial<DraftCard>;
  onEditFormChange: React.Dispatch<React.SetStateAction<Partial<DraftCard>>>;
  sourceExcerpt?: string;
  imageAssets: ImageAsset[];
  defaultImageAssetId?: string;
  onSave: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const clozeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const sourceExcerptRef = useRef<HTMLDivElement>(null);
  const [sourceSelection, setSourceSelection] = useState<{
    text: string;
    startOffset: number;
    endOffset: number;
  } | null>(null);
  const [canUndoCloze, setCanUndoCloze] = useState(false);
  const lastClozeTextRef = useRef<string | null>(null);

  const activeType = (editForm.type as DraftCardType | undefined) || card.type;
  const trimmedSourceExcerpt = sourceExcerpt?.trim() || "";

  const setType = (type: DraftCardType) => {
    onEditFormChange((form) => ({
      ...form,
      type,
      question: type === "cloze" ? undefined : (form.question as string) || "",
      answer: type === "cloze" ? undefined : (form.answer as string) || "",
      text:
        type === "cloze"
          ? ((form.text as string) || trimmedSourceExcerpt || "")
          : undefined,
      multipleChoiceOptions:
        type === "multiple-choice"
          ? (Array.isArray(form.multipleChoiceOptions) && form.multipleChoiceOptions.length > 0
              ? form.multipleChoiceOptions
              : [{ id: "choice-1", text: "" }, { id: "choice-2", text: "" }])
          : undefined,
      multipleChoiceCorrectOptionId:
        type === "multiple-choice"
          ? (form.multipleChoiceCorrectOptionId as string | undefined) || "choice-1"
          : undefined,
      imageOcclusionAssetId:
        type === "image-occlusion"
          ? ((form.imageOcclusionAssetId as string | undefined) || defaultImageAssetId)
          : undefined,
      imageOcclusionRegions:
        type === "image-occlusion"
          ? (Array.isArray(form.imageOcclusionRegions) ? form.imageOcclusionRegions : [])
          : undefined,
    }));
  };

  const wrapClozeSelection = () => {
    const textarea = clozeTextareaRef.current;
    const currentText = ((editForm.text as string) || "");
    if (!textarea || textarea.selectionStart === textarea.selectionEnd) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = currentText.slice(start, end);
    const wrapped = `{{${selectedText}}}`;
    const nextText = currentText.slice(0, start) + wrapped + currentText.slice(end);

    lastClozeTextRef.current = currentText;
    setCanUndoCloze(true);
    onEditFormChange((form) => ({ ...form, text: nextText }));
    requestAnimationFrame(() => {
      if (!clozeTextareaRef.current) return;
      clozeTextareaRef.current.focus();
      clozeTextareaRef.current.selectionStart = start;
      clozeTextareaRef.current.selectionEnd = start + wrapped.length;
    });
  };

  const undoClozeWrap = () => {
    if (lastClozeTextRef.current === null) return;
    onEditFormChange((form) => ({ ...form, text: lastClozeTextRef.current! }));
    lastClozeTextRef.current = null;
    setCanUndoCloze(false);
  };

  const updateSourceSelection = useCallback(() => {
    const selection = window.getSelection();
    const container = sourceExcerptRef.current;
    if (!selection || selection.isCollapsed || !container || !selection.rangeCount) {
      setSourceSelection(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      setSourceSelection(null);
      return;
    }

    const preRange = range.cloneRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;
    const text = selection.toString();
    const endOffset = startOffset + text.length;

    if (!text.trim() || endOffset <= startOffset) {
      setSourceSelection(null);
      return;
    }

    setSourceSelection({ text, startOffset, endOffset });
  }, []);

  const applySourceSelectionAsCloze = () => {
    if (!sourceSelection || !trimmedSourceExcerpt) return;

    const currentText = ((editForm.text as string) || "").trim();
    const hasCompatibleBase =
      currentText.length > 0 && stripClozeMarkup(currentText) === trimmedSourceExcerpt;
    const baseText = hasCompatibleBase ? currentText : trimmedSourceExcerpt;
    const nextText = wrapMarkedTextByPlainOffsets(
      baseText,
      sourceSelection.startOffset,
      sourceSelection.endOffset
    );

    lastClozeTextRef.current = baseText;
    setCanUndoCloze(true);
    onEditFormChange((form) => ({ ...form, text: nextText }));
    setSourceSelection(null);
    window.getSelection()?.removeAllRanges();
    requestAnimationFrame(() => clozeTextareaRef.current?.focus());
  };

  const previewContent = activeType === "qa"
    ? `${editForm.question || ""}\n---\n${editForm.answer || ""}`
    : activeType === "cloze"
    ? (editForm.text || "")
    : activeType === "multiple-choice"
    ? `${editForm.question || ""}\n${(editForm.multipleChoiceOptions || []).map((option) => option.text).join("\n")}\n${editForm.answer || ""}`
    : `${editForm.question || ""}\n${editForm.answer || ""}`;
  const { html: previewHtml, isPending: previewPending } = useLatexPreview(previewContent);

  const previewAssetId = (editForm.imageOcclusionAssetId as string | undefined) || defaultImageAssetId;
  const previewAsset = imageAssets.find((asset) => asset.id === previewAssetId) || null;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";
  const labelCls = "text-xs font-medium text-muted-foreground mb-1.5 block";

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <div className="text-sm font-semibold text-foreground">{t("flashcardStudio.editCardTitle")}</div>
            <div className="text-xs text-muted-foreground">{t("flashcardStudio.editCardHint")}</div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={activeType}
              onChange={(e) => setType(e.target.value as DraftCardType)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="qa">{t("flashcardStudio.cardTypeQaShort")}</option>
              <option value="cloze">{t("flashcardStudio.cardTypeCloze")}</option>
              <option value="multiple-choice">{t("flashcardStudio.cardTypeMultipleChoice")}</option>
              <option value="image-occlusion">{t("flashcardStudio.cardTypeImageOcclusion")}</option>
            </select>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {activeType === "cloze" ? (
            <div className="flex gap-6 h-full">
              {/* Source extract pane */}
              {trimmedSourceExcerpt && (
                <div className="w-[38%] flex flex-col min-h-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={labelCls}>{t("flashcardStudio.sourceExtractLabel")}</span>
                    <div className="flex items-center gap-2">
                      {sourceSelection && (
                        <button
                          type="button"
                          onClick={applySourceSelectionAsCloze}
                          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                        >
                          Cloze selection
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEditFormChange((form) => ({ ...form, text: trimmedSourceExcerpt }))}
                        className="text-xs font-medium text-primary hover:opacity-80"
                      >
                        Use full extract
                      </button>
                    </div>
                  </div>
                  <div
                    ref={sourceExcerptRef}
                    onMouseUp={updateSourceSelection}
                    onKeyUp={updateSourceSelection}
                    className="flex-1 min-h-0 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground select-text rounded-md border border-border/60 bg-muted/20 px-3 py-2"
                  >
                    {trimmedSourceExcerpt}
                  </div>
                  {sourceSelection && (
                    <div className="mt-2 rounded-md bg-background px-2 py-1 text-xs text-muted-foreground">
                      Selected: <span className="text-foreground font-medium">{sourceSelection.text.trim()}</span>
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Highlight a word or phrase, then click <span className="font-medium text-foreground">Cloze selection</span>.
                  </p>
                </div>
              )}
              {/* Cloze editor pane */}
              <div className={`flex flex-col min-h-0 ${trimmedSourceExcerpt ? "w-[62%]" : "w-full"}`}>
                <span className={labelCls}>{t("flashcardStudio.clozeTextLabel")}</span>
                <textarea
                  ref={clozeTextareaRef}
                  value={(editForm.text as string) || ""}
                  onChange={(e) => onEditFormChange((f) => ({ ...f, text: e.target.value }))}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
                      e.preventDefault();
                      wrapClozeSelection();
                    }
                  }}
                  className={`${inputCls} flex-1 min-h-[200px] resize-y font-mono`}
                  placeholder="Enter text with {{cloze deletions}}..."
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    Select text and press <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">Ctrl+B</kbd> to wrap as Cloze.
                  </p>
                  <div className="flex items-center gap-1.5">
                    {canUndoCloze && (
                      <button
                        type="button"
                        onClick={undoClozeWrap}
                        className="shrink-0 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      >
                        {t("flashcardStudio.undoCloze")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={wrapClozeSelection}
                      className="shrink-0 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15"
                    >
                      Wrap selection
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : activeType === "qa" ? (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div>
                <span className={labelCls}>{t("flashcardStudio.question")}</span>
                <textarea
                  value={(editForm.question as string) || ""}
                  onChange={(e) => onEditFormChange((f) => ({ ...f, question: e.target.value }))}
                  className={inputCls}
                  rows={4}
                />
              </div>
              <div>
                <span className={labelCls}>{t("flashcardStudio.answer")}</span>
                <textarea
                  value={(editForm.answer as string) || ""}
                  onChange={(e) => onEditFormChange((f) => ({ ...f, answer: e.target.value }))}
                  className={inputCls}
                  rows={6}
                />
              </div>
            </div>
          ) : activeType === "multiple-choice" ? (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div>
                <span className={labelCls}>{t("flashcardStudio.question")}</span>
                <textarea
                  value={(editForm.question as string) || ""}
                  onChange={(e) => onEditFormChange((f) => ({ ...f, question: e.target.value }))}
                  className={inputCls}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={labelCls}>{t("flashcardStudio.choices")}</span>
                  <button
                    type="button"
                    onClick={() =>
                      onEditFormChange((form) => ({
                        ...form,
                        multipleChoiceOptions: [
                          ...(form.multipleChoiceOptions || []),
                          { id: `choice-${(form.multipleChoiceOptions?.length || 0) + 1}`, text: "" },
                        ],
                      }))
                    }
                    className="text-xs text-primary hover:opacity-80"
                  >
                    {t("flashcardStudio.addChoice")}
                  </button>
                </div>
                {(editForm.multipleChoiceOptions || []).map((option, index) => (
                  <div key={option.id || index} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-lightbox-${card.id}`}
                      checked={editForm.multipleChoiceCorrectOptionId === option.id}
                      onChange={() =>
                        onEditFormChange((form) => ({
                          ...form,
                          multipleChoiceCorrectOptionId: option.id,
                        }))
                      }
                    />
                    <input
                      value={option.text}
                      onChange={(e) =>
                        onEditFormChange((form) => ({
                          ...form,
                          multipleChoiceOptions: (form.multipleChoiceOptions || []).map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, text: e.target.value } : entry
                          ),
                        }))
                      }
                      placeholder={t("flashcardStudio.choiceNumber", { count: index + 1 })}
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
              <div>
                <span className={labelCls}>{t("flashcardStudio.explanationOptional")}</span>
                <textarea
                  value={(editForm.answer as string) || ""}
                  onChange={(e) => onEditFormChange((f) => ({ ...f, answer: e.target.value }))}
                  className={inputCls}
                  rows={3}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div>
                <span className={labelCls}>{t("flashcardStudio.prompt")}</span>
                <textarea
                  value={(editForm.question as string) || ""}
                  onChange={(e) => onEditFormChange((f) => ({ ...f, question: e.target.value }))}
                  className={inputCls}
                  rows={3}
                  placeholder={t("flashcardStudio.imagePromptPlaceholder")}
                />
              </div>
              <div>
                <span className={labelCls}>{t("flashcardStudio.revealExplanation")}</span>
                <textarea
                  value={(editForm.answer as string) || ""}
                  onChange={(e) => onEditFormChange((f) => ({ ...f, answer: e.target.value }))}
                  className={inputCls}
                  rows={3}
                />
              </div>
              <div>
                <span className={labelCls}>{t("flashcardStudio.sourceImage")}</span>
                <select
                  value={(editForm.imageOcclusionAssetId as string | undefined) || ""}
                  onChange={(e) =>
                    onEditFormChange((form) => ({
                      ...form,
                      imageOcclusionAssetId: e.target.value || undefined,
                    }))
                  }
                  className={inputCls}
                >
                  <option value="">{t("flashcardStudio.selectImportedImage")}</option>
                  {imageAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.file_name || asset.id}
                    </option>
                  ))}
                </select>
              </div>
              <ImageOcclusionEditor
                asset={previewAsset}
                regions={(editForm.imageOcclusionRegions as ImageOcclusionRegion[] | undefined) || []}
                onChange={(regions) => onEditFormChange((form) => ({ ...form, imageOcclusionRegions: regions }))}
              />
            </div>
          )}
        </div>

        {/* Footer: Preview + Actions */}
        <div className="border-t border-border px-6 py-4">
          {previewHtml && (
            <div className="mb-3 rounded-md border border-border/50 bg-muted/30 p-3 text-sm max-h-32 overflow-y-auto">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("flashcardStudio.preview")} {previewPending && <span className="opacity-50">...</span>}
              </div>
              <div
                className="prose prose-sm max-w-none [&_.math-expression-block]:my-1 [&_.math-expression-block]:flex [&_.math-expression-block]:justify-center"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("flashcardStudio.cancel")}
            </button>
            <button
              onClick={onSave}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
            >
              {t("flashcardStudio.saveChanges")}
            </button>
          </div>
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
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDoc = documents.find((d) => d.id === selectedId);

  const filteredDocs = documents.filter((d) =>
    d.title.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && e.target instanceof Node && !containerRef.current.contains(e.target)) {
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
                placeholder={t("flashcardStudio.searchDocuments")}
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
                {t("flashcardStudio.noDocument")}
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
                {t("flashcardStudio.noDocumentsFound")}
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
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedDeck = decks.find((d) => d.id === selectedId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && e.target instanceof Node && !containerRef.current.contains(e.target)) {
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
          {selectedDeck?.name || t("flashcardStudio.selectDeck")}
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
                {t("flashcardStudio.noDeck")}
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

export function FlashcardStudioModal({ isOpen, onClose, seed }: FlashcardStudioModalProps) {
  const { t } = useI18n();
  const toast = useToast();
  const { documents, loadDocuments } = useDocumentStore();
  const { decks, activeDeckIds } = useStudyDeckStore();
  const providers = useLLMProvidersStore((state) => state.providers);
  const enabledProviders = useMemo(() => providers.filter((p) => p.enabled), [providers]);
  const maxTokens = useSettingsStore((state) => state.settings.ai.maxTokens) || 4000;
  const aiControls = useSettingsStore((state) => state.settings.ai.aiControls);
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
  const [allExtracts, setAllExtracts] = useState<Extract[]>([]);
  const [areExtractsLoading, setAreExtractsLoading] = useState(false);
  const [generatingExtractIds, setGeneratingExtractIds] = useState<Set<string>>(new Set());
  const [imageAssets, setImageAssets] = useState<ImageAsset[]>([]);
  const [selectedImageAssetIds, setSelectedImageAssetIds] = useState<string[]>([]);
  const [isImageImporting, setIsImageImporting] = useState(false);
  const [isImageRegistryOpen, setIsImageRegistryOpen] = useState(false);
  const appliedSeedKeyRef = useRef<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draftCardsContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

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

  const refreshImageAssets = useCallback(async () => {
    try {
      const assets = await listImageAssets();
      setImageAssets(Array.isArray(assets) ? assets : []);
    } catch (error) {
      console.error("Failed to load image registry assets", error);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void refreshImageAssets();
  }, [isOpen, refreshImageAssets]);

  // Load extracts for the extract browser
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setAreExtractsLoading(true);
    getExtracts()
      .then((result) => {
        if (!cancelled) setAllExtracts(result);
      })
      .catch((err) => {
        console.error("Failed to load extracts", err);
      })
      .finally(() => {
        if (!cancelled) setAreExtractsLoading(false);
      });
    return () => { cancelled = true; };
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
        else if (activeDeckIds[0]) setSelectedDeckId(activeDeckIds[0]);
        if (parsed?.contextSelection) setContextSelection(normalizeContextSelection(parsed.contextSelection));
        if (parsed?.viewMode && ["chat", "templates", "history", "extracts"].includes(parsed.viewMode)) setViewMode(parsed.viewMode);
      } catch (error) {
        console.warn("Failed to restore state", error);
        setSelectedDeckId(activeDeckIds[0] ?? null);
      }
    } else {
      setSelectedDeckId(activeDeckIds[0] ?? null);
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
  }, [isOpen, activeDeckIds[0]]);

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
      viewMode,
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
  const canUseVisionOcclusion = useMemo(
    () =>
      Boolean(
        currentProvider &&
          modelSupportsImageInput(
            currentProvider.provider,
            currentProvider.model,
            currentProvider.baseUrl?.trim() || undefined
          )
      ),
    [currentProvider]
  );

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
      multipleChoice: selected.filter((c) => c.type === "multiple-choice").length,
      imageOcclusion: selected.filter((c) => c.type === "image-occlusion").length,
    };
  }, [draftCards]);

  const createBlankDraftCard = useCallback((type: DraftCardType): DraftCard => {
    const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const seededExcerpt = contextSelection.excerpt?.trim() || "";
    const base: DraftCard = {
      id,
      type,
      selected: true,
      createdAt: Date.now(),
      tags: [],
    };

    if (type === "qa") {
      return { ...base, question: "", answer: "" };
    }
    if (type === "cloze") {
      return { ...base, text: seededExcerpt };
    }
    if (type === "multiple-choice") {
      return {
        ...base,
        question: "",
        answer: "",
        multipleChoiceOptions: [
          { id: "choice-1", text: "" },
          { id: "choice-2", text: "" },
        ],
        multipleChoiceCorrectOptionId: "choice-1",
      };
    }
    return {
      ...base,
      question: "",
      answer: "",
      imageOcclusionAssetId: selectedImageAssetIds[0],
      imageOcclusionRegions: [],
    };
  }, [contextSelection.excerpt, selectedImageAssetIds]);

  useEffect(() => {
    if (!isOpen) {
      appliedSeedKeyRef.current = null;
      return;
    }
    if (!seed?.key || appliedSeedKeyRef.current === seed.key) {
      return;
    }

    appliedSeedKeyRef.current = seed.key;

    if (seed.documentId !== undefined) {
      setSelectedDocumentId(seed.documentId);
    }

    if (seed.excerpt?.trim()) {
      setContextSelection({
        ...DEFAULT_CONTEXT_SELECTION,
        mode: "excerpt",
        excerpt: seed.excerpt,
      });
    }

    if (seed.resetDraftCards || seed.draftCardType) {
      const nextCard = createBlankDraftCard(seed.draftCardType || "qa");
      if ((seed.draftCardType || "qa") === "cloze" && seed.excerpt?.trim()) {
        nextCard.text = seed.excerpt.trim();
      }
      setDraftCards([nextCard]);
      setFlippedCardId(null);
      setEditingCardId(seed.autoEditDraft === false ? null : nextCard.id);
      setViewMode("chat");
    }
  }, [isOpen, seed, createBlankDraftCard]);

  const handleGenerateImageOcclusions = async () => {
    if (isSending) return;
    if (!currentProvider) {
      toast.error(t("flashcardStudio.noLlmProvider"), t("flashcardStudio.noLlmProviderDesc"));
      return;
    }
    if (!canUseVisionOcclusion) {
      toast.error(t("flashcardStudio.imageOcclusionVisionUnsupported"), t("flashcardStudio.imageOcclusionVisionUnsupportedDesc"));
      return;
    }
    if (selectedImageAssetIds.length === 0) {
      toast.error(t("flashcardStudio.noImageSelected"), t("flashcardStudio.noImageSelectedDesc"));
      return;
    }

    setIsSending(true);
    setViewMode("chat");

    const promptText = input.trim() || t("flashcardStudio.imageOcclusionAutoPrompt");
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: promptText,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const fullAssets = (
        await Promise.all(selectedImageAssetIds.map((assetId) => getImageAssetById(assetId)))
      ).filter((asset): asset is ImageAsset => Boolean(asset));

      if (fullAssets.length === 0) {
        throw new Error(t("flashcardStudio.noImageSelectedDesc"));
      }

      const userContent: LLMMessageContentPart[] = [];
      const contextBlocks: string[] = [];

      if (selectedDocument?.title) {
        contextBlocks.push(`Related document: ${selectedDocument.title}`);
      }
      if (selectedDeck?.name) {
        contextBlocks.push(`Target deck: ${selectedDeck.name}`);
      }
      if (contextContent?.trim()) {
        contextBlocks.push(`Reference context:\n${contextContent.trim()}`);
      }

      userContent.push({
        type: "text",
        text: [
          promptText,
          "",
          "Create image occlusion flashcards from the study images below.",
          "Use the exact imageAssetId assigned to each image.",
          "Return one JSON code block only.",
          contextBlocks.length > 0 ? `\nSupporting context:\n${contextBlocks.join("\n\n")}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      });

      fullAssets.forEach((asset, index) => {
        userContent.push({
          type: "text",
          text: `Image ${index + 1}\nimageAssetId: ${asset.id}\nfileName: ${asset.file_name || "untitled"}\nTask: hide the most useful answer-bearing labels or regions in this image.`,
        });
        userContent.push({
          type: "image_url",
          imageUrl: asset.data_url,
        });
      });

      const llmMessages: LLMMessage[] = [
        { role: "system", content: IMAGE_OCCLUSION_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ];

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
        currentProvider.baseUrl?.trim() || undefined,
        currentProvider.temperature,
        currentProvider.maxTokens,
        currentProvider.systemPrompt,
        aiControls.contextFromRelatedCards,
        aiControls.documentSnippetLength
      );

      const assistantId = `assistant-${Date.now()}`;
      const { cards, cleaned } = parseCardsFromResponse(response.content, assistantId);
      const occlusionCards = cards.filter((card) => card.type === "image-occlusion");

      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: cleaned || response.content,
        timestamp: Date.now(),
        cardsGenerated: occlusionCards.length,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (occlusionCards.length === 0) {
        throw new Error(t("flashcardStudio.imageOcclusionNoCards"));
      }

      setDraftCards((prev) => [...occlusionCards, ...prev]);
      toast.success(
        t("flashcardStudio.imageOcclusionCardsGenerated", { count: occlusionCards.length }),
        t("flashcardStudio.imageOcclusionCardsGeneratedDesc")
      );
    } catch (error) {
      toast.error(
        t("flashcardStudio.imageOcclusionGenerationFailed"),
        error instanceof Error ? error.message : t("flashcardStudio.failedReachLlm")
      );
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "system",
          content: `Error: ${error instanceof Error ? error.message : t("flashcardStudio.imageOcclusionGenerationFailed")}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const promptText = customPrompt || input;
    if (!promptText.trim() || isSending) return;
    if (!isNotebookProviderSelected && !currentProvider) {
      toast.error(t("flashcardStudio.noLlmProvider"), t("flashcardStudio.noLlmProviderDesc"));
      return;
    }
    if (isNotebookProviderSelected && !selectedNotebookId) {
      toast.error(t("flashcardStudio.noNotebookSelected"), t("flashcardStudio.noNotebookSelectedDesc"));
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
          toast.success(t("flashcardStudio.cardsGenerated", { count: cards.length }), t("flashcardStudio.cardsGeneratedDesc"));
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
        currentProvider.baseUrl?.trim() || undefined,
        currentProvider.temperature,
        currentProvider.maxTokens,
        currentProvider.systemPrompt,
        aiControls.contextFromRelatedCards,
        aiControls.documentSnippetLength
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
        toast.success(t("flashcardStudio.cardsGenerated", { count: cards.length }), t("flashcardStudio.cardsGeneratedDesc"));
        
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
      toast.error(t("flashcardStudio.generationFailed"), error instanceof Error ? error.message : t("flashcardStudio.failedReachLlm"));
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

    // Separate already-persisted cards (from extract generation) from new drafts
    const alreadySaved = selected.filter((c) => c.alreadyPersisted);
    const toCreate = selected.filter((c) => !c.alreadyPersisted);

    if (toCreate.length === 0) {
      // All selected cards were already persisted — just clear them from drafts
      setDraftCards((prev) => prev.filter((c) => !c.selected));
      toast.success(t("flashcardStudio.cardsSaved"), t("flashcardStudio.cardsSavedDesc", { count: alreadySaved.length }));
      return;
    }

    setIsSaving(true);

    const results = await Promise.all(
      toCreate.map(async (card) => {
        try {
          const baseInput: CreateLearningItemInput = {
            item_type: card.type === "cloze" ? "cloze" : "qa",
            question:
              card.type === "cloze"
                ? (card.text || "").trim()
                : (card.question || "").trim(),
            answer:
              card.type === "qa"
                ? (card.answer || "").trim()
                : card.type === "multiple-choice"
                ? ((card.multipleChoiceOptions || []).find((option) => option.id === card.multipleChoiceCorrectOptionId)?.text || "").trim()
                : (card.answer || "").trim(),
            cloze_text: card.type === "cloze" ? (card.text || "").trim() : undefined,
            document_id: selectedDocument?.id,
            tags: [...deckTags, ...card.tags],
            image_asset_ids:
              card.type === "image-occlusion"
                ? [card.imageOcclusionAssetId || selectedImageAssetIds[0]].filter(Boolean) as string[]
                : selectedImageAssetIds,
            interaction_metadata:
              card.type === "multiple-choice"
                ? {
                    interactionType: "multiple-choice",
                    multipleChoiceOptions: card.multipleChoiceOptions || [],
                    multipleChoiceCorrectOptionId: card.multipleChoiceCorrectOptionId,
                    multipleChoiceExplanation: card.answer || undefined,
                  }
                : card.type === "image-occlusion"
                ? {
                    interactionType: "image-occlusion",
                    imageOcclusionAssetId: card.imageOcclusionAssetId || selectedImageAssetIds[0],
                    imageOcclusionRegions: card.imageOcclusionRegions || [],
                    imageOcclusionPrompt: card.question || undefined,
                  }
                : undefined,
          };

          if (card.type === "qa" && (!baseInput.question || !baseInput.answer)) {
            throw new Error("Q&A cards require both a question and an answer.");
          }
          if (card.type === "cloze" && !baseInput.cloze_text) {
            throw new Error("Cloze cards require cloze text.");
          }
          if (
            card.type === "multiple-choice" &&
            (
              !baseInput.question ||
              (card.multipleChoiceOptions || []).filter((option) => option.text.trim().length > 0).length < 2 ||
              !card.multipleChoiceCorrectOptionId
            )
          ) {
            throw new Error("Multiple choice cards require a question, at least two options, and a correct answer.");
          }
          if (
            card.type === "image-occlusion" &&
            (
              !((card.imageOcclusionAssetId || selectedImageAssetIds[0])) ||
              (card.imageOcclusionRegions || []).length === 0
            )
          ) {
            throw new Error("Image occlusion cards require an image and at least one hidden region.");
          }

          await createLearningItem(baseInput);
          return { id: card.id, success: true };
        } catch (error) {
          console.error("Failed to create card", error);
          return { id: card.id, success: false };
        }
      })
    );

    const failedIds = results.filter((r) => !r.success).map((r) => r.id);
    const newlySaved = toCreate.length - failedIds.length;
    const savedCount = alreadySaved.length + newlySaved;
    
    // Remove all selected cards from drafts (persisted ones + successfully created ones).
    // Keep failed ones so the user can retry.
    const idsToRemove = new Set([
      ...alreadySaved.map((c) => c.id),
      ...toCreate.filter((c) => !failedIds.includes(c.id)).map((c) => c.id),
    ]);
    setDraftCards((prev) => prev.filter((c) => !idsToRemove.has(c.id)));
    
    if (failedIds.length > 0) {
      toast.error(t("flashcardStudio.someCardsFailed"), t("flashcardStudio.someCardsFailedDesc", { saved: savedCount, failed: failedIds.length }));
    } else {
      toast.success(t("flashcardStudio.cardsSaved"), t("flashcardStudio.cardsSavedDesc", { count: savedCount }));
    }
    setIsSaving(false);
  };

  const handleUseExtractAsContext = useCallback((extract: Extract) => {
    setSelectedDocumentId(extract.document_id);
    setContextSelection({ ...DEFAULT_CONTEXT_SELECTION, mode: "excerpt", excerpt: extract.content });
    setViewMode("chat");
  }, []);

  const handleCreateCardFromExtract = useCallback((extract: Extract) => {
    const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const card: DraftCard = {
      id,
      type: "qa",
      question: extract.content.trim(),
      answer: "",
      selected: true,
      createdAt: Date.now(),
      tags: [],
    };
    setDraftCards((prev) => [card, ...prev]);
    setEditingCardId(card.id);
    setSelectedDocumentId(extract.document_id);
  }, []);

  const handleGenerateFromExtract = useCallback(async (extractId: string) => {
    setGeneratingExtractIds((prev) => new Set(prev).add(extractId));
    try {
      const items = await generateLearningItemsFromExtract(extractId);
      const newDrafts: DraftCard[] = items.map((item, idx) => {
        // The local Rust generator creates cloze cards with question=[...] and answer=hidden_word
        // but never sets cloze_text. Convert to proper {{c1::}} format for the DraftCard.
        if (item.item_type === "Cloze") {
          const clozeText = item.cloze_text
            || (item.question && item.answer
              ? item.question.replace(/\[\.\.\.\]/g, `{{c1::${item.answer}}}`)
              : item.question || "");
          return {
            id: `draft-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
            type: "cloze" as const,
            question: item.question || "",
            answer: item.answer,
            text: clozeText,
            selected: true,
            createdAt: Date.now(),
            tags: item.tags || [],
            alreadyPersisted: true,
            persistedItemId: item.id,
          };
        }
        return {
          id: `draft-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
          type: "qa" as const,
          question: item.question || "",
          answer: item.answer || "",
          text: item.cloze_text,
          selected: true,
          createdAt: Date.now(),
          tags: item.tags || [],
          alreadyPersisted: true,
          persistedItemId: item.id,
        };
      });
      setDraftCards((prev) => [...newDrafts, ...prev]);
      toast.success(t("flashcardStudio.cardsGenerated", { count: newDrafts.length }));
    } catch (error) {
      console.error("Failed to generate cards from extract", error);
      toast.error(t("flashcardStudio.extractGenerationFailed"), String(error));
    } finally {
      setGeneratingExtractIds((prev) => {
        const next = new Set(prev);
        next.delete(extractId);
        return next;
      });
    }
  }, [t]);

  const ingestFilesIntoRegistry = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setIsImageImporting(true);
    try {
      const previousIds = new Set(imageAssets.map((asset) => asset.id));
      const imported = await Promise.all(files.map((file) => ingestImageFile(file)));
      const importedIds = imported.map((asset) => asset.id);
      const duplicateCount = importedIds.filter((id) => previousIds.has(id)).length;

      setImageAssets((prev) => {
        const merged = [...imported, ...prev];
        const dedup = new Map(merged.map((asset) => [asset.id, asset]));
        return Array.from(dedup.values());
      });
      setSelectedImageAssetIds((prev) => Array.from(new Set([...prev, ...importedIds])));

      if (duplicateCount > 0 && duplicateCount === imported.length) {
        toast.info(t("imageRegistry.duplicateReused"), t("imageRegistry.duplicateReusedDesc", { count: duplicateCount }));
      } else {
        toast.success(
          t("flashcardStudio.imagesImported"),
          duplicateCount > 0
            ? t("imageRegistry.assetsAddedWithDuplicates", { added: imported.length - duplicateCount, duplicates: duplicateCount })
            : t("flashcardStudio.imagesImportedDesc", { count: imported.length })
        );
      }
    } catch (error) {
      toast.error(t("flashcardStudio.imageImportFailed"), error instanceof Error ? error.message : t("flashcardStudio.unableImportImage"));
    } finally {
      setIsImageImporting(false);
    }
  }, [imageAssets, t, toast]);

  const toggleSelectedImageAsset = (assetId: string) => {
    setSelectedImageAssetIds((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId]
    );
  };

  const handleTemplateSelect = (template: QuickTemplate) => {
    setInput(template.prompt);
    inputRef.current?.focus();
    setViewMode("chat");
    
    if (!selectedDocument) {
      toast.info(t("flashcardStudio.selectDocumentFirst"), t("flashcardStudio.selectDocumentFirstDesc"));
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
    toast.success(t("flashcardStudio.tagsAdded"), t("flashcardStudio.tagsAddedDesc", { count: tags.length }));
  };

  const handleDeleteSelected = () => {
    setDraftCards((prev) => prev.filter((c) => !c.selected));
    toast.success(t("flashcardStudio.cardsRemoved"), t("flashcardStudio.cardsRemovedDesc"));
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
    toast.success(t("flashcardStudio.cardUpdated"), t("flashcardStudio.cardUpdatedDesc"));
  };

  const duplicateCard = (card: DraftCard) => {
    const newCard: DraftCard = {
      ...card,
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
      selected: true,
    };
    setDraftCards((prev) => [newCard, ...prev]);
    toast.success(t("flashcardStudio.cardDuplicated"), t("flashcardStudio.cardDuplicatedDesc"));
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
      toast.error(t("flashcardStudio.notebookSelectionFailed"), error instanceof Error ? error.message : t("flashcardStudio.unableSelectNotebook"));
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onPasteCapture={(event) => {
        if (isImageRegistryOpen) return;
        const imageFiles = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (imageFiles.length === 0) return;

        event.preventDefault();
        void ingestFilesIntoRegistry(imageFiles);
      }}
    >
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
              <button
                onClick={() => setViewMode("extracts")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  viewMode === "extracts" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                {t("flashcardStudio.extracts")}
                {allExtracts.length > 0 && (
                  <span className="ml-0.5 text-[10px] bg-primary-foreground/20 px-1 rounded-full">
                    {allExtracts.length}
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
            <button
              type="button"
              onClick={() => void handleGenerateImageOcclusions()}
              disabled={isImageImporting || isSending || selectedImageAssetIds.length === 0 || !canUseVisionOcclusion}
              title={
                selectedImageAssetIds.length === 0
                  ? t("flashcardStudio.noImageSelectedDesc")
                  : !canUseVisionOcclusion
                  ? t("flashcardStudio.imageOcclusionVisionUnsupportedDesc")
                  : t("flashcardStudio.generateImageOcclusions")
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-50"
            >
              {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {t("flashcardStudio.generateImageOcclusions")}
            </button>
            <button
              type="button"
              onClick={() => setIsImageRegistryOpen(true)}
              disabled={isImageImporting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-60"
            >
              <Images className="w-3.5 h-3.5" />
              {t("flashcardStudio.openImageLibrary")}
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
                {t("flashcardStudio.selectedCount", { count: selectedImageAssetIds.length })}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {t("flashcardStudio.imagePasteHint")}
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
                        {t("flashcardStudio.welcomeBodyPrefix")}{" "}
                        {t("flashcardStudio.welcomeBodyUse")} <strong>{t("flashcardStudio.contextControlTitle")}</strong>{" "}
                        {t("flashcardStudio.welcomeBodySuffix")}
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
                              {t("flashcardStudio.generatedCardsShort", { count: message.cardsGenerated })}
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
                        ? t("flashcardStudio.contextPromptPlaceholder")
                        : t("flashcardStudio.generalPromptPlaceholder")}
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
                  <h3 className="text-lg font-semibold text-foreground mb-2">{t("flashcardStudio.quickTemplates")}</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    {t("flashcardStudio.quickTemplatesDesc")}{" "}
                    {t("flashcardStudio.contextControlHintPrefix")} <strong>{t("flashcardStudio.contextControlTitle")}</strong> {t("flashcardStudio.contextControlHintSuffix")}
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
                      <h3 className="text-lg font-semibold text-foreground">{t("flashcardStudio.generationHistory")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("flashcardStudio.generationHistoryDesc")}
                      </p>
                    </div>
                    {generationHistory.length > 0 && (
                      <button
                        onClick={() => {
                          setGenerationHistory([]);
                          localStorage.removeItem(HISTORY_KEY);
                          toast.success(t("flashcardStudio.historyCleared"));
                        }}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        {t("flashcardStudio.clearAll")}
                      </button>
                    )}
                  </div>
                  
                  {generationHistory.length === 0 ? (
                    <div className="text-center py-12">
                      <History className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground">{t("flashcardStudio.noGenerationHistory")}</p>
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
                                  {t("flashcardStudio.historyFromDocument", { name: item.documentName })}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs font-medium text-primary">
                                {t("flashcardStudio.cardsWithCount", { count: item.cardCount })}
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

            {viewMode === "extracts" && (
              areExtractsLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                </div>
              ) : (
                <ExtractBrowserPanel
                  extracts={allExtracts}
                  documents={documents.map((d) => ({ id: d.id, title: d.title }))}
                  selectedDocumentId={selectedDocumentId}
                  generatingExtractIds={generatingExtractIds}
                  onUseAsContext={handleUseExtractAsContext}
                  onGenerateCards={handleGenerateFromExtract}
                  onCreateCard={handleCreateCardFromExtract}
                />
              )
            )}
          </div>

          {/* Right Panel - Draft Cards */}
          <div className="flex h-full min-h-0 flex-col bg-muted/20">
            {/* Draft Header */}
            <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {t("flashcardStudio.draftCards")}
                  {stats.total > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({stats.selected}/{stats.total})
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {stats.qa > 0 && `${stats.qa} ${t("flashcardStudio.cardTypeQaShort")}`}
                  {stats.qa > 0 && stats.cloze > 0 && " · "}
                  {stats.cloze > 0 && `${stats.cloze} ${t("flashcardStudio.cardTypeCloze")}`}
                  {(stats.multipleChoice > 0 || stats.imageOcclusion > 0) && (stats.qa > 0 || stats.cloze > 0) && " · "}
                  {stats.multipleChoice > 0 && `${stats.multipleChoice} ${t("flashcardStudio.cardTypeMcShort")}`}
                  {stats.multipleChoice > 0 && stats.imageOcclusion > 0 && " · "}
                  {stats.imageOcclusion > 0 && `${stats.imageOcclusion} ${t("flashcardStudio.cardTypeImageShort")}`}
                  {stats.selected === 0 && t("flashcardStudio.noCardsSelected")}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {([
                  ["qa", "Q&A"],
                  ["cloze", "Cloze"],
                  ["multiple-choice", "MC"],
                  ["image-occlusion", "Image"],
                ] as const).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      const nextCard = createBlankDraftCard(type);
                      setDraftCards((prev) => [nextCard, ...prev]);
                      setEditingCardId(nextCard.id);
                    }}
                    className="hidden rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground hover:bg-muted md:inline-flex"
                    title={t("flashcardStudio.addCardTitle", { label })}
                  >
                    + {label}
                  </button>
                ))}
                <button
                  onClick={() => toggleSelectAll(true)}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                  title={t("flashcardStudio.selectAll")}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleSelectAll(false)}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                  title={t("flashcardStudio.deselectAll")}
                >
                  <AlertCircle className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-border mx-1" />
                <button
                  onClick={() => setDraftCards([])}
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title={t("flashcardStudio.clearAll")}
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
                      placeholder={t("flashcardStudio.tagsPlaceholder")}
                      className="flex-1 text-xs bg-transparent outline-none"
                    />
                    <button
                      onClick={handleAddTagToSelected}
                      className="text-xs text-primary font-medium hover:opacity-80"
                    >
                      {t("reviewHome.add")}
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setIsTagInputVisible(true)}
                      className="flex items-center gap-1.5 text-xs text-primary hover:opacity-80"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      {t("flashcardStudio.tagSelected", { count: stats.selected })}
                    </button>
                    <button
                      onClick={handleDeleteSelected}
                      className="flex items-center gap-1.5 text-xs text-destructive hover:opacity-80"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t("queue.delete")}
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
                  <p className="text-sm text-muted-foreground mb-1">{t("flashcardStudio.noDraftCards")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("flashcardStudio.generateCardsHint")}
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
                            : card.type === "cloze"
                            ? "bg-purple-500/10 text-purple-600"
                            : card.type === "multiple-choice"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-amber-500/10 text-amber-700"
                        )}
                      >
                        {card.type === "qa"
                          ? "Q&A"
                          : card.type === "cloze"
                          ? t("flashcardStudio.cardTypeCloze")
                          : card.type === "multiple-choice"
                          ? t("flashcardStudio.cardTypeMultipleChoice")
                          : t("flashcardStudio.cardTypeImageOcclusion")}
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
                          title={t("flashcardStudio.duplicate")}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingCardId(card.id)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground"
                          title={t("flashcardStudio.edit")}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setDraftCards((prev) => prev.filter((c) => c.id !== card.id))
                          }
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title={t("queue.delete")}
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
                      sourceExcerpt={contextSelection.excerpt}
                      imageAssets={imageAssets}
                      defaultImageAssetId={selectedImageAssetIds[0]}
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
                  {t("flashcardStudio.saveSelectedCards", { count: stats.selected })}
                </button>
                <p className="text-center text-[10px] text-muted-foreground mt-2">
                  {t("flashcardStudio.saveShortcutHint")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isImageRegistryOpen && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/60 p-4">
          <div className="h-[88vh] w-full max-w-7xl">
            <ImageRegistryLibrary
              initialSelectedIds={selectedImageAssetIds}
              onSelectedIdsChange={setSelectedImageAssetIds}
              onAssetsChange={setImageAssets}
              onClose={() => setIsImageRegistryOpen(false)}
              onConfirmSelection={(ids) => {
                setSelectedImageAssetIds(ids);
                setIsImageRegistryOpen(false);
              }}
              showCloseButton
              showConfirmButton
              title={t("flashcardStudio.imageLibraryTitle")}
              subtitle={t("flashcardStudio.imageLibrarySubtitle")}
              confirmLabel={t("flashcardStudio.useSelectedImages")}
            />
          </div>
        </div>
      )}

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
              <h3 className="text-lg font-semibold text-foreground">{t("flashcardStudio.keyboardShortcuts")}</h3>
              <button
                onClick={() => setShowShortcuts(false)}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">{t("flashcardStudio.shortcutSendMessage")}</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl + Enter</kbd>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">{t("flashcardStudio.shortcutSaveSelected")}</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl + S</kbd>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">{t("flashcardStudio.shortcutClose")}</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Esc</kbd>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">{t("flashcardStudio.shortcutShow")}</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">?</kbd>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">{t("flashcardStudio.shortcutFlip")}</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">{t("flashcardStudio.clickCard")}</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FlashcardStudioModal;
