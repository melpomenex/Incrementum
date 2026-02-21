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

/**
 * AI Provider Settings
 */
export function AISettings({ onChange }: { onChange: () => void }) {
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

  const handleAddProvider = (provider: Omit<{ id: string; provider: "openai" | "anthropic" | "ollama" | "openrouter"; name: string; apiKey: string; baseUrl?: string; model: string; enabled: boolean }, "id">) => {
    addProvider(provider);
    onChange();
  };

  const handleUpdateProvider = (id: string, updates: Partial<{ id: string; provider: "openai" | "anthropic" | "ollama" | "openrouter"; name: string; apiKey: string; baseUrl?: string; model: string; enabled: boolean }>) => {
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
        title="Model Settings"
        description="Configure AI model behavior and context limits"
      >
        <SettingsRow
          label="Context Window (Document Content)"
          description="How much document content to send to the AI when generating flashcards or answering questions (in tokens)"
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
    </>
  );
}
