/**
 * AI Provider Settings Component
 * LLM Provider configuration and MCP Servers configuration
 */

import { SettingsSection, SettingsRow } from "./SettingsPage";
import { LLMProviderSettings } from "./LLMProviderSettings";
import { MCPServersSettings } from "./MCPServersSettings";
import { useLLMProvidersStore } from "../../stores/llmProvidersStore";
import { useMCPServersStore } from "../../stores/mcpServersStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { invokeCommand as invoke } from "../../lib/tauri";
import { useState, useEffect } from "react";
import { useI18n } from "../../lib/i18n";

/**
 * AI Provider Settings
 */
export function AISettings({ onChange }: { onChange: () => void }) {
  const { t } = useI18n();
  const providers = useLLMProvidersStore((state) => state.providers);
  const addProvider = useLLMProvidersStore((state) => state.addProvider);
  const updateProvider = useLLMProvidersStore((state) => state.updateProvider);
  const removeProvider = useLLMProvidersStore((state) => state.removeProvider);

  const mcpServers = useMCPServersStore((state) => state.servers);
  const addMCPServer = useMCPServersStore((state) => state.addServer);
  const removeMCPServer = useMCPServersStore((state) => state.removeServer);
  const updateMCPServer = useMCPServersStore((state) => state.updateServer);

  // Context window tokens setting
  const { settings, updateSettings } = useSettingsStore();
  const [contextWindowTokens, setContextWindowTokens] = useState(settings.ai.maxTokens);

  // Load context window tokens on mount
  useEffect(() => {
    setContextWindowTokens(settings.ai.maxTokens);
  }, [settings.ai.maxTokens]);

  const handleSaveContextWindow = (value: number) => {
    setContextWindowTokens(value);
    updateSettings({ ai: { ...settings.ai, maxTokens: value } });
    onChange();
  };

  const handleTestConnection = async (config: { id: string; provider: string; apiKey: string; baseUrl?: string; model: string }) => {
    try {
      const result = await invoke<boolean>("llm_test_connection", {
        provider: config.provider,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
      });
      return result;
    } catch (error) {
      console.error("Failed to test connection:", error);
      return false;
    }
  };

  const handleTestMCPServer = async (_server: { id: string; name: string; endpoint: string; transport: "stdio" | "sse" }) => {
    // TODO: Implement actual MCP server connection test
    // For now, just return true
    return true;
  };

  const handleAddProvider = (provider: Omit<{ id: string; provider: "openai" | "anthropic" | "ollama" | "openrouter"; name: string; apiKey: string; baseUrl?: string; model: string; enabled: boolean; temperature: number; maxTokens: number; systemPrompt?: string }, "id">) => {
    addProvider(provider);
    onChange();
  };

  const handleUpdateProvider = (id: string, updates: Partial<{ id: string; provider: "openai" | "anthropic" | "ollama" | "openrouter"; name: string; apiKey: string; baseUrl?: string; model: string; enabled: boolean; temperature: number; maxTokens: number; systemPrompt?: string }>) => {
    updateProvider(id, updates);
    onChange();
  };

  const handleRemoveProvider = (id: string) => {
    removeProvider(id);
    onChange();
  };

  const handleAddMCPServer = (server: Omit<{ id: string; name: string; endpoint: string; transport: "stdio" | "sse"; enabled?: boolean }, "id">) => {
    addMCPServer(server);
    onChange();
  };

  const handleRemoveMCPServer = (id: string) => {
    removeMCPServer(id);
    onChange();
  };

  const handleUpdateMCPServer = (id: string, updates: Partial<{ id: string; name: string; endpoint: string; transport: "stdio" | "sse"; enabled?: boolean }>) => {
    updateMCPServer(id, updates);
    onChange();
  };

  return (
    <>
      <LLMProviderSettings
        providers={providers}
        onAddProvider={handleAddProvider}
        onUpdateProvider={handleUpdateProvider}
        onRemoveProvider={handleRemoveProvider}
        onTestConnection={handleTestConnection}
      />

      {/* AI Model Settings */}
      <SettingsSection
        title={t("aiSettings.modelSettings")}
        description={t("aiProvider.modelSettingsDesc")}
      >
        <SettingsRow
          label={t("aiSettings.contextWindow")}
          description={t("aiProvider.contextWindowDesc")}
        >
          <input
            type="number"
            min="1000"
            max="32000"
            step="500"
            value={contextWindowTokens}
            onChange={(e) => handleSaveContextWindow(parseInt(e.target.value) || 4000)}
            className="w-24 px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
        </SettingsRow>
      </SettingsSection>

      {/* MCP Servers Configuration */}
      <MCPServersSettings
        servers={mcpServers}
        onAddServer={handleAddMCPServer}
        onRemoveServer={handleRemoveMCPServer}
        onUpdateServer={handleUpdateMCPServer}
        onTestServer={handleTestMCPServer}
        maxServers={3}
      />

      {/* Auto-Generation Settings */}
      <SettingsSection
        title="Auto-Generation"
        description="Automatically generate flashcards from new extracts"
      >
        <SettingsRow
          label="Auto-generate flashcards"
          description="Generate flashcards automatically when new extracts are created"
        >
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={settings.ai.aiControls.autoGenerate}
              onChange={(e) => {
                updateSettings({
                  ai: {
                    ...settings.ai,
                    aiControls: { ...settings.ai.aiControls, autoGenerate: e.target.checked },
                  },
                });
                onChange();
              }}
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </SettingsRow>

        <SettingsRow
          label="Cards per extract"
          description="Number of flashcards to generate per extract (1-20)"
        >
          <input
            type="number"
            min="1"
            max="20"
            value={settings.ai.aiControls.cardsPerExtract}
            onChange={(e) => {
              updateSettings({
                ai: {
                  ...settings.ai,
                  aiControls: { ...settings.ai.aiControls, cardsPerExtract: parseInt(e.target.value) || 5 },
                },
              });
              onChange();
            }}
            disabled={!settings.ai.aiControls.autoGenerate}
            className="w-24 px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm disabled:opacity-50"
          />
        </SettingsRow>

        <SettingsRow
          label="Quality threshold"
          description="Minimum confidence score (0.0-1.0) to keep generated flashcards"
        >
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.ai.aiControls.qualityThreshold}
              onChange={(e) => {
                updateSettings({
                  ai: {
                    ...settings.ai,
                    aiControls: { ...settings.ai.aiControls, qualityThreshold: parseFloat(e.target.value) },
                  },
                });
                onChange();
              }}
              disabled={!settings.ai.aiControls.autoGenerate}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground w-10">
              {settings.ai.aiControls.qualityThreshold.toFixed(2)}
            </span>
          </div>
        </SettingsRow>

        <SettingsRow
          label="Require manual approval"
          description="Hold generated cards for review before saving"
        >
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={settings.ai.aiControls.requireApproval}
              onChange={(e) => {
                updateSettings({
                  ai: {
                    ...settings.ai,
                    aiControls: { ...settings.ai.aiControls, requireApproval: e.target.checked },
                  },
                });
                onChange();
              }}
              disabled={!settings.ai.aiControls.autoGenerate}
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary disabled:opacity-50"></div>
          </label>
        </SettingsRow>
      </SettingsSection>

      {/* Summarization Settings */}
      <SettingsSection
        title="Summarization"
        description="Automatically summarize long extracts"
      >
        <SettingsRow
          label="Auto-summarize long extracts"
          description="Generate summaries for extracts exceeding length threshold"
        >
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={settings.ai.aiControls.autoSummarize}
              onChange={(e) => {
                updateSettings({
                  ai: {
                    ...settings.ai,
                    aiControls: { ...settings.ai.aiControls, autoSummarize: e.target.checked },
                  },
                });
                onChange();
              }}
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </SettingsRow>

        <SettingsRow
          label="Summary length"
          description="Target length for auto-generated summaries"
        >
          <select
            value={settings.ai.aiControls.summaryLength}
            onChange={(e) => {
              updateSettings({
                ai: {
                  ...settings.ai,
                  aiControls: { ...settings.ai.aiControls, summaryLength: e.target.value as "short" | "medium" | "long" },
                },
              });
              onChange();
            }}
            disabled={!settings.ai.aiControls.autoSummarize}
            className="w-full sm:w-auto px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm disabled:opacity-50"
          >
            <option value="short">Short (~100 words)</option>
            <option value="medium">Medium (~250 words)</option>
            <option value="long">Long (~500 words)</option>
          </select>
        </SettingsRow>

        <SettingsRow
          label="Include summary in card content"
          description="Prepend summary to flashcard generation prompt as context"
        >
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={settings.ai.aiControls.includeSummaryInCards}
              onChange={(e) => {
                updateSettings({
                  ai: {
                    ...settings.ai,
                    aiControls: { ...settings.ai.aiControls, includeSummaryInCards: e.target.checked },
                  },
                });
                onChange();
              }}
              disabled={!settings.ai.aiControls.autoSummarize}
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary disabled:opacity-50"></div>
          </label>
        </SettingsRow>
      </SettingsSection>

      {/* Context Window Settings */}
      <SettingsSection
        title="Context Window"
        description="Configure how much context is sent in AI requests"
      >
        <SettingsRow
          label="Max tokens per request"
          description="Global fallback for max tokens (256-128000); overridden by per-provider value"
        >
          <input
            type="number"
            min="256"
            max="128000"
            value={settings.ai.aiControls.maxTokensPerRequest}
            onChange={(e) => {
              updateSettings({
                ai: {
                  ...settings.ai,
                  aiControls: { ...settings.ai.aiControls, maxTokensPerRequest: parseInt(e.target.value) || 4096 },
                },
              });
              onChange();
            }}
            className="w-28 px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
        </SettingsRow>

        <SettingsRow
          label="Context from related cards"
          description="Include semantically related card content as context"
        >
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={settings.ai.aiControls.contextFromRelatedCards}
              onChange={(e) => {
                updateSettings({
                  ai: {
                    ...settings.ai,
                    aiControls: { ...settings.ai.aiControls, contextFromRelatedCards: e.target.checked },
                  },
                });
                onChange();
              }}
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </SettingsRow>

        <SettingsRow
          label="Document snippet length"
          description="Characters per context snippet from source documents (200-10000)"
        >
          <input
            type="number"
            min="200"
            max="10000"
            value={settings.ai.aiControls.documentSnippetLength}
            onChange={(e) => {
              updateSettings({
                ai: {
                  ...settings.ai,
                  aiControls: { ...settings.ai.aiControls, documentSnippetLength: parseInt(e.target.value) || 2000 },
                },
              });
              onChange();
            }}
            className="w-28 px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
        </SettingsRow>
      </SettingsSection>
    </>
  );
}
