import { useEffect, useState } from "react";
import { Settings, Key, Check, AlertCircle, Loader2, Server } from "lucide-react";
import {
  getAIConfig,
  setAIConfig,
  setApiKey,
  testAIConnection,
  listOllamaModels,
  LLMProviderType,
  AIConfig,
} from "../../api/ai";
import { useSettingsStore } from "../../stores/settingsStore";
import { useI18n } from "../../lib/i18n";

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

  // Context window tokens (for document content)
  const { settings, updateSettingsCategory } = useSettingsStore();
  const [contextWindowTokens, setContextWindowTokens] = useState(settings.ai.maxTokens);
  const [pwaAssistantEnabled, setPwaAssistantEnabled] = useState(settings.ai.pwaAssistantButtonEnabled);
  const [pwaAssistantSide, setPwaAssistantSide] = useState<"left" | "right">(settings.ai.pwaAssistantButtonSide);

  useEffect(() => {
    async function loadConfig() {
      try {
        setIsLoading(true);
        const loaded = await getAIConfig();
        if (loaded) {
          setConfigState(loaded);
          setOpenaiKey(loaded.api_keys.openai || "");
          setAnthropicKey(loaded.api_keys.anthropic || "");
          setOpenrouterKey(loaded.api_keys.openrouter || "");
        }
        // Load context window tokens from settings store
        setContextWindowTokens(settings.ai.maxTokens);
        setPwaAssistantEnabled(settings.ai.pwaAssistantButtonEnabled);
        setPwaAssistantSide(settings.ai.pwaAssistantButtonSide);
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

      // Save API keys first
      if (openaiKey) {
        await setApiKey("openai", openaiKey);
      }
      if (anthropicKey) {
        await setApiKey("anthropic", anthropicKey);
      }
      if (openrouterKey) {
        await setApiKey("openrouter", openrouterKey);
      }

      // Update config with API keys
      const updatedConfig = {
        ...config,
        api_keys: {
          openai: openaiKey || undefined,
          anthropic: anthropicKey || undefined,
          openrouter: openrouterKey || undefined,
        },
      };

      await setAIConfig(updatedConfig);
      setConfigState(updatedConfig);

      // Save context window tokens to settings store
      updateSettingsCategory("ai", {
        maxTokens: contextWindowTokens,
        pwaAssistantButtonEnabled: pwaAssistantEnabled,
        pwaAssistantButtonSide: pwaAssistantSide,
      });
    } catch (error) {
      console.error("Failed to save AI config:", error);
      alert(t("aiSettings.failedSaveConfig"));
    } finally {
      setIsSaving(false);
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
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-foreground" />
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
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={() => handleTestConnection(LLMProviderType.OpenAI)}
                disabled={isTesting === LLMProviderType.OpenAI}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {isTesting === LLMProviderType.OpenAI ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
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
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={() => handleTestConnection(LLMProviderType.Anthropic)}
                disabled={isTesting === LLMProviderType.Anthropic}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {isTesting === LLMProviderType.Anthropic ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
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
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={openrouterKey}
                onChange={(e) => setOpenrouterKey(e.target.value)}
                placeholder="sk-or-..."
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={() => handleTestConnection(LLMProviderType.OpenRouter)}
                disabled={isTesting === LLMProviderType.OpenRouter}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {isTesting === LLMProviderType.OpenRouter ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
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
              <AlertCircle className="w-4 h-4" />
            )}
            <span className="text-sm">{testResult}</span>
          </div>
        )}
      </div>

      {/* Model Settings */}
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

      {/* Ollama Settings */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Server className="w-5 h-5 text-muted-foreground" />
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
                  <Loader2 className="w-4 h-4 animate-spin" />
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

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
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
