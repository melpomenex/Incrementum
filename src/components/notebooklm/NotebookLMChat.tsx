import { useState, useRef, useEffect } from "react";
import { useI18n } from "../../lib/i18n";
import {
  BookOpen,
  ChatCircle,
  Check,
  CircleNotch,
  Copy,
  FloppyDisk,
  PaperPlaneTilt,
  Sparkle,
  ThumbsDown,
  ThumbsUp,
} from "@phosphor-icons/react";
import { notebooklmAsk, notebooklmResearch } from "../../api/integrations";
import { createDocument, getDocuments, updateDocument, updateDocumentContent } from "../../api/documents";
import { createExtract, getExtracts } from "../../api/extracts";
import { useToast } from "../common/Toast";
import { renderMarkdown } from "../../utils/markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: string[];
  isResearch?: boolean;
}

interface NotebookLMChatProps {
  notebookId: string;
  notebookTitle: string;
}

const SUGGESTED_PROMPTS = [
  "Summarize the key points from my sources",
  "What are the main themes across all sources?",
  "Create a timeline of events mentioned",
  "Explain the most complex concept simply",
  "What are the counter-arguments?",
  "Generate study questions",
];

const appendMarkdownBlock = (existing: string | undefined, block: string, marker: string) => {
  const base = existing?.trim() || "";
  if (base.includes(marker)) return base;
  if (!base) return block;
  return `${base}\n\n---\n\n${block}`;
};

const buildMarkdownBlock = (params: {
  messageId: string;
  response: string;
  prompt?: string;
  timestamp: Date;
}) => {
  const when = params.timestamp.toISOString();
  const header = `## NotebookLM Extract (${when})`;
  const marker = `<!-- notebooklm-message-id:${params.messageId} -->`;
  const promptSection = params.prompt?.trim()
    ? `### Prompt\n\n${params.prompt.trim()}\n\n`
    : "";
  return `${marker}\n${header}\n\n${promptSection}### Response\n\n${params.response.trim()}`;
};

