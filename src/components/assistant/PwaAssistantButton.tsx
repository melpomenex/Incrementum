import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Mic, MicOff, Sparkles, X, Loader2, Send, Settings as SettingsIcon } from "lucide-react";
import { chatWithContext, type LLMMessage } from "../../api/llm";
import { renderMarkdown } from "../../utils/markdown";
import { useLLMProvidersStore, useSettingsStore } from "../../stores";
import type { AssistantContext } from "./AssistantPanel";
import * as documentsApi from "../../api/documents";
import { getAssistantContextErrorMessage } from "../../utils/assistantContext";
import { providerRequiresApiKey } from "../../utils/llmProviderUtils";

type Side = "left" | "right";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
};

function getSpeechRecognitionCtor(): any | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function isVoiceSupported(): boolean {
  return !!getSpeechRecognitionCtor();
}

function preflightVoice(): { ok: true } | { ok: false; message: string } {
  if (!window.isSecureContext) {
    return {
      ok: false,
      message: "Microphone permissions require HTTPS (or localhost). Open the app over https:// and try again.",
    };
  }

  // If embedded, permissions prompts are often blocked unless the embedding frame allows microphone.
  if (window.top && window.top !== window) {
    return {
      ok: false,
      message:
        "Microphone permission prompts are blocked in embedded views. Open this page directly (not inside an iframe) and try again.",
    };
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      message: "This browser does not support microphone capture. Try a Chromium-based browser.",
    };
  }

  return { ok: true };
}

function requestMicPermissionInGesture(setError: (msg: string) => void) {
  // Trigger the browser's mic permission prompt within the click gesture.
  // Do not await, so we don't lose user activation for SpeechRecognition.start().
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      stream.getTracks().forEach((t) => t.stop());
    })
    .catch((e) => {
      const name = (e as any)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError(
          "Microphone permission is blocked. Allow microphone access for this site in your browser settings, then try again."
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("No microphone was found (or it is unavailable). Connect a mic and try again.");
      } else {
        setError("Could not access the microphone. You can still type your question.");
      }
    });
}

