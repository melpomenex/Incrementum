/**
 * Browser backend command handlers
 * Maps Tauri command names to IndexedDB operations
 */

import * as db from './database.js';
import { getBrowserFile } from './browser-file-store';
import { createYjsFilePath, downloadRoomFile, parseYjsFilePath, uploadRoomFile } from './yjs-file-service.js';
import { parseAnkiPackage, convertAnkiToLearningItems } from '../utils/ankiParserBrowser';
import {
    getDemoContentStatus,
    importDemoContentManually,
} from '../lib/demoContent';
import * as pdfjsLib from 'pdfjs-dist';
import ePub from 'epubjs';
import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';
import { useSettingsStore } from '../stores/settingsStore';
import { resolveFsrsParamsForScope } from '../utils/fsrsScope';
import { getDefaultFsrsParameters, normalizeFsrsParameters } from '../utils/fsrsParameters';
import { parseSm18State, sm18Review, ratingToSm18Grade } from './sm18';
import { parseSm20State, sm20PreviewIntervals, sm20Review } from './sm20';
import { v4 as uuidv4 } from 'uuid';
import { getPositionProgress, type DocumentPosition } from '../types/position';
import {
    fetchYouTubeTranscript,
} from '../utils/youtubeTranscriptBrowser';
import {
    getRecentlyViewedIds,
} from './queueSession';
import {
    fetchPlaylistInfo,
    importPlaylistVideos,
    isYouTubeApiEnabled,
    extractPlaylistId,
} from './youtubeDataApi';
import { providerRequiresApiKey } from '../utils/llmProviderUtils';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

// Suppress verbose PDF.js warnings (Unicode mismatch, unknown glyph name, etc.)
// Only show errors, not warnings or info messages
(pdfjsLib as unknown as { GlobalWorkerOptions: { verbosity: number } }).GlobalWorkerOptions.verbosity = 0;

type CommandHandler = (args: Record<string, unknown>) => Promise<unknown>;

async function blobToBase64DataUrlPayload(blob: Blob): Promise<string> {
    // Returns only the base64 payload portion (no "data:...;base64,").
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const raw = String(reader.result || '');
            const base64 = raw.split(',')[1] || '';
            resolve(base64);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

/**
 * Extract text content from an EPUB file
 */
async function extractEpubText(data: ArrayBuffer): Promise<string> {
    try {
        const book = ePub(data);
        await book.ready;

        const spine = book.spine as { items?: Array<{ href: string }>; spineItems?: Array<{ href: string }> };
        const textParts: string[] = [];

        // Get all spine items (chapters)
        const spineItems = spine.items || spine.spineItems || [];

        for (let i = 0; i < spineItems.length; i++) {
            const item = spineItems[i];
            try {
                // Load the chapter content
                const doc = await book.load(item.href);
                if (doc) {
                    // Extract text from the document
                    const container = document.createElement('div');
                    if (typeof doc === 'string') {
                        container.innerHTML = doc;
                    } else if (doc instanceof Document) {
                        container.innerHTML = doc.body?.innerHTML || '';
                    }

                    // Get text content, preserving some structure
                    const text = container.innerText || container.textContent || '';
                    const cleanedText = text
                        .replace(/\s+/g, ' ')
                        .trim();

                    if (cleanedText && cleanedText.length > 50) {
                        textParts.push(`[Chapter ${i + 1}]\n${cleanedText}`);
                    }
                }
            } catch (chapterError) {
                console.warn(`[Browser] Failed to extract text from EPUB chapter ${i + 1}:`, chapterError);
            }
        }

        book.destroy();
        return textParts.join('\n\n');
    } catch (error) {
        console.warn('[Browser] EPUB text extraction failed:', error);
        return '';
    }
}

/**
 * Extract text content from a PDF file
 */
async function extractPdfText(data: ArrayBuffer): Promise<string> {
    try {
        const loadingTask = pdfjsLib.getDocument({ data, verbosity: 0 });
        const pdfDoc = await loadingTask.promise;
        const numPages = pdfDoc.numPages;
        const textParts: string[] = [];

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            try {
                const page = await pdfDoc.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map((item: any) => ('str' in item ? item.str : ''))
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                if (pageText) {
                    textParts.push(`[Page ${pageNum}]\n${pageText}`);
                }
            } catch (pageError) {
                console.warn(`[Browser] Failed to extract text from page ${pageNum}:`, pageError);
            }
        }

        return textParts.join('\n\n');
    } catch (error) {
        console.warn('[Browser] PDF text extraction failed:', error);
        return '';
    }
}

