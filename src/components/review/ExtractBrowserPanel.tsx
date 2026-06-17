import { useMemo, useState } from "react";
import {
  CaretDown,
  CaretRight,
  ChatCircle,
  CircleNotch,
  MagnifyingGlass,
  Plus,
  Sparkle,
  TextT,
} from "@phosphor-icons/react";
import type { Extract } from "../../api/extracts";
import { useI18n } from "../../lib/i18n";

interface ExtractBrowserPanelProps {
  extracts: Extract[];
  documents: Array<{ id: string; title: string }>;
  selectedDocumentId: string | null;
  generatingExtractIds: Set<string>;
  onUseAsContext: (extract: Extract) => void;
  onGenerateCards: (extractId: string) => void;
  onCreateCard: (extract: Extract) => void;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "…";
}

function groupByDocument(
  extracts: Extract[],
  documents: Array<{ id: string; title: string }>,
): Map<string, { title: string; extracts: Extract[] }> {
  const docMap = new Map<string, string>();
  for (const d of documents) docMap.set(d.id, d.title);

  const groups = new Map<string, { title: string; extracts: Extract[] }>();
  for (const ext of extracts) {
    if (!groups.has(ext.document_id)) {
      groups.set(ext.document_id, {
        title: docMap.get(ext.document_id) || ext.document_id,
        extracts: [],
      });
    }
    groups.get(ext.document_id)!.extracts.push(ext);
  }
  return groups;
}

export function ExtractBrowserPanel({
  extracts,
  documents,
  selectedDocumentId,
  generatingExtractIds,
  onUseAsContext,
  onGenerateCards,
  onCreateCard,
}: ExtractBrowserPanelProps) {
  const { t } = useI18n();
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(() => {
    if (selectedDocumentId) return new Set([selectedDocumentId]);
    return new Set();
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDocId, setFilterDocId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = extracts;
    if (filterDocId) {
      result = result.filter((e) => e.document_id === filterDocId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) => e.content.toLowerCase().includes(q));
    }
    return result;
  }, [extracts, filterDocId, searchQuery]);

  const grouped = useMemo(
    () => groupByDocument(filtered, documents),
    [filtered, documents],
  );

  const toggleDoc = (docId: string) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const hasFilters = searchQuery.trim() || filterDocId;
  const hasResults = grouped.size > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header with search and filter */}
      <div className="border-b border-border px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">
            {t("flashcardStudio.extractsTitle")}
          </h3>
          <span className="text-xs text-muted-foreground">
            ({extracts.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("flashcardStudio.extractsSearchPlaceholder")}
              className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <select
            value={filterDocId ?? ""}
            onChange={(e) => setFilterDocId(e.target.value || null)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 max-w-[180px]"
          >
            <option value="">{t("flashcardStudio.extractsAllDocuments")}</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {truncate(d.title, 30)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Extract list grouped by document */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!hasResults && hasFilters && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <TextT className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("flashcardStudio.extractsNoResults")}
            </p>
          </div>
        )}
        {!hasResults && !hasFilters && extracts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <TextT className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("flashcardStudio.extractsEmpty")}
            </p>
          </div>
        )}
        {Array.from(grouped.entries()).map(([docId, group]) => {
          const isExpanded = expandedDocs.has(docId);
          return (
            <div key={docId} className="border-b border-border last:border-b-0">
              {/* Document section header */}
              <button
                onClick={() => toggleDoc(docId)}
                className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
              >
                {isExpanded ? (
                  <CaretDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <CaretRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <TextT className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-foreground truncate flex-1">
                  {group.title}
                </span>
                <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 shrink-0">
                  {group.extracts.length}
                </span>
              </button>

              {/* Extract rows */}
              {isExpanded && (
                <div className="pb-1">
                  {group.extracts.map((extract) => (
                    <ExtractRow
                      key={extract.id}
                      extract={extract}
                      isGenerating={generatingExtractIds.has(extract.id)}
                      onUseAsContext={onUseAsContext}
                      onGenerateCards={onGenerateCards}
                      onCreateCard={onCreateCard}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExtractRow({
  extract,
  isGenerating,
  onUseAsContext,
  onGenerateCards,
  onCreateCard,
}: {
  extract: Extract;
  isGenerating: boolean;
  onUseAsContext: (extract: Extract) => void;
  onGenerateCards: (extractId: string) => void;
  onCreateCard: (extract: Extract) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex items-start gap-2 px-4 py-2 hover:bg-muted/30 transition-colors group">
      {/* Highlight color dot */}
      {extract.highlight_color ? (
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
          style={{ backgroundColor: extract.highlight_color }}
        />
      ) : (
        <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 bg-muted-foreground/20" />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground leading-relaxed">
          {truncate(extract.content.replace(/\n/g, " "), 120)}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {extract.page_number != null && (
            <span className="text-[10px] text-muted-foreground">
              p.{extract.page_number}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => onUseAsContext(extract)}
          title={t("flashcardStudio.extractUseAsContext")}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChatCircle className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onCreateCard(extract)}
          title={t("flashcardStudio.extractCreateCard")}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onGenerateCards(extract.id)}
          disabled={isGenerating}
          title={t("flashcardStudio.extractGenerateCards")}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          {isGenerating ? (
            <CircleNotch className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkle className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
