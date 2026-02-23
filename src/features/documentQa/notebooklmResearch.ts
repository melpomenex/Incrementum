import { notebooklmResearch } from "../../api/integrations";

export interface ResearchSelectionRange {
  start: number;
  end: number;
  text: string;
}

export interface ResearchProvenance {
  documentId: string;
  sessionId: string;
  selectionStart: number;
  selectionEnd: number;
  selectedText: string;
  createdAt: number;
}

export interface ResearchArtifactDraft {
  id: string;
  type: "cloze" | "qa";
  question?: string;
  answer?: string;
  clozeText?: string;
  provenance: ResearchProvenance;
  createdAt: number;
  updatedAt: number;
}

export interface ResearchEvent {
  id: string;
  query: string;
  summary: string;
  source: "notebooklm" | "brainstorm";
  mode: string;
  createdAt: number;
}

export interface DocumentResearchSession {
  id: string;
  documentId: string;
  notebookId?: string;
  createdAt: number;
  updatedAt: number;
  lastQuery?: string;
  draftText: string;
  history: ResearchEvent[];
  artifacts: ResearchArtifactDraft[];
}

export interface OrchestratedResearchRequest {
  documentId: string;
  notebookId?: string;
  query: string;
  mode?: "fast" | "deep";
  from?: "web" | "drive";
  retryCount?: number;
  timeoutMs?: number;
  source?: "notebooklm" | "brainstorm";
  session: DocumentResearchSession;
}

export interface OrchestratedResearchResponse {
  session: DocumentResearchSession;
  event: ResearchEvent;
}

export class NotebookLMResearchError extends Error {
  code: "RATE_LIMIT" | "TIMEOUT" | "REQUEST_FAILED";

  constructor(code: NotebookLMResearchError["code"], message: string) {
    super(message);
    this.name = "NotebookLMResearchError";
    this.code = code;
  }
}