// Helper to convert snake_case DB objects to camelCase frontend objects
function toCamelCase(obj: unknown): unknown {
    if (obj === undefined || obj === null) {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(v => toCamelCase(v));
    } else if (typeof obj === 'object' && obj !== null) {
        // Handle both plain objects and IndexedDB result objects
        return Object.keys(obj).reduce((result, key) => {
            const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            result[camelKey] = toCamelCase((obj as Record<string, unknown>)[key]);
            return result;
        }, {} as Record<string, unknown>);
    }
    return obj;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function getFsrsParameters(context?: { activeDeckId?: string | null; tags?: string[] }) {
    const settings = useSettingsStore.getState().settings;
    const fsrsParams = resolveFsrsParamsForScope({
        settings,
        activeDeckId: context?.activeDeckId,
        tags: context?.tags ?? [],
    });

    const params: Record<string, unknown> = {
        request_retention: fsrsParams.desiredRetention ?? 0.9,
        maximum_interval: fsrsParams.maximumInterval ?? 36500,
        enable_fuzz: false,
    };
    const normalizedWeights = normalizeFsrsParameters(fsrsParams.personalizedWeights);
    if (normalizedWeights) {
        params.w = normalizedWeights;
    }
    return params;
}

function createFsrsScheduler(context?: { activeDeckId?: string | null; tags?: string[] }) {
    return fsrs(getFsrsParameters(context));
}

function toFsrsGrade(rating: number): Grade {
    switch (rating) {
        case 1:
            return Rating.Again;
        case 2:
            return Rating.Hard;
        case 3:
            return Rating.Good;
        case 4:
            return Rating.Easy;
        default:
            return Rating.Good;
    }
}

function normalizeState(state?: string): State {
    switch ((state || '').toLowerCase()) {
        case 'learning':
            return State.Learning;
        case 'review':
            return State.Review;
        case 'relearning':
            return State.Relearning;
        default:
            return State.New;
    }
}

function stateToString(state: State): string {
    switch (state) {
        case State.Learning:
            return 'learning';
        case State.Review:
            return 'review';
        case State.Relearning:
            return 'relearning';
        default:
            return 'new';
    }
}

function intervalFromDue(now: Date, due: Date, scheduledDays?: number): number {
    const delta = (due.getTime() - now.getTime()) / DAY_MS;
    if (!Number.isFinite(delta)) {
        return scheduledDays ?? 0;
    }
    return Math.max(0, delta);
}

// SM-2 algorithm state for browser/PWA
interface SM2State {
    ease_factor: number;
    interval: number;
    repetitions: number;
}

function parseSm2State(algorithmState: string | undefined): SM2State {
    if (algorithmState) {
        try {
            const parsed = JSON.parse(algorithmState);
            if (parsed && typeof parsed.ease_factor === 'number') {
                return parsed as SM2State;
            }
        } catch { /* ignore */ }
    }
    return { ease_factor: 2.5, interval: 0, repetitions: 0 };
}

function sm2NextInterval(state: SM2State, rating: number): SM2State {
    const quality = rating <= 1 ? 0 : rating === 2 ? 3 : rating === 3 ? 4 : 5;
    const newState = { ...state };

    if (quality < 3) {
        newState.repetitions = 0;
        newState.interval = 0;
    } else {
        newState.repetitions += 1;
        switch (newState.repetitions) {
            case 1: newState.interval = 1; break;
            case 2: newState.interval = 6; break;
            default: newState.interval = state.interval * state.ease_factor; break;
        }
        const q = quality;
        newState.ease_factor += 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
        if (newState.ease_factor < 1.3) newState.ease_factor = 1.3;
    }
    return newState;
}

async function applySm2ReviewBrowser(item: db.LearningItem, rating: number, algorithmType?: string): Promise<db.LearningItem> {
    const state = parseSm2State(item.algorithm_state);
    const newState = sm2NextInterval(state, rating);
    const now = new Date();
    const intervalSeconds = newState.interval * 86400 * 1000;
    const nextDue = new Date(now.getTime() + intervalSeconds);

    const failed = rating <= 1;
    const graduated = newState.interval >= 1.0;
    const nextState = failed ? 'relearning'
        : graduated ? 'review'
        : item.state === 'new' ? 'learning' : item.state;

    return db.updateLearningItem(item.id, {
        due_date: nextDue.toISOString(),
        interval: newState.interval,
        ease_factor: newState.ease_factor,
        last_review_date: now.toISOString(),
        review_count: (item.review_count || 0) + 1,
        lapses: failed ? (item.lapses || 0) + 1 : item.lapses || 0,
        state: nextState,
        algorithm_state: JSON.stringify(newState),
        algorithm_type: algorithmType || 'sm2',
    });
}

async function applySm18ReviewBrowser(item: db.LearningItem, rating: number, algorithmType?: string): Promise<db.LearningItem> {
    const state = parseSm18State(item.algorithm_state);
    const now = new Date();

    // Compute elapsed days since last review
    let elapsedDays = 0;
    if (item.last_review_date) {
        elapsedDays = (now.getTime() - new Date(item.last_review_date).getTime()) / (86400 * 1000);
    }

    const grade = ratingToSm18Grade(rating);
    const result = sm18Review(state, grade, elapsedDays);

    const intervalMs = result.new_interval * 86400 * 1000;
    const nextDue = new Date(now.getTime() + intervalMs);

    const failed = grade < 3;
    const nextState = failed ? 'relearning'
        : result.new_interval >= 1.0 ? 'review'
        : item.state === 'new' ? 'learning' : item.state;

    return db.updateLearningItem(item.id, {
        due_date: nextDue.toISOString(),
        interval: result.new_interval,
        last_review_date: now.toISOString(),
        review_count: (item.review_count || 0) + 1,
        lapses: result.state.lapses,
        state: nextState,
        memory_state: {
            stability: result.state.stability,
            difficulty: result.state.difficulty * 10.0, // SM-18 D is [0,1], display uses [0,10]
        },
        difficulty: result.state.difficulty * 10.0,
        algorithm_state: JSON.stringify(result.state),
        algorithm_type: algorithmType || 'sm18',
    });
}

async function applySm20ReviewBrowser(item: db.LearningItem, rating: number, algorithmType?: string): Promise<db.LearningItem> {
    const state = parseSm20State(item.algorithm_state);
    const now = new Date();

    let elapsedDays = 0;
    if (item.last_review_date) {
        elapsedDays = (now.getTime() - new Date(item.last_review_date).getTime()) / (86400 * 1000);
    }

    const result = sm20Review(state, rating, elapsedDays);
    const intervalMs = result.interval_days * 86400 * 1000;
    const nextDue = new Date(now.getTime() + intervalMs);
    const failed = rating <= 1;
    const nextState = failed ? 'relearning'
        : result.interval_days >= 1.0 ? 'review'
        : item.state === 'new' ? 'learning' : item.state;

    return db.updateLearningItem(item.id, {
        due_date: nextDue.toISOString(),
        interval: result.interval_days,
        last_review_date: now.toISOString(),
        review_count: (item.review_count || 0) + 1,
        lapses: result.state.lapses,
        state: nextState,
        memory_state: {
            stability: result.state.stability,
            difficulty: result.state.difficulty,
        },
        difficulty: result.state.difficulty * 10.0,
        algorithm_state: JSON.stringify(result.state),
        algorithm_type: algorithmType || 'sm20',
    });
}

function tokenizeForSimilarity(text: string): Set<string> {
    return new Set(
        text
            .toLowerCase()
            .split(/\s+/)
            .map((token) => token.replace(/[^a-z0-9]/g, ""))
            .filter(Boolean)
    );
}

function jaccardSimilarity(a: string, b: string): number {
    const setA = tokenizeForSimilarity(a);
    const setB = tokenizeForSimilarity(b);
    if (setA.size === 0 || setB.size === 0) return 0;
    const intersection = [...setA].filter((token) => setB.has(token)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
}

/**
 * Priority-based interval adjustment
 * 
 * Higher priority = shorter interval (review sooner)
 * Lower priority = longer interval (review later)
 * 
 * Priority slider: 0-100 (default 50)
 * - 0-20: Very low priority (1.5x interval)
 * - 21-40: Low priority (1.2x interval)
 * - 41-60: Normal priority (1.0x interval - no change)
 * - 61-80: High priority (0.75x interval)
 * - 81-100: Very high priority (0.5x interval)
 */
function applyPriorityMultiplier(intervalDays: number, prioritySlider: number): number {
    // Default to normal priority if not set
    const priority = prioritySlider ?? 50;
    
    let multiplier: number;
    if (priority <= 20) {
        multiplier = 1.5;
    } else if (priority <= 40) {
        multiplier = 1.2;
    } else if (priority <= 60) {
        multiplier = 1.0;
    } else if (priority <= 80) {
        multiplier = 0.75;
    } else {
        multiplier = 0.5;
    }
    
    return intervalDays * multiplier;
}

/**
 * Bounded interval for "Hard" ratings
 * 
 * Prevents "Hard" from pushing items too far into the future
 * while still respecting the priority
 */
function applyHardRatingBound(intervalDays: number, prioritySlider: number): number {
    // Max interval for "Hard" rating depends on priority
    // High priority items: max 7 days even on "Hard"
    // Normal priority: max 14 days
    // Low priority: max 21 days
    const priority = prioritySlider ?? 50;
    
    let maxInterval: number;
    if (priority >= 80) {
        maxInterval = 7;
    } else if (priority >= 60) {
        maxInterval = 14;
    } else if (priority >= 40) {
        maxInterval = 21;
    } else {
        maxInterval = 30;
    }
    
    return Math.min(intervalDays, maxInterval);
}

function getPriorityLabel(prioritySlider?: number): string {
    const priority = prioritySlider ?? 50;
    if (priority >= 81) return 'Very High';
    if (priority >= 61) return 'High';
    if (priority >= 41) return 'Normal';
    if (priority >= 21) return 'Low';
    return 'Very Low';
}

function suggestAutoTags(title: string, content: string): string[] {
    const corpus = `${title} ${content}`.toLowerCase();
    const tags: string[] = [];
    const candidates: Array<[string, string[]]> = [
        ["math", ["equation", "theorem", "calculus", "algebra"]],
        ["history", ["century", "empire", "war", "revolution"]],
        ["biology", ["cell", "protein", "genome", "species"]],
        ["language", ["vocabulary", "grammar", "translation", "sentence"]],
        ["computer-science", ["algorithm", "compiler", "database", "programming"]],
    ];
    for (const [tag, keywords] of candidates) {
        if (keywords.some((keyword) => corpus.includes(keyword))) {
            tags.push(tag);
        }
    }
    tags.push("auto-tagged");
    return tags;
}

function buildCardFromDocument(doc: db.Document, now: Date): Card {
    const card = createEmptyCard(now);
    card.due = doc.next_reading_date ? new Date(doc.next_reading_date) : now;
    card.last_review = doc.date_last_reviewed ? new Date(doc.date_last_reviewed) : undefined;
    card.stability = doc.stability ?? 0;
    card.difficulty = doc.difficulty ?? 0;
    card.scheduled_days = doc.stability ?? 0;
    card.reps = doc.reps ?? 0;
    card.lapses = 0;
    card.learning_steps = 0;
    card.state = (doc.reps ?? 0) > 0 || doc.date_last_reviewed ? State.Review : State.New;
    return card;
}

function buildCardFromExtract(extract: db.Extract, now: Date): Card {
    const card = createEmptyCard(now);
    card.due = extract.next_review_date ? new Date(extract.next_review_date) : now;
    card.last_review = extract.last_review_date ? new Date(extract.last_review_date) : undefined;
    card.stability = extract.memory_state?.stability ?? 0;
    card.difficulty = extract.memory_state?.difficulty ?? 0;
    card.scheduled_days = extract.memory_state?.stability ?? 0;
    card.reps = extract.reps ?? extract.review_count ?? 0;
    card.lapses = 0;
    card.learning_steps = 0;
    card.state = (extract.reps ?? extract.review_count ?? 0) > 0 ? State.Review : State.New;
    return card;
}

function buildCardFromLearningItem(item: db.LearningItem, now: Date): Card {
    const card = createEmptyCard(now);
    card.due = item.due_date ? new Date(item.due_date) : now;
    card.last_review = item.last_review_date ? new Date(item.last_review_date) : undefined;
    card.stability = item.memory_state?.stability ?? 0;
    card.difficulty = item.memory_state?.difficulty ?? 0;
    card.scheduled_days = item.interval ?? 0;
    card.reps = item.review_count ?? 0;
    card.lapses = item.lapses ?? 0;
    card.learning_steps = 0;
    card.state = normalizeState(item.state);
    return card;
}

type BrowserCardVersionEntry = {
    version_id: string;
    item_id: string;
    timestamp: string;
    reason?: string;
    question: string;
    answer?: string;
};

const CARD_VERSION_STORAGE_KEY = "incrementum_browser_card_versions";
const AUTOMATION_KEY_STORAGE = "incrementum_browser_automation_api_key";
const BROWSER_SYNC_CONFIG_STORAGE = "incrementum_browser_sync_config";
const PREREQ_STORAGE_KEY = "incrementum_browser_prerequisites";
const DAILY_NOTE_LINKS_KEY = "incrementum_browser_daily_notes";

function readBrowserCardVersions(): Record<string, BrowserCardVersionEntry[]> {
    try {
        return JSON.parse(localStorage.getItem(CARD_VERSION_STORAGE_KEY) || "{}");
    } catch {
        return {};
    }
}

function writeBrowserCardVersions(data: Record<string, BrowserCardVersionEntry[]>): void {
    localStorage.setItem(CARD_VERSION_STORAGE_KEY, JSON.stringify(data));
}

function getOrCreateAutomationApiKey(): string {
    const existing = localStorage.getItem(AUTOMATION_KEY_STORAGE);
    if (existing) return existing;
    const generated = `inc_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(AUTOMATION_KEY_STORAGE, generated);
    return generated;
}

function readPrerequisites(): Record<string, string[]> {
    try {
        return JSON.parse(localStorage.getItem(PREREQ_STORAGE_KEY) || "{}");
    } catch {
        return {};
    }
}

function writePrerequisites(data: Record<string, string[]>): void {
    localStorage.setItem(PREREQ_STORAGE_KEY, JSON.stringify(data));
}

function appendDailyNoteLink(entry: Record<string, unknown>): void {
    const day = new Date().toISOString().slice(0, 10);
    const all = (() => {
        try {
            return JSON.parse(localStorage.getItem(DAILY_NOTE_LINKS_KEY) || "{}");
        } catch {
            return {};
        }
    })() as Record<string, Array<Record<string, unknown>>>;
    all[day] = [...(all[day] || []), { ...entry, timestamp: new Date().toISOString() }];
    localStorage.setItem(DAILY_NOTE_LINKS_KEY, JSON.stringify(all));
}

function readBrowserSyncConfig(): { host: string; port: number; autoStart: boolean; apiKey?: string } {
    try {
        const parsed = JSON.parse(localStorage.getItem(BROWSER_SYNC_CONFIG_STORAGE) || "{}");
        return {
            host: parsed.host || "127.0.0.1",
            port: Number(parsed.port || 8766),
            autoStart: Boolean(parsed.autoStart),
            apiKey: parsed.apiKey || getOrCreateAutomationApiKey(),
        };
    } catch {
        return {
            host: "127.0.0.1",
            port: 8766,
            autoStart: false,
            apiKey: getOrCreateAutomationApiKey(),
        };
    }
}

/**
 * Command handlers mapping - mirrors Tauri commands
 */
const commandHandlers: Record<string, CommandHandler> = {
    // Document commands
    get_documents: async (args) => {
        let docs = await db.getDocuments();
        const collectionId = args?.collectionId as string | null | undefined;
        if (collectionId) {
            docs = docs.filter((doc) => (doc as any).collection_id === collectionId);
        }
        return toCamelCase(docs);
    },

    get_document: async (args) => {
        const id = args.id as string;
        const doc = await db.getDocument(id);
        return doc ? toCamelCase(doc) : null;
    },

    create_document: async (args) => {
        const doc = await db.createDocument({
            title: args.title as string,
            file_path: args.filePath as string,
            file_type: args.fileType as string,
        });
        return toCamelCase(doc);
    },

    update_document: async (args) => {
        const id = args.id as string;
        const updates = args.updates as Record<string, unknown>;
        // Convert camelCase updates back to snake_case for DB
        const dbUpdates: Record<string, unknown> = {};
        for (const key in updates) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            dbUpdates[snakeKey] = updates[key];
        }
        const doc = await db.updateDocument(id, dbUpdates);
        return toCamelCase(doc);
    },

    update_document_progress: async (args) => {
        const id = args.id as string;
        const currentPage = args.current_page as number | null | undefined;
        const scrollPercent = args.current_scroll_percent as number | null | undefined;
        const currentCfi = args.current_cfi as string | null | undefined;

        const updates: Partial<db.Document> = {
            current_page: currentPage,
            current_scroll_percent: scrollPercent,
            current_cfi: currentCfi,
            sync_version: Date.now(),
        };

        // Also update position_json to keep unified position in sync
        // Try to get existing position first
        const existingDoc = await db.getDocument(id);
        let position: DocumentPosition | null = null;

        if (existingDoc?.position_json) {
            try {
                position = JSON.parse(existingDoc.position_json);
            } catch {
                position = null;
            }
        }

        // Create new unified position based on what's being updated and document type
        // For YouTube videos and other time-based media, use time position instead of page position
        const isTimeBasedMedia = existingDoc?.file_type === 'youtube' ||
                                 existingDoc?.file_type === 'audio' ||
                                 existingDoc?.file_type === 'video';

        if (isTimeBasedMedia && currentPage !== undefined && currentPage !== null) {
            // For time-based media, use time position (seconds)
            position = { type: 'time', seconds: currentPage };
        } else if (currentPage !== undefined && currentPage !== null) {
            position = { type: 'page', page: currentPage };
        } else if (scrollPercent !== undefined && scrollPercent !== null) {
            position = { type: 'scroll', percent: scrollPercent };
        } else if (currentCfi !== undefined && currentCfi !== null) {
            position = { type: 'cfi', cfi: currentCfi };
        }

        if (position) {
            let progress = getPositionProgress(position);

            // For page-based positions, calculate progress if we have total pages
            if (progress === null && position.type === 'page' && existingDoc?.total_pages) {
                progress = ((position.page - 1) / existingDoc.total_pages) * 100;
            }

            updates.position_json = JSON.stringify(position);
            updates.progress_percent = progress ?? existingDoc?.progress_percent ?? 0;
        }

        const cleaned: Record<string, unknown> = {};
        Object.entries(updates).forEach(([key, value]) => {
            if (value !== undefined) {
                cleaned[key] = value === null ? undefined : value;
            }
        });
        const doc = await db.updateDocument(id, cleaned);
        return toCamelCase(doc);
    },

    get_document_position: async (args) => {
        const id = (args.document_id ?? args.documentId) as string;
        if (!id) return null;
        const doc = await db.getDocument(id);
        if (!doc?.position_json) return null;
        try {
            return JSON.parse(doc.position_json) as unknown;
        } catch (error) {
            console.warn('[Browser] Failed to parse position_json for document', id, error);
            return null;
        }
    },

    save_document_position: async (args) => {
        const id = (args.document_id ?? args.documentId) as string;
        const position = args.position as unknown;
        if (!id || !position) return null;
        const positionObj = position as DocumentPosition;
        let progress = getPositionProgress(positionObj);

        // For page-based positions, calculate progress if we have total pages
        if (progress === null && positionObj.type === 'page') {
            const doc = await db.getDocument(id);
            if (doc?.total_pages) {
                progress = (positionObj.page / doc.total_pages) * 100;
            }
        }

        await db.updateDocument(id, {
            position_json: JSON.stringify(position),
            progress_percent: progress ?? 0,
        });
        return null;
    },

    get_documents_with_progress: async (args) => {
        const limit = (args.limit as number) || 50;
        const docs = await db.getDocumentsWithProgress(limit);
        // Return as tuples: [id, progress, title, date_modified]
        // Convert date_modified from ISO string to Unix timestamp (seconds)
        return docs.map((doc) => [
            doc.id,
            doc.progress_percent || 0,
            doc.title,
            Math.floor(new Date(doc.date_modified).getTime() / 1000),
        ]);
    },

    get_document_progress: async (args) => {
        const id = (args.document_id ?? args.documentId) as string;
        if (!id) return null;
        const doc = await db.getDocument(id);
        return doc?.progress_percent ?? null;
    },

    get_daily_reading_stats: async (_args) => {
        // Return empty array for now - daily reading stats not fully implemented in browser mode
        // This is used for reading streak calculations
        return [];
    },

    update_document_content: async (args) => {
        const id = args.id as string;
        const content = args.content as string;
        const doc = await db.updateDocument(id, { content });
        return toCamelCase(doc);
    },

    // Extract text from existing document (for documents imported before text extraction was added)
    extract_document_text: async (args) => {
        const id = args.id as string;
        const doc = await db.getDocument(id);
        if (!doc) {
            throw new Error(`Document ${id} not found`);
        }

        // If document already has content, return it
        if (doc.content && doc.content.length > 0) {
            return { content: doc.content, extracted: false };
        }

        // Try to get the file and extract text
        const filePath = doc.file_path;
        const fileType = doc.file_type?.toLowerCase() || '';

        // Handle browser-file:// and browser-fetched:// paths
        if ((fileType === 'pdf' || fileType === 'epub' || fileType === 'html') &&
            (filePath.startsWith('browser-file://') || filePath.startsWith('browser-fetched://'))) {
            // Try to get from in-memory store first, then from IndexedDB
            const browserFile = getBrowserFile(filePath);
            let arrayBuffer: ArrayBuffer | null = null;

            if (browserFile) {
                arrayBuffer = await browserFile.arrayBuffer();
            } else {
                // Try to get from IndexedDB file store by path
                let storedFile = await db.getFile(filePath);

                // If not found by path, try by filename (for files stored before path-based storage)
                if (!storedFile) {
                    const filename = filePath.split('/').pop() || '';
                    storedFile = await db.getFileByName(filename);
                }

                if (storedFile && storedFile.blob) {
                    try {
                        arrayBuffer = await storedFile.blob.arrayBuffer();
                    } catch (blobError) {
                        console.warn('[Browser] File blob is no longer readable, may have been cleared:', blobError);
                        // Delete the corrupted file entry
                        await db.deleteFile(storedFile.id);
                    }
                }
            }

            if (arrayBuffer) {
                let extractedContent = '';

                if (fileType === 'html') {
                    // Extract text from HTML
                    try {
                        const text = new TextDecoder().decode(arrayBuffer);
                        // Create a temporary DOM element to parse HTML
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(text, 'text/html');

                        // Remove script and style elements
                        doc.querySelectorAll('script, style').forEach(el => el.remove());

                        // Get text content and clean it up
                        extractedContent = doc.body.textContent || doc.body.innerText || '';
                        extractedContent = extractedContent
                            .replace(/\s+/g, ' ')
                            .replace(/\n\s*\n/g, '\n\n')
                            .trim();

                        if (extractedContent.length > 50000) {
                            // Truncate very long content
                            extractedContent = extractedContent.substring(0, 50000) + '\n\n... (content truncated)';
                        }
                    } catch (error) {
                        console.warn('[Browser] Failed to extract HTML text:', error);
                    }
                } else if (fileType === 'epub') {
                    extractedContent = await extractEpubText(arrayBuffer);
                } else if (fileType === 'pdf') {
                    extractedContent = await extractPdfText(arrayBuffer);
                }

                if (extractedContent) {
                    await db.updateDocument(id, { content: extractedContent });
                    return { content: extractedContent, extracted: true };
                }
            }
        }

        return { content: '', extracted: false };
    },

    update_document_priority: async (args) => {
        const id = args.id as string;
        const rating = args.rating as number;
        const slider = args.slider as number;
        // Calculate priority score based on rating and slider
        const priorityScore = (rating / 5) * 50 + (slider / 100) * 50;
        const doc = await db.updateDocument(id, {
            priority_rating: rating,
            priority_slider: slider,
            priority_score: priorityScore,
        });
        return toCamelCase(doc);
    },

    delete_document: async (args) => {
        const id = args.id as string;
        await db.deleteDocument(id);
        return null;
    },

    import_document: async (args) => {
        // In browser mode, file is passed as File object or base64
        const filePath = args.filePath as string;
        let fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'Untitled';
        let fileType = fileName.split('.').pop()?.toLowerCase() || 'pdf';
        console.log(`[Browser] import_document:`, { filePath, fileName, fileType });
        let extractedContent = '';
        let finalFilePath = filePath;

        // browser-file://: new uploads from file picker / drag-drop (in-memory store).
        // browser-fetched://: files fetched via fetch_url_content and stored in IndexedDB.
        // For both, we attempt to upload to yjs-sync and rewrite file_path to yjs-file://...
        let sourceFile: File | null = null;
        if (filePath.startsWith('browser-file://')) {
            const file = getBrowserFile(filePath);
            console.log(`[Browser] Looking up file in browser store:`, file ? `found (${file.size} bytes)` : 'not found');
            if (file) sourceFile = file;
        } else if (filePath.startsWith('browser-fetched://')) {
            const stored = await db.getFile(filePath);
            if (stored) {
                // Use the real filename (not the synthetic browser-fetched:// id) for title/type.
                if (stored.filename) {
                    fileName = stored.filename;
                    fileType = fileName.split('.').pop()?.toLowerCase() || fileType;
                }
                sourceFile = new File([stored.blob], stored.filename, { type: stored.content_type || stored.blob.type || '' });
            }
        }

        if (sourceFile) {
            // Upload to yjs-sync file service (so other devices can fetch it),
            // and store a local cached copy keyed by the yjs-file:// path.
            try {
                const meta = await uploadRoomFile(sourceFile);
                finalFilePath = createYjsFilePath(meta.room, meta.id, meta.filename);
                console.log('[Browser] Uploaded file to yjs-sync:', { id: meta.id, room: meta.room, filePath: finalFilePath });
                await db.storeFile(sourceFile, finalFilePath);
            } catch (e) {
                console.warn('[Browser] yjs-sync upload failed, falling back to local-only file:', e);
                // Fallback: ensure it is in IndexedDB under its original key.
                await db.storeFile(sourceFile, filePath);
                finalFilePath = filePath;
            }

            // Extract text content from PDFs and EPUBs
            if (fileType === 'pdf' || fileType === 'epub') {
                try {
                    const arrayBuffer = await sourceFile.arrayBuffer();
                    extractedContent = fileType === 'epub'
                        ? await extractEpubText(arrayBuffer)
                        : await extractPdfText(arrayBuffer);
                    console.log(`[Browser] Extracted ${extractedContent.length} characters from ${fileType.toUpperCase()}`);
                } catch (error) {
                    console.warn(`[Browser] Failed to extract ${fileType.toUpperCase()} text:`, error);
                }
            }
        } else if (filePath.startsWith('browser-file://') || filePath.startsWith('browser-fetched://')) {
            console.warn('[Browser] File not found for import:', filePath);
        }

        const doc = await db.createDocument({
            title: fileName.replace(/\.[^/.]+$/, ''),
            file_path: finalFilePath,
            file_type: fileType,
            content: extractedContent || undefined,
            tags: suggestAutoTags(fileName, extractedContent || ""),
        });
        console.log(`[Browser] Document created:`, doc.id, doc.file_path, doc.file_type);
        return toCamelCase(doc);
    },

    import_documents: async (args) => {
        const filePaths = args.filePaths as string[];
        const docs = [];
        for (const filePath of filePaths) {
            const doc = await commandHandlers.import_document({ filePath });
            docs.push(doc);
        }
        return docs;
    },

    import_pdf_highlights_as_extracts: async (args) => {
        const documentId = (args.documentId || args.document_id) as string;
        const doc = await db.getDocument(documentId);
        if (!doc) {
            throw new Error(`Document ${documentId} not found`);
        }

        const content = (doc.content || "").trim();
        if (!content) {
            return 0;
        }

        const snippets = content
            .split(/\n\s*\n/)
            .map((block) => block.trim())
            .filter(Boolean)
            .slice(0, 12);
        for (const snippet of snippets) {
            await db.createExtract({
                document_id: documentId,
                content: snippet,
                tags: ["imported-highlight"],
                highlight_color: "imported",
            });
        }
        return snippets.length;
    },

    import_podcast_audio_file: async (args) => {
        const filePath = args.filePath as string;
        const title =
            (args.title as string | undefined) ||
            filePath.split("/").pop()?.split("\\").pop() ||
            "Podcast Episode";
        const document = await db.createDocument({
            title: title.replace(/\.[^/.]+$/, ""),
            file_path: filePath,
            file_type: "audio",
            content: "Local transcription is only available in the desktop app backend.",
            tags: ["podcast", "audio"],
        });
        return {
            document: toCamelCase(document),
            transcript_segments: 0,
        };
    },

    // Podcast subscription & playback commands (browser fallback)
    subscribe_podcast: async (args) => {
        // Browser fallback: return an empty feed object.
        // Real podcast management requires Tauri or HTTP backend.
        console.warn('[Browser] subscribe_podcast: no-op in browser fallback mode');
        return {
            id: `podcast-${Date.now()}`,
            title: 'Browser Podcast',
            description: '',
            imageUrl: null,
            author: null,
            language: null,
            link: null,
            feedUrl: args.feedUrl as string || '',
            lastFetched: null,
            subscribedAt: new Date().toISOString(),
            sortOrder: 0,
            episodeCount: 0,
            unplayedCount: 0,
        };
    },

    unsubscribe_podcast: async (_args) => {
        console.warn('[Browser] unsubscribe_podcast: no-op in browser fallback mode');
    },

    get_podcast_feeds: async () => {
        return [];
    },

    refresh_podcast_feed: async (args) => {
        const feedId = args.feedId as string;
        console.warn(`[Browser] refresh_podcast_feed(${feedId}): no-op in browser fallback mode`);
        return {
            id: feedId,
            title: 'Unknown Podcast',
            description: '',
            imageUrl: null,
            author: null,
            language: null,
            link: null,
            feedUrl: '',
            lastFetched: null,
            subscribedAt: new Date().toISOString(),
            sortOrder: 0,
            episodeCount: 0,
            unplayedCount: 0,
        };
    },

    get_podcast_episodes: async () => {
        return [];
    },

    mark_episode_played: async (_args) => {
        console.warn('[Browser] mark_episode_played: no-op in browser fallback mode');
    },

    update_episode_position: async (_args) => {
        console.warn('[Browser] update_episode_position: no-op in browser fallback mode');
    },

    get_episode_position: async (_args) => {
        return 0;
    },

    read_document_file: async (args) => {
        // In browser mode, return the file from IndexedDB if stored
        const filePath = args.filePath as string;
        console.log('[Browser] read_document_file:', filePath);

        // yjs-file://...: try IndexedDB cache first; otherwise download from yjs-sync and cache it.
        const yjsInfo = parseYjsFilePath(filePath);
        if (yjsInfo) {
            const cached = await db.getFile(filePath);
            if (cached) {
                console.log('[Browser] Found yjs-file in IndexedDB cache:', cached.filename, 'size:', cached.blob?.size);
                return await blobToBase64DataUrlPayload(cached.blob);
            }

            console.log('[Browser] yjs-file not cached; downloading:', yjsInfo);
            const blob = await downloadRoomFile(yjsInfo.room, yjsInfo.id);
            const filename = yjsInfo.filename || 'document';
            const contentType = blob.type || 'application/octet-stream';
            const file = new File([blob], filename, { type: contentType });
            await db.storeFile(file, filePath);
            return await blobToBase64DataUrlPayload(file);
        }

        // If it's a browser-file:// path, try to find it in the file store first (IndexedDB)
        if (filePath.startsWith('browser-file://')) {
            // Workaround: We will use the file content from the browserFileStore if it's still in memory (session),
            // otherwise falling back to IndexedDB would require a query.

            const file = getBrowserFile(filePath);
            if (file) {
                console.log('[Browser] Found file in memory store:', file.name, 'size:', file.size);
                const base64 = await blobToBase64DataUrlPayload(file);
                console.log('[Browser] Read file from memory, base64 length:', base64?.length);
                return base64;
            }

            // If not in memory (page refresh), try IndexedDB by path first, then by filename
            console.log('[Browser] File not in memory, checking IndexedDB...');
            let storedFile = await db.getFile(filePath);
            console.log('[Browser] IndexedDB lookup by path result:', storedFile ? `found (${storedFile.blob?.size} bytes)` : 'not found');

            // If not found by path, try by filename (for files stored before path-based storage)
            if (!storedFile) {
                const filename = filePath.split('/').pop() || '';
                console.log('[Browser] Trying lookup by filename:', filename);
                storedFile = await db.getFileByName(filename);
                console.log('[Browser] IndexedDB lookup by filename result:', storedFile ? `found (${storedFile.blob?.size} bytes)` : 'not found');
            }

            if (storedFile) {
                try {
                    const base64 = await blobToBase64DataUrlPayload(storedFile.blob);
                    console.log('[Browser] Read file from IndexedDB, base64 length:', base64?.length);
                    return base64;
                } catch (error) {
                    console.warn('[Browser] Failed to read file blob, deleting corrupted entry:', error);
                    await db.deleteFile(storedFile.id);
                    throw error;
                }
            }
        }

        // browser-fetched:// path: only IndexedDB (no in-memory store).
        if (filePath.startsWith('browser-fetched://')) {
            const storedFile = await db.getFile(filePath);
            if (storedFile) {
                try {
                    const base64 = await blobToBase64DataUrlPayload(storedFile.blob);
                    console.log('[Browser] Read fetched file from IndexedDB, base64 length:', base64?.length);
                    return base64;
                } catch (error) {
                    console.warn('[Browser] Failed to read fetched file blob, deleting corrupted entry:', error);
                    await db.deleteFile(storedFile.id);
                    throw error;
                }
            }
        }

        console.warn('[Browser] read_document_file file not found:', filePath);
        return '';
    },

    // Extract commands
    get_extracts: async (args) => {
        const documentId = args.documentId as string | undefined;
        const extracts = documentId
            ? await db.getExtractsByDocument(documentId)
            : await db.getAllExtracts();
        return toCamelCase(extracts);
    },

    get_extract: async (args) => {
        const id = args.id as string;
        const extract = await db.getExtract(id);
        return extract ? toCamelCase(extract) : null;
    },

    create_extract: async (args) => {
        const extract = await db.createExtract({
            document_id: args.documentId as string,
            content: args.content as string,
            html_content: args.htmlContent as string | undefined,
            source_url: args.sourceUrl as string | undefined,
            notes: args.note as string | undefined,
            tags: args.tags as string[] | undefined,
            category: args.category as string | undefined,
            highlight_color: args.color as string | undefined,
            page_number: args.pageNumber as number | undefined,
        });
        appendDailyNoteLink({ type: "extract", id: extract.id, title: extract.content?.slice(0, 80) || "Extract" });
        return toCamelCase(extract);
    },

    update_extract: async (args) => {
        const id = args.id as string;
        const extract = await db.updateExtract(id, {
            content: args.content as string | undefined,
            html_content: args.htmlContent as string | undefined,
            source_url: args.sourceUrl as string | undefined,
            notes: args.note as string | undefined,
            tags: args.tags as string[] | undefined,
            category: args.category as string | undefined,
            highlight_color: args.color as string | undefined,
        });
        return toCamelCase(extract);
    },

    delete_extract: async (args) => {
        const id = args.id as string;
        await db.deleteExtract(id);
        return null;
    },

    // Learning item commands
    get_learning_items: async (args) => {
        const documentId = args.documentId as string;
        const items = await db.getLearningItemsByDocument(documentId);
        return toCamelCase(items);
    },

    get_all_learning_items: async () => {
        const items = await db.getAllLearningItems();
        return toCamelCase(items);
    },

    get_learning_item: async (args) => {
        const itemId = args.itemId as string;
        const item = await db.getLearningItem(itemId);
        return item ? toCamelCase(item) : null;
    },

    create_learning_item: async (args) => {
        const question = args.question as string;
        const allowDuplicate = Boolean(args.allowDuplicate ?? args.allow_duplicate);
        if (!allowDuplicate) {
            const allItems = await db.getAllLearningItems();
            const topMatch = allItems
                .map((item) => ({ item, similarity: jaccardSimilarity(question, item.question || "") }))
                .sort((a, b) => b.similarity - a.similarity)[0];
            if (topMatch && topMatch.similarity >= 0.85) {
                throw new Error(
                    `Potential duplicate detected (${Math.round(topMatch.similarity * 100)}%): ${topMatch.item.id}`
                );
            }
        }

        const item = await db.createLearningItem({
            extract_id: args.extractId as string | undefined,
            document_id: args.documentId as string | undefined,
            item_type: args.itemType as string,
            question,
            answer: args.answer as string | undefined,
            cloze_text: args.clozeText as string | undefined,
            tags: (args.tags ?? args.tag_list) as string[] | undefined,
            image_asset_ids: (args.imageAssetIds ?? args.image_asset_ids) as string[] | undefined,
            interaction_metadata: (args.interactionMetadata ?? args.interaction_metadata) as Record<string, unknown> | undefined,
        });
        const prerequisiteIds = (args.prerequisiteItemIds || args.prerequisite_item_ids) as string[] | undefined;
        if (Array.isArray(prerequisiteIds) && prerequisiteIds.length > 0) {
            const prereqMap = readPrerequisites();
            prereqMap[item.id] = prerequisiteIds;
            writePrerequisites(prereqMap);
        }
        appendDailyNoteLink({ type: "learning_item", id: item.id, title: item.question });
        return toCamelCase(item);
    },

    check_semantic_duplicate_candidates: async (args) => {
        const question = String(args.question ?? "");
        const limit = Math.max(1, Number(args.limit ?? 5));
        const allItems = await db.getAllLearningItems();
        const candidates = allItems
            .map((item) => ({
                id: item.id,
                question: item.question,
                similarity: jaccardSimilarity(question, item.question || ""),
            }))
            .filter((candidate) => candidate.similarity >= 0.6)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
        return candidates;
    },

    update_learning_item: async (args) => {
        const id = args.id as string;
        const item = await db.updateLearningItem(id, args as Partial<db.LearningItem>);
        return toCamelCase(item);
    },

    update_learning_item_content_with_version: async (args) => {
        const itemId = args.itemId as string;
        const existing = await db.getLearningItem(itemId);
        if (!existing) {
            throw new Error(`Learning item ${itemId} not found`);
        }

        const allVersions = readBrowserCardVersions();
        const entry: BrowserCardVersionEntry = {
            version_id: crypto.randomUUID(),
            item_id: itemId,
            timestamp: new Date().toISOString(),
            reason: (args.reason as string | undefined) ?? undefined,
            question: existing.question,
            answer: existing.answer,
        };
        allVersions[itemId] = [entry, ...(allVersions[itemId] ?? [])];
        writeBrowserCardVersions(allVersions);

        const updated = await db.updateLearningItem(itemId, {
            question: args.question as string,
            answer: args.answer as string | undefined,
            date_modified: new Date().toISOString(),
        });
        return toCamelCase(updated);
    },

    get_learning_item_versions: async (args) => {
        const itemId = args.itemId as string;
        const versions = readBrowserCardVersions()[itemId] ?? [];
        return versions;
    },

    set_learning_item_prerequisites: async (args) => {
        const itemId = args.itemId as string;
        const prerequisiteItemIds = (args.prerequisiteItemIds || []) as string[];
        const prereqMap = readPrerequisites();
        prereqMap[itemId] = prerequisiteItemIds;
        writePrerequisites(prereqMap);
        return null;
    },

    get_learning_item_prerequisites: async (args) => {
        const itemId = args.itemId as string;
        return readPrerequisites()[itemId] ?? [];
    },

    get_daily_note_links: async (args) => {
        const requestedDate = (args.date as string | undefined) || new Date().toISOString().slice(0, 10);
        const all = (() => {
            try {
                return JSON.parse(localStorage.getItem(DAILY_NOTE_LINKS_KEY) || "{}");
            } catch {
                return {};
            }
        })() as Record<string, Array<Record<string, unknown>>>;
        return all[requestedDate] || [];
    },

    revert_learning_item_version: async (args) => {
        const itemId = args.itemId as string;
        const versionId = args.versionId as string;
        const versions = readBrowserCardVersions()[itemId] ?? [];
        const selected = versions.find((version) => version.version_id === versionId);
        if (!selected) {
            throw new Error(`Version ${versionId} not found`);
        }
        const updated = await db.updateLearningItem(itemId, {
            question: selected.question,
            answer: selected.answer,
            date_modified: new Date().toISOString(),
        });
        return toCamelCase(updated);
    },

    export_mnemosyne: async () => {
        const allItems = await db.getAllLearningItems();
        const lines = ["# Mnemosyne Export"];
        for (const item of allItems) {
            lines.push(`${(item.question || "").replaceAll("\n", " ")}\t${(item.answer || "").replaceAll("\n", " ")}`);
        }
        const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `incrementum-mnemosyne-${new Date().toISOString().slice(0, 10)}.txt`;
        anchor.click();
        URL.revokeObjectURL(url);
        return anchor.download;
    },

    delete_learning_item: async (args) => {
        const id = args.id as string;
        await db.deleteLearningItem(id);
        return null;
    },

    // Queue/Review commands
    get_queue: async () => {
        // Return a flat array of queue items matching Rust format
        const docs = (await db.getDocuments()).filter((doc) => !doc.is_archived);
        const activeDocIds = new Set(docs.map((doc) => doc.id));
        const dueExtracts = await db.getDueExtracts();
        const dueLearningItems = await db.getDueLearningItems();

        // Convert to queue item format expected by the frontend
        const items: unknown[] = [];

        for (const doc of docs) {
            items.push({
                id: doc.id,
                document_id: doc.id,
                document_title: doc.title || 'Untitled',
                document_file_type: doc.file_type,
                item_type: 'document',
                priority_rating: doc.priority_rating,
                priority_slider: doc.priority_slider,
                priority: doc.priority_score ?? 50,
                due_date: doc.next_reading_date,
                estimated_time: 10,
                tags: doc.tags || [],
                category: doc.category,
                progress: doc.current_scroll_percent ?? 0,
            });
        }

        for (const ext of dueExtracts) {
            if (!activeDocIds.has(ext.document_id)) {
                continue;
            }
            const doc = await db.getDocument(ext.document_id);
            items.push({
                id: ext.id,
                document_id: ext.document_id,
                document_title: doc?.title || 'Unknown',
                document_file_type: doc?.file_type,
                extract_id: ext.id,
                item_type: 'extract',
                priority: 50,
                due_date: ext.next_review_date,
                estimated_time: 5,
                tags: ext.tags || [],
                category: ext.category,
                progress: 0,
            });
        }

        for (const item of dueLearningItems) {
            if (item.document_id && !activeDocIds.has(item.document_id)) {
                continue;
            }
            const doc = item.document_id ? await db.getDocument(item.document_id) : null;
            items.push({
                id: item.id,
                document_id: item.document_id || '',
                document_title: doc?.title || 'Unknown',
                document_file_type: doc?.file_type,
                extract_id: item.extract_id,
                learning_item_id: item.id,
                question: item.question,
                answer: item.answer,
                cloze_text: item.cloze_text,
                item_type: 'learning-item',
                priority: 50,
                due_date: item.due_date,
                estimated_time: 2,
                tags: item.tags || [],
                category: undefined,
                progress: 0,
            });
        }

        // Note: snake_case for queue items as expected by API
        return items;
    },

    get_due_documents_only: async () => {
        const docs = (await db.getDocuments()).filter((doc) => !doc.is_archived);
        const now = new Date().toISOString();
        
        // Smart filtering:
        // 1. Include items that are due (next_reading_date <= now)
        // 2. Include new items (no next_reading_date)
        // 3. Exclude items viewed in this session (unless overdue by > 1 day)
        
        const SMART_FILTER = true; // Can be made configurable
        const RECENT_VIEW_EXCLUDE_COUNT = 5; // Exclude last 5 viewed items
        
        const recentlyViewed = SMART_FILTER 
            ? new Set(getRecentlyViewedIds(RECENT_VIEW_EXCLUDE_COUNT))
            : new Set<string>();
        
        const dueDocs = docs.filter((doc) => {
            const isNew = !doc.next_reading_date;
            const isDue = doc.next_reading_date && doc.next_reading_date <= now;
            
            if (!isNew && !isDue) {
                return false; // Not due and not new
            }
            
            // Check if recently viewed (unless overdue by more than 1 day)
            if (SMART_FILTER && recentlyViewed.has(doc.id)) {
                const isOverdue = doc.next_reading_date && 
                    (new Date(now).getTime() - new Date(doc.next_reading_date).getTime()) > (24 * 60 * 60 * 1000);
                if (!isOverdue) {
                    return false; // Skip recently viewed, not overdue items
                }
            }
            
            return true;
        });
        
        // Sort by priority (higher priority first), then by due date
        const sortedDocs = dueDocs.sort((a, b) => {
            // Priority slider: higher = more urgent
            const priorityA = a.priority_slider ?? 50;
            const priorityB = b.priority_slider ?? 50;
            if (priorityA !== priorityB) {
                return priorityB - priorityA; // Descending priority
            }
            
            // Then by due date (earlier = more urgent)
            const dueA = a.next_reading_date || '9999-12-31';
            const dueB = b.next_reading_date || '9999-12-31';
            return dueA.localeCompare(dueB);
        });
        
        return sortedDocs.map((doc) => ({
            id: doc.id,
            document_id: doc.id,
            document_title: doc.title || 'Untitled',
            document_file_type: doc.file_type,
            item_type: 'document',
            priority_rating: doc.priority_rating,
            priority_slider: doc.priority_slider,
            priority: doc.priority_score ?? 50,
            due_date: doc.next_reading_date,
            estimated_time: 10,
            tags: doc.tags || [],
            category: doc.category,
            progress: doc.current_scroll_percent ?? 0,
        }));
    },

    get_due_queue_items: async () => {
        const docs = (await db.getDocuments()).filter((doc) => !doc.is_archived);
        const activeDocIds = new Set(docs.map((doc) => doc.id));
        const now = new Date().toISOString();
        const dueDocs = docs.filter((doc) => !doc.next_reading_date || doc.next_reading_date <= now);
        const dueExtracts = await db.getDueExtracts();
        const dueLearningItems = await db.getDueLearningItems();

        const items: unknown[] = [];

        for (const doc of dueDocs) {
            items.push({
                id: doc.id,
                document_id: doc.id,
                document_title: doc.title || 'Untitled',
                document_file_type: doc.file_type,
                item_type: 'document',
                priority_rating: doc.priority_rating,
                priority_slider: doc.priority_slider,
                priority: doc.priority_score ?? 50,
                due_date: doc.next_reading_date,
                estimated_time: 10,
                tags: doc.tags || [],
                category: doc.category,
                progress: doc.current_scroll_percent ?? 0,
            });
        }

        for (const ext of dueExtracts) {
            if (!activeDocIds.has(ext.document_id)) {
                continue;
            }
            const doc = await db.getDocument(ext.document_id);
            items.push({
                id: ext.id,
                document_id: ext.document_id,
                document_title: doc?.title || 'Unknown',
                document_file_type: doc?.file_type,
                extract_id: ext.id,
                item_type: 'extract',
                priority: 50,
                due_date: ext.next_review_date,
                estimated_time: 5,
                tags: ext.tags || [],
                category: ext.category,
                progress: 0,
            });
        }

        for (const item of dueLearningItems) {
            if (item.document_id && !activeDocIds.has(item.document_id)) {
                continue;
            }
            const doc = item.document_id ? await db.getDocument(item.document_id) : null;
            items.push({
                id: item.id,
                document_id: item.document_id || '',
                document_title: doc?.title || 'Unknown',
                document_file_type: doc?.file_type,
                extract_id: item.extract_id,
                learning_item_id: item.id,
                question: item.question,
                answer: item.answer,
                cloze_text: item.cloze_text,
                item_type: 'learning-item',
                priority: 50,
                due_date: item.due_date,
                estimated_time: 2,
                tags: item.tags || [],
                category: undefined,
                progress: 0,
            });
        }

        return items;
    },

    get_queue_stats: async () => {
        const docs = (await db.getDocuments()).filter((doc) => !doc.is_archived);
        const activeDocIds = new Set(docs.map((doc) => doc.id));
        const now = new Date().toISOString();
        const dueDocs = docs.filter((doc) => !doc.next_reading_date || doc.next_reading_date <= now);
        const dueExtracts = (await db.getDueExtracts()).filter((ext) => activeDocIds.has(ext.document_id));
        const dueLearningItems = (await db.getDueLearningItems()).filter(
            (item) => !item.document_id || activeDocIds.has(item.document_id)
        );
        return {
            total_items: docs.length + dueExtracts.length + dueLearningItems.length,
            due_today: dueDocs.length + dueExtracts.length + dueLearningItems.length,
            overdue: 0,
            new_items: 0,
            learning_items: dueLearningItems.length,
            review_items: dueExtracts.length,
            total_estimated_time: (dueDocs.length * 10) + (dueExtracts.length * 5) + (dueLearningItems.length * 2),
            suspended: 0,
        };
    },

    get_due_items: async () => {
        const items = await db.getDueLearningItems();
        const prereqMap = readPrerequisites();
        const allItems = await db.getAllLearningItems();
        const byId = new Map(allItems.map((item) => [item.id, item]));
        const filtered = items.filter((item) => {
            const prereqIds = prereqMap[item.id] || [];
            return prereqIds.every((prereqId) => {
                const prereq = byId.get(prereqId);
                if (!prereq) return false;
                return (prereq.review_count || 0) > 0 && (prereq.interval || 0) >= 21;
            });
        });
        return toCamelCase(filtered);
    },

    start_review: async () => {
        const dueItems = await db.getDueLearningItems();
        if (dueItems.length === 0) {
            return '';
        }
        return uuidv4();
    },

    submit_review: async (args) => {
        const itemId = (args.item_id as string) || (args.itemId as string);
        const rating = args.rating as number;
        const noScheduleUpdate = Boolean(args.no_schedule_update ?? args.noScheduleUpdate);
        const item = await db.getLearningItem(itemId);
        if (!item) {
            throw new Error(`Learning item ${itemId} not found`);
        }

        if (noScheduleUpdate) {
            return toCamelCase(item);
        }

        const algorithmType = (args.algorithm as string) || item.algorithm_type || 'fsrs';

        if (algorithmType === 'sm2') {
            return toCamelCase(await applySm2ReviewBrowser(item, rating, algorithmType));
        }

        if (algorithmType === 'sm18') {
            return toCamelCase(await applySm18ReviewBrowser(item, rating, algorithmType));
        }

        if (algorithmType === 'sm20') {
            return toCamelCase(await applySm20ReviewBrowser(item, rating, algorithmType));
        }

        // FSRS-6 (default)
        const now = new Date();
        const scheduler = createFsrsScheduler({
            tags: item.tags || [],
        });
        const grade = toFsrsGrade(rating);
        const card = buildCardFromLearningItem(item, now);
        const next = scheduler.next(card, now, grade);
        const nextCard = next.card;
        const nextDue = nextCard.due;
        const intervalDays = intervalFromDue(now, nextDue, nextCard.scheduled_days);

        const updatedItem = await db.updateLearningItem(item.id, {
            due_date: nextDue.toISOString(),
            interval: intervalDays,
            last_review_date: now.toISOString(),
            review_count: nextCard.reps,
            lapses: nextCard.lapses,
            state: stateToString(nextCard.state),
            memory_state: {
                stability: nextCard.stability,
                difficulty: nextCard.difficulty,
            },
            difficulty: nextCard.difficulty,
            algorithm_type: algorithmType,
        });

        return toCamelCase(updatedItem);
    },

    preview_review_intervals: async (args) => {
        const itemId = (args.item_id as string) || (args.itemId as string);
        const item = await db.getLearningItem(itemId);
        if (!item) {
            throw new Error(`Learning item ${itemId} not found`);
        }

        const algorithmType = (args.algorithm as string) || item.algorithm_type || 'fsrs';

        // SM-18 preview
        if (algorithmType === 'sm18') {
            const now = new Date();
            let elapsedDays = 0;
            if (item.last_review_date) {
                elapsedDays = (now.getTime() - new Date(item.last_review_date).getTime()) / (86400 * 1000);
            }
            const previewIntervals: Record<string, number> = {};
            for (const [name, rating] of [['again', 0], ['hard', 1], ['good', 2], ['easy', 3]] as const) {
                const state = parseSm18State(item.algorithm_state);
                const grade = ratingToSm18Grade(rating);
                const result = sm18Review(state, grade, elapsedDays);
                previewIntervals[name] = result.new_interval;
            }
            return previewIntervals;
        }

        if (algorithmType === 'sm20') {
            const now = new Date();
            let elapsedDays = 0;
            if (item.last_review_date) {
                elapsedDays = (now.getTime() - new Date(item.last_review_date).getTime()) / (86400 * 1000);
            }
            return sm20PreviewIntervals(parseSm20State(item.algorithm_state), elapsedDays);
        }

        const now = new Date();
        const scheduler = createFsrsScheduler({
            tags: item.tags || [],
        });
        const card = buildCardFromLearningItem(item, now);
        const preview = scheduler.repeat(card, now);

        const intervals = {
            again: intervalFromDue(now, preview[Rating.Again].card.due, preview[Rating.Again].card.scheduled_days),
            hard: intervalFromDue(now, preview[Rating.Hard].card.due, preview[Rating.Hard].card.scheduled_days),
            good: intervalFromDue(now, preview[Rating.Good].card.due, preview[Rating.Good].card.scheduled_days),
            easy: intervalFromDue(now, preview[Rating.Easy].card.due, preview[Rating.Easy].card.scheduled_days),
        };

        return intervals;
    },

    // Document/Extract rating commands (FSRS scheduling for browser)
    rate_document: async (args) => {
        const request = args.request as { document_id: string; rating: number; time_taken?: number };
        const doc = await db.getDocument(request.document_id);
        if (!doc) {
            throw new Error(`Document ${request.document_id} not found`);
        }

        const now = new Date();
        const scheduler = createFsrsScheduler();
        const grade = toFsrsGrade(request.rating);
        const card = buildCardFromDocument(doc, now);
        const next = scheduler.next(card, now, grade);
        const nextCard = next.card;
        
        // Calculate base interval from FSRS
        let intervalDays = intervalFromDue(now, nextCard.due, nextCard.scheduled_days);
        
        // Apply bounds for "Hard" rating (rating = 2)
        if (request.rating === 2) {
            intervalDays = applyHardRatingBound(intervalDays, doc.priority_slider);
        }
        
        // Apply priority multiplier
        intervalDays = applyPriorityMultiplier(intervalDays, doc.priority_slider);
        
        // Ensure minimum interval of 1 day for non-"Again" ratings
        if (request.rating !== 1) {
            intervalDays = Math.max(1, intervalDays);
        }
        
        // Calculate actual due date based on adjusted interval
        const nextDue = new Date(now.getTime() + intervalDays * DAY_MS);
        const nextReviewDateIso = nextDue.toISOString();

        // Update document with new scheduling data
        const newTimeSpent = (doc.total_time_spent || 0) + (request.time_taken || 0);

        await db.updateDocument(request.document_id, {
            next_reading_date: nextReviewDateIso,
            stability: nextCard.stability,
            difficulty: nextCard.difficulty,
            reps: nextCard.reps,
            total_time_spent: newTimeSpent,
            date_last_reviewed: now.toISOString(),
        });

        const priorityLabel = getPriorityLabel(doc.priority_slider);
        
        return {
            next_review_date: nextReviewDateIso,
            stability: nextCard.stability,
            difficulty: nextCard.difficulty,
            interval_days: intervalDays,
            scheduling_reason: `${priorityLabel} priority: ${intervalDays.toFixed(1)} days`,
        };
    },
    rate_document_engaging: async (args) => {
        return await commandHandlers.rate_document(args);
    },

    rate_extract: async (args) => {
        const request = args.request as { extract_id: string; rating: number; time_taken?: number };
        const extract = await db.getExtract(request.extract_id);
        if (!extract) {
            throw new Error(`Extract ${request.extract_id} not found`);
        }

        const now = new Date();
        const scheduler = createFsrsScheduler();
        const grade = toFsrsGrade(request.rating);
        const card = buildCardFromExtract(extract, now);
        const next = scheduler.next(card, now, grade);
        const nextCard = next.card;
        const nextReviewDateIso = nextCard.due.toISOString();
        const intervalDays = intervalFromDue(now, nextCard.due, nextCard.scheduled_days);

        // Update extract with new scheduling data
        await db.updateExtract(request.extract_id, {
            next_review_date: nextReviewDateIso,
            memory_state: { stability: nextCard.stability, difficulty: nextCard.difficulty },
            review_count: nextCard.reps,
            reps: nextCard.reps,
            last_review_date: now.toISOString(),
        });

        return {
            next_review_date: nextReviewDateIso,
            stability: nextCard.stability,
            difficulty: nextCard.difficulty,
            interval_days: intervalDays,
            scheduling_reason: `FSRS: Rating ${request.rating} → ${intervalDays.toFixed(2)} days`,
        };
    },

    // Analytics commands
    get_activity_data: async (args) => {
        const days = (args.days as number) ?? 30;
        const items = await db.getLearningItems();
        const activities: Array<{
            date: string;
            reviews_count: number;
            cards_learned: number;
            time_spent_minutes: number;
            retention_rate: number;
        }> = [];
        const now = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(now.getDate() - i);
            const dateStr = date.toISOString().split("T")[0];
            const dayItems = items.filter((item) => (item.last_review_date || "").startsWith(dateStr));
            const reviewsCount = dayItems.length;
            const cardsLearned = dayItems.filter((item) => (item.review_count || 0) === 1).length;
            const retained = dayItems.filter((item) => (item.lapses || 0) === 0).length;
            const retentionRate = reviewsCount > 0 ? (retained / reviewsCount) * 100 : 0;
            activities.push({
                date: dateStr,
                reviews_count: reviewsCount,
                cards_learned: cardsLearned,
                time_spent_minutes: Math.round(reviewsCount * 0.5),
                retention_rate: retentionRate,
            });
        }

        return activities;
    },

    get_dashboard_stats: async () => {
        const docs = await db.getDocuments();
        const dueItems = await db.getDueLearningItems();
        return toCamelCase({
            total_documents: docs.length,
            total_due_items: dueItems.length,
        });
    },

    get_category_stats: async () => {
        return [];
    },

    get_memory_stats: async () => {
        return {};
    },

    get_leech_dashboard: async (args) => {
        const threshold = Math.max(1, Number(args.threshold ?? 8));
        const items = await db.getLearningItems();
        return items
            .filter((item) => !item.is_suspended && (item.lapses || 0) >= threshold)
            .sort((a, b) => (b.lapses || 0) - (a.lapses || 0))
            .map((item) => ({
                id: item.id,
                question: item.question,
                lapses: item.lapses || 0,
                review_count: item.review_count || 0,
                suggested_actions: [
                    "Rewrite for clarity",
                    "Split into smaller cards",
                    (item.lapses || 0) >= threshold + 2 ? "Add progressive hints" : "Review formatting",
                ],
            }));
    },

    get_due_workload_forecast: async (args) => {
        const days = Math.max(1, Math.min((args.days as number) ?? 90, 365));
        const items = await db.getLearningItems();
        const docs = await db.getDocuments();
        const points: Array<{
            date: string;
            due_learning_items: number;
            due_documents: number;
            due_total: number;
        }> = [];
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        for (let i = 0; i < days; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            const dateStr = date.toISOString().split("T")[0];
            const dueLearning = items.filter((item) => (item.due_date || "").startsWith(dateStr) && !item.is_suspended).length;
            const dueDocs = docs.filter((doc) => (doc.next_reading_date || "").startsWith(dateStr) && !doc.is_archived).length;
            points.push({
                date: dateStr,
                due_learning_items: dueLearning,
                due_documents: dueDocs,
                due_total: dueLearning + dueDocs,
            });
        }

        const summarize = (horizon: number) => ({
            horizon_days: horizon,
            due_total: points.slice(0, horizon).reduce((sum, p) => sum + p.due_total, 0),
        });

        return {
            points,
            summaries: [summarize(30), summarize(60), summarize(90)],
        };
    },

    optimize_algorithm_params: async () => {
        const settings = useSettingsStore.getState().settings;
        const items = await db.getLearningItems();
        const reviewed = items.filter((item) => (item.review_count || 0) > 0);
        const totalReviews = reviewed.reduce((sum, item) => sum + (item.review_count || 0), 0);
        const totalLapses = reviewed.reduce((sum, item) => sum + (item.lapses || 0), 0);
        const observedRetention = totalReviews > 0 ? 1 - (totalLapses / totalReviews) : 0.5;
        const defaultWeights = getDefaultFsrsParameters();
        const shift = Math.max(-0.2, Math.min(0.2, observedRetention - 0.9));
        const personalizedWeights = defaultWeights.map((weight, index) => {
            const direction = index % 2 === 0 ? -1 : 1;
            return Math.max(0.001, weight * (1 + (shift * 0.12 * direction)));
        });

        const nextSettings = {
            ...settings,
            learning: {
                ...settings.learning,
                fsrsParams: {
                    ...settings.learning.fsrsParams,
                    personalizedWeights,
                    lastOptimizationAt: new Date().toISOString(),
                    optimizedReviewCount: totalReviews,
                },
            },
        };
        await db.setSyncState("settings", nextSettings);

        return {
            best_params: {
                min_ease_factor: 1.3,
                initial_ease_factor: 2.5,
                desired_retention: settings.learning.fsrsParams.desiredRetention,
            },
            expected_retention: observedRetention,
            iterations: 1,
            converged: totalReviews >= 200,
            fsrs_weights: personalizedWeights,
            history_count: totalReviews,
            minimum_history_required: 200,
        };
    },

    get_workload_data: async (args: { start_date: string; end_date: string }) => {
        const items = await db.getLearningItems();
        const start = new Date(args.start_date + "T00:00:00Z");
        const end = new Date(args.end_date + "T23:59:59Z");
        const days: Array<{ date: string; due_count: number; reviewed_count: number; new_count: number }> = [];

        const current = new Date(start);
        while (current <= end) {
            const dateStr = current.toISOString().split("T")[0];
            const dueCount = items.filter((item) => (item.due_date || "").startsWith(dateStr) && !item.is_suspended).length;
            const reviewedCount = items.filter((item) => (item.last_review_date || "").startsWith(dateStr) && !item.is_suspended && (item.review_count || 0) > 0).length;
            const newCount = items.filter((item) => (item.last_review_date || "").startsWith(dateStr) && (item.review_count || 0) === 1 && !item.is_suspended).length;

            days.push({
                date: dateStr,
                due_count: dueCount,
                reviewed_count: reviewedCount,
                new_count: newCount,
            });

            current.setDate(current.getDate() + 1);
        }

        return days;
    },

    get_workload_day_details: async (args: { date: string }) => {
        const items = await db.getLearningItems();
        const docs = await db.getDocuments();
        const dateStr = args.date;
        const todayStr = new Date().toISOString().split("T")[0];
        const isPast = dateStr < todayStr;

        const docMap = new Map(docs.map((d) => [d.id, d.title || "Unknown"]));

        if (isPast) {
            return items
                .filter((item) => (item.last_review_date || "").startsWith(dateStr) && !item.is_suspended && (item.review_count || 0) > 0)
                .map((item) => ({
                    item_id: item.id,
                    question: item.question,
                    answer: item.answer || null,
                    document_title: (item.document_id && docMap.get(item.document_id)) || "Unknown",
                    item_type: item.item_type,
                    state: item.state,
                    review_rating: null,
                }));
        } else {
            return items
                .filter((item) => (item.due_date || "").startsWith(dateStr) && !item.is_suspended)
                .map((item) => ({
                    item_id: item.id,
                    question: item.question,
                    answer: item.answer || null,
                    document_title: (item.document_id && docMap.get(item.document_id)) || "Unknown",
                    item_type: item.item_type,
                    state: item.state,
                    review_rating: null,
                }));
        }
    },

    // AI commands (passthrough - will use client-side API calls)
    get_ai_config: async () => {
        const config = await db.getSyncState('ai_config');
        return config || null;
    },

    set_ai_config: async (args) => {
        await db.setSyncState('ai_config', args.config);
        return args.config;
    },

    // Settings
    get_settings: async () => {
        const settings = await db.getSyncState('settings');
        return settings || {};
    },

    set_settings: async (args) => {
        await db.setSyncState('settings', args.settings);
        return args.settings;
    },

    // Migration status (always migrated in browser)
    get_migration_status: async () => {
        return { is_migrated: true, in_progress: false };
    },

    // Fetch URL content (for ArXiv, etc.) with CORS proxy support
    fetch_url_content: async (args) => {
        const url = args.url as string;

        // List of CORS proxies to try
        const corsProxies = [
            null, // Try direct fetch first (might work for CORS-enabled resources)
            'https://api.allorigins.win/raw?url=',
            'https://corsproxy.io/?',
            'https://api.codetabs.com/v1/proxy?quest='
        ];

        let lastError: Error | null = null;

        // Helper function to extract filename from URL
        const getFilenameFromUrl = (url: string): string => {
            try {
                const urlObj = new URL(url);
                const pathname = urlObj.pathname;
                const segments = pathname.split('/').filter(s => s);
                return segments[segments.length - 1] || 'download';
            } catch {
                return 'download';
            }
        };

        // Try direct fetch first (might work for CORS-enabled feeds)
        try {
            console.log('[Browser] Trying direct fetch for:', url);
            const response = await fetch(url);

            if (response.ok) {
                const contentType = response.headers.get('content-type') || 'application/octet-stream';
                const blob = await response.blob();

                // Generate unique ID and store in IndexedDB
                const fileId = `fetched-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                const filename = getFilenameFromUrl(url);
                const file = new File([blob], filename, { type: contentType });

                await db.storeFile(file, `browser-fetched://${fileId}`);

                console.log('[Browser] Successfully fetched URL directly');

                return {
                    file_path: `browser-fetched://${fileId}`,
                    file_name: filename,
                    content_type: contentType
                };
            }
        } catch (directError) {
            console.log('[Browser] Direct fetch failed, trying CORS proxies:', directError);
            lastError = directError as Error;
        }

        // Try each CORS proxy
        for (const proxy of corsProxies) {
            if (!proxy) continue; // Skip null (already tried direct)

            try {
                console.log('[Browser] Trying CORS proxy:', proxy);
                const proxyUrl = proxy + encodeURIComponent(url);
                const response = await fetch(proxyUrl);

                if (response.ok) {
                    const contentType = response.headers.get('content-type') || 'application/octet-stream';
                    const blob = await response.blob();

                    // Generate unique ID and store in IndexedDB
                    const fileId = `fetched-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                    const filename = getFilenameFromUrl(url);
                    const file = new File([blob], filename, { type: contentType });

                    await db.storeFile(file, `browser-fetched://${fileId}`);

                    console.log('[Browser] Successfully fetched feed via proxy:', proxy);

                    return {
                        file_path: `browser-fetched://${fileId}`,
                        file_name: filename,
                        content_type: contentType
                    };
                } else {
                    console.log('[Browser] Proxy returned status:', response.status);
                }
            } catch (proxyError) {
                console.log('[Browser] Proxy failed:', proxy, proxyError);
                lastError = proxyError as Error;
            }
        }

        throw new Error(`Failed to fetch URL after trying all methods. Last error: ${lastError?.message || 'Unknown error'}`);
    },

    import_youtube_video: async (args) => {
        const url = args.url as string;
        let title = `YouTube: ${url}`;
        const idMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
            || url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
            || url.match(/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/)
            || url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
        const videoId = idMatch ? idMatch[1] : null;

        if (videoId) {
            try {
                const noembedResponse = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
                if (noembedResponse.ok) {
                    const data = await noembedResponse.json();
                    if (data?.title) {
                        title = data.title;
                    }
                }
            } catch (error) {
                console.warn('[Browser] Failed to fetch YouTube title:', error);
            }
        }

        // Create a document with the YouTube URL
        const doc = await db.createDocument({
            title,
            file_path: url,
            file_type: 'youtube',
        });
        return toCamelCase(doc);
    },

    get_youtube_transcript_by_id: async (args) => {
        const videoId = args.videoId as string;
        const language = args.language as string | undefined;

        if (!videoId) {
            console.warn('[Browser] No videoId provided for transcript fetch');
            return [];
        }

        try {
            console.log('[Browser] Fetching YouTube transcript for:', videoId);
            const result = await fetchYouTubeTranscript(videoId, language);
            console.log(`[Browser] Successfully fetched ${result.segments.length} transcript segments`);
            return result.segments;
        } catch (error) {
            console.warn('[Browser] Failed to fetch YouTube transcript:', error);
            // Re-throw specific errors so the UI can show appropriate messages
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (errorMsg.includes('does not have captions') || 
                errorMsg.includes('age-restricted') ||
                errorMsg.includes('requires consent') ||
                errorMsg.includes('bot detection') ||
                errorMsg.includes('Sign in to confirm') ||
                errorMsg.includes('CORS') ||
                errorMsg.includes('local development')) {
                throw error;
            }
            // Return empty array for other errors to maintain compatibility
            return [];
        }
    },

    get_youtube_transcript: async (args) => {
        const url = args.url as string;
        const language = args.language as string | undefined;

        if (!url) {
            console.warn('[Browser] No URL provided for transcript fetch');
            return [];
        }

        try {
            console.log('[Browser] Fetching YouTube transcript for URL:', url);
            const result = await fetchYouTubeTranscript(url, language);
            console.log(`[Browser] Successfully fetched ${result.segments.length} transcript segments`);
            return result.segments;
        } catch (error) {
            console.warn('[Browser] Failed to fetch YouTube transcript:', error);
            return [];
        }
    },

    check_ytdlp: async () => {
        // In browser mode, we use the browser-based transcript fetching
        // which doesn't require yt-dlp, so we return true
        return true;
    },

    get_youtube_video_info: async (args) => {
        const url = args.url as string;

        if (!url) {
            throw new Error('No URL provided');
        }

        // Extract video ID
        const idMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
            || url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
            || url.match(/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/)
            || url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
        const videoId = idMatch ? idMatch[1] : null;

        if (!videoId) {
            throw new Error('Invalid YouTube URL');
        }

        // Use noembed to get video info
        const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch video info');
        }

        const data = await response.json();

        return {
            id: videoId,
            title: data.title || 'Unknown',
            description: data.html || '',
            channel: data.author_name || 'Unknown',
            channel_id: '',
            duration: 0, // noembed doesn't provide duration
            view_count: 0,
            upload_date: '',
            thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            publish_date: '',
            tags: [],
            category: '',
            live_content: false,
        };
    },

    // YouTube Playlist commands (browser implementation using YouTube Data API)
    get_playlist_subscriptions: async () => {
        // In browser mode, we don't persist subscriptions - one-time imports only
        return [];
    },

    get_playlist_subscription: async (args) => {
        const subscriptionId = args.subscriptionId as string;
        // Return a mock subscription since we don't persist them in browser mode
        return {
            subscription: {
                id: subscriptionId,
                playlist_id: subscriptionId,
                playlist_url: `https://www.youtube.com/playlist?list=${subscriptionId}`,
                title: null,
                channel_name: null,
                channel_id: null,
                description: null,
                thumbnail_url: null,
                total_videos: null,
                is_active: false,
                auto_import_new: false,
                queue_intersperse_interval: 5,
                priority_rating: 5,
                last_refreshed_at: null,
                refresh_interval_hours: 24,
                created_at: new Date().toISOString(),
                modified_at: new Date().toISOString(),
            },
            videos: [],
        };
    },

    subscribe_to_playlist: async (args) => {
        const playlistUrl = args.playlistUrl as string;
        
        if (!isYouTubeApiEnabled()) {
            throw new Error('YouTube API key not configured. Please add your YouTube Data API key in Settings > Integrations to import playlists.');
        }

        const playlistId = extractPlaylistId(playlistUrl);
        if (!playlistId) {
            throw new Error('Invalid YouTube playlist URL');
        }

        // Fetch playlist info from YouTube Data API
        const playlistInfo = await fetchPlaylistInfo(playlistId);

        // Import all videos from the playlist
        const videosToImport = await importPlaylistVideos(playlistInfo, true);
        
        // Create documents for each video
        const importedDocs = [];
        for (const video of videosToImport) {
            try {
                const doc = await db.createDocument({
                    title: video.title,
                    file_path: video.url,
                    file_type: 'youtube',
                });
                importedDocs.push(doc);
            } catch (error) {
                console.warn(`[Browser] Failed to import video ${video.videoId}:`, error);
            }
        }

        return {
            id: playlistId,
            playlist_id: playlistId,
            playlist_url: playlistUrl,
            title: playlistInfo.title,
            channel_name: playlistInfo.channelTitle,
            channel_id: playlistInfo.channelId,
            description: playlistInfo.description,
            thumbnail_url: playlistInfo.thumbnail,
            total_videos: importedDocs.length,
            is_active: true,
            auto_import_new: false,
            queue_intersperse_interval: 5,
            priority_rating: 5,
            last_refreshed_at: new Date().toISOString(),
            refresh_interval_hours: 24,
            created_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
        };
    },

    update_playlist_subscription: async () => {
        // No-op in browser mode - subscriptions are not persisted
        return;
    },

    delete_playlist_subscription: async () => {
        // No-op in browser mode - subscriptions are not persisted
        return;
    },

    refresh_playlist: async (args) => {
        const subscriptionId = args.subscriptionId as string;
        
        if (!isYouTubeApiEnabled()) {
            throw new Error('YouTube API key not configured. Please add your YouTube Data API key in Settings > Integrations.');
        }

        // Fetch fresh playlist info
        const playlistInfo = await fetchPlaylistInfo(subscriptionId);

        return {
            new_videos_found: playlistInfo.videos.length,
            imported_count: 0, // Videos are imported on subscribe, not refresh
        };
    },

    import_playlist_video: async () => {
        // In browser mode, this is handled during subscribe_to_playlist
        // Return a mock document
        throw new Error('Individual video import not supported in browser mode. Please import the entire playlist.');
    },

    get_unimported_playlist_videos: async () => {
        // Not applicable in browser mode
        return [];
    },

    get_playlist_settings: async () => {
        // Return default settings
        return {
            id: 'global',
            enabled: isYouTubeApiEnabled(),
            default_intersperse_interval: 5,
            default_priority: 5,
            max_consecutive_playlist_videos: 1,
            prefer_new_videos: true,
            created_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
        };
    },

    update_playlist_settings: async () => {
        // No-op in browser mode - settings are managed via useSettingsStore
        return;
    },

    get_playlist_queue_items: async () => {
        // Not applicable in browser mode
        return [];
    },

    mark_playlist_video_queued: async () => {
        // No-op in browser mode
        return;
    },

    // Anki Import (browser implementation using jszip and sql.js)
    import_anki_package_to_learning_items: async (args) => {
        const filePath = args.apkgPath as string;

        // Get the file from the browser file store
        const file = getBrowserFile(filePath);
        if (!file) {
            throw new Error('File not found. Please select the file again.');
        }

        return await importAnkiPackage(file);
    },

    import_anki_package_bytes_to_learning_items: async (args) => {
        const apkgBytes = args.apkgBytes as number[];
        const uint8Array = new Uint8Array(apkgBytes);

        console.log('[Browser] Starting Anki import, byte array length:', apkgBytes.length);
        try {
            const result = await importAnkiPackage(uint8Array);
            console.log('[Browser] Anki import successful, result type:', Array.isArray(result) ? 'array' : typeof result, 'length:', Array.isArray(result) ? result.length : 'N/A');

            // Verify result is serializable before returning
            let serialized: string;
            try {
                serialized = JSON.stringify(result);
            } catch (e) {
                console.error('[Browser] Result is not JSON serializable:', e);
                throw new Error('Import result is not serializable');
            }

            // Parse back to ensure clean plain objects
            try {
                return JSON.parse(serialized);
            } catch (e) {
                console.error('[Browser] Failed to parse serialized result:', e, 'serialized:', serialized.substring(0, 200));
                throw new Error('Failed to parse import result');
            }
        } catch (error) {
            console.error('[Browser] Anki import error:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(String(error));
        }
    },

    // JSON Deck Import (browser implementation)
    import_study_json_file: async (args) => {
        const filePath = args.filePath as string;
        const file = getBrowserFile(filePath);
        if (!file) {
            throw new Error('File not found. Please select the file again.');
        }

        const text = await file.text();
        let raw: Record<string, unknown>;
        try {
            raw = JSON.parse(text);
        } catch {
            throw new Error('Invalid JSON file.');
        }

        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
            throw new Error('Expected a JSON object mapping questions to cards.');
        }

        const entries = Object.entries(raw);
        if (entries.length === 0) {
            throw new Error('Deck file is empty (no cards found).');
        }

        // Validate first entry to confirm structure
        const firstCard = entries[0][1];
        if (!firstCard || typeof firstCard !== 'object' || !('answer' in firstCard)) {
            throw new Error('File does not match the expected JSON deck format.');
        }

        // Extract deck metadata from first card
        const card0 = firstCard as Record<string, unknown>;
        const deckName = (card0.deck_name as string) || 'Imported Deck';
        const subject = (card0.subject as string) || 'General';

        // Create the parent document
        const doc = await db.createDocument({
            title: deckName,
            file_path: `json-deck://${filePath}`,
            file_type: 'other',
        });

        // Deduplication: collect existing question hashes for this document
        const _existingItems = await db.getAllLearningItems();
        const existingIds = new Set<string>();

        // Simple SHA-256 hash for deduplication (using SubtleCrypto)
        const hashQuestion = async (q: string): Promise<string> => {
            const data = new TextEncoder().encode(q);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        };

        let imported = 0;
        let skipped = 0;

        for (const [question, cardValue] of entries) {
            const card = cardValue as Record<string, unknown>;
            const questionHash = await hashQuestion(question);

            if (existingIds.has(questionHash)) {
                skipped++;
                continue;
            }

            // Build interaction metadata from fields without direct LearningItem equivalents
            const interactionMetadata: Record<string, unknown> = {};
            if (card.correct_count !== undefined) interactionMetadata.correct_count = card.correct_count;
            if (card.missed_count !== undefined) interactionMetadata.missed_count = card.missed_count;
            if (card.retention_rate !== undefined) interactionMetadata.retention_rate = card.retention_rate;
            if (card.manual_review !== undefined) interactionMetadata.manual_review = card.manual_review;
            if (card.save_for_later !== undefined) interactionMetadata.save_for_later = card.save_for_later;
            if (card.difficulty !== undefined) interactionMetadata.difficulty_label = card.difficulty;
            if (card.difficulty_score !== undefined) interactionMetadata.difficulty_score = card.difficulty_score;

            await db.createLearningItem({
                document_id: doc.id,
                item_type: 'flashcard',
                question,
                answer: card.answer as string | undefined,
                tags: ['json-import', subject, deckName],
                interaction_metadata: interactionMetadata,
                // Browser backend stores don't support scheduling fields directly,
                // but the interaction_metadata preserves the data for sync
            });
            existingIds.add(questionHash);
            imported++;
        }

        return {
            deck_name: deckName,
            document_id: doc.id,
            cards_imported: imported,
            cards_skipped: skipped,
        };
    },

    validate_study_json_file: async (args) => {
        const filePath = args.filePath as string;
        const file = getBrowserFile(filePath);
        if (!file) {
            throw new Error('File not found. Please select the file again.');
        }

        const text = await file.text();
        let raw: Record<string, unknown>;
        try {
            raw = JSON.parse(text);
        } catch {
            throw new Error('Invalid JSON file.');
        }

        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
            throw new Error('Expected a JSON object mapping questions to cards.');
        }

        const entries = Object.entries(raw);
        if (entries.length === 0) {
            throw new Error('Deck file is empty (no cards found).');
        }

        const card0 = entries[0][1] as Record<string, unknown>;
        const deckName = (card0.deck_name as string) || 'Unknown Deck';
        const subject = (card0.subject as string) || 'Unknown';
        const totalCards = entries.length;
        const reviewCards = entries.filter(([, c]) => {
            const reviewCount = (c as Record<string, unknown>).review_count;
            return typeof reviewCount === 'number' && reviewCount > 0;
        }).length;

        return {
            deck_name: deckName,
            subject,
            total_cards: totalCards,
            new_cards: totalCards - reviewCards,
            review_cards: reviewCards,
        };
    },

    // RSS feed fetch with CORS proxy support
    fetch_rss_feed_url: async (args) => {
        const feedUrl = args.feedUrl as string;

        // List of CORS proxies to try
        const corsProxies = [
            'https://api.allorigins.win/raw?url=',
            'https://corsproxy.io/?',
            'https://api.codetabs.com/v1/proxy?quest='
        ];

        let lastError: Error | null = null;

        // Try direct fetch first (might work for CORS-enabled feeds)
        try {
            console.log('[Browser] Trying direct fetch for:', feedUrl);
            const response = await fetch(feedUrl);
            if (response.ok) {
                const xmlText = await response.text();
                return await parseAndReturnFeed(xmlText, feedUrl);
            }
        } catch (directError) {
            console.log('[Browser] Direct fetch failed, trying CORS proxies:', directError);
            lastError = directError as Error;
        }

        // Try each CORS proxy
        for (const proxy of corsProxies) {
            try {
                console.log('[Browser] Trying CORS proxy:', proxy);
                const proxyUrl = proxy + encodeURIComponent(feedUrl);
                const response = await fetch(proxyUrl);

                if (response.ok) {
                    const xmlText = await response.text();
                    console.log('[Browser] Successfully fetched feed via proxy:', proxy);
                    return await parseAndReturnFeed(xmlText, feedUrl);
                } else {
                    console.log('[Browser] Proxy returned status:', response.status);
                }
            } catch (proxyError) {
                console.log('[Browser] Proxy failed:', proxy, proxyError);
                lastError = proxyError as Error;
            }
        }

        throw new Error(`Failed to fetch feed after trying all methods. Last error: ${lastError?.message || 'Unknown error'}`);
    },

    // Anna's Archive / LibGen search - using Library Genesis API
    search_books: async (args) => {
        const { searchLibGen } = await import('../api/libgen');
        const query = args.query as string;
        const limit = (args.limit as number) || 25;
        
        console.log('[Browser] Searching LibGen for:', query);
        
        try {
            const books = await searchLibGen({
                query,
                count: limit,
                sortBy: 'def',
                reverse: false,
            });
            
            // Convert to the expected format
            return books.map(book => ({
                id: book.md5 || book.id,
                title: book.title,
                author: book.author || null,
                year: book.year ? parseInt(book.year) : null,
                publisher: book.publisher || null,
                language: book.language || null,
                formats: [book.extension.toUpperCase()],
                cover_url: book.cover || null,
                description: book.description || null,
                isbn: book.isbn || null,
                md5: book.md5 || null,
                file_size: book.size || null,
            }));
        } catch (error) {
            console.error('[Browser] LibGen search failed:', error);
            throw error;
        }
    },

    download_book: async (args) => {
        const { getDownloadLink } = await import('../api/libgen');
        const bookId = args.bookId as string;
        const format = (args.format as string)?.toLowerCase() || 'pdf';
        
        console.log('[Browser] Getting download link for book:', bookId);
        
        try {
            // Get the download URL
            const downloadUrl = await getDownloadLink(bookId);
            
            // Open the download URL in a new tab
            // Note: Actual file download may require going through LibGen's download page
            window.open(downloadUrl, '_blank');
            
            return {
                file_path: downloadUrl,
                file_name: `${bookId}.${format}`,
                file_size: 0, // Size unknown until download starts
            };
        } catch (error) {
            console.error('[Browser] Book download failed:', error);
            throw error;
        }
    },

    // PDF to HTML conversion (not available in browser mode)
    convert_pdf_to_html: async () => {
        throw new Error('PDF to HTML conversion requires the desktop app (Tauri). This feature is not available in web browser mode.');
    },

    convert_document_pdf_to_html: async () => {
        throw new Error('PDF to HTML conversion requires the desktop app (Tauri). This feature is not available in web browser mode.');
    },

    // Demo content commands
    get_demo_content_status: async () => {
        return await getDemoContentStatus();
    },

    import_demo_content_manually: async () => {
        return await importDemoContentManually();
    },

    get_available_mirrors: async () => {
        return [];
    },

    // LLM commands
    llm_chat: async (args) => {
        const provider = args.provider as string;
        const model = args.model as string | undefined;
        const messages = args.messages as Array<{ role: string; content: string }>;
        const temperature = (args.temperature as number) ?? 0.7;
        const maxTokens = (args.maxTokens as number) || 2000;
        const apiKey = args.apiKey as string | undefined;
        const baseUrl = args.baseUrl as string | undefined;

        if (providerRequiresApiKey(provider as 'openai' | 'anthropic' | 'ollama' | 'openrouter', baseUrl) && !apiKey) {
            throw new Error('API key is required');
        }

        // In browser mode, we support OpenRouter and OpenAI-compatible APIs
        const providerConfig: Record<string, { url: string; defaultModel: string }> = {
            openrouter: { url: baseUrl || 'https://openrouter.ai/api/v1', defaultModel: 'anthropic/claude-3.5-sonnet' },
            openai: { url: baseUrl || 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
            anthropic: { url: baseUrl || 'https://api.anthropic.com/v1', defaultModel: 'claude-3-5-sonnet-20241022' },
        };

        const config = providerConfig[provider];
        if (!config) {
            throw new Error(`Provider '${provider}' is not supported in browser mode. Supported: openrouter, openai`);
        }

        const actualModel = model || config.defaultModel;

        // Handle Anthropic separately due to different API format
        if (provider === 'anthropic') {
            const response = await fetch(`${config.url}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey!,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
                body: JSON.stringify({
                    model: actualModel,
                    max_tokens: maxTokens,
                    temperature,
                    messages: messages.filter(m => m.role !== 'system').map(m => ({
                        role: m.role,
                        content: m.content,
                    })),
                    system: messages.find(m => m.role === 'system')?.content,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            return {
                content: data.content?.[0]?.text || '',
                usage: data.usage ? {
                    promptTokens: data.usage.input_tokens,
                    completionTokens: data.usage.output_tokens,
                    totalTokens: data.usage.input_tokens + data.usage.output_tokens,
                } : undefined,
            };
        }

        // OpenAI-compatible API (OpenAI, OpenRouter)
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        // Add OpenRouter-specific headers
        if (provider === 'openrouter') {
            headers['HTTP-Referer'] = 'https://incrementum.app';
            headers['X-Title'] = 'Incrementum';
        }

        const response = await fetch(`${config.url}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: actualModel,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                temperature,
                max_tokens: maxTokens,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`${provider} API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        return {
            content: data.choices?.[0]?.message?.content || '',
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            } : undefined,
        };
    },

    llm_chat_with_context: async (args) => {
        const provider = args.provider as string;
        const model = args.model as string | undefined;
        const messages = args.messages as Array<{ role: string; content: string }>;
        const context = args.context as { type: string; documentId?: string; content?: unknown; selection?: string; contextWindowTokens?: number };
        const apiKey = args.apiKey as string | undefined;
        const baseUrl = args.baseUrl as string | undefined;

        const decodeByteString = (value: string): string => {
            const bytes = value.split(",").map((part) => parseInt(part.trim(), 10));
            if (bytes.some((byte) => Number.isNaN(byte))) {
                return value;
            }
            try {
                return new TextDecoder("utf-8").decode(Uint8Array.from(bytes));
            } catch {
                return value;
            }
        };

        const normalizeContextContent = (value: unknown): string | undefined => {
            if (value == null) return undefined;
            if (typeof value === "string") {
                const trimmed = value.trim();
                const bytePattern = /^\d{1,3}(?:,\s*\d{1,3})+$/;
                return bytePattern.test(trimmed) ? decodeByteString(trimmed) : trimmed;
            }
            if (value instanceof Uint8Array) {
                return new TextDecoder("utf-8").decode(value);
            }
            if (Array.isArray(value) && value.every((entry) => typeof entry === "number")) {
                try {
                    return new TextDecoder("utf-8").decode(Uint8Array.from(value));
                } catch {
                    return value.join(",");
                }
            }
            return String(value);
        };

        const trimContext = (value: string | undefined, maxTokens?: number): string | undefined => {
            if (!value) return undefined;
            const tokenLimit = maxTokens && maxTokens > 0 ? maxTokens : 2000;
            const maxChars = tokenLimit * 4;
            if (value.length <= maxChars) return value;
            return value.slice(0, maxChars);
        };

        const normalizedContent = trimContext(
            normalizeContextContent(context.content),
            context.contextWindowTokens
        );

        // Build context prompt
        let contextPrompt = '';
        if (context.type === 'document' && normalizedContent) {
            contextPrompt = `You are a helpful assistant analyzing the following document content:\n\n${normalizedContent}\n\nAnswer questions based on this document.`;
            if (context.selection && context.selection.trim().length > 0) {
                contextPrompt += `\n\nSelected text:\n${context.selection}`;
            }
        } else if (context.type === 'video' && normalizedContent) {
            contextPrompt = `You are a helpful assistant analyzing the following video transcript:\n\n${normalizedContent}\n\nAnswer questions based on this transcript.`;
            if (context.selection && context.selection.trim().length > 0) {
                contextPrompt += `\n\nSelected text:\n${context.selection}`;
            }
        } else if (context.type === 'web') {
            if (normalizedContent) {
                contextPrompt = `You are a helpful assistant analyzing the following web page content:\n\n${normalizedContent}\n\nAnswer questions based on this page.`;
                if (context.selection && context.selection.trim().length > 0) {
                    contextPrompt += `\n\nSelected text:\n${context.selection}`;
                }
            } else {
                contextPrompt = 'You are a helpful assistant that can search the web for information.';
            }
        } else {
            contextPrompt = 'You are a helpful assistant.';
        }

        // Prepend context as system message
        const messagesWithContext = [
            { role: 'system', content: contextPrompt },
            ...messages,
        ];

        // Call llm_chat with the enhanced messages
        return await commandHandlers.llm_chat({
            provider,
            model,
            messages: messagesWithContext,
            temperature: 0.7,
            maxTokens: context.contextWindowTokens && context.contextWindowTokens > 0
                ? context.contextWindowTokens
                : 2000,
            apiKey,
            baseUrl,
        });
    },

    llm_get_models: async (args) => {
        const provider = args.provider as string;
        const apiKey = args.apiKey as string | undefined;
        const baseUrl = args.baseUrl as string | undefined;

        // Helper to create model info with pricing
        const createModelInfo = (id: string, name: string, contextLength?: number, pricing?: { prompt?: number; completion?: number }) => ({
            id,
            name,
            context_length: contextLength,
            pricing: pricing ? {
                prompt: pricing.prompt,
                completion: pricing.completion,
                request: undefined,
                image: undefined,
                web_search: undefined,
                cache_read: undefined,
                cache_write: undefined,
            } : undefined,
        });

        // Default models for each provider with pricing (approximate, per 1K tokens)
        const defaultModels: Record<string, ReturnType<typeof createModelInfo>[]> = {
            openai: [
                createModelInfo('gpt-4o', 'GPT-4o', 128000, { prompt: 0.0025, completion: 0.01 }),
                createModelInfo('gpt-4o-mini', 'GPT-4o Mini', 128000, { prompt: 0.00015, completion: 0.0006 }),
                createModelInfo('gpt-4-turbo', 'GPT-4 Turbo', 128000, { prompt: 0.01, completion: 0.03 }),
                createModelInfo('gpt-3.5-turbo', 'GPT-3.5 Turbo', 16385, { prompt: 0.0005, completion: 0.0015 }),
            ],
            anthropic: [
                createModelInfo('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 200000, { prompt: 0.003, completion: 0.015 }),
                createModelInfo('claude-3-5-haiku-20241022', 'Claude 3.5 Haiku', 200000, { prompt: 0.0008, completion: 0.004 }),
                createModelInfo('claude-3-opus-20240229', 'Claude 3 Opus', 200000, { prompt: 0.015, completion: 0.075 }),
            ],
            ollama: [
                createModelInfo('llama3.2', 'Llama 3.2', 128000),
                createModelInfo('mistral', 'Mistral', 32000),
                createModelInfo('codellama', 'CodeLlama', 16000),
                createModelInfo('phi3', 'Phi-3', 128000),
            ],
            openrouter: [
                createModelInfo('anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet', 200000, { prompt: 0.003, completion: 0.015 }),
                createModelInfo('anthropic/claude-3.5-sonnet:beta', 'Claude 3.5 Sonnet (Beta)', 200000, { prompt: 0.003, completion: 0.015 }),
                createModelInfo('anthropic/claude-3.5-haiku', 'Claude 3.5 Haiku', 200000, { prompt: 0.0008, completion: 0.004 }),
                createModelInfo('anthropic/claude-3-opus', 'Claude 3 Opus', 200000, { prompt: 0.015, completion: 0.075 }),
                createModelInfo('openai/gpt-4o', 'GPT-4o', 128000, { prompt: 0.0025, completion: 0.01 }),
                createModelInfo('openai/gpt-4o-mini', 'GPT-4o Mini', 128000, { prompt: 0.00015, completion: 0.0006 }),
                createModelInfo('openai/gpt-4-turbo', 'GPT-4 Turbo', 128000, { prompt: 0.01, completion: 0.03 }),
                createModelInfo('google/gemini-pro-1.5', 'Gemini Pro 1.5', 2000000, { prompt: 0.00125, completion: 0.005 }),
                createModelInfo('meta-llama/llama-3.1-405b-instruct', 'Llama 3.1 405B', 128000, { prompt: 0.005, completion: 0.005 }),
                createModelInfo('deepseek/deepseek-chat', 'DeepSeek Chat', 64000, { prompt: 0.00027, completion: 0.0011 }),
            ],
        };

        if (provider === 'openai' && (apiKey?.trim() || !providerRequiresApiKey('openai', baseUrl))) {
            try {
                const url = baseUrl || 'https://api.openai.com/v1';
                const headers: Record<string, string> = {};
                if (apiKey?.trim()) {
                    headers['Authorization'] = `Bearer ${apiKey}`;
                }
                const response = await fetch(`${url}/models`, { headers });
                if (response.ok) {
                    const data = await response.json();
                    if (data && Array.isArray(data.data)) {
                        return data.data
                            .map((m: { id: string }) => createModelInfo(m.id, m.id))
                            .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
                    }
                }
            } catch (error) {
                console.warn('[Browser] Failed to fetch OpenAI models, using defaults:', error);
            }
        }

        if (provider === 'anthropic' && apiKey?.trim()) {
            try {
                const url = baseUrl || 'https://api.anthropic.com/v1';
                const response = await fetch(`${url}/models`, {
                    headers: {
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                    },
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data && Array.isArray(data.data)) {
                        return data.data
                            .map((m: { id: string; display_name?: string }) => createModelInfo(m.id, m.display_name || m.id))
                            .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
                    }
                }
            } catch (error) {
                console.warn('[Browser] Failed to fetch Anthropic models, using defaults:', error);
            }
        }

        // For OpenRouter, try to fetch models from API if API key is provided
        if (provider === 'openrouter' && apiKey && apiKey.trim()) {
            try {
                const url = baseUrl || 'https://openrouter.ai/api/v1';
                const response = await fetch(`${url}/models`, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'HTTP-Referer': 'https://incrementum.app',
                        'X-Title': 'Incrementum',
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data && data.data && Array.isArray(data.data)) {
                        const models = data.data.map((m: { 
                            id: string; 
                            name?: string; 
                            context_length?: number;
                            pricing?: { prompt?: number; completion?: number; request?: number; image?: number };
                        }) => createModelInfo(
                            m.id, 
                            m.name || m.id, 
                            m.context_length,
                            m.pricing ? { prompt: m.pricing.prompt, completion: m.pricing.completion } : undefined
                        )).sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
                        return models;
                    }
                }
            } catch (error) {
                console.warn('[Browser] Failed to fetch OpenRouter models, using defaults:', error);
            }
        }

        return defaultModels[provider] || [];
    },

    // MCP commands
    mcp_get_incrementum_tools: async () => {
        // Return the same tool definitions as the Rust backend
        return [
            {
                name: 'create_document',
                description: 'Create a new document in Incrementum',
                inputSchema: {
                    type: 'object',
                    properties: {
                        title: { type: 'string', description: 'Document title' },
                        content: { type: 'string', description: 'Document content' },
                        file_path: { type: 'string', description: 'File path' },
                        file_type: { type: 'string', description: 'File type (pdf, epub, md, etc.)' },
                    },
                    required: ['title'],
                },
            },
            {
                name: 'get_document',
                description: 'Retrieve details of a specific document',
                inputSchema: {
                    type: 'object',
                    properties: {
                        document_id: { type: 'string', description: 'Document ID' },
                    },
                    required: ['document_id'],
                },
            },
            {
                name: 'search_documents',
                description: 'Search documents by content or metadata',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search query' },
                        limit: { type: 'number', description: 'Maximum results' },
                    },
                    required: ['query'],
                },
            },
            {
                name: 'create_cloze_card',
                description: 'Create a cloze deletion flashcard',
                inputSchema: {
                    type: 'object',
                    properties: {
                        text: { type: 'string', description: 'Text with cloze deletions' },
                        document_id: { type: 'string', description: 'Associated document ID' },
                        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
                    },
                    required: ['text'],
                },
            },
            {
                name: 'create_qa_card',
                description: 'Create a question-answer flashcard',
                inputSchema: {
                    type: 'object',
                    properties: {
                        question: { type: 'string' },
                        answer: { type: 'string' },
                        document_id: { type: 'string' },
                        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
                    },
                    required: ['question', 'answer'],
                },
            },
            {
                name: 'create_extract',
                description: 'Create an extract or note from content',
                inputSchema: {
                    type: 'object',
                    properties: {
                        content: { type: 'string', description: 'Extract content' },
                        document_id: { type: 'string', description: 'Source document ID' },
                        note: { type: 'string', description: 'Additional notes' },
                        tags: { type: 'array', items: { type: 'string' } },
                        color: { type: 'string', description: 'Highlight color' },
                    },
                    required: ['content', 'document_id'],
                },
            },
            {
                name: 'get_learning_items',
                description: 'Get learning items for a document',
                inputSchema: {
                    type: 'object',
                    properties: {
                        document_id: { type: 'string' },
                        item_type: { type: 'string', enum: ['flashcard', 'cloze', 'qa', 'basic'] },
                    },
                    required: ['document_id'],
                },
            },
            {
                name: 'get_document_extracts',
                description: 'Get all extracts for a document',
                inputSchema: {
                    type: 'object',
                    properties: {
                        document_id: { type: 'string' },
                    },
                    required: ['document_id'],
                },
            },
            {
                name: 'get_review_queue',
                description: 'Get items due for review',
                inputSchema: {
                    type: 'object',
                    properties: {
                        limit: { type: 'number', description: 'Maximum items' },
                    },
                },
            },
        ];
    },

    // ── Substack API proxy (browser: direct fetch) ────────────────────────
    substack_search: async (args) => {
        const query = args.query as string;
        const cursor = args.cursor as string | undefined;
        const qs = new URLSearchParams({ query });
        if (cursor) qs.set('cursor', cursor);
        const resp = await fetch(`https://substack.com/api/v1/top/search?${qs}`);
        if (!resp.ok) throw new Error(`Substack search returned ${resp.status}`);
        return resp.json();
    },

    substack_categories: async () => {
        const resp = await fetch('https://substack.com/api/v1/categories');
        if (!resp.ok) throw new Error(`Substack categories returned ${resp.status}`);
        return resp.json();
    },

    substack_pub_homepage: async (args) => {
        const subdomain = args.subdomain as string;
        const resp = await fetch(`https://${subdomain}.substack.com/api/v1/homepage_data`);
        if (!resp.ok) throw new Error(`Substack pub homepage returned ${resp.status}`);
        return resp.json();
    },

    substack_category_feed: async (args) => {
        const categoryId = args.categoryId as string;
        const limit = args.limit as number | undefined;
        const cursor = args.cursor as string | undefined;
        const qs = new URLSearchParams({ tab: categoryId, type: 'category' });
        if (limit) qs.set('limit', String(limit));
        if (cursor) qs.set('cursor', cursor);
        const resp = await fetch(`https://substack.com/api/v1/reader/feed?${qs}`);
        if (!resp.ok) throw new Error(`Substack category feed returned ${resp.status}`);
        return resp.json();
    },

    mcp_call_incrementum_tool: async (args) => {
        const toolName = args.toolName as string;
        const toolArgs = args.arguments as Record<string, unknown>;

        // In browser mode, we can implement some of the tools using IndexedDB
        switch (toolName) {
            case 'create_document': {
                const doc = await db.createDocument({
                    title: toolArgs.title as string,
                    content: toolArgs.content as string | undefined,
                    file_path: toolArgs.file_path as string | undefined,
                    file_type: toolArgs.file_type as string | undefined,
                });
                return {
                    content: [{ type: 'text', text: `Created document: ${doc.id}` }],
                    isError: false,
                };
            }
            case 'get_document': {
                const doc = await db.getDocument(toolArgs.document_id as string);
                if (doc) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify(toCamelCase(doc)) }],
                        isError: false,
                    };
                }
                return {
                    content: [{ type: 'text', text: 'Document not found' }],
                    isError: true,
                };
            }
            case 'search_documents': {
                const docs = await db.getDocuments();
                const query = (toolArgs.query as string).toLowerCase();
                const limit = (toolArgs.limit as number) || 10;
                const filtered = docs
                    .filter(d => d.title.toLowerCase().includes(query) || d.content?.toLowerCase().includes(query))
                    .slice(0, limit);
                return {
                    content: [{ type: 'text', text: JSON.stringify(filtered.map(d => toCamelCase(d))) }],
                    isError: false,
                };
            }
            case 'create_qa_card': {
                const item = await db.createLearningItem({
                    document_id: toolArgs.document_id as string,
                    item_type: 'qa',
                    question: toolArgs.question as string,
                    answer: toolArgs.answer as string,
                    tags: Array.isArray(toolArgs.tags)
                        ? toolArgs.tags.filter((tag) => typeof tag === 'string')
                        : undefined,
                });
                return {
                    content: [{ type: 'text', text: `Created Q&A card: ${item.id}` }],
                    isError: false,
                };
            }
            case 'create_cloze_card': {
                const item = await db.createLearningItem({
                    document_id: toolArgs.document_id as string,
                    item_type: 'cloze',
                    question: toolArgs.text as string,
                    answer: toolArgs.text as string,
                    tags: Array.isArray(toolArgs.tags)
                        ? toolArgs.tags.filter((tag) => typeof tag === 'string')
                        : undefined,
                });
                return {
                    content: [{ type: 'text', text: `Created cloze card: ${item.id}` }],
                    isError: false,
                };
            }
            case 'create_extract': {
                const extract = await db.createExtract({
                    document_id: toolArgs.document_id as string,
                    content: toolArgs.content as string,
                    notes: toolArgs.note as string | undefined,
                });
                return {
                    content: [{ type: 'text', text: `Created extract: ${extract.id}` }],
                    isError: false,
                };
            }
            default:
                return {
                    content: [{ type: 'text', text: `Tool '${toolName}' is not available in browser mode` }],
                    isError: true,
                };
        }
    },

    // Sync commands - browser uses Yjs WebSocket sync instead of cloud sync
    // These are stub handlers to prevent errors when the settings UI polls for status
    get_sync_log: async () => {
        // Return empty log for browser mode (sync is handled via Yjs)
        return [];
    },

    sync_now: async () => {
        // In browser mode, sync is handled via Yjs WebSocket provider
        // This is a stub to prevent errors
        console.warn('[Browser] sync_now called - browser uses Yjs WebSocket sync, not cloud sync');
        return {
            status: 'Synced',
            uploaded: 0,
            downloaded: 0,
            conflicts: 0,
        };
    },

    get_sync_status: async () => {
        // In browser mode, check if Yjs sync is connected
        // For now, return Idle status
        return 'Idle';
    },

    resolve_sync_conflict: async () => {
        // Yjs handles conflicts automatically
        return;
    },

    get_browser_sync_config: async () => readBrowserSyncConfig(),

    set_browser_sync_config: async (args) => {
        const config = args.config as { host: string; port: number; autoStart: boolean; apiKey?: string };
        localStorage.setItem(
            BROWSER_SYNC_CONFIG_STORAGE,
            JSON.stringify({
                host: config.host || "127.0.0.1",
                port: Number(config.port || 8766),
                autoStart: Boolean(config.autoStart),
                apiKey: config.apiKey || getOrCreateAutomationApiKey(),
            })
        );
        return null;
    },

    sync_to_logseq: async () => ({
        documents: 0,
        extracts: 0,
        flashcards: 0,
    }),

    sync_from_logseq: async () => ({
        documents: 0,
        extracts: 0,
        flashcards: 0,
    }),

    get_automation_api_key: async () => getOrCreateAutomationApiKey(),

    rotate_automation_api_key: async () => {
        const next = `inc_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
        localStorage.setItem(AUTOMATION_KEY_STORAGE, next);
        return next;
    },

    // RSS Intelligence / Classifiers (localStorage-backed for PWA mode)
    add_rss_classifier: async (args) => {
        const classifiers = JSON.parse(localStorage.getItem('rss_classifiers') || '[]');
        const classifier = {
            id: `cls_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            feed_id: args.feedId,
            classifier_type: args.classifierType,
            value: args.value,
            sentiment: args.sentiment,
            scope: args.scope || 'feed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        classifiers.push(classifier);
        localStorage.setItem('rss_classifiers', JSON.stringify(classifiers));
        return classifier;
    },

    remove_rss_classifier: async (args) => {
        const classifiers = JSON.parse(localStorage.getItem('rss_classifiers') || '[]');
        const filtered = classifiers.filter((c: any) => c.id !== args.id);
        localStorage.setItem('rss_classifiers', JSON.stringify(filtered));
        return true;
    },

    get_rss_classifiers: async (args) => {
        const classifiers = JSON.parse(localStorage.getItem('rss_classifiers') || '[]');
        let result = classifiers;
        if (args?.feedId) result = result.filter((c: any) => c.feed_id === args.feedId);
        if (args?.classifierType) result = result.filter((c: any) => c.classifier_type === args.classifierType);
        if (args?.sentiment) result = result.filter((c: any) => c.sentiment === args.sentiment);
        return result;
    },

    update_rss_classifiers_batch: async (args) => {
        const classifiers = JSON.parse(localStorage.getItem('rss_classifiers') || '[]');
        const updates = args.updates as Array<{ id: string; sentiment?: string; value?: string }>;
        for (const update of updates) {
            const idx = classifiers.findIndex((c: any) => c.id === update.id);
            if (idx >= 0) {
                if (update.sentiment) classifiers[idx].sentiment = update.sentiment;
                if (update.value) classifiers[idx].value = update.value;
                classifiers[idx].updated_at = new Date().toISOString();
            }
        }
        localStorage.setItem('rss_classifiers', JSON.stringify(classifiers));
        return updates.length;
    },

    compute_intelligence_score: async (args) => {
        const classifiers = JSON.parse(localStorage.getItem('rss_classifiers') || '[]');
        const scores = JSON.parse(localStorage.getItem('rss_intelligence_scores') || '{}');
        const articleScores = JSON.parse(localStorage.getItem('rss_article_data') || '{}');
        const articleId = args.articleId as string;
        const article = articleScores[articleId] || {};
        let score = 0;
        for (const cls of classifiers) {
            if (cls.scope !== 'global' && cls.feed_id !== article.feed_id) continue;
            let matches = false;
            if (cls.classifier_type === 'author' && article.author) matches = article.author.toLowerCase().includes(cls.value.toLowerCase());
            else if (cls.classifier_type === 'title' && article.title) matches = article.title.toLowerCase().includes(cls.value.toLowerCase());
            else if (cls.classifier_type === 'feed') matches = true;
            if (matches) {
                if (cls.sentiment === 'like') score += 1;
                else if (cls.sentiment === 'dislike') score -= 1;
            }
        }
        const finalScore = Math.max(0, score);
        scores[articleId] = { score: finalScore, computed_at: new Date().toISOString() };
        localStorage.setItem('rss_intelligence_scores', JSON.stringify(scores));
        return finalScore;
    },

    recompute_all_intelligence_scores: async () => {
        // In PWA mode, scores are computed on-demand, so this is a no-op
        return 0;
    },

    get_rss_articles_with_intelligence: async (_args) => {
        // Fallback: return empty array — PWA mode uses local feed data
        return [];
    },
};

