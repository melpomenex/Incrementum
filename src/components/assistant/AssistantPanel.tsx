import { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Send,
  Sparkles,
  Code,
  FileText,
  Settings,
  Loader2,
  PanelLeftClose,
  PanelRightClose,
  Share2,
  Copy,
  Check,
  ImagePlus,
  X,
  AlertTriangle,
} from "lucide-react";
import { compressImage, readFileAsDataUrl } from "../../utils/imageCompression";
import { supportsVision } from "../../utils/visionCapability";
import { chatWithContext, type LLMMessage, type LLMMessageContentPart } from "../../api/llm";
import { callIncrementumMCPTool, getIncrementumMCPTools, type MCPTool } from "../../api/mcp";
import { renderMarkdown } from "../../utils/markdown";
import { useSettingsStore } from "../../stores";
import { useStudyDeckStore } from "../../stores/studyDeckStore";
import { useLLMProvidersStore } from "../../stores/llmProvidersStore";
import { ShareMessageDialog } from "./ShareMessageDialog";
import { copyToClipboard, generateSingleMessageMarkdown, type ConversationMessage } from "../../api/integrations";
import { useI18n } from "../../lib/i18n";
import type { ResolvedAssistantContext } from "../../utils/assistantContext";
import { getAssistantContextErrorMessage } from "../../utils/assistantContext";
import { providerRequiresApiKey } from "../../utils/llmProviderUtils";

export interface AssistantContext {
  type: "document" | "web" | "video" | "general";
  content?: string;
  url?: string;
  documentId?: string;
  selection?: string;
  contextWindowTokens?: number;
  position?: {
    pageNumber?: number;
    scrollPercent?: number;
    currentTime?: number;
  };
  metadata?: {
    title?: string;
    duration?: number;
    videoId?: string;
  };
  status?: "ready" | "loading" | "unavailable";
  statusMessage?: string;
  source?: string;
  resolveForPrompt?: (prompt: string) => Promise<ResolvedAssistantContext>;
}

export interface AttachedImage {
  id: string;
  dataUrl: string;
  fileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  images?: AttachedImage[];
  toolCalls?: ToolCall[];
}

interface ToolCall {
  name: string;
  parameters: Record<string, unknown>;
  result?: unknown;
  status: "pending" | "success" | "error";
}

export type AssistantPosition = "left" | "right";

interface AssistantPanelProps {
  context?: AssistantContext;
  onToolCall?: (tool: string, params: Record<string, unknown>) => Promise<unknown>;
  className?: string;
  onInputHoverChange?: (isHovered: boolean) => void;
  onWidthChange?: (width: number) => void;
  position?: AssistantPosition;
  onPositionChange?: (position: AssistantPosition) => void;
  selectedProvider?: "openai" | "anthropic" | "ollama" | "openrouter";
  onProviderChange?: (provider: "openai" | "anthropic" | "ollama" | "openrouter") => void;
  appendContextMessages?: boolean;
}

const ASSISTANT_POSITION_KEY = "assistant-panel-position";
const ASSISTANT_WIDTH_KEY = "assistant-panel-width";
const ASSISTANT_CONVERSATIONS_KEY = "assistant-panel-conversations-v1";
const MAX_STORED_MESSAGES = 200;
const MAX_ATTACHED_IMAGES = 4;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB raw file limit

interface StoredConversation {
  messages: Message[];
  input: string;
  updatedAt: number;
}

type StoredConversationMap = Record<string, StoredConversation>;

const isValidMessage = (value: unknown): value is Message => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Message>;
  return (
    typeof candidate.id === "string" &&
    (candidate.role === "user" || candidate.role === "assistant" || candidate.role === "system") &&
    typeof candidate.content === "string" &&
    typeof candidate.timestamp === "number" &&
    (candidate.images === undefined || Array.isArray(candidate.images))
  );
};

const getConversationKey = (ctx?: AssistantContext): string => {
  if (!ctx) return "general";
  if (ctx.type === "document") return `document:${ctx.documentId || "unknown"}`;
  if (ctx.type === "video") {
    return `video:${ctx.documentId || ctx.metadata?.videoId || ctx.metadata?.title || "unknown"}`;
  }
  if (ctx.type === "web") return `web:${ctx.url || ctx.metadata?.title || "unknown"}`;
  return "general";
};

const readStoredConversations = (): StoredConversationMap => {
  try {
    const raw = localStorage.getItem(ASSISTANT_CONVERSATIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const normalized: StoredConversationMap = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
      if (!value || typeof value !== "object") return;
      const candidate = value as Partial<StoredConversation>;
      const messages = Array.isArray(candidate.messages)
        ? candidate.messages.filter(isValidMessage).slice(-MAX_STORED_MESSAGES)
        : [];
      normalized[key] = {
        messages,
        input: typeof candidate.input === "string" ? candidate.input : "",
        updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : Date.now(),
      };
    });
    return normalized;
  } catch (error) {
    console.warn("Failed to parse stored assistant conversations:", error);
    return {};
  }
};

