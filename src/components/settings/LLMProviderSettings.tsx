/**
 * LLM Provider Settings
 * Configure API keys and model preferences
 */
import { useState } from "react";
import { useI18n } from "../../lib/i18n";
import {
  ArrowsClockwise,
  Check,
  CircleNotch,
  CurrencyDollar,
  Eye,
  EyeSlash,
  Key,
  Pencil,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { getAvailableModels, type ModelInfo } from "../../api/llm";
import { providerRequiresApiKey } from "../../utils/llmProviderUtils";

export interface LLMProviderConfig {
  id: string;
  provider: "openai" | "anthropic" | "ollama" | "openrouter";
  name: string;
  apiKey: string;
  baseUrl?: string;
  model: string;
  enabled: boolean;
  // Store pricing information for cost calculations
  modelPricing?: Record<string, ModelInfo>;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
}

interface LLMProviderSettingsProps {
  providers: LLMProviderConfig[];
  onAddProvider: (provider: Omit<LLMProviderConfig, "id">) => void;
  onUpdateProvider: (id: string, updates: Partial<LLMProviderConfig>) => void;
  onRemoveProvider: (id: string) => void;
  onTestConnection: (config: LLMProviderConfig) => Promise<boolean>;
  onRefreshModels?: (providerId: string, models: ModelInfo[]) => void;
}

const PROVIDER_INFO = {
  openai: {
    name: "OpenAI",
    description: "GPT-4o, GPT-4o-mini, GPT-4-turbo",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    icon: "🤖",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  },
  anthropic: {
    name: "Anthropic",
    description: "Claude 3.5 Sonnet, Claude 3.5 Haiku",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-sonnet-20241022",
    icon: "🧠",
    models: [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
    ],
  },
  ollama: {
    name: "Ollama",
    description: "Local LLM models (Llama, Mistral, etc.)",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
    icon: "💻",
    models: ["llama3.2", "mistral", "codellama", "phi3", "deepseek-coder"],
  },
  openrouter: {
    name: "OpenRouter",
    description: "Unified API for 100+ LLM providers",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-3.5-sonnet",
    icon: "🔀",
    models: [
      "anthropic/claude-3.5-sonnet",
      "anthropic/claude-3.5-sonnet:beta",
      "anthropic/claude-3.5-haiku",
      "anthropic/claude-3-opus",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "openai/gpt-4-turbo",
      "google/gemini-pro-1.5",
      "meta-llama/llama-3.1-405b-instruct",
      "deepseek/deepseek-chat",
    ],
  },
};

export function LLMProviderSettings({
  providers,
  onAddProvider,
  onUpdateProvider,
  onRemoveProvider,
  onTestConnection,
}: LLMProviderSettingsProps) {
  const { t } = useI18n();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LLMProviderConfig | null>(null);
  const [newProviderType, setNewProviderType] = useState<"openai" | "anthropic" | "ollama" | "openrouter">("openai");
  const [newProviderName, setNewProviderName] = useState("");
  const [newProviderApiKey, setNewProviderApiKey] = useState("");
  const [newProviderBaseUrl, setNewProviderBaseUrl] = useState("");
  const [newProviderModel, setNewProviderModel] = useState("");
  const [newProviderTemperature, setNewProviderTemperature] = useState(0.7);
  const [newProviderMaxTokens, setNewProviderMaxTokens] = useState(4096);
  const [newProviderSystemPrompt, setNewProviderSystemPrompt] = useState("");
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [dynamicModels, setDynamicModels] = useState<Record<string, ModelInfo[]>>({});
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<string | null>(null);

  const isEditing = editingProvider !== null;
  const resolvedBaseUrl = (providerType: "openai" | "anthropic" | "ollama" | "openrouter", baseUrl: string) =>
    baseUrl || PROVIDER_INFO[providerType].baseUrl;
  const newProviderNeedsApiKey = providerRequiresApiKey(
    newProviderType,
    resolvedBaseUrl(newProviderType, newProviderBaseUrl)
  );

  const startEditing = (provider: LLMProviderConfig) => {
    setEditingProvider(provider);
    setNewProviderType(provider.provider);
    setNewProviderName(provider.name);
    setNewProviderApiKey(provider.apiKey);
    setNewProviderBaseUrl(provider.baseUrl || "");
    setNewProviderModel(provider.model);
    setNewProviderTemperature(provider.temperature ?? 0.7);
    setNewProviderMaxTokens(provider.maxTokens ?? 4096);
    setNewProviderSystemPrompt(provider.systemPrompt ?? "");
    setShowAddForm(true);
  };

  const cancelEditing = () => {
    setEditingProvider(null);
    setShowAddForm(false);
    setNewProviderName("");
    setNewProviderApiKey("");
    setNewProviderBaseUrl("");
    setNewProviderModel("");
    setNewProviderTemperature(0.7);
    setNewProviderMaxTokens(4096);
    setNewProviderSystemPrompt("");
  };

  const handleAddProvider = () => {
    if (!newProviderName.trim() || (newProviderNeedsApiKey && !newProviderApiKey.trim())) {
      return;
    }

    const info = PROVIDER_INFO[newProviderType];
    
    const modelPricing: Record<string, ModelInfo> = {};
    const models = dynamicModels[newProviderType];
    if (models) {
      models.forEach((model) => {
        modelPricing[model.id] = model;
      });
    }

    onAddProvider({
      provider: newProviderType,
      name: newProviderName || info.name,
      apiKey: newProviderApiKey,
      baseUrl: newProviderBaseUrl || info.baseUrl,
      model: newProviderModel || info.defaultModel,
      enabled: true,
      modelPricing: Object.keys(modelPricing).length > 0 ? modelPricing : undefined,
      temperature: newProviderTemperature,
      maxTokens: newProviderMaxTokens,
      systemPrompt: newProviderSystemPrompt || undefined,
    });
  };

  const handleSaveProvider = () => {
    if (!editingProvider || !newProviderName.trim()) return;

    const modelPricing: Record<string, ModelInfo> = {};
    const models = dynamicModels[newProviderType];
    if (models) {
      models.forEach((model) => {
        modelPricing[model.id] = model;
      });
    }

    onUpdateProvider(editingProvider.id, {
      name: newProviderName,
      apiKey: newProviderApiKey,
      baseUrl: newProviderBaseUrl || PROVIDER_INFO[newProviderType].baseUrl,
      model: newProviderModel,
      modelPricing: Object.keys(modelPricing).length > 0 ? modelPricing : undefined,
      temperature: newProviderTemperature,
      maxTokens: newProviderMaxTokens,
      systemPrompt: newProviderSystemPrompt || undefined,
    });
  };

  const handleSubmit = () => {
    if (isEditing) {
      handleSaveProvider();
    } else {
      handleAddProvider();
    }

    // Reset form
    setNewProviderName("");
    setNewProviderApiKey("");
    setNewProviderBaseUrl("");
    setNewProviderModel("");
    setNewProviderTemperature(0.7);
    setNewProviderMaxTokens(4096);
    setNewProviderSystemPrompt("");
    setDynamicModels({});
    setShowAddForm(false);
    setEditingProvider(null);
  };

  const resetForm = () => {
    setNewProviderName("");
    setNewProviderApiKey("");
    setNewProviderBaseUrl("");
    setNewProviderModel("");
    setNewProviderTemperature(0.7);
    setNewProviderMaxTokens(4096);
    setNewProviderSystemPrompt("");
    setDynamicModels({});
    setOllamaStatus(null);
    setShowAddForm(false);
    setEditingProvider(null);
  };

  const handleTestConnection = async (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;

    setTestingConnection(providerId);
    try {
      const success = await onTestConnection(provider);
      setTestResults({ ...testResults, [providerId]: success });
    } catch {
      setTestResults({ ...testResults, [providerId]: false });
    } finally {
      setTestingConnection(null);
    }
  };

  const toggleKeyVisibility = (providerId: string) => {
    setVisibleKeys({ ...visibleKeys, [providerId]: !visibleKeys[providerId] });
  };

  const handleRefreshModels = async () => {
    if (newProviderNeedsApiKey && !newProviderApiKey.trim()) {
      alert("Please enter an API key first to fetch models");
      return;
    }

    setRefreshingModels(true);
    try {
      const models = await getAvailableModels(
        newProviderType,
        newProviderType === "ollama" ? undefined : newProviderApiKey,
        newProviderBaseUrl || PROVIDER_INFO[newProviderType].baseUrl
      );
      if (!models || !Array.isArray(models)) {
        throw new Error("Failed to fetch models - invalid response");
      }
      setDynamicModels({ ...dynamicModels, [newProviderType]: models });
      
      const pricingMap: Record<string, ModelInfo> = {};
      models.forEach((model) => {
        pricingMap[model.id] = model;
      });
      
      // Set the first model as default if current model is not in the list
      if (models.length > 0 && !models.find(m => m.id === newProviderModel)) {
        setNewProviderModel(models[0].id);
      }

      if (newProviderType === "ollama") {
        setOllamaStatus(null);
      }
      
      return pricingMap;
    } catch (error) {
      console.error("Failed to fetch models:", error);
      const msg = error instanceof Error ? error.message : String(error);
      if (newProviderType === "ollama") {
        setOllamaStatus(msg);
        setDynamicModels((prev) => {
          const next = { ...prev };
          delete next["ollama"];
          return next;
        });
      } else {
        alert(`Failed to fetch models: ${msg}`);
      }
      return undefined;
    } finally {
      setRefreshingModels(false);
    }
  };

  // Format pricing for display
  const formatPrice = (price?: number) => {
    if (price === undefined || price === null) return "N/A";
    if (price === 0) return "Free";
    if (price < 0.001) return `$${(price * 1000).toFixed(2)} per 1M tokens`;
    return `$${price.toFixed(4)} per 1K tokens`;
  };

  const getModelPricing = (providerType: string, modelId: string): ModelInfo | undefined => {
    const models = dynamicModels[providerType];
    if (!models) return undefined;
    return models.find(m => m.id === modelId);
  };

  return (
    <div className="space-y-6">
      {/* Provider List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{t("llmProvider.configuredProviders")}</h3>
          <button
            onClick={() => isEditing ? cancelEditing() : setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Provider
          </button>
        </div>

        {providers.length === 0 ? (
          <div className="text-center py-12 bg-muted rounded-lg border-2 border-dashed border-muted-foreground">
            <Key className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">{t("llmProvider.noApiKeysConfigured")}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Add your OpenAI, Anthropic, Ollama, or OpenRouter API keys to get started
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map((provider) => {
              const info = PROVIDER_INFO[provider.provider];
              const isVisible = visibleKeys[provider.id];
              const testResult = testResults[provider.id];

              return (
                <div
                  key={provider.id}
                  className={`p-4 bg-card border rounded-lg ${
                    !provider.enabled ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{info.icon}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-foreground">{provider.name}</h4>
                          {!provider.enabled && (
                            <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                              Disabled
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{info.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Model: <span className="font-mono">{provider.model}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Temp: {provider.temperature?.toFixed(1)} · Max tokens: {provider.maxTokens ?? "default"}
                        </p>
                        {provider.systemPrompt && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                            System: {provider.systemPrompt}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEditing(provider)}
                        className="p-2 hover:bg-muted rounded transition-colors"
                        title="Edit provider"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleTestConnection(provider.id)}
                        disabled={testingConnection === provider.id}
                        className="p-2 hover:bg-muted rounded transition-colors"
                        title="Test connection"
                      >
                        {testingConnection === provider.id ? (
                          <CircleNotch className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : testResult === true ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : testResult === false ? (
                          <div className="w-4 h-4 text-red-500">×</div>
                        ) : (
                          <CircleNotch className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>

                      <button
                        onClick={() => onUpdateProvider(provider.id, { enabled: !provider.enabled })}
                        className="p-2 hover:bg-muted rounded transition-colors"
                        title={provider.enabled ? "Disable" : "Enable"}
                      >
                        {provider.enabled ? "⏸" : "▶️"}
                      </button>

                      <button
                        onClick={() => onRemoveProvider(provider.id)}
                        className="p-2 hover:bg-destructive hover:text-destructive-foreground rounded transition-colors"
                        title="Remove provider"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* API Key */}
                  <div className="mt-4 flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-muted rounded text-xs font-mono">
                      {isVisible ? provider.apiKey : "••••••••••••••••••••••••••••••••"}
                    </code>
                    <button
                      onClick={() => toggleKeyVisibility(provider.id)}
                      className="p-2 hover:bg-muted rounded transition-colors"
                    >
                      {isVisible ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Base URL (if custom) */}
                  {provider.baseUrl && provider.baseUrl !== PROVIDER_INFO[provider.provider].baseUrl && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Base URL: {provider.baseUrl}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Provider Form */}
      {showAddForm && (
        <div className="p-4 bg-card border rounded-lg space-y-4">
          <h3 className="text-lg font-semibold text-foreground">{isEditing ? "Edit Provider" : t("llmProvider.addNewProvider")}</h3>

          {/* Provider Type Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Provider Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["openai", "anthropic", "ollama", "openrouter"] as const).map((type) => {
                const info = PROVIDER_INFO[type];
                return (
                  <button
                    key={type}
                    onClick={() => {
                      if (isEditing) return;
                      setNewProviderType(type);
                      setNewProviderName(info.name);
                      setNewProviderBaseUrl(info.baseUrl);
                      setNewProviderModel(info.defaultModel);
                      setNewProviderApiKey("");
                      setOllamaStatus(null);
                    }}
                    disabled={isEditing}
                    className={`p-4 border-2 rounded-lg transition-all text-left ${
                      isEditing && newProviderType !== type
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    } ${
                      newProviderType === type
                        ? "border-primary bg-primary/5"
                        : !isEditing ? "border-border hover:border-muted-foreground" : "border-border"
                    }`}
                  >
                    <div className="text-2xl mb-2">{info.icon}</div>
                    <div className="font-medium text-foreground">{info.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{info.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Name
            </label>
            <input
              type="text"
              value={newProviderName}
              onChange={(e) => setNewProviderName(e.target.value)}
              placeholder="Custom name for this provider"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              API Key
            </label>
            <div className="flex gap-2">
              <input
                type={visibleKeys[newProviderType] ? "text" : "password"}
                value={newProviderApiKey}
                onChange={(e) => setNewProviderApiKey(e.target.value)}
                placeholder={newProviderNeedsApiKey ? "sk-..." : "Optional for local endpoint"}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground font-mono text-sm"
              />
            </div>
            {!newProviderNeedsApiKey && (
              <p className="text-xs text-muted-foreground mt-1">
                API key is optional for local Ollama or local OpenAI-compatible endpoints such as `llama.cpp`.
              </p>
            )}
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Base URL (Optional)
            </label>
            <input
              type="url"
              value={newProviderBaseUrl}
              onChange={(e) => setNewProviderBaseUrl(e.target.value)}
              placeholder={PROVIDER_INFO[newProviderType].baseUrl}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Default: {PROVIDER_INFO[newProviderType].baseUrl}
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-foreground">
                Model
              </label>
              <button
                onClick={handleRefreshModels}
                disabled={refreshingModels || (newProviderNeedsApiKey && !newProviderApiKey.trim())}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                title={`Fetch latest models and pricing from ${PROVIDER_INFO[newProviderType].name}`}
              >
                <ArrowsClockwise className={`w-3 h-3 ${refreshingModels ? "animate-spin" : ""}`} />
                Refresh Models
              </button>
            </div>
            <select
              value={newProviderModel}
              onChange={(e) => setNewProviderModel(e.target.value)}
              disabled={refreshingModels}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground disabled:opacity-50"
            >
              {(dynamicModels[newProviderType] || 
                PROVIDER_INFO[newProviderType].models.map(id => ({ 
                  id, 
                  name: id,
                  context_length: undefined,
                  pricing: undefined 
                } as ModelInfo))
              ).map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} {model.pricing?.prompt !== undefined && 
                    `(in: ${formatPrice(model.pricing.prompt)}, out: ${formatPrice(model.pricing.completion)})`
                  }
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newProviderModel}
              onChange={(e) => setNewProviderModel(e.target.value)}
              placeholder="Enter a custom model ID"
              className="w-full mt-2 px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground font-mono text-sm"
            />
            
            {/* Pricing Display for Selected Model */}
            {(() => {
              const selectedModel = getModelPricing(newProviderType, newProviderModel);
              if (!selectedModel?.pricing) return null;
              return (
                <div className="mt-2 p-2 bg-muted/50 rounded-lg text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground mb-1">
                    <CurrencyDollar className="w-3 h-3" />
                    <span className="font-medium">{t("llmProvider.pricingPer1k")}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedModel.pricing.prompt !== undefined && (
                      <div>
                        <span className="text-muted-foreground">{t("llmProvider.input")}</span>{" "}
                        <span className="font-medium">{formatPrice(selectedModel.pricing.prompt)}</span>
                      </div>
                    )}
                    {selectedModel.pricing.completion !== undefined && (
                      <div>
                        <span className="text-muted-foreground">{t("llmProvider.output")}</span>{" "}
                        <span className="font-medium">{formatPrice(selectedModel.pricing.completion)}</span>
                      </div>
                    )}
                    {selectedModel.pricing.cache_read !== undefined && (
                      <div>
                        <span className="text-muted-foreground">{t("llmProvider.cacheRead")}</span>{" "}
                        <span className="font-medium">{formatPrice(selectedModel.pricing.cache_read)}</span>
                      </div>
                    )}
                    {selectedModel.pricing.cache_write !== undefined && (
                      <div>
                        <span className="text-muted-foreground">{t("llmProvider.cacheWrite")}</span>{" "}
                        <span className="font-medium">{formatPrice(selectedModel.pricing.cache_write)}</span>
                      </div>
                    )}
                  </div>
                  {selectedModel.context_length && (
                    <div className="mt-1 text-muted-foreground">
                      Context window: {(selectedModel.context_length / 1000).toFixed(0)}k tokens
                    </div>
                  )}
                </div>
              );
            })()}
            
            {dynamicModels[newProviderType] && (
              <p className="text-xs text-muted-foreground mt-1">
                {dynamicModels[newProviderType]!.length} models available from {PROVIDER_INFO[newProviderType].name}
              </p>
            )}

            {newProviderType === "ollama" && ollamaStatus && (
              <p className="text-xs text-destructive mt-1">
                {ollamaStatus}
              </p>
            )}
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Temperature: {newProviderTemperature.toFixed(1)}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={newProviderTemperature}
              onChange={(e) => setNewProviderTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Precise (0.0)</span>
              <span>Creative (2.0)</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Max Tokens
            </label>
            <input
              type="number"
              min="1"
              max="128000"
              value={newProviderMaxTokens}
              onChange={(e) => setNewProviderMaxTokens(parseInt(e.target.value) || 4096)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
            />
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              System Prompt (optional)
            </label>
            <textarea
              value={newProviderSystemPrompt}
              onChange={(e) => setNewProviderSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant..."
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={cancelEditing}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!newProviderName || (newProviderNeedsApiKey && !newProviderApiKey.trim())}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditing ? "Save Changes" : "Add Provider"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
