/**
 * MCP Servers Settings
 * Configure external MCP servers (up to 3)
 */

import { useState } from "react";
import { Server, Plus, Trash2, Check, Loader2, X } from "lucide-react";
import { useI18n } from "../../lib/i18n";

export interface MCPServerConfig {
  id: string;
  name: string;
  endpoint: string;
  transport: "stdio" | "sse";
  enabled?: boolean;
}

interface MCPServersSettingsProps {
  servers: MCPServerConfig[];
  onAddServer: (server: Omit<MCPServerConfig, "id">) => void;
  onRemoveServer: (id: string) => void;
  onUpdateServer: (id: string, updates: Partial<MCPServerConfig>) => void;
  onTestServer: (server: MCPServerConfig) => Promise<boolean>;
  maxServers?: number;
}

const MAX_SERVERS_DEFAULT = 3;

export function MCPServersSettings({
  servers,
  onAddServer,
  onRemoveServer,
  onUpdateServer: _onUpdateServer,
  onTestServer,
  maxServers = MAX_SERVERS_DEFAULT,
}: MCPServersSettingsProps) {
  const { t } = useI18n();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerEndpoint, setNewServerEndpoint] = useState("");
  const [newServerTransport, setNewServerTransport] = useState<"stdio" | "sse">("stdio");
  const [testingServer, setTestingServer] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});

  const handleAddServer = () => {
    if (!newServerName.trim() || !newServerEndpoint.trim()) {
      return;
    }

    if (servers.length >= maxServers) {
      alert(t("settings.mcpMaxServers", { max: maxServers }));
      return;
    }

    onAddServer({
      name: newServerName,
      endpoint: newServerEndpoint,
      transport: newServerTransport,
      enabled: true,
    });

    // Reset form
    setNewServerName("");
    setNewServerEndpoint("");
    setNewServerTransport("stdio");
    setShowAddForm(false);
  };

  const handleTestConnection = async (server: MCPServerConfig) => {
    setTestingServer(server.id);
    try {
      const success = await onTestServer(server);
      setTestResults({ ...testResults, [server.id]: success });
    } catch {
      setTestResults({ ...testResults, [server.id]: false });
    } finally {
      setTestingServer(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Server List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{t("settings.mcpConfiguredServers")}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t("settings.mcpServersCount", { count: servers.length, max: maxServers })}
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={servers.length >= maxServers}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            {t("settings.mcpAddServer")}
          </button>
        </div>

        {servers.length === 0 ? (
          <div className="text-center py-12 bg-muted rounded-lg border-2 border-dashed border-muted-foreground">
            <Server className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">{t("settings.mcpNoServers")}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {t("settings.mcpNoServersDesc")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {servers.map((server) => {
              const testResult = testResults[server.id];
              const isTesting = testingServer === server.id;

              return (
                <div
                  key={server.id}
                  className="p-4 bg-card border rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {server.transport === "stdio" ? "⌨️" : "🌐"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-foreground">{server.name}</h4>
                          <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                            {server.transport.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          {server.endpoint}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTestConnection(server)}
                        disabled={isTesting}
                        className="p-2 hover:bg-muted rounded transition-colors"
                        title={t("settings.mcpTestConnection")}
                      >
                        {isTesting ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : testResult === true ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : testResult === false ? (
                          <div className="w-4 h-4 text-red-500">×</div>
                        ) : (
                          <Loader2 className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>

                      <button
                        onClick={() => onRemoveServer(server.id)}
                        className="p-2 hover:bg-destructive hover:text-destructive-foreground rounded transition-colors"
                        title={t("settings.mcpRemoveServer")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Server Form */}
      {showAddForm && (
        <div className="p-4 bg-card border rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">{t("settings.mcpAddServerTitle")}</h3>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewServerName("");
                setNewServerEndpoint("");
                setNewServerTransport("stdio");
              }}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("settings.mcpServerName")}
            </label>
            <input
              type="text"
              value={newServerName}
              onChange={(e) => setNewServerName(e.target.value)}
              placeholder="e.g., Filesystem, Git, GitHub"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
            />
          </div>

          {/* Transport Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("settings.mcpTransportType")}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNewServerTransport("stdio")}
                className={`p-4 border-2 rounded-lg transition-all text-left ${
                  newServerTransport === "stdio"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <div className="text-2xl mb-2">⌨️</div>
                <div className="font-medium text-foreground">STDIO</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t("settings.mcpStdioDesc")}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setNewServerTransport("sse")}
                className={`p-4 border-2 rounded-lg transition-all text-left ${
                  newServerTransport === "sse"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <div className="text-2xl mb-2">🌐</div>
                <div className="font-medium text-foreground">SSE</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t("settings.mcpSseDesc")}
                </div>
              </button>
            </div>
          </div>

          {/* Endpoint */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {newServerTransport === "stdio" ? t("settings.mcpCommand") : t("settings.mcpUrl")}
            </label>
            <input
              type="text"
              value={newServerEndpoint}
              onChange={(e) => setNewServerEndpoint(e.target.value)}
              placeholder={
                newServerTransport === "stdio"
                  ? "npx @modelcontextprotocol/server-filesystem"
                  : "http://localhost:3001/sse"
              }
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {newServerTransport === "stdio"
                ? t("settings.mcpCommandHint")
                : t("settings.mcpSseUrlHint")}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewServerName("");
                setNewServerEndpoint("");
                setNewServerTransport("stdio");
              }}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleAddServer}
              disabled={!newServerName || !newServerEndpoint}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("settings.mcpAddServer")}
            </button>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="p-4 bg-muted/30 rounded-lg border border-border">
        <h4 className="font-medium text-foreground mb-2">{t("settings.mcpAboutTitle")}</h4>
        <p className="text-sm text-muted-foreground mb-2">
          {t("settings.mcpAboutDesc")}
        </p>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• <strong>STDIO</strong>: {t("settings.mcpAboutStdio")}</li>
          <li>• <strong>SSE</strong>: {t("settings.mcpAboutSse")}</li>
          <li>• {t("settings.mcpAboutMaxServers", { max: maxServers })}</li>
        </ul>
      </div>
    </div>
  );
}