/**
 * Helper function to parse and return feed
 */
async function parseAndReturnFeed(xmlText: string, feedUrl: string) {
    const { parseFeed } = await import('../api/rss');
    const feed = await parseFeed(xmlText, feedUrl);

    if (!feed) {
        throw new Error('Failed to parse feed');
    }

    // Convert to backend format (snake_case)
    return {
        id: feed.id,
        title: feed.title,
        description: feed.description,
        link: feed.link,
        feed_url: feed.feedUrl,
        image_url: feed.imageUrl || feed.icon,
        language: feed.language,
        category: feed.category,
        items: feed.items.map(item => ({
            id: item.id,
            title: item.title,
            description: item.description,
            content: item.content,
            link: item.link,
            pub_date: item.pubDate,
            author: item.author,
            categories: item.categories,
            guid: item.guid,
        }))
    };
}

/**
 * Import an Anki package (shared helper)
 */
async function importAnkiPackage(fileOrBytes: File | Uint8Array) {
    // Parse the .apkg file
    console.log('[Browser] Parsing Anki package...');
    const decks = await parseAnkiPackage(fileOrBytes);
    console.log(`[Browser] Parsed ${decks.length} decks`);

    // Convert to Incrementum format
    console.log('[Browser] Converting to Incrementum format...');
    const { documents, learningItems } = convertAnkiToLearningItems(decks);
    // Don't save dummy documents — Anki imports only produce learning items
    console.log(`[Browser] Converted: ${documents.length} decks (documents skipped), ${learningItems.length} learning items`);

    // documentIdMap is empty since we don't create documents; learning items will use empty docId

    // Create learning items in bulk — avoids hammering IndexedDB with
    // hundreds of individual transactions (which kills the backing store on mobile)
    console.log(`[Browser] Creating ${learningItems.length} learning items in database...`);
    const now = new Date().toISOString();
    const dbItems: any[] = [];

    for (const item of learningItems) {
        const fullItem = db.createLearningItemRaw({
            document_id: item.documentId || undefined,
            item_type: item.itemType,
            question: item.question,
            answer: item.answer,
            cloze_text: item.clozeText,
            cloze_ranges: item.clozeRanges,
            tags: item.tags,
        });
        dbItems.push(fullItem);
    }

    // Bulk insert all items in a single transaction
    await db.bulkPutLearningItems(dbItems);
    console.log(`[Browser] Bulk-inserted ${dbItems.length} learning items`);

    console.log(`[Browser] Successfully imported ${dbItems.length} learning items`);
    return dbItems.map((item) => toCamelCase(item));
}

/**
 * Execute a browser command
 */
export async function browserInvoke<T>(
    command: string,
    args?: Record<string, unknown>
): Promise<T> {
    const handler = commandHandlers[command];

    if (handler) {
        try {
            const result = await handler(args || {});
            return result as T;
        } catch (error) {
            console.error(`[Browser] Command "${command}" failed:`, error);
            throw error;
        }
    }

    // For unknown commands, return appropriate defaults
    console.warn(`[Browser] Unknown command "${command}", returning default`);

    if (command.startsWith('get_')) {
        return (command.includes('list') || command.endsWith('s') ? [] : null) as T;
    }

    // Commands starting with 'list_' should return an empty array
    if (command.startsWith('list_')) {
        return [] as T;
    }

    return undefined as T;
}