const writeStoredConversations = (conversations: StoredConversationMap) => {
  try {
    localStorage.setItem(ASSISTANT_CONVERSATIONS_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.warn("Failed to persist assistant conversation:", error);
  }
};

const getUserInputHistory = (messages: Message[]): string[] => {
  const seen = new Set<string>();
  const history: string[] = [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") continue;
    const content = message.content.trim();
    if (!content || seen.has(content)) continue;
    seen.add(content);
    history.push(content);
  }

  return history;
};

const isCaretOnFirstLine = (textarea: HTMLTextAreaElement) => {
  const caret = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  if (caret !== selectionEnd) return false;
  return !textarea.value.slice(0, caret).includes("\n");
};

const isCaretOnLastLine = (textarea: HTMLTextAreaElement) => {
  const caret = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  if (caret !== selectionEnd) return false;
  return !textarea.value.slice(caret).includes("\n");
};

export function AssistantPanel({
  context,
  onToolCall: _onToolCall,
  className = "",
  onInputHoverChange,
  onWidthChange,
  position: externalPosition,
  onPositionChange,
  selectedProvider: externalSelectedProvider,
  onProviderChange,
  appendContextMessages = true,
}: AssistantPanelProps) {
  const { t: _t } = useI18n();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(ASSISTANT_WIDTH_KEY);
    return saved ? parseInt(saved) : 400;
  });
  const [position, setPosition] = useState<AssistantPosition>(() => {
    if (externalPosition) return externalPosition;
    const saved = localStorage.getItem(ASSISTANT_POSITION_KEY);
    return saved === "left" ? "left" : "right";
  });

  // Debug logging
  useEffect(() => {
    console.log('[AssistantPanel] Mounted/Updated', { isCollapsed, width, position, className });
  }, [isCollapsed, width, position, className]);
  const [isResizing, setIsResizing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<"openai" | "anthropic" | "ollama" | "openrouter">(() => {
    const stored = localStorage.getItem("assistant-llm-provider");
    if (stored === "openai" || stored === "anthropic" || stored === "ollama" || stored === "openrouter") {
      return stored;
    }
    return "openai";
  });
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use external provider if provided
  const effectiveProvider = externalSelectedProvider ?? selectedProvider;
  const [isInputHovered, setIsInputHovered] = useState(false);
  const contextWindowTokens = useSettingsStore((state) => state.settings.ai.maxTokens);
  const aiControls = useSettingsStore((state) => state.settings.ai.aiControls);

  // Share dialog state
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState<Message | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastContextSignatureRef = useRef<string | null>(null);
  const activeConversationKeyRef = useRef<string>("general");
  const historyDraftRef = useRef("");
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  // --- Image attachment helpers ---

  const attachImage = async (file: File) => {
    // Validate type
    if (!file.type.startsWith("image/")) return;

    // Validate size
    if (file.size > MAX_IMAGE_BYTES) {
      // Show toast-like warning via a temporary system message
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: "system" as const,
          content: `⚠️ Image "${file.name}" exceeds the 10 MB limit and was not attached.`,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    // Validate count
    setAttachedImages((prev) => {
      if (prev.length >= MAX_ATTACHED_IMAGES) {
        setMessages((msgs) => [
          ...msgs,
          {
            id: `sys-${Date.now()}`,
            role: "system" as const,
            content: `⚠️ Maximum ${MAX_ATTACHED_IMAGES} images per message. Remove one to add another.`,
            timestamp: Date.now(),
          },
        ]);
        return prev;
      }
      return prev;
    });

    try {
      let dataUrl = await readFileAsDataUrl(file);

      // Compress if > 1 MB raw data URL length (rough proxy)
      if (dataUrl.length > 1 * 1024 * 1024) {
        dataUrl = await compressImage(dataUrl);
      }

      const image: AttachedImage = {
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        dataUrl,
        fileName: file.name,
        fileSize: file.size,
      };

      setAttachedImages((prev) => {
        if (prev.length >= MAX_ATTACHED_IMAGES) return prev;
        return [...prev, image];
      });
    } catch (err) {
      console.error("Failed to attach image:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: "system" as const,
          content: `⚠️ Failed to process image "${file.name}".`,
          timestamp: Date.now(),
        },
      ]);
    }
  };

  const removeImage = (id: string) => {
    setAttachedImages((prev) => prev.filter((img) => img.id !== id));
    textareaRef.current?.focus();
  };

  const clearAttachedImages = () => {
    setAttachedImages([]);
  };

  const providers = [
    { id: "openai", name: "OpenAI", icon: Sparkles, color: "text-green-500" },
    { id: "anthropic", name: "Anthropic", icon: MessageSquare, color: "text-orange-500" },
    { id: "ollama", name: "Ollama", icon: Code, color: "text-blue-500" },
    { id: "openrouter", name: "OpenRouter", icon: Settings, color: "text-purple-500" },
  ];

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    onInputHoverChange?.(isInputFocused || isInputHovered);
  }, [isInputFocused, isInputHovered, onInputHoverChange]);

  useEffect(() => {
    const conversationKey = getConversationKey(context);
    activeConversationKeyRef.current = conversationKey;
    const stored = readStoredConversations()[conversationKey];
    setMessages(stored?.messages ?? []);
    setInput(stored?.input ?? "");
    historyDraftRef.current = stored?.input ?? "";
    setHistoryIndex(null);
    lastContextSignatureRef.current = null;
    clearAttachedImages();
  }, [context?.type, context?.documentId, context?.url, context?.metadata?.videoId, context?.metadata?.title]);

  useEffect(() => {
    const key = activeConversationKeyRef.current;
    const conversations = readStoredConversations();
    conversations[key] = {
      messages: messages.slice(-MAX_STORED_MESSAGES),
      input,
      updatedAt: Date.now(),
    };
    writeStoredConversations(conversations);
  }, [messages, input]);

  useEffect(() => {
    localStorage.setItem("assistant-llm-provider", selectedProvider);
  }, [selectedProvider]);

  // Sync external provider prop
  useEffect(() => {
    if (externalSelectedProvider && externalSelectedProvider !== selectedProvider) {
      setSelectedProvider(externalSelectedProvider);
    }
  }, [externalSelectedProvider]);

  useEffect(() => {
    let isActive = true;
    getIncrementumMCPTools()
      .then((tools) => {
        if (isActive) {
          setAvailableTools(tools);
        }
      })
      .catch((error) => {
        console.error("Failed to load assistant tools:", error);
      });
    return () => {
      isActive = false;
    };
  }, []);

  // Paste handler on input container (not textarea — textarea doesn't fire paste for images)
  useEffect(() => {
    const container = inputContainerRef.current;
    if (!container) return;

    const handlePaste = (e: ClipboardEvent) => {
      if (isLoading) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) attachImage(file);
          return;
        }
      }
      // Let text paste propagate normally
    };

    container.addEventListener("paste", handlePaste);
    return () => container.removeEventListener("paste", handlePaste);
  }, [isLoading, attachedImages.length]);

  // Drag-and-drop handler on input container
  useEffect(() => {
    const container = inputContainerRef.current;
    if (!container) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer?.types.some((t) => t === "Files")) {
        setIsDragOver(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (isLoading) return;

      const files = Array.from(e.dataTransfer?.files ?? []);
      for (const file of files) {
        if (file.type.startsWith("image/")) {
          attachImage(file);
        }
      }
    };

    container.addEventListener("dragover", handleDragOver);
    container.addEventListener("dragleave", handleDragLeave);
    container.addEventListener("drop", handleDrop);
    return () => {
      container.removeEventListener("dragover", handleDragOver);
      container.removeEventListener("dragleave", handleDragLeave);
      container.removeEventListener("drop", handleDrop);
    };
  }, [isLoading, attachedImages.length]);

  // Add context message when context changes
  useEffect(() => {
    if (context && appendContextMessages) {
      const signature = `${context.type}:${context.documentId ?? ""}:${context.url ?? ""}`;
      if (lastContextSignatureRef.current === signature) {
        return;
      }
      lastContextSignatureRef.current = signature;
      const contextMessage: Message = {
        id: `context-${Date.now()}`,
        role: "system",
        content: getContextMessage(context),
        timestamp: Date.now(),
      };
      setMessages((prev) => {
        if (
          prev.length > 0 &&
          prev[prev.length - 1].role === "system" &&
          prev[prev.length - 1].content === contextMessage.content
        ) {
          return prev;
        }
        return [...prev, contextMessage];
      });
    }
  }, [context]);

  const getContextMessage = (ctx: AssistantContext): string => {
    switch (ctx.type) {
      case "document": {
        const title = ctx.metadata?.title;
        const base = title
          ? `📄 ${title}`
          : `📄 Viewing document${ctx.documentId ? ` (ID: ${ctx.documentId})` : ""}`;
        return `${base}${ctx.position?.pageNumber ? ` • Page ${ctx.position.pageNumber}` : ""}${typeof ctx.position?.scrollPercent === "number" ? ` • ${ctx.position.scrollPercent.toFixed(1)}%` : ""}${ctx.selection ? `. Selected text: "${ctx.selection.slice(0, 100)}..."` : ""}`;
      }
      case "web": {
        const title = ctx.metadata?.title;
        const base = title ? `🌐 ${title}` : `🌐 Browsing: ${ctx.url || "Unknown page"}`;
        return `${base}${ctx.selection ? `. Selected text: "${ctx.selection.slice(0, 100)}..."` : ""}`;
      }
      case "video":
        return `🎬 Watching video: ${ctx.metadata?.title || ctx.metadata?.videoId || "Unknown"}${typeof ctx.position?.currentTime === "number" ? ` • ${formatDuration(ctx.position.currentTime)}` : ""}${ctx.metadata?.duration ? ` / ${formatDuration(ctx.metadata.duration)}` : ""}${ctx.selection ? `. Selected text: "${ctx.selection.slice(0, 100)}..."` : ""}`;
      default:
        return "General context - Ready to help";
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) {
      return `${hours}:${(mins % 60).toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && attachedImages.length === 0) || isLoading) return;

    const hasImages = attachedImages.length > 0;
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input || (hasImages ? "" : ""),
      timestamp: Date.now(),
      images: hasImages ? [...attachedImages] : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input;
    setInput("");
    historyDraftRef.current = "";
    setHistoryIndex(null);
    clearAttachedImages();
    setIsLoading(true);

    try {
      // Handle slash commands locally
      if (userInput === "/help") {
        const toolsList = getAvailableTools()
          .map((tool) => `• **${tool.name}** - ${tool.description}`)
          .join("\n");
        const helpMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: `**Available Commands:**

/help - Show this help message
/tools - List available tools
/clear - Clear conversation

**Available Tools:**
${toolsList || "No tools available."}

**What I can do:**
- Answer questions about your documents (content is automatically provided)
- Create flashcards from the current document
- Create extracts from important passages
- Summarize and explain concepts

**Example prompts:**
- "Create 5 flashcards from this paper" - I'll extract key concepts and make Q&A or cloze cards
- "Summarize the main points" - I'll summarize the document content
- "What is the author's argument?" - I'll analyze the provided content
- "Save this quote as an extract" - I'll create an extract

**Tool Calls:**
When you ask me to create flashcards or extracts, I'll use tool calls like:
\`\`\`tool_calls
{"tool_calls":[{"name":"create_qa_card","arguments":{"question":"...","answer":"..."}}]}
\`\`\``,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, helpMessage]);
        setIsLoading(false);
        return;
      }

      if (userInput === "/tools") {
        const tools = getAvailableTools();
        const toolsList = tools.map(t => `• **${t.name}** - ${t.description}`).join('\n');
        const toolsMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: `**Available Tools:**\n\n${toolsList}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, toolsMessage]);
        setIsLoading(false);
        return;
      }

      if (userInput === "/clear") {
        setMessages([]);
        setIsLoading(false);
        return;
      }

      // Build context for the LLM
      // Filter conversation history to only include user and assistant messages
      const filteredHistory = messages
        .filter(m => m.role === "user" || m.role === "assistant")
        .slice(-10); // Last 10 messages (excluding system messages)

      const contextData = {
        currentContext: context,
        conversationHistory: filteredHistory,
        availableTools: getAvailableTools(),
        currentUserImages: userMessage.images,
        currentProvider: effectiveProvider,
        currentModel: useLLMProvidersStore.getState().providers.find((p) => p.provider === effectiveProvider)?.model,
      };

      // Call the LLM API
      const response = await callLLM(userMessage.content, contextData);
      const { cleanedContent, toolCalls } = parseToolCalls(response.content);
      console.log("[Assistant] LLM response:", response.content?.substring(0, 500));
      console.log("[Assistant] Parsed tool calls:", toolCalls.length, toolCalls.map(c => c.name));

      // Show warning if images were stripped due to unsupported model
      if (response.imagesStripped && response.modelName) {
        const warningMessage: Message = {
          id: `sys-${Date.now()}`,
          role: "system",
          content: `⚠️ ${response.modelName} doesn't support images. Sent text only. Switch to a vision-capable model to include images.`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, warningMessage]);
      }

      const displayContent = cleanedContent || (toolCalls.length > 0 ? "Running tool calls..." : response.content);
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: displayContent,
        timestamp: Date.now(),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      if (toolCalls.length > 0) {
        const results = await executeToolCalls(assistantMessage.id, toolCalls);
        const confirmation = buildConfirmationMessage(results);
        if (confirmation) {
          const confirmationMessage: Message = {
            id: `assistant-confirm-${Date.now()}`,
            role: "assistant",
            content: confirmation,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, confirmationMessage]);
        }
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "system",
        content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const callLLM = async (
    prompt: string,
    contextData: Record<string, unknown>
  ): Promise<{ content: string; toolCalls?: ToolCall[]; imagesStripped?: boolean; modelName?: string }> => {
    try {
      // Get all providers to check if selected provider exists but is disabled
      const allProviders = useLLMProvidersStore.getState().providers;
      const enabledProviders = useLLMProvidersStore.getState().getEnabledProviders();

      console.log("All providers:", allProviders.map((p) => ({
        id: p.id,
        provider: p.provider,
        name: p.name,
        enabled: p.enabled,
        hasApiKey: p.apiKey ? p.apiKey.trim().length > 0 : false,
      })));

      // Check if the selected provider exists but is disabled
      const selectedTypeProvider = allProviders.find((p) => p.provider === effectiveProvider);

      if (!selectedTypeProvider) {
        // Provider doesn't exist at all
        const availableTypes = enabledProviders.map((p) => p.provider).join(", ");
        return {
          content: `No ${effectiveProvider} provider configured. Available providers: ${availableTypes || "None"}. Please add an API key in Settings.`,
        };
      }

      if (!selectedTypeProvider.enabled) {
        // Provider exists but is disabled
        return {
          content: `The ${effectiveProvider} provider is configured but disabled. Please enable it in Settings, or select a different provider.`,
        };
      }

      if (providerRequiresApiKey(selectedTypeProvider.provider, selectedTypeProvider.baseUrl) && (!selectedTypeProvider.apiKey || !selectedTypeProvider.apiKey.trim())) {
        return {
          content: `${effectiveProvider} provider found but API key is empty. Please remove and re-add the provider in Settings.`,
        };
      }

      const provider = selectedTypeProvider;

      // Convert messages to LLM format
      // NOTE: conversation history comes BEFORE the current user prompt so the LLM
      // sees correct turn ordering: system → [past turns...] → current user message
      const toolInstruction = buildToolInstruction(getAvailableTools());
      const llmMessages: LLMMessage[] = [
        {
          role: "system" as const,
          content: toolInstruction,
        },
        ...(contextData.conversationHistory as Message[]).map((m) => {
          // Build multimodal content for messages with images
          if (m.images && m.images.length > 0) {
            const parts: LLMMessageContentPart[] = [];
            if (m.content.trim()) {
              parts.push({ type: "text", text: m.content });
            }
            for (const img of m.images) {
              parts.push({ type: "image_url", imageUrl: img.dataUrl });
            }
            return {
              role: m.role as "system" | "user" | "assistant",
              content: parts,
            };
          }
          return {
            role: m.role as "system" | "user" | "assistant",
            content: m.content,
          };
        }),
        {
          role: "user" as const,
          content: prompt,
        },
      ];

      // Check vision capability for current user message images
      const currentUserImages = contextData.currentUserImages as AttachedImage[] | undefined;
      let imagesStripped = false;
      const modelName = (provider.model || effectiveProvider) as string;

      if (currentUserImages && currentUserImages.length > 0) {
        const hasVision = supportsVision(effectiveProvider, modelName);
        if (!hasVision) {
          // Strip images from the current user message in llmMessages
          // The current user message is the last user message in the array
          const lastUserIdx = llmMessages.map((m) => m.role).lastIndexOf("user");
          if (lastUserIdx >= 0) {
            llmMessages[lastUserIdx] = {
              ...llmMessages[1],
              content: prompt, // plain text only
            };
          }
          imagesStripped = true;
        } else {
          // Build multimodal content for current message
          const parts: LLMMessageContentPart[] = [];
          if (prompt.trim()) {
            parts.push({ type: "text", text: prompt });
          }
          for (const img of currentUserImages) {
            parts.push({ type: "image_url", imageUrl: img.dataUrl });
          }
          const lastUserIdx2 = llmMessages.map((m) => m.role).lastIndexOf("user");
          llmMessages[lastUserIdx2] = {
            role: "user" as const,
            content: parts,
          };
        }
      }

      // Build LLM context
      const llmContext = contextData.currentContext as AssistantContext;
      const contextWindow = contextWindowTokens && contextWindowTokens > 0 ? contextWindowTokens : 2000;
      const effectiveContextWindow = llmContext?.contextWindowTokens && llmContext.contextWindowTokens > 0
        ? llmContext.contextWindowTokens
        : contextWindow;
      const resolvedContext = llmContext?.resolveForPrompt
        ? await llmContext.resolveForPrompt(prompt)
        : {
            status: llmContext?.status ?? "ready",
            content: llmContext?.content,
            source: (llmContext?.source as any) ?? "document",
            message: llmContext?.statusMessage,
          };

      if (resolvedContext.status !== "ready" || !resolvedContext.content?.trim()) {
        throw new Error(resolvedContext.message || getAssistantContextErrorMessage(llmContext?.status));
      }

      // Build context object for LLM API - ensure required fields are valid
      const llmContextData = {
        type: llmContext?.type || "general",
        documentId: llmContext?.documentId,
        url: llmContext?.url,
        selection: llmContext?.selection,
        content: resolvedContext.content,
        contextWindowTokens: effectiveContextWindow,
      };

      // Call the LLM API
      const response = await chatWithContext(
        effectiveProvider,
        provider.model,
        llmMessages,
        llmContextData,
        provider.apiKey,
        provider.baseUrl && provider.baseUrl.trim() ? provider.baseUrl : undefined,
        provider.temperature,
        provider.maxTokens,
        provider.systemPrompt,
        aiControls?.contextFromRelatedCards,
        aiControls?.documentSnippetLength
      );

      return { content: response.content, imagesStripped, modelName };
    } catch (error) {
      console.error("LLM API error:", error);
      // Better error handling - Tauri errors can be strings or objects
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : JSON.stringify(error);
      return {
        content: `Error calling LLM: ${errorMessage}`,
      };
    }
  };

  const getAvailableTools = () => {
    return availableTools;
  };

  const parseToolCalls = (content: string) => {
    const knownToolNames = new Set(availableTools.map((t) => t.name));
    const toolCalls: ToolCall[] = [];
    const toolCallRegex = /```tool_calls\s*([\s\S]*?)```/g;
    let cleanedContent = content;
    let match: RegExpExecArray | null;

    const extractCalls = (parsed: unknown): Array<{ name?: string; arguments?: Record<string, unknown> }> => {
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).tool_calls)) {
        return (parsed as Record<string, unknown>).tool_calls as Array<{ name?: string; arguments?: Record<string, unknown> }>;
      }
      if (parsed && typeof parsed === "object" && typeof (parsed as Record<string, unknown>).name === "string") {
        return [parsed as { name?: string; arguments?: Record<string, unknown> }];
      }
      return [];
    };

    while ((match = toolCallRegex.exec(content)) !== null) {
      const raw = match[1].trim();
      try {
        const parsed = JSON.parse(raw);
        const calls = extractCalls(parsed);

        calls.forEach((call: { name?: string; arguments?: Record<string, unknown> }) => {
          if (typeof call?.name === "string" && knownToolNames.has(call.name)) {
            const args = call.arguments;
            const normalizedArgs = args && typeof args === "object" && !Array.isArray(args)
              ? args
              : {};
            toolCalls.push({
              name: call.name,
              parameters: normalizedArgs,
              status: "pending",
            });
          }
        });
        cleanedContent = cleanedContent.replace(match[0], "").trim();
      } catch (error) {
        console.warn("Failed to parse tool call block:", error);
      }
    }

    // Fallback 1: try to parse unfenced JSON containing recognized tool names
    // Uses brace/bracket depth matching instead of regex to handle nested JSON like {"tool_calls":[...]}.
    if (toolCalls.length === 0 && knownToolNames.size > 0) {
      const jsonCandidatePositions: number[] = [];
      for (let i = 0; i < cleanedContent.length; i += 1) {
        if (cleanedContent[i] === "{" || cleanedContent[i] === "[") {
          jsonCandidatePositions.push(i);
        }
      }
      for (const startPos of jsonCandidatePositions) {
        const opener = cleanedContent[startPos];
        const closer = opener === "{" ? "}" : "]";
        let depth = 0;
        let endPos = -1;
        for (let i = startPos; i < cleanedContent.length; i += 1) {
          if (cleanedContent[i] === opener) depth += 1;
          else if (cleanedContent[i] === closer) {
            depth -= 1;
            if (depth === 0) { endPos = i + 1; break; }
          }
        }
        if (endPos === -1) continue;
        const raw = cleanedContent.slice(startPos, endPos).trim();
        try {
          const parsed = JSON.parse(raw);
          const calls = extractCalls(parsed);
          const validCalls = calls.filter((call) => typeof call?.name === "string" && knownToolNames.has(call.name));
          if (validCalls.length > 0) {
            validCalls.forEach((call) => {
              const args = call.arguments;
              const normalizedArgs = args && typeof args === "object" && !Array.isArray(args) ? args : {};
              toolCalls.push({ name: call.name!, parameters: normalizedArgs, status: "pending" });
            });
            cleanedContent = cleanedContent.slice(0, startPos) + cleanedContent.slice(endPos);
            cleanedContent = cleanedContent.replace(/\n{3,}/g, "\n\n").trim();
          } else if (knownToolNames.has("create_qa_card") && Array.isArray(parsed)) {
            let foundCards = false;
            for (const item of parsed) {
              if (item && typeof item === "object") {
                const q = item.question ?? item.Q ?? item.q;
                const a = item.answer ?? item.A ?? item.a;
                if (typeof q === "string" && typeof a === "string") {
                  toolCalls.push({ name: "create_qa_card", parameters: { question: q, answer: a }, status: "pending" });
                  foundCards = true;
                }
              }
            }
            if (foundCards) {
              cleanedContent = cleanedContent.slice(0, startPos) + cleanedContent.slice(endPos);
              cleanedContent = cleanedContent.replace(/\n{3,}/g, "\n\n").trim();
            }
          }
        } catch {
          // Not valid JSON — leave untouched
        }
      }
    }

    // Fallback 2: convert fenced JSON arrays of {question, answer} into create_qa_card calls
    if (toolCalls.length === 0 && knownToolNames.has("create_qa_card")) {
      const jsonArrRegex = /```(?:json)?\s*\n?([\s\S]*?)```/g;
      let arrMatch: RegExpExecArray | null;
      while ((arrMatch = jsonArrRegex.exec(cleanedContent)) !== null) {
        const raw = arrMatch[1].trim();
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item && typeof item === "object") {
                const q = item.question ?? item.Q ?? item.q;
                const a = item.answer ?? item.A ?? item.a;
                if (typeof q === "string" && typeof a === "string") {
                  toolCalls.push({ name: "create_qa_card", parameters: { question: q, answer: a }, status: "pending" });
                }
              }
            }
            // Remove the matched fence block from content
            cleanedContent = cleanedContent.replace(arrMatch[0], "").trim();
          }
        } catch {
          // Not valid JSON
        }
      }
    }

    // Fallback 3: convert UNFENCED JSON arrays of {question, answer} into create_qa_card calls
    // This catches the common case where the LLM outputs raw JSON without code fences.
    if (toolCalls.length === 0 && knownToolNames.has("create_qa_card")) {
      // Strategy: find JSON arrays that start with [{ and contain question/answer-like keys.
      // Use a relaxed regex that only needs to match the start of the first object.
      const arrayLikeRegex = /\[\s*\{[^}]*?(?:question|Q|q)\s*:/s;
      let arrMatch = arrayLikeRegex.exec(cleanedContent);
      if (arrMatch) {
        try {
          // Try to find the full array by extending from the match start
          const start = arrMatch.index;
          const afterMatch = cleanedContent.slice(start);
          const arrayStart = afterMatch.indexOf('[');
          if (arrayStart !== -1) {
            // Find the matching closing bracket
            let depth = 0;
            let end = -1;
            for (let i = arrayStart; i < afterMatch.length; i += 1) {
              if (afterMatch[i] === '[') depth += 1;
              else if (afterMatch[i] === ']') {
                depth -= 1;
                if (depth === 0) {
                  end = i + 1;
                  break;
                }
              }
            }
            if (end !== -1) {
              const raw = afterMatch.slice(arrayStart, end);
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                let foundCards = false;
                for (const item of parsed) {
                  if (item && typeof item === "object") {
                    const q = item.question ?? item.Q ?? item.q;
                    const a = item.answer ?? item.A ?? item.a;
                    if (typeof q === "string" && typeof a === "string") {
                      toolCalls.push({ name: "create_qa_card", parameters: { question: q, answer: a }, status: "pending" });
                      foundCards = true;
                    }
                  }
                }
                if (foundCards) {
                  // Remove the matched array from content
                  cleanedContent = cleanedContent.slice(0, start + arrayStart) + cleanedContent.slice(start + end);
                  cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n').trim();
                }
              }
            }
          }
        } catch {
          // Not valid JSON — leave untouched
        }
      }
    }

    return { cleanedContent, toolCalls };
  };

  const executeToolCalls = async (messageId: string, calls: ToolCall[]) => {
    const results: Array<{ name: string; status: "success" | "error"; error?: string }> = [];
    // Track deck names created in this batch so we can tag subsequent cards with matching tags
    const batchDeckNames: string[] = [];

    for (let index = 0; index < calls.length; index += 1) {
      const call = calls[index];
      let parameters = normalizeToolParameters(call.name, call.parameters);

      // If this is a card/extract call and we created decks earlier in this batch,
      // ensure the card tags include the deck names so tag-based filtering works.
      if (batchDeckNames.length > 0) {
        const cardTools = new Set(["create_qa_card", "create_cloze_card", "batch_create_cards", "create_extract"]);
        if (cardTools.has(call.name)) {
          const existingTags: string[] = Array.isArray(parameters.tags)
            ? parameters.tags.map((t: unknown) => String(t))
            : [];
          for (const deckName of batchDeckNames) {
            const normalized = deckName.toLowerCase();
            const hasMatch = existingTags.some(
              (t) => t.toLowerCase() === normalized || t.toLowerCase() === `deck:${normalized}`
            );
            if (!hasMatch) {
              existingTags.push(deckName);
            }
          }
          parameters = { ...parameters, tags: existingTags };
        }
      }

      updateToolCall(messageId, index, { parameters });

      try {
        console.log("[Assistant] Executing tool:", call.name, "params:", parameters);
        const result = await callIncrementumMCPTool(call.name, parameters);
        console.log("[Assistant] Tool result:", call.name, result);
        // Check if the MCP tool itself reported an error (e.g. DB write failure)
        if (result.isError) {
          console.warn("[Assistant] Tool reported error:", call.name, result);
          updateToolCall(messageId, index, {
            result: JSON.stringify(result.content),
            status: "error",
          });
          results.push({ name: call.name, status: "error", error: "Tool returned error" });
        } else {
          updateToolCall(messageId, index, { result, status: "success" });
          results.push({ name: call.name, status: "success" });
        }

        // Sync deck creation to frontend store and track for card tagging
        if (call.name === "create_deck" && !result.isError) {
          try {
            const parsed = JSON.parse(result.content?.[0]?.text ?? "{}");
            if (parsed.success && parsed.name) {
              useStudyDeckStore.getState().addDeck(parsed.name, parsed.tags ?? [parsed.name]);
              batchDeckNames.push(parsed.name);
            }
          } catch { /* non-critical */ }
        }

        // Auto-create deck in frontend store from tags on card creation
        if (!result.isError && parameters.tags && Array.isArray(parameters.tags)) {
          for (const tag of parameters.tags as string[]) {
            const deckName = tag.startsWith("deck:") ? tag.slice(5) : null;
            if (deckName) {
              const store = useStudyDeckStore.getState();
              const baseName = deckName.replace(/\s*\([^)]*\)\s*$/, "").trim() || deckName;
              const exists = store.decks.some((d) => {
                const dBase = d.name.replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
                return dBase === baseName.toLowerCase() || d.name.toLowerCase() === deckName.toLowerCase();
              });
              if (!exists) {
                store.addDeck(baseName, [baseName]);
              }
            }
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        updateToolCall(messageId, index, {
          result: errorMsg,
          status: "error",
        });
        results.push({ name: call.name, status: "error", error: errorMsg });
      }
    }

    return results;
  };

  const buildConfirmationMessage = (results: Array<{ name: string; status: "success" | "error"; error?: string }>) => {
    const succeeded = results.filter((r) => r.status === "success");
    const failed = results.filter((r) => r.status === "error");

    const parts: string[] = [];

    if (succeeded.length > 0) {
      const counts: Record<string, number> = {};
      succeeded.forEach((r) => {
        counts[r.name] = (counts[r.name] || 0) + 1;
      });

      const hasCards = counts["create_qa_card"] || counts["create_cloze_card"] || counts["batch_create_cards"];
      const hasDeck = counts["create_deck"];

      if (hasDeck && !hasCards) {
        // Deck was created but no cards — likely the LLM didn't include card calls
        parts.push(`⚠️ Deck created but no flashcards were saved. The AI may have only created the deck without the card tool calls. Try asking again to add cards.`);
      } else {
        const summaries = Object.entries(counts).map(([name, count]) => {
          const label = name === "create_qa_card" || name === "create_cloze_card" || name === "batch_create_cards"
            ? `${count} flashcard${count > 1 ? "s" : ""}`
            : name === "create_extract"
              ? `${count} extract${count > 1 ? "s" : ""}`
              : name === "create_document"
                ? `${count} document${count > 1 ? "s" : ""}`
                : `${count} ${name}${count > 1 ? "s" : ""}`;
          return label;
        });
        parts.push(`Created ${summaries.join(", ")} and saved to your library.`);
      }
    }

    if (failed.length > 0) {
      const errors = failed.map((r) => `${r.name}: ${r.error}`).join("; ");
      parts.push(`Failed: ${errors}`);
    }

    return parts.join(" ");
  };

  const updateToolCall = (messageId: string, index: number, updates: Partial<ToolCall>) => {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== messageId || !message.toolCalls) return message;
        const updatedCalls = message.toolCalls.map((call, callIndex) =>
          callIndex === index ? { ...call, ...updates } : call
        );
        return { ...message, toolCalls: updatedCalls };
      })
    );
  };

  const normalizeToolParameters = (toolName: string, parameters: Record<string, unknown>) => {
    const normalized = { ...parameters };
    const documentId = context?.documentId;
    const docTitle = context?.metadata?.title;
    const attachableTools = new Set([
      "create_cloze_card",
      "create_qa_card",
      "create_extract",
      "batch_create_cards",
    ]);

    if (documentId && attachableTools.has(toolName) && normalized.document_id == null) {
      normalized.document_id = documentId;
    }

    // Auto-tag with deck:<base title> for card/extract tools.
    // Strips parenthetical author info (e.g. "Book (Author)" → "deck:Book")
    // so tags match deck names more reliably.
    if (docTitle && attachableTools.has(toolName)) {
      const baseTitle = docTitle.replace(/\s*\([^)]*\)\s*$/, "").trim();
      const deckTag = `deck:${baseTitle || docTitle}`;
      const existingTags: string[] = Array.isArray(normalized.tags)
        ? normalized.tags.map((t: unknown) => String(t))
        : [];
      if (!existingTags.some((t) => t.toLowerCase() === deckTag.toLowerCase())) {
        normalized.tags = [...existingTags, deckTag];
      }
    }

    return normalized;
  };

  const buildToolInstruction = (tools: MCPTool[]) => {
    if (tools.length === 0) {
      return "Answer normally. Tool calls are unavailable.";
    }
    const toolNames = tools.map((tool) => tool.name).join(", ");
    const toolDescriptions = tools.map((tool) => `- **${tool.name}**: ${tool.description}`).join("\n");

    const cardToolNames = tools
      .filter((t) => t.name.includes("card") || t.name.includes("cloze") || t.name === "batch_create_cards")
      .map((t) => t.name)
      .join(", ");

    return `You are a helpful assistant with access to document content and tools. You can answer questions about the content AND create learning items from it.

**Available Tools**: ${toolNames}

${toolDescriptions}

## CRITICAL RULES — Respond vs. Act

**When the user asks to CREATE, SAVE, ADD, or MAKE something** — you MUST emit tool calls, NOT output raw JSON or markdown.
- "create flashcards", "make cards", "generate qa cards", "add flashcards" → use ${cardToolNames}
- "save this as an extract", "save this quote" → use create_extract
- "create a document" → use create_document
- "make cloze cards" → use create_cloze_card

**When the user asks a question or wants an explanation** — respond conversationally, NO tool calls.
- "what does this mean?", "explain X", "summarize this" → just answer in plain text

**NEVER output raw JSON, markdown tables, or bullet lists of flashcards.** ALWAYS use the tool_calls format below.

## Tool call format (REQUIRED — you MUST use EXACTLY this format):

Output a SINGLE JSON code block with ALL tool calls combined. When the user asks to both create a deck AND create cards, you MUST include BOTH the create_deck call AND every card call in the SAME block. Never split actions across multiple blocks.

\`\`\`tool_calls
{"tool_calls":[{"name":"tool_name","arguments":{"key":"value"}},{"name":"another_tool","arguments":{"key":"value"}}]}
\`\`\`

- The block MUST start with \`\`\`tool_calls and end with \`\`\`
- Include ALL actions in a SINGLE block — do NOT create partial output
- Each call has "name" (one of: ${toolNames}) and "arguments" (an object)
- For flashcards: use "question" and "answer" fields
- For cloze: use "text" field with {{cloze}} markers
- Do NOT include document_id — it is added automatically

## Example — user says "create a deck called Physics and add 2 flashcards":
\`\`\`tool_calls
{"tool_calls":[
  {"name":"create_deck","arguments":{"name":"Physics"}},
  {"name":"create_qa_card","arguments":{"question":"What is Newton's first law?","answer":"An object at rest stays at rest unless acted upon by a force."}},
  {"name":"create_qa_card","arguments":{"question":"What is the speed of light?","answer":"Approximately 299,792,458 meters per second."}}
]}
\`\`\`

Do NOT output flashcards as plain JSON arrays, markdown, or anything other than the tool_calls format above.`;
  };

  const handleHistoryNavigation = (direction: "up" | "down") => {
    const history = getUserInputHistory(messages);
    if (history.length === 0) return;

    if (direction === "up") {
      if (historyIndex === null) {
        historyDraftRef.current = input;
        setHistoryIndex(0);
        setInput(history[0]);
        return;
      }

      const nextIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex]);
      return;
    }

    if (historyIndex === null) return;

    if (historyIndex === 0) {
      setHistoryIndex(null);
      setInput(historyDraftRef.current);
      return;
    }

    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setInput(history[nextIndex]);
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    if (historyIndex === null) {
      historyDraftRef.current = value;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && textareaRef.current) {
      if (e.key === "ArrowUp" && isCaretOnFirstLine(textareaRef.current)) {
        e.preventDefault();
        handleHistoryNavigation("up");
        return;
      }

      if (e.key === "ArrowDown" && isCaretOnLastLine(textareaRef.current)) {
        e.preventDefault();
        handleHistoryNavigation("down");
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    // Trap Tab key so focus stays in the input instead of jumping to transcript/page elements
    if (e.key === "Tab") {
      e.preventDefault();
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  // Sync external position prop
  useEffect(() => {
    if (externalPosition && externalPosition !== position) {
      setPosition(externalPosition);
    }
  }, [externalPosition]);

  // Handle position toggle
  const togglePosition = () => {
    const newPosition = position === "left" ? "right" : "left";
    setPosition(newPosition);
    localStorage.setItem(ASSISTANT_POSITION_KEY, newPosition);
    onPositionChange?.(newPosition);
  };

  // Handle copying a single message to clipboard
  const handleCopyMessage = async (message: Message) => {
    const conversationMessage: ConversationMessage = {
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
    };

    const title = context?.metadata?.title ||
      (context?.type === "document" ? "Document Discussion" :
        context?.type === "web" ? "Web Page Discussion" :
          "AI Conversation");

    const markdown = generateSingleMessageMarkdown(
      conversationMessage,
      title,
      context ? getContextMessage(context) : undefined
    );

    const success = await copyToClipboard(markdown);
    if (success) {
      setCopiedMessageId(message.id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }
  };

  // Handle opening share dialog for a single message
  const handleShareMessage = (message: Message) => {
    setShareMessage(message);
    setIsShareDialogOpen(true);
  };

  // Handle opening share dialog for the whole conversation
  const handleShareConversation = () => {
    setShareMessage(null);
    setIsShareDialogOpen(true);
  };

  // Convert internal messages to conversation messages for export
  const getConversationMessages = (): ConversationMessage[] => {
    return messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }));
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        let newWidth: number;
        if (position === "right") {
          // Panel on right: width = screen width - mouse X
          newWidth = window.innerWidth - e.clientX;
        } else {
          // Panel on left: width = mouse X
          newWidth = e.clientX;
        }
        if (newWidth >= 300 && newWidth <= 800) {
          setWidth(newWidth);
          localStorage.setItem(ASSISTANT_WIDTH_KEY, newWidth.toString());
          onWidthChange?.(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, position, onWidthChange]);

  if (isCollapsed) {
    return (
      <div className={`flex flex-col h-full min-h-0 overflow-hidden bg-card ${position === "right" ? "border-l" : "border-r"} border-border relative ${className}`}>
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 hover:bg-muted transition-colors"
          title="Open Assistant"
        >
          {position === "right" ? (
            <ChevronLeft className="w-4 h-4 text-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-foreground" />
          )}
        </button>
      </div>
    );
  }

  const currentProvider = providers.find((p) => p.id === effectiveProvider);

  const handleProviderChange = (providerId: "openai" | "anthropic" | "ollama" | "openrouter") => {
    setSelectedProvider(providerId);
    onProviderChange?.(providerId);
  };

  return (
    <div
      className={`flex flex-col h-full max-h-full min-h-0 overflow-hidden bg-card ${position === "right" ? "border-l" : "border-r"} border-border relative ${className}`}
      style={{ width: isCollapsed ? "auto" : width }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Assistant</h2>
        </div>
        <div className="flex items-center gap-1">
          {/* Share Conversation Button */}
          {messages.length > 0 && (
            <button
              onClick={handleShareConversation}
              className="p-1.5 hover:bg-muted transition-colors rounded mr-1"
              title="Share conversation"
            >
              <Share2 className="w-4 h-4 text-foreground" />
            </button>
          )}
          {/* Provider Selector */}
          <div className="flex items-center gap-1 mr-2">
            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleProviderChange(provider.id as any)}
                className={`p-1.5 rounded transition-colors ${effectiveProvider === provider.id
                  ? "bg-muted"
                  : "hover:bg-muted"
                  }`}
                title={provider.name}
              >
                <provider.icon className={`w-3 h-3 ${provider.color}`} />
              </button>
            ))}
          </div>
          {/* Position Toggle Button */}
          <button
            onClick={togglePosition}
            className="p-1.5 hover:bg-muted transition-colors rounded"
            title={position === "right" ? "Move to left side" : "Move to right side"}
          >
            {position === "right" ? (
              <PanelLeftClose className="w-4 h-4 text-foreground" />
            ) : (
              <PanelRightClose className="w-4 h-4 text-foreground" />
            )}
          </button>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1.5 hover:bg-muted transition-colors rounded"
            title="Collapse"
          >
            {position === "right" ? (
              <ChevronRight className="w-4 h-4 text-foreground" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Context Banner */}
      {context && (
        <div className="px-3 py-2 bg-muted/50 border-b border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {context.type === "document" && <FileText className="w-3 h-3" />}
            {context.type === "web" && <Code className="w-3 h-3" />}
            <span>{getContextMessage(context)}</span>
            {context.type === "video" && context.content && (
              <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground/80">
                Transcript attached
              </span>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Ask me anything about your documents</p>
            <p className="text-xs mt-1">I have context of what you're viewing</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col group ${message.role === "user" ? "items-end" : "items-start"
                }`}
            >
              {/* Message Header */}
              <div className="flex items-center gap-2 mb-1">
                {message.role === "system" && (
                  <Settings className="w-3 h-3 text-muted-foreground" />
                )}
                {message.role === "assistant" && (
                  <>
                    {effectiveProvider === "openai" && <Sparkles className="w-3 h-3 text-green-500" />}
                    {effectiveProvider === "anthropic" && <MessageSquare className="w-3 h-3 text-orange-500" />}
                    {effectiveProvider === "ollama" && <Code className="w-3 h-3 text-blue-500" />}
                    {effectiveProvider === "openrouter" && <Settings className="w-3 h-3 text-purple-500" />}
                  </>
                )}
                <span className="text-xs text-muted-foreground">
                  {message.role === "user"
                    ? "You"
                    : message.role === "system"
                      ? "System"
                      : currentProvider?.name || "Assistant"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Message Content */}
              <div
                className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : message.role === "system"
                    ? "bg-muted text-muted-foreground"
                    : "bg-muted text-foreground"
                  }`}
              >
                {/* Image thumbnails for user messages */}
                {message.images && message.images.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mb-1.5">
                    {message.images.map((img) => (
                      <img
                        key={img.id}
                        src={img.dataUrl}
                        alt={img.fileName || "Attached image"}
                        className="max-w-[120px] max-h-[120px] rounded-md object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(img.dataUrl, "_blank")}
                      />
                    ))}
                  </div>
                )}
                {message.role === "user" ? (
                  message.content
                ) : (
                  <div
                    className="assistant-markdown leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                  />
                )}
              </div>

              {/* Message Actions - only for assistant messages */}
              {message.role === "assistant" && (
                <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleCopyMessage(message)}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedMessageId === message.id ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                  <button
                    onClick={() => handleShareMessage(message)}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="Share/Export"
                  >
                    <Share2 className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Tool Calls */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-2 space-y-1">
                  {message.toolCalls.map((tool, idx) => (
                    <div
                      key={idx}
                      className={`text-xs px-2 py-1 rounded flex items-center gap-2 ${tool.status === "success"
                        ? "bg-green-100 text-green-800"
                        : tool.status === "error"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                        }`}
                    >
                      <Code className="w-3 h-3" />
                      <span className="font-medium">{tool.name}</span>
                      <span className="opacity-75">
                        {JSON.stringify(tool.parameters)}
                      </span>
                      {tool.status === "pending" && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 p-3 border-t border-border bg-card">
        <div className="flex flex-col gap-2">
          {/* Image Preview Strip */}
          {attachedImages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {attachedImages.map((img) => (
                <div
                  key={img.id}
                  className="relative flex-shrink-0 group/thumb rounded-md overflow-hidden border border-border"
                >
                  <img
                    src={img.dataUrl}
                    alt={img.fileName || "Attached image"}
                    className="w-16 h-16 object-cover"
                  />
                  <button
                    onClick={() => removeImage(img.id)}
                    className="absolute top-0 right-0 bg-black/60 text-white rounded-bl-md p-0.5 opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                    title="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {(img.fileName || img.fileSize) && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 truncate">
                      {img.fileName || `${((img.fileSize ?? 0) / 1024).toFixed(0)}KB`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Available Tools Hint */}
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>Type /tools to see available tools</span>
          </div>

          {/* Text Input */}
          <div
            ref={inputContainerRef}
            className={`flex gap-2 rounded-lg transition-colors ${isDragOver ? "border-2 border-dashed border-primary bg-primary/5" : ""}`}
            onMouseEnter={() => setIsInputHovered(true)}
            onMouseLeave={() => setIsInputHovered(false)}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              placeholder={attachedImages.length > 0 ? "Ask about the attached image(s)..." : "Ask about your document, or type /help for commands..."}
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm"
              rows={2}
              disabled={isLoading}
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || attachedImages.length >= MAX_ATTACHED_IMAGES}
                className="px-2 py-1 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={attachedImages.length >= MAX_ATTACHED_IMAGES ? `Maximum ${MAX_ATTACHED_IMAGES} images` : "Attach image"}
              >
                <ImagePlus className="w-4 h-4" />
              </button>
              <button
                onClick={handleSendMessage}
                disabled={(!input.trim() && attachedImages.length === 0) || isLoading}
                className="px-2 py-1 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              for (const file of files) {
                if (file.type.startsWith("image/")) {
                  attachImage(file);
                }
              }
              // Reset input so same file can be picked again
              e.target.value = "";
            }}
          />

          {/* Quick Actions */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setInput("/tools")}
              className="px-2 py-1 bg-muted hover:bg-muted/80 rounded text-muted-foreground transition-colors"
            >
              /tools
            </button>
            <button
              onClick={() => setInput("/help")}
              className="px-2 py-1 bg-muted hover:bg-muted/80 rounded text-muted-foreground transition-colors"
            >
              /help
            </button>
            <button
              onClick={() => setInput("/clear")}
              className="px-2 py-1 bg-muted hover:bg-muted/80 rounded text-muted-foreground transition-colors ml-auto"
            >
              /clear
            </button>
          </div>
        </div>
      </div>

      {/* Share Dialog */}
      <ShareMessageDialog
        isOpen={isShareDialogOpen}
        onClose={() => setIsShareDialogOpen(false)}
        messages={getConversationMessages()}
        singleMessage={shareMessage ? {
          role: shareMessage.role,
          content: shareMessage.content,
          timestamp: shareMessage.timestamp,
        } : undefined}
        contextInfo={context ? getContextMessage(context) : undefined}
        documentTitle={context?.metadata?.title ||
          (context?.type === "document" ? "Document Discussion" :
            context?.type === "web" ? "Web Page Discussion" :
              "AI Conversation")}
      />

      {/* Resize Handle - positioned based on panel position */}
      <div
        onMouseDown={handleResizeStart}
        className={`absolute top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/20 transition-colors group ${position === "right" ? "left-0" : "right-0"
          }`}
      >
        <div className={`absolute top-1/2 -translate-y-1/2 w-1 h-8 bg-border group-hover:bg-primary/50 rounded ${position === "right" ? "left-0" : "right-0"
          }`} />
      </div>
    </div>
  );
}