const STORAGE_KEY = "document_qa_notebooklm_sessions_v1";
const RATE_WINDOW_MS = 1000;
const sessionLastRequest = new Map<string, number>();

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new NotebookLMResearchError("TIMEOUT", `NotebookLM request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

function safeJsonParse(value: string | null): Record<string, DocumentResearchSession> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function readAllSessions(): Record<string, DocumentResearchSession> {
  if (typeof localStorage === "undefined") return {};
  return safeJsonParse(localStorage.getItem(STORAGE_KEY));
}

function writeAllSessions(sessions: Record<string, DocumentResearchSession>): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function createResearchSession(documentId: string, notebookId?: string): DocumentResearchSession {
  const now = Date.now();
  return {
    id: randomId("research-session"),
    documentId,
    notebookId,
    createdAt: now,
    updatedAt: now,
    draftText: "",
    history: [],
    artifacts: [],
  };
}

export function loadResearchSession(documentId: string): DocumentResearchSession | null {
  const sessions = readAllSessions();
  return sessions[documentId] || null;
}

export function loadOrCreateResearchSession(documentId: string, notebookId?: string): DocumentResearchSession {
  const existing = loadResearchSession(documentId);
  if (!existing) {
    const created = createResearchSession(documentId, notebookId);
    saveResearchSession(created);
    return created;
  }

  if (notebookId && !existing.notebookId) {
    const updated = {
      ...existing,
      notebookId,
      updatedAt: Date.now(),
    };
    saveResearchSession(updated);
    return updated;
  }

  return existing;
}

export function saveResearchSession(session: DocumentResearchSession): void {
  const sessions = readAllSessions();
  sessions[session.documentId] = {
    ...session,
    updatedAt: Date.now(),
  };
  writeAllSessions(sessions);
}

export function saveResearchDraft(session: DocumentResearchSession, draftText: string): DocumentResearchSession {
  const updated: DocumentResearchSession = {
    ...session,
    draftText,
    updatedAt: Date.now(),
  };
  saveResearchSession(updated);
  return updated;
}

export function appendResearchEvent(session: DocumentResearchSession, event: ResearchEvent): DocumentResearchSession {
  const updated: DocumentResearchSession = {
    ...session,
    history: [...session.history, event],
    lastQuery: event.query,
    draftText: session.draftText ? `${session.draftText}\n\n${event.summary}` : event.summary,
    updatedAt: Date.now(),
  };
  saveResearchSession(updated);
  return updated;
}

export function upsertArtifactDraft(
  session: DocumentResearchSession,
  draft: ResearchArtifactDraft,
): DocumentResearchSession {
  const existingIndex = session.artifacts.findIndex((artifact) => artifact.id === draft.id);
  const artifacts = [...session.artifacts];
  if (existingIndex >= 0) {
    artifacts[existingIndex] = { ...draft, updatedAt: Date.now() };
  } else {
    artifacts.push({ ...draft, updatedAt: Date.now() });
  }

  const updated: DocumentResearchSession = {
    ...session,
    artifacts,
    updatedAt: Date.now(),
  };

  saveResearchSession(updated);
  return updated;
}

export function createSelectionRange(text: string, start: number, end: number): ResearchSelectionRange | null {
  if (start < 0 || end <= start || end > text.length) return null;
  const selected = text.slice(start, end).trim();
  if (!selected) return null;
  return {
    start,
    end,
    text: selected,
  };
}

export function buildClozeFromSelection(text: string, selection: ResearchSelectionRange): string {
  const before = text.slice(0, selection.start);
  const after = text.slice(selection.end);
  return `${before}{{${selection.text}}}${after}`;
}

export function buildQaFromSelection(selection: ResearchSelectionRange): { question: string; answer: string } {
  return {
    question: "What does this passage describe?",
    answer: selection.text,
  };
}

export function createArtifactDraft(
  session: DocumentResearchSession,
  type: "cloze" | "qa",
  selection: ResearchSelectionRange,
  draftPayload: { question?: string; answer?: string; clozeText?: string },
): ResearchArtifactDraft {
  const now = Date.now();
  return {
    id: randomId(`artifact-${type}`),
    type,
    ...draftPayload,
    provenance: {
      documentId: session.documentId,
      sessionId: session.id,
      selectionStart: selection.start,
      selectionEnd: selection.end,
      selectedText: selection.text,
      createdAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export async function orchestrateNotebooklmResearch(
  request: OrchestratedResearchRequest,
): Promise<OrchestratedResearchResponse> {
  const now = Date.now();
  const last = sessionLastRequest.get(request.session.id) || 0;
  if (now - last < RATE_WINDOW_MS) {
    throw new NotebookLMResearchError("RATE_LIMIT", "Please wait a moment before sending another NotebookLM request.");
  }
  sessionLastRequest.set(request.session.id, now);

  const retryCount = request.retryCount ?? 2;
  const timeoutMs = request.timeoutMs ?? 30000;
  const mode = request.mode ?? "deep";
  const from = request.from ?? "web";

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const response = await withTimeout(
        notebooklmResearch({
          query: request.query,
          notebookId: request.notebookId,
          mode,
          from,
        }),
        timeoutMs,
      );

      const event: ResearchEvent = {
        id: randomId("research-event"),
        query: request.query,
        summary: response.summary,
        source: request.source ?? "notebooklm",
        mode,
        createdAt: Date.now(),
      };

      const sessionWithEvent = appendResearchEvent(request.session, event);
      return {
        session: sessionWithEvent,
        event,
      };
    } catch (error) {
      lastError = error;
      if (attempt < retryCount) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }

  if (lastError instanceof NotebookLMResearchError) {
    throw lastError;
  }

  throw new NotebookLMResearchError(
    "REQUEST_FAILED",
    lastError instanceof Error ? lastError.message : "NotebookLM research request failed",
  );
}
