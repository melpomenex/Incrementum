import { useEffect, useState } from "react";
import {
  Check,
  CircleNotch,
  Gear,
  HardDrives,
  Key,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  getAIConfig,
  setAIConfig,
  setApiKey,
  testAIConnection,
  listOllamaModels,
  LLMProviderType,
  AIConfig,
  isMaskedKey,
} from "../../api/ai";
import { useSettingsStore } from "../../stores/settingsStore";
import { useI18n } from "../../lib/i18n";
import { invokeCommand } from "../../lib/tauri";

const DEFAULT_CONFIG: AIConfig = {
  default_provider: LLMProviderType.OpenAI,
  api_keys: {},
  models: {
    openai_model: "gpt-4o-mini",
    anthropic_model: "claude-3-5-sonnet-20241022",
    openrouter_model: "anthropic/claude-3.5-sonnet",
    ollama_model: "llama3.2",
    temperature: 0.7,
    max_tokens: 4096,
  },
  local_settings: {
    ollama_base_url: "http://localhost:11434",
    timeout_secs: 120,
  },
};

export function AISettings() {
  const { t } = useI18n();
  const [config, setConfigState] = useState<AIConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isLoadingOllama, setIsLoadingOllama] = useState(false);

  // API key inputs
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  // Track which keys are stored in keychain (to show indicator)
  const [hasOpenaiKey, setHasOpenaiKey] = useState(false);
  const [hasAnthropicKey, setHasAnthropicKey] = useState(false);
  const [hasOpenrouterKey, setHasOpenrouterKey] = useState(false);

  // Context window tokens (for document content)
  const { settings, updateSettingsCategory } = useSettingsStore();
  const [contextWindowTokens, setContextWindowTokens] = useState(settings.ai.maxTokens);
  const [pwaAssistantEnabled, setPwaAssistantEnabled] = useState(settings.ai.pwaAssistantButtonEnabled);
  const [pwaAssistantSide, setPwaAssistantSide] = useState<"left" | "right">(settings.ai.pwaAssistantButtonSide);

  // AI Memory States
  const [memoryEnabled, setMemoryEnabled] = useState(settings.ai.memoryEnabled || false);
  const [memoryContent, setMemoryContent] = useState("");
  const [isEditingMemory, setIsEditingMemory] = useState(false);
  const [editedMemory, setEditedMemory] = useState("");
  const [isSavingMemory, setIsSavingMemory] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        setIsLoading(true);
        const loaded = await getAIConfig();
        if (loaded) {
          setConfigState(loaded);
          // Keys from backend are now masked. Show placeholder if masked.
          const openaiVal = loaded.api_keys.openai || "";
          const anthropicVal = loaded.api_keys.anthropic || "";
          const openrouterVal = loaded.api_keys.openrouter || "";
          setOpenaiKey(openaiVal && isMaskedKey(openaiVal) ? "" : openaiVal);
          setAnthropicKey(anthropicVal && isMaskedKey(anthropicVal) ? "" : anthropicVal);
          setOpenrouterKey(openrouterVal && isMaskedKey(openrouterVal) ? "" : openrouterVal);
          setHasOpenaiKey(!!openaiVal);
          setHasAnthropicKey(!!anthropicVal);
          setHasOpenrouterKey(!!openrouterVal);
        }
        setContextWindowTokens(settings.ai.maxTokens);
        setPwaAssistantEnabled(settings.ai.pwaAssistantButtonEnabled);
        setPwaAssistantSide(settings.ai.pwaAssistantButtonSide);
        setMemoryEnabled(settings.ai.memoryEnabled || false);

        try {
          const content = await invokeCommand<string>("get_memory_content");
          setMemoryContent(content);
          setEditedMemory(content);
        } catch (err) {
          console.error("Failed to load memories on init:", err);
        }
      } catch (error) {
        console.error("Failed to load AI config:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);

      if (openaiKey) {
        await setApiKey("openai", openaiKey);
        setHasOpenaiKey(true);
        setOpenaiKey("");
      }
      if (anthropicKey) {
        await setApiKey("anthropic", anthropicKey);
        setHasAnthropicKey(true);
        setAnthropicKey("");
      }
      if (openrouterKey) {
        await setApiKey("openrouter", openrouterKey);
        setHasOpenrouterKey(true);
        setOpenrouterKey("");
      }

      // Update config (without plaintext keys — they're in the keychain now)
      const updatedConfig = {
        ...config,
        api_keys: {
          openai: hasOpenaiKey ? "••••••••" : undefined,
          anthropic: hasAnthropicKey ? "••••••••" : undefined,
          openrouter: hasOpenrouterKey ? "••••••••" : undefined,
        },
      };

      await setAIConfig(updatedConfig);
      setConfigState(updatedConfig);

      // Save context window tokens and memory settings to settings store
      updateSettingsCategory("ai", {
        maxTokens: contextWindowTokens,
        pwaAssistantButtonEnabled: pwaAssistantEnabled,
        pwaAssistantButtonSide: pwaAssistantSide,
        memoryEnabled: memoryEnabled,
      });
    } catch (error) {
      console.error("Failed to save AI config:", error);
      alert(t("aiSettings.failedSaveConfig"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMemoryEdits = async () => {
    try {
      setIsSavingMemory(true);
      await invokeCommand("save_memory_content", { content: editedMemory });
      setMemoryContent(editedMemory);
      setIsEditingMemory(false);
    } catch (err) {
      console.error("Failed to save memory edits:", err);
      alert("Failed to save memory edits.");
    } finally {
      setIsSavingMemory(false);
    }
  };

  const handleTestConnection = async (provider: LLMProviderType) => {
    try {
      setIsTesting(provider);
      setTestResult(null);
      const result = await testAIConnection(provider);
      setTestResult(`${provider}: ${result}`);
    } catch (error) {
      setTestResult(t("aiSettings.connectionFailed", { provider }));
      console.error("Test connection failed:", error);
    } finally {
      setIsTesting(null);
    }
  };

  const handleRefreshOllamaModels = async () => {
    try {
      setIsLoadingOllama(true);
      const models = await listOllamaModels(config.local_settings.ollama_base_url);
      setOllamaModels(models);
    } catch (error) {
      console.error("Failed to list Ollama models:", error);
      alert(t("aiSettings.failedFetchOllamaModels"));
    } finally {
      setIsLoadingOllama(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <CircleNotch className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <Gear className="w-6 h-6 text-foreground" />
        <h2 className="text-2xl font-bold text-foreground">{t("aiSettings.title")}</h2>
      </div>

      {/* Default Provider Selection */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">{t("aiSettings.defaultProvider")}</h3>
        <select
          value={config.default_provider}
          onChange={(e) =>
            setConfigState({ ...config, default_provider: e.target.value as LLMProviderType })
          }
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value={LLMProviderType.OpenAI}>OpenAI (GPT-4, GPT-3.5)</option>
          <option value={LLMProviderType.Anthropic}>Anthropic (Claude)</option>
          <option value={LLMProviderType.OpenRouter}>OpenRouter (Multi-provider)</option>
          <option value={LLMProviderType.Ollama}>Ollama (Local)</option>
        </select>
      </div>

      {/* API Keys */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Key className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">{t("aiSettings.apiKeys")}</h3>
        </div>

        <div className="space-y-4">
          {/* OpenAI */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("aiSettings.openaiApiKey")}
              {hasOpenaiKey && (
                <span className="ml-2 text-xs text-green-500 font-normal flex items-center gap-1">
                  <Check className="w-3 h-3 inline" /> Key stored in keychain
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder={hasOpenaiKey ? "Enter new key to replace..." : "sk-..."}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={() => handleTestConnection(LLMProviderType.OpenAI)}
                disabled={isTesting === LLMProviderType.OpenAI}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {isTesting === LLMProviderType.OpenAI ? (
                  <CircleNotch className="w-4 h-4 animate-spin" />
                ) : (
                  t("common.test")
                )}
              </button>
            </div>
          </div>

          {/* Anthropic */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("aiSettings.anthropicApiKey")}
              {hasAnthropicKey && (
                <span className="ml-2 text-xs text-green-500 font-normal flex items-center gap-1">
                  <Check className="w-3 h-3 inline" /> Key stored in keychain
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder={hasAnthropicKey ? "Enter new key to replace..." : "sk-ant-..."}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={() => handleTestConnection(LLMProviderType.Anthropic)}
                disabled={isTesting === LLMProviderType.Anthropic}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {isTesting === LLMProviderType.Anthropic ? (
                  <CircleNotch className="w-4 h-4 animate-spin" />
                ) : (
                  t("common.test")
                )}
              </button>
            </div>
          </div>

          {/* OpenRouter */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("aiSettings.openrouterApiKey")}
              {hasOpenrouterKey && (
                <span className="ml-2 text-xs text-green-500 font-normal flex items-center gap-1">
                  <Check className="w-3 h-3 inline" /> Key stored in keychain
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={openrouterKey}
                onChange={(e) => setOpenrouterKey(e.target.value)}
                placeholder={hasOpenrouterKey ? "Enter new key to replace..." : "sk-or-..."}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={() => handleTestConnection(LLMProviderType.OpenRouter)}
                disabled={isTesting === LLMProviderType.OpenRouter}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {isTesting === LLMProviderType.OpenRouter ? (
                  <CircleNotch className="w-4 h-4 animate-spin" />
                ) : (
                  t("common.test")
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
            testResult.includes("successful") || testResult.includes("Connection successful")
              ? "bg-green-500/10 text-green-500 border border-green-500/20"
              : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}>
            {testResult.includes("successful") || testResult.includes("Connection successful") ? (
              <Check className="w-4 h-4" />
            ) : (
              <WarningCircle className="w-4 h-4" />
            )}
            <span className="text-sm">{testResult}</span>
          </div>
        )}
      </div>

      {/* Model Gear */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">{t("aiSettings.modelSettings")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* OpenAI Model */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("aiSettings.openaiModel")}
            </label>
            <select
              value={config.models.openai_model}
              onChange={(e) =>
                setConfigState({
                  ...config,
                  models: { ...config.models, openai_model: e.target.value },
                })
              }
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </select>
          </div>

          {/* Anthropic Model */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("aiSettings.anthropicModel")}
            </label>
            <select
              value={config.models.anthropic_model}
              onChange={(e) =>
                setConfigState({
                  ...config,
                  models: { ...config.models, anthropic_model: e.target.value },
                })
              }
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
              <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
              <option value="claude-3-opus-20240229">Claude 3 Opus</option>
            </select>
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Temperature: {config.models.temperature}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={config.models.temperature}
              onChange={(e) =>
                setConfigState({
                  ...config,
                  models: { ...config.models, temperature: parseFloat(e.target.value) },
                })
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{t("aiSettings.precise")}</span>
              <span>{t("aiSettings.creative")}</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("aiSettings.maxTokens")}
            </label>
            <input
              type="number"
              min="256"
              max="8192"
              step="256"
              value={config.models.max_tokens}
              onChange={(e) =>
                setConfigState({
                  ...config,
                  models: { ...config.models, max_tokens: parseInt(e.target.value) },
                })
              }
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("aiSettings.maxTokensDesc")}
            </p>
          </div>

          {/* Context Window Tokens */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("aiSettings.contextWindow")}
            </label>
            <input
              type="number"
              min="1000"
              max="32000"
              step="500"
              value={contextWindowTokens}
              onChange={(e) => setContextWindowTokens(parseInt(e.target.value) || 4000)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("aiSettings.contextWindowDesc")}
            </p>
          </div>

          {/* PWA Assistant Button */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  {t("aiSettings.pwaVoiceAssistant")}
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("aiSettings.pwaVoiceAssistantDesc")}
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={pwaAssistantEnabled}
                  onChange={(e) => setPwaAssistantEnabled(e.target.checked)}
                  className="h-4 w-4"
                />
                {t("aiSettings.enabled")}
              </label>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="text-sm text-muted-foreground">{t("aiSettings.side")}</div>
              <select
                value={pwaAssistantSide}
                onChange={(e) => setPwaAssistantSide(e.target.value as "left" | "right")}
                disabled={!pwaAssistantEnabled}
                className="px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              >
                <option value="right">Right</option>
                <option value="left">Left</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Ollama Gear */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <HardDrives className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">{t("aiSettings.ollamaLocal")}</h3>
        </div>

        <div className="space-y-4">
          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("aiSettings.ollamaBaseUrl")}
            </label>
            <input
              type="text"
              value={config.local_settings.ollama_base_url}
              onChange={(e) =>
                setConfigState({
                  ...config,
                  local_settings: {
                    ...config.local_settings,
                    ollama_base_url: e.target.value,
                  },
                })
              }
              placeholder="http://localhost:11434"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("aiSettings.ollamaModel")}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={config.models.ollama_model}
                onChange={(e) =>
                  setConfigState({
                    ...config,
                    models: { ...config.models, ollama_model: e.target.value },
                  })
                }
                placeholder="llama3.2"
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={handleRefreshOllamaModels}
                disabled={isLoadingOllama}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {isLoadingOllama ? (
                  <CircleNotch className="w-4 h-4 animate-spin" />
                ) : (
                  t("aiSettings.refresh")
                )}
              </button>
            </div>
            {ollamaModels.length > 0 && (
              <div className="mt-2 text-sm text-muted-foreground">
                Available: {ollamaModels.slice(0, 5).join(", ")}
                {ollamaModels.length > 5 && "..."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Memory (Long-Term Memory) */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧠</span>
            <div>
              <h3 className="text-lg font-semibold text-foreground">AI Long-Term Memory</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Store facts, preferences, and standing decisions about yourself to personalize all AI interactions.
              </p>
            </div>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={memoryEnabled}
              onChange={(e) => setMemoryEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="relative w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            <span className="text-sm font-medium text-foreground">
              {memoryEnabled ? "Enabled" : "Disabled"}
            </span>
          </label>
        </div>

        {memoryEnabled && (
          <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600 dark:text-amber-400 flex items-start gap-2.5">
            <span className="text-lg mt-0.5">⚠️</span>
            <div className="text-xs leading-relaxed">
              <strong>Token Usage Warning:</strong> Enabling AI memory will load your persistent markdown memories into all chat prompts. While this dramatically improves context and personalization, it will consume more context tokens per message.
            </div>
          </div>
        )}

        {memoryEnabled && (
          <div className="mt-4 border border-border rounded-lg overflow-hidden bg-background">
            <div className="flex justify-between items-center px-4 py-2 border-b border-border bg-muted/30">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                MEMORY.md (Durable Markdown Context)
              </span>
              <div className="flex gap-2">
                {isEditingMemory ? (
                  <>
                    <button
                      onClick={() => {
                        setEditedMemory(memoryContent);
                        setIsEditingMemory(false);
                      }}
                      className="px-2.5 py-1 text-xs bg-muted text-foreground rounded hover:bg-muted/80 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveMemoryEdits}
                      disabled={isSavingMemory}
                      className="px-2.5 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity flex items-center gap-1 font-medium"
                    >
                      {isSavingMemory ? "Saving..." : "Save Edits"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setEditedMemory(memoryContent);
                      setIsEditingMemory(true);
                    }}
                    className="px-2.5 py-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors font-medium"
                  >
                    Edit Memories
                  </button>
                )}
              </div>
            </div>
            <div className="p-4">
              {isEditingMemory ? (
                <textarea
                  value={editedMemory}
                  onChange={(e) => setEditedMemory(e.target.value)}
                  rows={10}
                  className="w-full p-3 bg-muted/10 border border-border rounded-lg text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
                  placeholder="# AI Memory..."
                />
              ) : (
                <pre className="text-xs text-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                  {memoryContent || "(No memory content loaded)"}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <CircleNotch className="w-4 h-4 animate-spin" />
              {t("aiSettings.saving")}
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              {t("aiSettings.saveSettings")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
