import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useDocumentStore, useLLMProvidersStore, useSettingsStore, useDocumentQAStore, type QAMessage, type QAToolCall } from "../../stores";
import { chatWithContext, type LLMMessage } from "../../api/llm";
import { getDocument, extractDocumentText } from "../../api/documents";
import { getExtracts } from "../../api/extracts";
import { callIncrementumMCPTool, getIncrementumMCPTools } from "../../api/mcp";
import { getIntegrationSettings, notebooklmGetSettings } from "../../api/integrations";
import {
  buildClozeFromSelection,
  buildQaFromSelection,
  createArtifactDraft,
  createSelectionRange,
  loadOrCreateResearchSession,
  orchestrateNotebooklmResearch,
  saveResearchDraft,
  upsertArtifactDraft,
  type DocumentResearchSession,
  type NotebookLMResearchError,
  type ResearchArtifactDraft,
} from "../../features/documentQa/notebooklmResearch";
import {
  MessageSquare,
  Send,
  Loader2,
  X,
  FileText,
  Settings,
  Sparkles,
  Trash2,
  BookOpen,
  FlaskConical,
  Wand2,
  Save,
  AlertCircle,
} from "lucide-react";
import { renderMarkdown } from "../../utils/markdown";
import { detectChapterReference, buildChapterQAContext, getChapterTitles, type ChapterReference } from "../../utils/chapterUtils";
import { useI18n } from "../../lib/i18n";

// Re-export types with simpler names for local use
type Message = QAMessage;
type ToolCall = QAToolCall;

interface DocumentMention {
  id: string;
  title: string;
  index: number; // Position in the input text
}

// Mention token format in input: @{documentId}
const MENTION_REGEX = /@{([^}]+)}/g;