export function NotebookLMChat({ notebookId, notebookTitle }: NotebookLMChatProps) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [savingMessageIds, setSavingMessageIds] = useState<Set<string>>(new Set());
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let active = true;
    const loadSavedExtracts = async () => {
      try {
        const notebookFilePath = `notebooklm://notebook/${notebookId}`;
        const docs = await getDocuments();
        let notebookDoc = docs.find((doc) => doc.filePath === notebookFilePath);
        if (!notebookDoc) {
          if (active) setSavedMessageIds(new Set());
          return;
        }
        if (notebookDoc.fileType === "other") {
          try {
            notebookDoc = await updateDocument(notebookDoc.id, {
              ...notebookDoc,
              fileType: "markdown",
            });
          } catch {
            // Keep existing document if upgrade fails.
          }
        }

        const extracts = await getExtracts(notebookDoc.id);
        if (!notebookDoc.content?.trim() && extracts.length > 0) {
          const blocks = extracts
            .filter((extract) => {
              const context = extract.selection_context as unknown as Record<string, unknown> | undefined;
              return context?.type === "notebooklm_chat" && context?.notebookId === notebookId;
            })
            .sort((a, b) => a.date_created.localeCompare(b.date_created))
            .map((extract) =>
              buildMarkdownBlock({
                messageId:
                  ((extract.selection_context as unknown as Record<string, unknown> | undefined)?.messageId as string) ||
                  extract.id,
                response: extract.content,
                prompt: extract.notes,
                timestamp: new Date(extract.date_created),
              })
            );
          if (blocks.length > 0) {
            try {
              notebookDoc = await updateDocumentContent(notebookDoc.id, blocks.join("\n\n---\n\n"));
            } catch {
              // Continue even if backfill fails; extracts are still available.
            }
          }
        }

        const ids = new Set<string>();
        for (const extract of extracts) {
          const context = extract.selection_context as unknown as Record<string, unknown> | undefined;
          if (!context) continue;
          if (context.type !== "notebooklm_chat") continue;
          if (context.notebookId !== notebookId) continue;
          if (typeof context.messageId === "string") {
            ids.add(context.messageId);
          }
        }

        if (active) {
          setSavedMessageIds(ids);
        }
      } catch (error) {
        console.warn("Failed to load saved NotebookLM extracts:", error);
      }
    };

    void loadSavedExtracts();
    return () => {
      active = false;
    };
  }, [notebookId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !notebookId) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      const response = await notebooklmAsk(userMessage.content, notebookId);
      
      const assistantMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: response.answer,
        timestamp: new Date(),
        sources: response.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: `Sorry, I encountered an error: ${error.message || "Failed to get response"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResearch = async () => {
    if (!input.trim() || isLoading || !notebookId) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: `[Research] ${input.trim()}`,
      timestamp: new Date(),
      isResearch: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    const researchQuery = input.trim();
    setInput("");
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      const response = await notebooklmResearch({
        query: researchQuery,
        notebookId,
        mode: "deep",
        from: "web",
      });

      const assistantMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: response.summary,
        timestamp: new Date(),
        isResearch: true,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: `Research failed: ${error.message || "Unknown error"}`,
        timestamp: new Date(),
        isResearch: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getNotebookDocument = async () => {
    const filePath = `notebooklm://notebook/${notebookId}`;
    const existing = (await getDocuments()).find((doc) => doc.filePath === filePath);
    if (existing) {
      if (existing.fileType === "other") {
        try {
          return await updateDocument(existing.id, { ...existing, fileType: "markdown" });
        } catch {
          return existing;
        }
      }
      return existing;
    }
    return await createDocument(`NotebookLM: ${notebookTitle}`, filePath, "markdown");
  };

  const getSelectedTextForMessage = (messageId: string): string | null => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!selection || !text) return null;
    if (selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer as Element
      : range.commonAncestorContainer.parentElement;
    if (!container) return null;

    const owner = container.closest(`[data-notebooklm-message-id="${messageId}"]`);
    return owner ? text : null;
  };

  const buildThreadContext = (messageId: string) => {
    const index = messages.findIndex((message) => message.id === messageId);
    if (index < 0) return [];
    const start = Math.max(0, index - 6);
    return messages.slice(start, index + 1).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp.toISOString(),
      sources: message.sources ?? [],
      isResearch: Boolean(message.isResearch),
    }));
  };

  const handleSaveResponseExtract = async (message: Message) => {
    if (message.role !== "assistant") return;
    if (savingMessageIds.has(message.id)) return;
    if (savedMessageIds.has(message.id)) {
      toast.info(t("notebooklmChat.alreadySaved"), t("notebooklmChat.alreadySavedAsExtract"));
      return;
    }

    setSavingMessageIds((prev) => {
      const next = new Set(prev);
      next.add(message.id);
      return next;
    });

    try {
      const selectedText = getSelectedTextForMessage(message.id);
      const extractContent = selectedText || message.content;
      if (!extractContent.trim()) {
        toast.warning(t("notebooklmChat.nothingToSave"), t("notebooklmChat.nothingToSave"));
        return;
      }

      const notebookDoc = await getNotebookDocument();
      const thread = buildThreadContext(message.id);

      const previousUserMessage = [...messages]
        .reverse()
        .find((item) => item.timestamp <= message.timestamp && item.role === "user");

      const noteParts: string[] = [
        "Saved from NotebookLM chat response.",
      ];
      if (selectedText) {
        noteParts.push("Contains selected text from the response.");
      }
      if (previousUserMessage?.content) {
        noteParts.push(`Prompt:\n${previousUserMessage.content}`);
      }

      await createExtract({
        document_id: notebookDoc.id,
        content: extractContent,
        source_url: `notebooklm://notebook/${notebookId}`,
        note: noteParts.join("\n\n"),
        category: "NotebookLM",
        tags: [
          "notebooklm",
          "chat-response",
          message.isResearch ? "research" : "chat",
        ],
        selection_context: {
          type: "notebooklm_chat",
          notebookId,
          notebookTitle,
          messageId: message.id,
          savedAt: new Date().toISOString(),
          extractedFromSelection: Boolean(selectedText),
          sources: message.sources ?? [],
          thread,
        },
      });

      const markdownBlock = buildMarkdownBlock({
        messageId: message.id,
        response: extractContent,
        prompt: previousUserMessage?.content,
        timestamp: message.timestamp,
      });
      try {
        const marker = `<!-- notebooklm-message-id:${message.id} -->`;
        const nextContent = appendMarkdownBlock(notebookDoc.content, markdownBlock, marker);
        if (nextContent !== (notebookDoc.content?.trim() || "")) {
          await updateDocumentContent(notebookDoc.id, nextContent);
        }
      } catch {
        // Extract save succeeded; content mirror is best effort.
      }

      toast.success(
        t("notebooklmChat.savedTitle"),
        t("notebooklmChat.savedDesc")
      );
      setSavedMessageIds((prev) => {
        const next = new Set(prev);
        next.add(message.id);
        return next;
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Failed to save response extract";
      toast.error(t("notebooklmChat.saveFailedTitle"), messageText);
    } finally {
      setSavingMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(message.id);
        return next;
      });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Sparkle className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">{t("notebooklm.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("notebooklmChat.chatWith", { title: notebookTitle })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-full">
            {t("notebooklmChat.messages", { count: messages.length })}
          </span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto">
            <div className="w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 flex items-center justify-center">
              <ChatCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {t("notebooklmChat.startConversation")}
            </h3>
            <p className="text-muted-foreground text-center mb-8 max-w-md">
              {t("notebooklmChat.askAboutSources")}
            </p>

            {showSuggestions && (
              <div className="w-full">
                <p className="text-sm text-muted-foreground mb-3 text-center">{t("notebooklmChat.tryAsking")}:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => {
                        setInput(prompt);
                        inputRef.current?.focus();
                      }}
                      className="text-left px-4 py-3 bg-card border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors text-sm text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl mx-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 ${
                  message.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                    message.role === "user"
                      ? "bg-primary"
                      : message.isResearch
                      ? "bg-amber-500"
                      : "bg-gradient-to-br from-emerald-500 to-teal-600"
                  }`}
                >
                  {message.role === "user" ? (
                    <span className="text-xs font-medium text-primary-foreground">You</span>
                  ) : message.isResearch ? (
                    <BookOpen className="w-4 h-4 text-white" />
                  ) : (
                    <Sparkle className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Message Content */}
                <div
                  className={`flex-1 ${
                    message.role === "user" ? "text-right" : ""
                  }`}
                  data-notebooklm-message-id={message.id}
                >
                  <div
                    className={`inline-block max-w-full text-left ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-tr-sm"
                        : "bg-card border border-border px-4 py-3 rounded-2xl rounded-tl-sm"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdown(message.content),
                        }}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>

                  {/* Message Meta */}
                  <div
                    className={`flex items-center gap-2 mt-1.5 text-xs text-muted-foreground ${
                      message.role === "user" ? "justify-end" : ""
                    }`}
                  >
                    <span>{formatTime(message.timestamp)}</span>
                    {message.isResearch && (
                      <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded text-[10px]">
                        Research
                      </span>
                    )}
                  </div>

                  {/* Action Buttons for Assistant Messages */}
                  {message.role === "assistant" && (
                    <div className="flex items-center gap-1 mt-2">
                      <button
                        onClick={() => copyToClipboard(message.content)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                        title={t("notebooklmChat.copyToClipboard")}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (savedMessageIds.has(message.id)) {
                            toast.info(t("notebooklmChat.alreadySaved"), t("notebooklmChat.alreadySavedAsExtract"));
                            return;
                          }
                          handleSaveResponseExtract(message);
                        }}
                        disabled={savingMessageIds.has(message.id)}
                        className={`p-1.5 rounded-md transition-colors disabled:opacity-50 ${
                          savedMessageIds.has(message.id)
                            ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                        title={savedMessageIds.has(message.id) ? t("notebooklmChat.alreadySavedAsExtract") : t("notebooklmChat.saveAsExtract")}
                      >
                        {savingMessageIds.has(message.id) ? (
                          <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                        ) : savedMessageIds.has(message.id) ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <FloppyDisk className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                        title={t("notebooklmChat.helpful")}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                        title={t("notebooklmChat.notHelpful")}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Source Citations */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {message.sources.map((source, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-md"
                        >
                          <BookOpen className="w-3 h-3" />
                          {source}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="px-6 py-4 border-t border-border bg-card">
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("notebooklmChat.placeholder")}
              disabled={isLoading}
              className="w-full px-4 py-3 pr-24 bg-background border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 min-h-[56px] max-h-[200px] text-foreground placeholder:text-muted-foreground"
              rows={1}
              style={{ height: "auto" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
              }}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <button
                onClick={handleResearch}
                disabled={isLoading || !input.trim()}
                className="p-2 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-colors disabled:opacity-50"
                title={t("notebooklmChat.runResearchQuery")}
              >
                <BookOpen className="w-4 h-4" />
              </button>
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isLoading ? (
                  <CircleNotch className="w-4 h-4 animate-spin" />
                ) : (
                  <PaperPlaneTilt className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {t("notebooklmChat.pressEnterToSend")}
          </p>
        </div>
      </div>
    </div>
  );
}
