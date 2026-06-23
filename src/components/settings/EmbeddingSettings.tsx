import { useEffect, useState } from "react";
import { Brain, Database, Lightning, Sparkle, Warning } from "@phosphor-icons/react";
import { useSettingsStore } from "../../stores/settingsStore";
import { useRagStore } from "../../stores/ragStore";
import { useShallow } from "zustand/react/shallow";
import { useI18n } from "../../lib/i18n";

/**
 * Embeddings & RAG settings: choose a cloud or local embedding provider,
 * configure chunk size / top-k, and trigger whole-library indexing for
 * retrieval-augmented chat.
 */
export function EmbeddingSettings() {
  const { t } = useI18n();
  const { settings, updateSettingsCategory } = useSettingsStore(
    useShallow((s) => ({
      settings: s.settings.embedding,
      updateSettingsCategory: s.updateSettingsCategory,
    }))
  );
  const { status, isIndexing, indexProgress, isLoadingStatus, lastError, refreshStatus, indexCollection } =
    useRagStore(
      useShallow((s) => ({
        status: s.status,
        isIndexing: s.isIndexing,
        indexProgress: s.indexProgress,
        isLoadingStatus: s.isLoadingStatus,
        lastError: s.lastError,
        refreshStatus: s.refreshStatus,
        indexCollection: s.indexCollection,
      }))
    );

  const [hasIndexed, setHasIndexed] = useState(false);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus, settings.provider, settings.openaiModel, settings.ollamaModel]);

  const update = (patch: Partial<typeof settings>) => updateSettingsCategory("embedding", patch);

  const providerOptions = [
    { value: "openai", label: t("embeddings.providerOpenai"), modelKey: "openaiModel" as const, models: ["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"] },
    { value: "cohere", label: t("embeddings.providerCohere"), modelKey: "cohereModel" as const, models: ["embed-english-v3.0", "embed-multilingual-v3.0"] },
    { value: "openrouter", label: t("embeddings.providerOpenrouter"), modelKey: "openrouterModel" as const, models: ["openai/text-embedding-3-small"] },
    { value: "ollama", label: t("embeddings.providerOllama"), modelKey: "ollamaModel" as const, models: ["nomic-embed-text", "mxbai-embed-large", "all-minilm"] },
  ];
  const activeProvider = providerOptions.find((p) => p.value === settings.provider)!;

  const handleIndex = async () => {
    setHasIndexed(true);
    await indexCollection();
  };

  const indexButtonLabel = isIndexing
    ? t("embeddings.indexing")
    : status && status.indexedDocuments > 0
      ? t("embeddings.reindex")
      : t("embeddings.indexCollection");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          {t("embeddings.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t("embeddings.desc")}</p>
      </div>

      {/* Provider selection */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Database className="w-4 h-4" /> {t("embeddings.provider")}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {providerOptions.map((p) => (
            <button
              key={p.value}
              onClick={() => update({ provider: p.value as typeof settings.provider })}
              className={`px-3 py-2 rounded-md text-sm border transition-colors text-left ${
                settings.provider === p.value
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border hover:bg-muted text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Model picker for the active provider */}
        <label className="block text-sm">
          <span className="text-muted-foreground">{t("embeddings.model")}</span>
          <select
            value={settings[activeProvider.modelKey] ?? activeProvider.models[0]}
            onChange={(e) => update({ [activeProvider.modelKey]: e.target.value } as Partial<typeof settings>)}
            className="mt-1 w-full px-3 py-2 bg-background border border-border rounded text-sm"
          >
            {activeProvider.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        {settings.provider === "ollama" && (
          <label className="block text-sm">
            <span className="text-muted-foreground">{t("embeddings.ollamaBaseUrl")}</span>
            <input
              type="text"
              value={settings.ollamaBaseUrl}
              onChange={(e) => update({ ollamaBaseUrl: e.target.value })}
              placeholder="http://localhost:11434"
              className="mt-1 w-full px-3 py-2 bg-background border border-border rounded text-sm font-mono"
            />
          </label>
        )}

        {settings.provider !== "ollama" && (
          <p className="text-xs text-muted-foreground">{t("embeddings.apiKeyNote")}</p>
        )}
      </div>

      {/* Retrieval tuning */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Lightning className="w-4 h-4" /> {t("embeddings.retrievalTuning")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-muted-foreground">{t("embeddings.chunkSize")}</span>
            <input
              type="number"
              min={50}
              max={2000}
              value={settings.chunkSize}
              onChange={(e) => update({ chunkSize: Number(e.target.value) })}
              className="mt-1 w-full px-3 py-2 bg-background border border-border rounded text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">{t("embeddings.chunkOverlap")}</span>
            <input
              type="number"
              min={0}
              max={500}
              value={settings.chunkOverlap}
              onChange={(e) => update({ chunkOverlap: Number(e.target.value) })}
              className="mt-1 w-full px-3 py-2 bg-background border border-border rounded text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">{t("embeddings.topK")}</span>
            <input
              type="number"
              min={1}
              max={50}
              value={settings.topK}
              onChange={(e) => update({ topK: Number(e.target.value) })}
              className="mt-1 w-full px-3 py-2 bg-background border border-border rounded text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">{t("embeddings.minSimilarity")}</span>
            <input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={settings.minSimilarity}
              onChange={(e) => update({ minSimilarity: Number(e.target.value) })}
              className="mt-1 w-full px-3 py-2 bg-background border border-border rounded text-sm"
            />
          </label>
        </div>
      </div>

      {/* Index status + action */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sparkle className="w-4 h-4" /> {t("embeddings.libraryIndex")}
        </h3>
        {isLoadingStatus ? (
          <p className="text-sm text-muted-foreground">{t("embeddings.loadingStatus")}</p>
        ) : status ? (
          <>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label={t("embeddings.docsIndexed")} value={status.indexedDocuments} sub={`/ ${status.totalDocuments}`} />
              <Stat label={t("embeddings.totalChunks")} value={status.totalChunks} />
              <Stat label={t("embeddings.providerLabel")} value={status.provider} sub={status.model} small />
            </div>
            {status.documentsWithoutContent > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                <Warning className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                {t("embeddings.docsWithoutContent", { count: status.documentsWithoutContent })}
              </p>
            )}
            {status.indexedDocuments < status.totalDocuments - status.documentsWithoutContent && (
              <p className="text-xs text-muted-foreground">
                {t("embeddings.docsNotIndexed", {
                  count: status.totalDocuments - status.documentsWithoutContent - status.indexedDocuments,
                })}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("embeddings.notIndexed")}</p>
        )}

        {isIndexing && indexProgress && (
          <div className="text-xs text-muted-foreground">
            {t("embeddings.indexingProgress", {
              current: indexProgress.current,
              total: indexProgress.total,
              title: indexProgress.documentTitle,
            })}
          </div>
        )}

        <button
          onClick={handleIndex}
          disabled={isIndexing}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {indexButtonLabel}
        </button>

        {hasIndexed && status && status.indexedDocuments === 0 && (
          <p className="text-xs text-muted-foreground">{t("embeddings.indexedZero")}</p>
        )}

        {lastError && (
          <p className="text-xs text-destructive flex items-start gap-1.5">
            <Warning className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {lastError}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t("embeddings.libraryScopeTip")}</p>
    </div>
  );
}

function Stat({ label, value, sub, small }: { label: string; value: number | string; sub?: string; small?: boolean }) {
  return (
    <div className="bg-background/50 rounded p-2">
      <div className={`font-bold ${small ? "text-sm" : "text-xl"}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