export function DocumentQATab() {
  // Use store for persistent state
  const {
    messages,
    isProcessing,
    addMessage,
    clearMessages,
    setIsProcessing,
    updateToolCall,
  } = useDocumentQAStore();

  // Local UI state (doesn't need persistence)
  const [input, setInput] = useState("");
  const [rawInput, setRawInput] = useState(""); // Input with mention tokens
  const [mentions, setMentions] = useState<DocumentMention[]>([]);
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionCursorIndex, setMentionCursorIndex] = useState(0);
  const [, setProviderError] = useState<string | null>(null);
  const [detectedChapter, setDetectedChapter] = useState<{ number: number; title?: string } | null>(null);
  const [notebookResearchEnabled, setNotebookResearchEnabled] = useState(false);
  const [researchQuery, setResearchQuery] = useState("");
  const [researchStatus, setResearchStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [researchError, setResearchError] = useState<string | null>(null);
  const [researchSession, setResearchSession] = useState<DocumentResearchSession | null>(null);
  const [activeNotebookId, setActiveNotebookId] = useState<string | undefined>(undefined);
  const [researchDraft, setResearchDraft] = useState("");
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number; text: string } | null>(null);
  const [artifactDraft, setArtifactDraft] = useState<ResearchArtifactDraft | null>(null);
  const [isSavingArtifact, setIsSavingArtifact] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [researchDocumentId, setResearchDocumentId] = useState<string>("");
  const showLegacyNotebookResearch = false;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const researchEditorRef = useRef<HTMLTextAreaElement>(null);
  const mentionPopupRef = useRef<HTMLDivElement>(null);
  const autosaveTimerRef = useRef<number | null>(null);

  const { documents } = useDocumentStore();
  const getEnabledProviders = useLLMProvidersStore((state) => state.getEnabledProviders);
  const contextWindowTokens = useSettingsStore((state) => state.settings.ai.maxTokens);
  const notebookFeatureEnabled = useSettingsStore((state) => state.settings.features.notebooklmEnabled);
  const analyticsEnabled = useSettingsStore((state) => state.settings.privacy.analyticsEnabled);
  const { t } = useI18n();

  const brainstormingPrompts = useMemo(() => [
    "Summarize the key concepts from this document and explain them simply.",
    "Compare and contrast the two most important ideas in this document.",
    "Create a timeline of the most important events or arguments.",
    "List high-yield concepts that are likely to become exam questions.",
    "Brainstorm counterpoints or alternative interpretations for the main claims.",
  ], []);

  // Filter documents for mention autocomplete
  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(mentionQuery.toLowerCase())
  );
  const activeResearchDocumentId = useMemo(() => {
    if (researchDocumentId) return researchDocumentId;
    if (mentions.length > 0) return mentions[0].id;
    return documents[0]?.id ?? "";
  }, [researchDocumentId, mentions, documents]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setNotebookResearchEnabled(notebookFeatureEnabled);
  }, [notebookFeatureEnabled]);

  useEffect(() => {
    const integrationSettings = getIntegrationSettings();
    if (integrationSettings.notebooklm?.activeNotebookId) {
      setActiveNotebookId(integrationSettings.notebooklm.activeNotebookId || undefined);
    }
    if (documents.length > 0 && !researchDocumentId) {
      setResearchDocumentId(documents[0].id);
    }

    void notebooklmGetSettings()
      .then((settings) => {
        if (settings.activeNotebookId) {
          setActiveNotebookId(settings.activeNotebookId || undefined);
        }
      })
      .catch(() => {
        // Keep local fallback settings when NotebookLM settings are unavailable.
      });
  }, [documents, researchDocumentId]);

  useEffect(() => {
    if (!activeResearchDocumentId) return;
    const session = loadOrCreateResearchSession(activeResearchDocumentId, activeNotebookId);
    setResearchSession(session);
    setResearchDraft(session.draftText);
  }, [activeResearchDocumentId, activeNotebookId]);

  useEffect(() => {
    if (!researchSession) return;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      const updated = saveResearchDraft(researchSession, researchDraft);
      setResearchSession(updated);
    }, 600);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [researchDraft, researchSession]);

  // Parse mentions from input text
  const parseMentions = useCallback((text: string): { text: string; mentions: DocumentMention[] } => {
    const newMentions: DocumentMention[] = [];

    let match: RegExpExecArray | null;
    while ((match = MENTION_REGEX.exec(text)) !== null) {
      const documentId = match[1];
      const doc = documents.find((d) => d.id === documentId);
      if (doc) {
        newMentions.push({
          id: documentId,
          title: doc.title,
          index: match.index,
        });
      }
    }

    return { text, mentions: newMentions };
  }, [documents]);

  // Format input for display (replace tokens with badges)
  const formatInputForDisplay = useCallback((text: string, mentionList: DocumentMention[]): string => {
    let formatted = text;
    mentionList.forEach((mention) => {
      const token = `@{${mention.id}}`;
      formatted = formatted.replace(token, `@${mention.title}`);
    });
    return formatted;
  }, []);

  // Handle input change with @ trigger detection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setRawInput(value);

    const cursorPosition = e.target.selectionStart;

    // Check if we're typing after @
    const beforeCursor = value.slice(0, cursorPosition);
    const atMatch = beforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setShowMentionPopup(true);
      setMentionQuery(atMatch[1]);
      setMentionCursorIndex(0);
    } else {
      setShowMentionPopup(false);
      setMentionQuery("");
    }

    // Parse existing mentions
    const { mentions: newMentions } = parseMentions(value);
    setMentions(newMentions);

    // Detect chapter references in the query
    const chapterRef = detectChapterReference(value);
    if (chapterRef && newMentions.length > 0) {
      // Try to get chapter title from the first mentioned document
      const mentionedDoc = documents.find(d => d.id === newMentions[0].id);
      if (mentionedDoc?.content) {
        const titles = getChapterTitles(mentionedDoc.content);
        const matchedChapter = titles.find(t => t.number === chapterRef.number);
        setDetectedChapter({ number: chapterRef.number, title: matchedChapter?.title });
      } else {
        setDetectedChapter({ number: chapterRef.number });
      }
    } else {
      setDetectedChapter(null);
    }

    // Update display value
    setInput(formatInputForDisplay(value, newMentions));
  };

  // Handle document selection from mention popup
  const handleSelectDocument = (doc: { id: string; title: string }) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPosition = textarea.selectionStart;
    const value = rawInput;

    // Find the @ position
    const beforeCursor = value.slice(0, cursorPosition);
    const atMatch = beforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      const atPosition = cursorPosition - atMatch[0].length;
      const mentionToken = `@{${doc.id}}`;
      const newValue =
        value.slice(0, atPosition) + mentionToken + " " + value.slice(cursorPosition);

      setRawInput(newValue);
      setInput(formatInputForDisplay(newValue, [...mentions, { id: doc.id, title: doc.title, index: atPosition }]));
      setShowMentionPopup(false);

      // Set cursor after the mention
      setTimeout(() => {
        const newPosition = atPosition + mentionToken.length + 1;
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();
      }, 0);
    }
  };

  // Handle keyboard navigation in mention popup
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentionPopup) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionCursorIndex((prev) =>
          prev < filteredDocuments.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionCursorIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter" && filteredDocuments.length > 0) {
        e.preventDefault();
        handleSelectDocument(filteredDocuments[mentionCursorIndex]);
      } else if (e.key === "Escape") {
        setShowMentionPopup(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Remove a mention
  const handleRemoveMention = (mentionId: string) => {
    const token = `@{${mentionId}}`;
    const newValue = rawInput.replace(token, "");
    setRawInput(newValue);
    const { mentions: newMentions } = parseMentions(newValue);
    setMentions(newMentions);
    setInput(formatInputForDisplay(newValue, newMentions));
  };

  const clearConversation = () => {
    clearMessages();
    setProviderError(null);
  };

  // Get document content for context (chapter-aware)
  const getDocumentContent = async (
    documentId: string, 
    chapterRef?: ChapterReference | null
  ): Promise<{ content: string; isChapterSpecific: boolean; chapterNumber?: number }> => {
    try {
      const doc = await getDocument(documentId);
      const docTitle = doc?.title || "Unknown Document";

      let documentContent = doc?.content || "";

      // If no content stored, try to extract from the document (e.g., PDF)
      if (!documentContent) {
        try {
          const extractionResult = await extractDocumentText(documentId);
          if (extractionResult.content) {
            console.log(`[Document Q&A] Extracted ${extractionResult.content.length} chars from document`);
            documentContent = extractionResult.content;
          }
        } catch (extractionError) {
          console.warn(`Failed to extract text from document ${documentId}:`, extractionError);
        }
      }

      // If chapter reference detected and we have content, extract that chapter
      if (chapterRef && documentContent) {
        const maxTokens = contextWindowTokens && contextWindowTokens > 0 ? contextWindowTokens : 4000;
        const chapterContext = buildChapterQAContext(docTitle, documentContent, chapterRef.number, maxTokens);
        
        console.log(`[Document Q&A] Using chapter ${chapterRef.number} content (${chapterContext.length} chars)`);
        return {
          content: chapterContext,
          isChapterSpecific: true,
          chapterNumber: chapterRef.number,
        };
      }

      // If document has content, use it (with truncation if needed)
      if (documentContent) {
        const maxTokens = contextWindowTokens && contextWindowTokens > 0 ? contextWindowTokens : 4000;
        const maxChars = maxTokens * 4;
        let content = documentContent;
        if (content.length > maxChars) {
          content = content.slice(0, maxChars) + "\n\n[Content truncated due to length...]";
        }
        return {
          content: `Document: ${docTitle}\n\n${content}`,
          isChapterSpecific: false,
        };
      }

      // Otherwise, try to get extracts (highlights/notes) from the document
      try {
        const extracts = await getExtracts(documentId);
        if (extracts && extracts.length > 0) {
          const extractContent = extracts
            .map((e, i) => {
              let text = `[Extract ${i + 1}]`;
              if (e.page_number) text += ` (Page ${e.page_number})`;
              text += `\n${e.content}`;
              if (e.notes) text += `\nNote: ${e.notes}`;
              return text;
            })
            .join("\n\n");
          return {
            content: `Document: ${docTitle}\n\nExtracts and highlights from this document:\n\n${extractContent}`,
            isChapterSpecific: false,
          };
        }
      } catch (extractError) {
        console.warn(`Failed to get extracts for document ${documentId}:`, extractError);
      }

      return {
        content: `Document: ${docTitle}\n\n(No content or extracts available. This document may be a PDF or file that hasn't been processed yet.)`,
        isChapterSpecific: false,
      };
    } catch (error) {
      console.error(`Failed to get document ${documentId}:`, error);
      return {
        content: `Document ID: ${documentId}\n\n(Error loading content)`,
        isChapterSpecific: false,
      };
    }
  };

  // Build aggregated content from mentioned documents (chapter-aware)
  const buildMultiDocumentContext = async (
    documentIds: string[],
    chapterRef?: ChapterReference | null
  ): Promise<{ content: string; isChapterSpecific: boolean; chapterNumber?: number }> => {
    if (documentIds.length === 0) {
      // If no documents mentioned, search all documents
      return {
        content: "User is asking about their documents. Search across all available documents to find relevant information.",
        isChapterSpecific: false,
      };
    }

    // Get content for each document (with chapter extraction if referenced)
    const results = await Promise.all(
      documentIds.map((id) => getDocumentContent(id, chapterRef))
    );

    // Check if any document is using chapter-specific content
    const isChapterSpecific = results.some(r => r.isChapterSpecific);
    const chapterNumber = results.find(r => r.chapterNumber)?.chapterNumber;

    // Combine contents
    let combined = results.map(r => r.content).join("\n\n---\n\n");

    // Rough token estimation and truncation
    const maxTokens = contextWindowTokens && contextWindowTokens > 0 ? contextWindowTokens : 4000;
    const estimatedCharsPerToken = 4;
    const maxChars = maxTokens * estimatedCharsPerToken;

    if (combined.length > maxChars) {
      combined = combined.slice(0, maxChars) + "\n\n[Content truncated due to length...]";
    }

    return {
      content: combined,
      isChapterSpecific,
      chapterNumber,
    };
  };

  // Parse tool calls from LLM response
  const parseToolCalls = (content: string) => {
    const toolCalls: ToolCall[] = [];
    const toolCallRegex = /```tool_calls\s*([\s\S]*?)```/g;
    let cleanedContent = content;

    let match: RegExpExecArray | null;
    while ((match = toolCallRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        const calls = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.tool_calls)
            ? parsed.tool_calls
            : [];

        calls.forEach((call: { name?: string; arguments?: Record<string, unknown> }) => {
          if (typeof call?.name === "string") {
            toolCalls.push({
              name: call.name,
              parameters: call.arguments || {},
              status: "pending",
            });
          }
        });
        cleanedContent = cleanedContent.replace(match[0], "").trim();
      } catch (error) {
        console.warn("Failed to parse tool call block:", error);
      }
    }

    return { cleanedContent, toolCalls };
  };

  // Execute tool calls
  const executeToolCalls = async (messageId: string, calls: ToolCall[]) => {
    for (const call of calls) {
      try {
        const result = await callIncrementumMCPTool(call.name, call.parameters);
        updateToolCall(messageId, call.name, { result, status: "success" });
      } catch (error) {
        updateToolCall(messageId, call.name, {
          result: error instanceof Error ? error.message : error,
          status: "error",
        });
      }
    }
  };

  const trackNotebookEvent = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    if (!analyticsEnabled) return;
    const detail = {
      event,
      payload,
      ts: Date.now(),
    };
    window.dispatchEvent(new CustomEvent("incrementum:analytics", { detail }));
  }, [analyticsEnabled]);

  const handleResearchSelection = () => {
    if (!researchEditorRef.current) return;
    const editor = researchEditorRef.current;
    const range = createSelectionRange(researchDraft, editor.selectionStart, editor.selectionEnd);
    setSelectedRange(range);
  };

  const handleRunNotebookResearch = async (source: "notebooklm" | "brainstorm" = "notebooklm") => {
    if (!researchSession || !researchQuery.trim()) return;
    setResearchStatus("loading");
    setResearchError(null);
    setSaveMessage(null);

    try {
      const { session } = await orchestrateNotebooklmResearch({
        documentId: researchSession.documentId,
        notebookId: activeNotebookId,
        query: researchQuery.trim(),
        mode: "deep",
        from: "web",
        source,
        session: researchSession,
        retryCount: 2,
        timeoutMs: 30000,
      });
      setResearchSession(session);
      setResearchDraft(session.draftText);
      setResearchStatus("success");
      trackNotebookEvent("document_qa_notebooklm_research_success", {
        documentId: researchSession.documentId,
        source,
      });
    } catch (error) {
      const typed = error as NotebookLMResearchError | Error;
      const message = typed instanceof Error ? typed.message : "NotebookLM research failed";
      setResearchError(message);
      setResearchStatus("error");
      trackNotebookEvent("document_qa_notebooklm_research_error", {
        error: message,
      });
    }
  };

  const handleCreateClozeDraft = () => {
    if (!researchSession || !selectedRange) return;
    const clozeText = buildClozeFromSelection(researchDraft, selectedRange);
    const draft = createArtifactDraft(researchSession, "cloze", selectedRange, { clozeText });
    const updatedSession = upsertArtifactDraft(researchSession, draft);
    setResearchSession(updatedSession);
    setArtifactDraft(draft);
    setSaveMessage(null);
    trackNotebookEvent("document_qa_cloze_draft_created", { documentId: researchSession.documentId });
  };

  const handleCreateQaDraft = () => {
    if (!researchSession || !selectedRange) return;
    const qa = buildQaFromSelection(selectedRange);
    const draft = createArtifactDraft(researchSession, "qa", selectedRange, qa);
    const updatedSession = upsertArtifactDraft(researchSession, draft);
    setResearchSession(updatedSession);
    setArtifactDraft(draft);
    setSaveMessage(null);
    trackNotebookEvent("document_qa_qa_draft_created", { documentId: researchSession.documentId });
  };

  const handleSaveArtifactDraft = async () => {
    if (!artifactDraft || !researchSession) return;

    const documentId = researchSession.documentId;
    if (!documentId) {
      setSaveMessage("Select a document before saving a card.");
      return;
    }

    setIsSavingArtifact(true);
    setSaveMessage(null);
    try {
      const tags = [
        "notebooklm",
        "document-qa",
        `research-session:${artifactDraft.provenance.sessionId}`,
      ];

      if (artifactDraft.type === "cloze" && artifactDraft.clozeText) {
        await callIncrementumMCPTool("create_cloze_card", {
          text: artifactDraft.clozeText,
          document_id: documentId,
          tags,
        });
      } else if (artifactDraft.type === "qa" && artifactDraft.question && artifactDraft.answer) {
        await callIncrementumMCPTool("create_qa_card", {
          question: artifactDraft.question,
          answer: artifactDraft.answer,
          document_id: documentId,
          tags,
        });
      } else {
        throw new Error("Draft is incomplete. Fill all required fields first.");
      }

      setSaveMessage("Card saved successfully.");
      setArtifactDraft(null);
      trackNotebookEvent("document_qa_artifact_saved", { type: artifactDraft.type, documentId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save artifact";
      setSaveMessage(message);
      trackNotebookEvent("document_qa_artifact_save_error", { error: message });
    } finally {
      setIsSavingArtifact(false);
    }
  };

  const handleSendMessage = async () => {
    if (!rawInput.trim() || isProcessing) return;

    // Parse mentions from input
    const mentionedDocumentIds = mentions.map((m) => m.id);

    // Detect chapter references in the query
    const chapterRef = detectChapterReference(rawInput);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input, // Display version with document titles
      timestamp: Date.now(),
      mentionedDocumentIds,
    };

    addMessage(userMessage);
    const savedRawInput = rawInput;
    setRawInput("");
    setInput("");
    setMentions([]);
    setDetectedChapter(null);
    setProviderError(null);
    setIsProcessing(true);

    try {
      // Check for LLM provider
      const enabledProviders = getEnabledProviders();
      if (!enabledProviders || enabledProviders.length === 0) {
        const errorMsg = {
          id: `error-${Date.now()}`,
          role: "system" as const,
          content: "No LLM provider configured. Please add an API key in Settings to use Document Q&A.",
          timestamp: Date.now(),
        };
        addMessage(errorMsg);
        setIsProcessing(false);
        return;
      }

      const provider = enabledProviders[0];

      // Build system prompt with document context
      const mcpTools = (await getIncrementumMCPTools()) || [];
      const systemPrompt: LLMMessage = {
        role: "system",
        content: `You are a helpful assistant for incremental reading and spaced repetition.

${mentionedDocumentIds.length > 0
  ? `**DOCUMENT CONTENT PROVIDED**: The user has provided full document content below. Use this content to:
- Answer questions about the material
- Extract key concepts for flashcards
- Create extracts from important passages
- Summarize and explain topics

${chapterRef ? `**CHAPTER CONTEXT**: The user is asking about Chapter ${chapterRef.number}. Focus your answer and flashcard creation on that specific chapter.\n\n` : ''}`
  : `The user is asking a general question. Answer based on your knowledge.`}

**CRITICAL: TOOL USAGE**
When the user asks to CREATE or SAVE learning items, you MUST output tool calls in the exact format below. DO NOT just display flashcards as text - use tool calls to actually save them to the database.

**When to use tools**:
- "Create flashcards", "make cards", "generate cards", "add to database" → MUST use create_qa_card or create_cloze_card tools
- "Create an extract", "save this quote", "save this passage" → MUST use create_extract tool
- "Save this note" → MUST use create_extract tool

**For regular questions** like "summarize", "explain", "what is" - answer directly without tools.

**FLASHCARD CREATION - CRITICAL INSTRUCTIONS**:
When asked to create flashcards:
1. Extract key concepts FROM THE PROVIDED DOCUMENT CONTENT
2. Create meaningful Q&A cards and cloze deletion cards
3. **IMPORTANT**: You MUST output the tool_calls code block to actually save the cards
4. Do NOT just display "Flashcard 1", "Flashcard 2" as text
5. The document_id will be automatically added

**CORRECT FORMAT (you MUST use this)**:
User: "Create 5 flashcards from this paper"
You respond:
\`\`\`tool_calls
{"tool_calls":[
  {"name":"create_qa_card","arguments":{"question":"What is the main contribution?","answer":"The paper introduces..."}},
  {"name":"create_cloze_card","arguments":{"text":"BRACE conditions on the {{belief distribution}}"}},
  {"name":"create_qa_card","arguments":{"question":"How does it learn?","answer":"End-to-end gradients..."}}
]}
\`\`\`

**WRONG FORMAT (do NOT do this)**:
Flashcard 1 - Q&A
Q: ...
A: ...

${mcpTools.length > 0 ? `**AVAILABLE TOOLS**: ${mcpTools.map((t) => t.name).join(", ")}

**REQUIRED TOOL CALL FORMAT**:
\`\`\`tool_calls
{"tool_calls":[{"name":"tool_name","arguments":{"key":"value"}}]}
\`\`\`` : ''}`,
      };

      // Get document context (chapter-aware)
      const { content: documentContext, isChapterSpecific, chapterNumber } = await buildMultiDocumentContext(
        mentionedDocumentIds,
        chapterRef
      );

      // Build user prompt with chapter context info
      let userQuestion = savedRawInput.replace(MENTION_REGEX, "").trim();
      let contextPrefix = "";
      
      if (isChapterSpecific && chapterNumber) {
        contextPrefix = `[Focusing on Chapter ${chapterNumber}]\n\n`;
      }

      const userPrompt: LLMMessage = {
        role: "user",
        content: mentionedDocumentIds.length > 0
          ? `${contextPrefix}Document context:\n${documentContext}\n\nUser question: ${userQuestion}`
          : userQuestion,
      };

      // Build conversation history for LLM context
      // Include recent messages (excluding system messages) for context
      const conversationHistory: LLMMessage[] = messages
        .filter(m => m.role === "user" || m.role === "assistant")
        .slice(-6) // Last 6 messages for context (3 turns)
        .map(m => ({
          role: m.role,
          content: m.content,
        }));

      // Call LLM with conversation history
      const response = await chatWithContext(
        provider.provider,
        provider.model,
        [systemPrompt, ...conversationHistory, userPrompt],
        {
          type: mentionedDocumentIds.length > 0 ? "document" : "general",
          documentId: mentionedDocumentIds[0],
          content: documentContext,
        },
        provider.apiKey,
        provider.baseUrl
      );

      const { cleanedContent, toolCalls } = parseToolCalls(response.content);

      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant" as const,
        content: cleanedContent || response.content,
        timestamp: Date.now(),
        sourceDocuments: mentionedDocumentIds.length > 0 ? mentionedDocumentIds : undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };

      addMessage(assistantMessage);

      if (toolCalls.length > 0) {
        await executeToolCalls(assistantMessage.id, toolCalls);
      }
    } catch (error) {
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: "system" as const,
        content: `Error: ${error instanceof Error ? error.message : "Failed to get response from AI. Please check your API key and try again."}`,
        timestamp: Date.now(),
      };
      addMessage(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // Empty state when no documents
  if (documents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold text-foreground mb-2">{t("tabs.noDocumentsYet")}</h2>
          <p className="text-muted-foreground mb-4">
            {t("tabs.importDocumentsFirst")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("tabs.useImportButton")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">{t("toolbar.documentQA")}</h2>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearConversation}
              className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded hover:bg-destructive hover:text-destructive-foreground transition-colors flex items-center gap-1"
              title="Clear conversation"
            >
              <Trash2 className="w-4 h-4" />
              {t("tabs.clearChat")}
            </button>
          )}
        </div>
      </div>

      {notebookResearchEnabled && showLegacyNotebookResearch && (
        <div className="border-b border-border bg-muted/30 p-4">
          <div className="max-w-4xl mx-auto space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <FlaskConical className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">NotebookLM Research Workspace</span>
              <select
                value={activeResearchDocumentId}
                onChange={(e) => setResearchDocumentId(e.target.value)}
                className="px-2 py-1 border border-border rounded bg-background text-sm"
              >
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">
                {activeNotebookId ? `Notebook: ${activeNotebookId}` : "No active NotebookLM notebook selected"}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {brainstormingPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setResearchQuery(prompt);
                    trackNotebookEvent("document_qa_brainstorm_prompt_selected", { prompt });
                  }}
                  className="text-xs px-2 py-1 rounded-full border border-border bg-background hover:bg-muted"
                >
                  <Wand2 className="w-3 h-3 inline mr-1" />
                  {prompt.length > 54 ? `${prompt.slice(0, 54)}...` : prompt}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <textarea
                value={researchQuery}
                onChange={(e) => setResearchQuery(e.target.value)}
                placeholder="Ask NotebookLM to research this document context..."
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm resize-y min-h-[72px]"
              />
              <button
                onClick={() => void handleRunNotebookResearch("notebooklm")}
                disabled={researchStatus === "loading" || !researchQuery.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50 flex items-center gap-2 self-start"
              >
                {researchStatus === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Research
              </button>
            </div>

            <div>
              <textarea
                ref={researchEditorRef}
                value={researchDraft}
                onChange={(e) => setResearchDraft(e.target.value)}
                onSelect={handleResearchSelection}
                placeholder="NotebookLM output appears here. Edit inline, select text, then create cloze or Q&A drafts."
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm min-h-[180px] font-mono"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={handleCreateClozeDraft}
                  disabled={!selectedRange}
                  className="px-3 py-1.5 text-xs rounded border border-border bg-background hover:bg-muted disabled:opacity-50"
                >
                  Create Cloze Draft
                </button>
                <button
                  onClick={handleCreateQaDraft}
                  disabled={!selectedRange}
                  className="px-3 py-1.5 text-xs rounded border border-border bg-background hover:bg-muted disabled:opacity-50"
                >
                  Create Q&A Draft
                </button>
                <span className="text-xs text-muted-foreground">
                  {selectedRange
                    ? `Selected ${selectedRange.end - selectedRange.start} chars`
                    : "Select text to enable card actions"}
                </span>
              </div>
            </div>

            {researchStatus === "error" && researchError && (
              <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded px-2 py-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {researchError}
              </div>
            )}

            {artifactDraft && (
              <div className="p-3 border border-border rounded bg-background space-y-2">
                <div className="text-sm font-semibold text-foreground">
                  {artifactDraft.type === "cloze" ? "Cloze Draft Preview" : "Q&A Draft Preview"}
                </div>
                {artifactDraft.type === "cloze" ? (
                  <textarea
                    value={artifactDraft.clozeText || ""}
                    onChange={(e) => setArtifactDraft({ ...artifactDraft, clozeText: e.target.value, updatedAt: Date.now() })}
                    className="w-full px-2 py-1 border border-border rounded text-sm min-h-[90px]"
                  />
                ) : (
                  <div className="space-y-2">
                    <input
                      value={artifactDraft.question || ""}
                      onChange={(e) => setArtifactDraft({ ...artifactDraft, question: e.target.value, updatedAt: Date.now() })}
                      className="w-full px-2 py-1 border border-border rounded text-sm"
                      placeholder="Question"
                    />
                    <textarea
                      value={artifactDraft.answer || ""}
                      onChange={(e) => setArtifactDraft({ ...artifactDraft, answer: e.target.value, updatedAt: Date.now() })}
                      className="w-full px-2 py-1 border border-border rounded text-sm min-h-[80px]"
                      placeholder="Answer"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void handleSaveArtifactDraft()}
                    disabled={isSavingArtifact}
                    className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-1"
                  >
                    {isSavingArtifact ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save Card
                  </button>
                  <button
                    onClick={() => setArtifactDraft(null)}
                    className="px-3 py-1.5 text-xs rounded border border-border bg-background"
                  >
                    Cancel
                  </button>
                  <span className="text-xs text-muted-foreground">
                    Session {researchSession?.id?.slice(0, 12)}
                  </span>
                </div>
                {saveMessage && <div className="text-xs text-muted-foreground">{saveMessage}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mention badges and chapter detection in input area */}
      {(mentions.length > 0 || detectedChapter) && (
        <div className="px-4 pt-2 flex flex-wrap gap-2">
          {mentions.map((mention) => (
            <span
              key={mention.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary text-sm rounded-full"
            >
              <FileText className="w-3 h-3" />
              {mention.title}
              <button
                onClick={() => handleRemoveMention(mention.id)}
                className="hover:bg-primary/30 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {detectedChapter && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-sm rounded-full">
              <BookOpen className="w-3 h-3" />
              Chapter {detectedChapter.number}
              {detectedChapter.title && `: ${detectedChapter.title}`}
            </span>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary opacity-50" />
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {t("tabs.askYourDocuments")}
              </h2>
              <p className="text-muted-foreground mb-4">
                {t("tabs.typeAtToMention")}
              </p>
              <div className="text-sm text-muted-foreground text-left">
                <p className="font-semibold mb-2">Example questions:</p>
                <ul className="space-y-1">
                  <li>• "@MyDocument What are the main points?"</li>
                  <li>• "Summarize chapter 3" (saves tokens!)</li>
                  <li>• "@MyDocument Explain chapter 5 in detail"</li>
                  <li>• "Create flashcards from mentioned documents"</li>
                  <li>• "What insights can you extract?"</li>
                </ul>
                <p className="font-semibold mt-3 mb-1">Chapter-aware queries:</p>
                <p className="text-xs">
                  Mention a document, then ask about a specific chapter like "summarize chapter 9" 
                  to only process that chapter—saving LLM tokens and getting more focused answers.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
              >
                {/* Message header */}
                <div className="flex items-center gap-2 mb-1">
                  {message.role === "user" ? (
                    <span className="text-xs text-muted-foreground">You</span>
                  ) : message.role === "system" ? (
                    <>
                      <Settings className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">System</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 text-primary" />
                      <span className="text-xs text-muted-foreground">AI</span>
                    </>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                  {message.sourceDocuments && message.sourceDocuments.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      · {message.sourceDocuments.length} doc{message.sourceDocuments.length > 1 ? "s" : ""} referenced
                    </span>
                  )}
                </div>

                {/* Message content */}
                <div
                  className={`max-w-[85%] rounded-lg p-4 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : message.role === "system"
                        ? "bg-muted text-muted-foreground border border-border"
                        : "bg-muted text-foreground"
                  }`}
                >
                  {message.role === "user" ? (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  ) : (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                    />
                  )}

                  {/* Tool calls */}
                  {message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.toolCalls.map((tool, idx) => (
                        <div
                          key={idx}
                          className={`text-xs px-2 py-1 rounded flex items-center gap-2 ${
                            tool.status === "success"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : tool.status === "error"
                                ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          }`}
                        >
                          <span className="font-medium">{tool.name}</span>
                          {tool.status === "pending" && <Loader2 className="w-3 h-3 animate-spin" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mentioned documents in user message */}
                {message.mentionedDocumentIds && message.mentionedDocumentIds.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {message.mentionedDocumentIds.map((docId) => {
                      const doc = documents.find((d) => d.id === docId);
                      return doc ? (
                        <span
                          key={docId}
                          className="text-xs px-2 py-0.5 bg-muted rounded text-muted-foreground flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          {doc.title}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            ))}
            {isProcessing && (
              <div className="flex items-start">
                <div className="bg-muted rounded-lg p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border relative">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={rawInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type @ to mention documents... (Shift+Enter for new line)"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground resize-none pr-12"
              rows={2}
              disabled={isProcessing}
            />
            {/* Character indicator for mentions */}
            {mentions.length > 0 && (
              <div className="absolute bottom-2 left-4 text-xs text-muted-foreground">
                {mentions.length} document{mentions.length > 1 ? "s" : ""} mentioned
              </div>
            )}
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!rawInput.trim() || isProcessing}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Mention autocomplete popup */}
        {showMentionPopup && filteredDocuments.length > 0 && (
          <div
            ref={mentionPopupRef}
            className="absolute bottom-full left-4 right-4 mb-2 max-w-4xl mx-auto bg-card border border-border rounded-lg shadow-lg overflow-hidden z-10"
          >
            <div className="max-h-48 overflow-auto">
              {filteredDocuments.map((doc, index) => (
                <button
                  key={doc.id}
                  onClick={() => handleSelectDocument(doc)}
                  className={`w-full px-4 py-2 text-left hover:bg-muted transition-colors flex items-center gap-3 ${
                    index === mentionCursorIndex ? "bg-muted" : ""
                  }`}
                >
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {doc.title}
                    </div>
                    {doc.metadata?.author && (
                      <div className="text-xs text-muted-foreground truncate">
                        {doc.metadata.author}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="px-4 py-2 bg-muted text-xs text-muted-foreground">
              Use ↑↓ to navigate, Enter to select, Escape to close
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