export function PwaAssistantButton({
  context,
  side,
  enabled,
}: {
  context: AssistantContext;
  side: Side;
  enabled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [transcript, setTranscript] = useState("");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastUsedProviderLabel, setLastUsedProviderLabel] = useState<string>("");
  const [_isExtractingContent, setIsExtractingContent] = useState(false);

  const recognitionRef = useRef<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const settings = useSettingsStore((s) => s.settings);

  const providers = useLLMProvidersStore((s) => s.providers);
  const enabledProviders = useLLMProvidersStore((s) => s.getEnabledProviders);

  const preferredProviderType = useMemo(() => {
    const stored = localStorage.getItem("assistant-llm-provider");
    if (stored === "openai" || stored === "anthropic" || stored === "ollama" || stored === "openrouter") {
      return stored;
    }
    // Fall back to app setting if present, else OpenAI.
    const configured = settings.ai.provider;
    return configured ?? "openai";
  }, [settings.ai.provider]);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isOpen, messages, isLoading]);

  const close = () => {
    setIsOpen(false);
    setError(null);
    setInterim("");
    setTranscript("");
    setInput("");
    stopListening();
  };

  const startListening = () => {
    setError(null);
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Voice capture is not supported in this browser. Try typing instead.");
      return;
    }

    // Ensure any existing session is stopped.
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // ignore
    }

    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = settings.general.language === "en" ? "en-US" : settings.general.language;

    let finalText = "";

    rec.onresult = (event: any) => {
      let nextInterim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result?.[0]?.transcript ?? "";
        if (result.isFinal) {
          finalText += text;
        } else {
          nextInterim += text;
        }
      }
      setTranscript(finalText.trim());
      setInterim(nextInterim.trim());
    };

    rec.onerror = (e: any) => {
      // Common: "not-allowed", "service-not-allowed", "no-speech"
      const msg = typeof e?.error === "string" ? e.error : "Voice capture failed";
      if (msg === "not-allowed" || msg === "service-not-allowed") {
        setError(
          "Voice permission is blocked (not-allowed). Enable microphone permission for this site in your browser settings, then try again. You can still type your question below."
        );
      } else if (msg === "no-speech") {
        setError("No speech was detected. Try again in a quieter environment, or type your question.");
      } else {
        setError(`Voice error: ${msg}`);
      }
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
      setInterim("");
    };

    try {
      rec.start();
      setIsListening(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start voice capture");
      setIsListening(false);
    }
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // ignore
    } finally {
      setIsListening(false);
      setInterim("");
    }
  };

  const resolveProvider = () => {
    const enabled = enabledProviders();
    const byType = providers.filter((p) => p.enabled && p.provider === preferredProviderType);
    const candidate = byType[0] ?? enabled.find((p) => p.provider === preferredProviderType) ?? enabled[0];
    if (!candidate) {
      return { error: "No LLM providers are configured. Add one in Settings → AI Provider Settings.", provider: null as any };
    }
    if (providerRequiresApiKey(candidate.provider, candidate.baseUrl) && (!candidate.apiKey || !candidate.apiKey.trim())) {
      return { error: "Your selected provider is missing an API key. Fix it in Settings → AI Provider Settings.", provider: null as any };
    }
    return { error: null, provider: candidate };
  };

  const sendPrompt = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    setIsLoading(true);

    const now = Date.now();
    const userMessage: ChatMessage = { id: `u-${now}`, role: "user", content: trimmed, timestamp: now };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const resolved = resolveProvider();
      if (resolved.error) {
        setError(resolved.error);
        setIsLoading(false);
        return;
      }

      const provider = resolved.provider;
      setLastUsedProviderLabel(`${provider.name || provider.provider} • ${provider.model}`);

      // Small, stable system prompt optimized for reading assistance.
      const system: LLMMessage = {
        role: "system",
        content:
          "You are a concise reading assistant. Answer using the provided document context. If the context does not contain the answer, say so and suggest what to look for.",
      };

      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-6)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const llmMessages: LLMMessage[] = [system, ...history, { role: "user", content: trimmed }];
      const contextWindow = context.contextWindowTokens && context.contextWindowTokens > 0
        ? context.contextWindowTokens
        : settings.ai.maxTokens;

      const resolvedContext = context.resolveForPrompt
        ? await context.resolveForPrompt(trimmed)
        : {
            status: context.status ?? "ready",
            content: context.content,
            message: context.statusMessage,
          };

      if (resolvedContext.status !== "ready" || !resolvedContext.content?.trim()) {
        throw new Error(resolvedContext.message || getAssistantContextErrorMessage(context.status));
      }

      const response = await chatWithContext(
        provider.provider,
        provider.model,
        llmMessages,
        {
          type: context.type,
          documentId: context.documentId,
          url: context.url,
          selection: context.selection,
          content: resolvedContext.content,
          contextWindowTokens: contextWindow,
        },
        provider.apiKey,
        provider.baseUrl && provider.baseUrl.trim() ? provider.baseUrl : undefined,
        provider.temperature,
        provider.maxTokens,
        provider.systemPrompt,
        settings.ai.aiControls?.contextFromRelatedCards,
        settings.ai.aiControls?.documentSnippetLength
      );

      const assistant: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: response.content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistant]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Failed to get response";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = async () => {
    if (!enabled) return;

    // Check if we have document context
    if (!context.content && context.type === "document" && !context.resolveForPrompt) {
      console.warn("[PwaAssistantButton] No document content available:", { context });

      // Try to extract content on-demand
      if (context.documentId) {
        setIsExtractingContent(true);
        try {
          const result = await documentsApi.extractDocumentText(context.documentId);
          console.log("[PwaAssistantButton] Extracted document content:", {
            hasContent: !!result.content,
            contentLength: result.content?.length,
            wasExtracted: result.extracted,
          });

          if (result.content && result.content.length > 0) {
            // Content extracted successfully, update the context
            // Note: This won't update the props immediately, so we show the assistant anyway
            // and let the LLM use the extracted content
            setError(null);
          } else {
            setError("This document doesn't have any content available for the assistant to use.");
            setIsExtractingContent(false);
            return;
          }
        } catch (error) {
          console.error("[PwaAssistantButton] Failed to extract document content:", error);
          setError("Could not load document content. Please try again.");
          setIsExtractingContent(false);
          return;
        }
        setIsExtractingContent(false);
      } else {
        setError("Document content is not available.");
        return;
      }
    }

    console.log("[PwaAssistantButton] Opening assistant with context:", {
      type: context.type,
      hasContent: !!context.content,
      contentLength: context.content?.length,
      documentId: context.documentId,
    });

    setIsOpen(true);
    setError(null);
    setInterim("");
    setTranscript("");
    setInput("");
    // Requirement: click invokes voice capture.
    // Keep voice start synchronous to preserve user activation.
    const preflight = preflightVoice();
    if (!preflight.ok) {
      setError((preflight as { ok: false; message: string }).message);
      return;
    }
    requestMicPermissionInGesture(setError);
    startListening();
  };

  // When listening ends, copy transcript into input (ready to send).
  useEffect(() => {
    if (isListening) return;
    const combined = `${transcript} ${interim}`.trim();
    if (combined) {
      setInput(combined);
    }
  }, [isListening, transcript, interim]);

  // If we have an input from voice and we just stopped listening, auto-send.
  const lastAutoSentRef = useRef<string>("");
  useEffect(() => {
    if (isListening) return;
    const candidate = input.trim();
    if (!isOpen) return;
    if (!candidate) return;
    if (candidate === lastAutoSentRef.current) return;

    // Only auto-send if it came from voice (transcript/interim)
    const cameFromVoice = candidate === `${transcript} ${interim}`.trim() || candidate === transcript.trim();
    if (!cameFromVoice) return;

    lastAutoSentRef.current = candidate;
    void sendPrompt(candidate);
  }, [isListening, isOpen, input, transcript, interim]);

  if (!enabled) return null;

  const style: CSSProperties =
    side === "left"
      ? { left: "calc(10px + env(safe-area-inset-left))" }
      : { right: "calc(10px + env(safe-area-inset-right))" };

  return (
    <>
      <div
        className="fixed top-1/2 -translate-y-1/2 z-[75] pointer-events-auto"
        style={style}
      >
        <button
          type="button"
          onClick={handleOpen}
          className={[
            "group relative",
            "flex items-center gap-3",
            "px-3 py-3 rounded-full shadow-xl",
            "border border-white/10",
            "bg-gradient-to-b from-slate-950/90 via-slate-900/90 to-slate-950/90",
            "backdrop-blur-xl",
            "text-white",
            "transition-all duration-200",
            "hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]",
            "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-background",
          ].join(" ")}
          aria-label="Open voice assistant"
          title={isVoiceSupported() ? "Ask about this document (voice)" : "Ask about this document"}
        >
          <span className="absolute -inset-2 rounded-full bg-gradient-to-r from-cyan-400/25 via-emerald-400/25 to-fuchsia-400/25 blur-xl opacity-80 group-hover:opacity-100 transition-opacity" />
          <span className="relative inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 border border-white/10">
            <Sparkles className="w-5 h-5 text-emerald-200" />
          </span>
          <span className="relative hidden sm:flex flex-col items-start pr-1">
            <span className="text-sm font-semibold leading-4">Ask</span>
            <span className="text-[11px] leading-4 text-white/70">
              {isVoiceSupported() ? "Voice" : "Type"}
            </span>
          </span>
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[90]">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            className="absolute inset-x-0 bottom-0 md:inset-y-10 md:inset-x-10 md:bottom-auto md:rounded-2xl bg-background border border-border shadow-2xl flex flex-col max-h-[92vh] md:max-h-[80vh]"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <div className="text-sm font-semibold text-foreground">Document Assistant</div>
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {lastUsedProviderLabel ? lastUsedProviderLabel : `${preferredProviderType} • model from Settings`}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="p-2 rounded-md hover:bg-muted transition-colors"
                  title="AI provider settings"
                  onClick={() => {
                    setError("Open Settings → AI Provider Settings to change model/provider.");
                  }}
                >
                  <SettingsIcon className="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  className="p-2 rounded-md hover:bg-muted transition-colors"
                  onClick={close}
                  aria-label="Close"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
              {error && (
                <div className="text-sm bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {isListening && (
                <div className="flex items-center gap-2 text-sm text-foreground bg-muted rounded-lg px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  Listening…
                  <span className="ml-auto text-xs text-muted-foreground">Tap stop when done</span>
                </div>
              )}

              {(transcript || interim) && (
                <div className="rounded-lg border border-border bg-card px-3 py-2">
                  <div className="text-xs text-muted-foreground mb-1">Captured</div>
                  <div className="text-sm text-foreground whitespace-pre-wrap">
                    {transcript}
                    {interim ? <span className="opacity-60"> {interim}</span> : null}
                  </div>
                </div>
              )}

              {messages.length === 0 && !isLoading && (
                <div className="text-sm text-muted-foreground">
                  Tap the microphone and ask a question about what you are reading.
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={[
                      "max-w-[92%] rounded-2xl px-3 py-2 text-sm border",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground border-primary/20"
                        : m.role === "assistant"
                          ? "bg-card text-foreground border-border"
                          : "bg-muted text-foreground border-border",
                    ].join(" ")}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                    ) : (
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Thinking…
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-border p-3">
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => (isListening ? stopListening() : startListening())}
                  className={[
                    "p-3 rounded-lg border transition-colors",
                    isListening
                      ? "bg-destructive text-destructive-foreground border-destructive/30 hover:opacity-95"
                      : "bg-muted text-foreground border-border hover:bg-muted/80",
                  ].join(" ")}
                  title={isVoiceSupported() ? (isListening ? "Stop" : "Start voice") : "Voice not supported"}
                  disabled={!isVoiceSupported()}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about this document…"
                  className="flex-1 min-h-[44px] max-h-32 resize-none px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendPrompt(input);
                      setInput("");
                      setTranscript("");
                      setInterim("");
                    }
                  }}
                />

                <button
                  type="button"
                  onClick={() => {
                    void sendPrompt(input);
                    setInput("");
                    setTranscript("");
                    setInterim("");
                  }}
                  disabled={!input.trim() || isLoading}
                  className="p-3 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
                  title="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Uses your AI provider model and context window from Settings.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
