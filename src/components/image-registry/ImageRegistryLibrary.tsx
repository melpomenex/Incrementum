import {
  ClipboardPaste,
  ImagePlus,
  Images,
  Search,
  Trash2,
  X,
  Check,
  Link2,
  CalendarDays,
  ArrowDownUp,
  Expand,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type ReactNode } from "react";

import {
  deleteImageAsset,
  ingestImageBlob,
  ingestImageFile,
  listImageAssets,
  type ImageAsset,
} from "../../api/image-registry";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../utils";
import { useToast } from "../common/Toast";

type SortMode = "newest" | "oldest" | "name" | "size";

const EMPTY_SELECTED_IDS: string[] = [];

export interface ImageRegistryLibraryProps {
  className?: string;
  initialSelectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  onConfirmSelection?: (ids: string[]) => void;
  onClose?: () => void;
  onAssetsChange?: (assets: ImageAsset[]) => void;
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  showCloseButton?: boolean;
  showConfirmButton?: boolean;
}

export function ImageRegistryLibrary({
  className,
  initialSelectedIds = EMPTY_SELECTED_IDS,
  onSelectedIdsChange,
  onConfirmSelection,
  onClose,
  onAssetsChange,
  title,
  subtitle,
  confirmLabel,
  showCloseButton = false,
  showConfirmButton = false,
}: ImageRegistryLibraryProps) {
  const { t } = useI18n();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(initialSelectedIds[0] ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setSelectedIds(initialSelectedIds);
  }, [initialSelectedIds]);

  const loadAssets = useCallback(async () => {
    try {
      const nextAssets = await listImageAssets();
      setAssets(Array.isArray(nextAssets) ? nextAssets : []);
      onAssetsChange?.(Array.isArray(nextAssets) ? nextAssets : []);
    } catch (error) {
      console.error("Failed to load image registry library", error);
      toast.error(t("imageRegistry.loadFailed"), error instanceof Error ? error.message : undefined);
    }
  }, [onAssetsChange]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (previewAssetId) return;
    if (assets.length === 0) return;
    setPreviewAssetId(assets[0].id);
  }, [assets, previewAssetId]);

  const commitSelectedIds = useCallback((updater: string[] | ((prev: string[]) => string[])) => {
    setSelectedIds((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      onSelectedIdsChange?.(next);
      return next;
    });
  }, [onSelectedIdsChange]);

  const markHighlighted = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setHighlightedIds(ids);
    window.setTimeout(() => {
      setHighlightedIds((prev) => prev.filter((id) => !ids.includes(id)));
    }, 2400);
  }, []);

  const mergeImportedAssets = useCallback((imported: ImageAsset[]) => {
    const previousIds = new Set(assets.map((asset) => asset.id));
    const duplicateCount = imported.filter((asset) => previousIds.has(asset.id)).length;
    const importedIds = imported.map((asset) => asset.id);

    setAssets((prev) => {
      const merged = [...imported, ...prev];
      const dedup = new Map(merged.map((asset) => [asset.id, asset]));
      const next = Array.from(dedup.values());
      onAssetsChange?.(next);
      return next;
    });

    commitSelectedIds((prev) => Array.from(new Set([...prev, ...importedIds])));
    setPreviewAssetId(importedIds[0] ?? null);
    markHighlighted(importedIds);

    const newCount = imported.length - duplicateCount;
    if (newCount > 0) {
      toast.success(
        t("imageRegistry.assetsAdded"),
        duplicateCount > 0
          ? t("imageRegistry.assetsAddedWithDuplicates", { added: newCount, duplicates: duplicateCount })
          : t("imageRegistry.assetsAddedDesc", { count: newCount })
      );
      return;
    }

    if (duplicateCount > 0) {
      toast.info(t("imageRegistry.duplicateReused"), t("imageRegistry.duplicateReusedDesc", { count: duplicateCount }));
    }
  }, [assets, commitSelectedIds, markHighlighted, onAssetsChange, t, toast]);

  const ingestFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setIsBusy(true);
    try {
      const imported = await Promise.all(files.map((file) => ingestImageFile(file)));
      mergeImportedAssets(imported);
    } catch (error) {
      toast.error(t("imageRegistry.importFailed"), error instanceof Error ? error.message : undefined);
    } finally {
      setIsBusy(false);
    }
  }, [mergeImportedAssets, t, toast]);

  const handleFileInputChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    await ingestFiles(files);
    event.target.value = "";
  }, [ingestFiles]);

  const handlePasteImage = useCallback(async () => {
    setIsBusy(true);
    try {
      if (!navigator.clipboard?.read) {
        throw new Error(t("imageRegistry.clipboardUnavailable"));
      }

      const clipboardItems = await navigator.clipboard.read();
      const blobs: Blob[] = [];
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType) {
          blobs.push(await item.getType(imageType));
        }
      }

      if (blobs.length === 0) {
        throw new Error(t("imageRegistry.clipboardEmpty"));
      }

      const imported = await Promise.all(
        blobs.map((blob, index) => ingestImageBlob(blob, `clipboard-image-${Date.now()}-${index + 1}.png`))
      );
      mergeImportedAssets(imported);
    } catch (error) {
      toast.error(t("imageRegistry.pasteFailed"), error instanceof Error ? error.message : undefined);
    } finally {
      setIsBusy(false);
    }
  }, [mergeImportedAssets, t, toast]);

  const handlePasteCapture = useCallback(async (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;

    event.preventDefault();
    await ingestFiles(files);
  }, [ingestFiles]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.length === 0) return;

    setIsBusy(true);
    try {
      const results = await Promise.all(selectedIds.map((id) => deleteImageAsset(id)));
      const deletedIds = selectedIds.filter((_, index) => results[index]?.deleted);
      const blocked = results.filter((result) => !result.deleted);

      if (deletedIds.length > 0) {
        setAssets((prev) => {
          const next = prev.filter((asset) => !deletedIds.includes(asset.id));
          onAssetsChange?.(next);
          return next;
        });
        commitSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
        toast.success(t("imageRegistry.assetsDeleted"), t("imageRegistry.assetsDeletedDesc", { count: deletedIds.length }));
      }

      if (blocked.length > 0) {
        toast.warning(
          t("imageRegistry.deleteBlocked"),
          blocked[0]?.reason || t("imageRegistry.deleteBlockedDesc")
        );
      }
    } catch (error) {
      toast.error(t("imageRegistry.deleteFailed"), error instanceof Error ? error.message : undefined);
    } finally {
      setIsBusy(false);
    }
  }, [commitSelectedIds, onAssetsChange, selectedIds, t, toast]);

  const sortedAssets = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = normalizedQuery.length === 0
      ? assets
      : assets.filter((asset) => {
          const fileName = asset.file_name?.toLowerCase() ?? "";
          return fileName.includes(normalizedQuery) || asset.sha256.toLowerCase().includes(normalizedQuery);
        });

    const next = [...filtered];
    switch (sortMode) {
      case "oldest":
        next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "name":
        next.sort((a, b) => (a.file_name || a.id).localeCompare(b.file_name || b.id));
        break;
      case "size":
        next.sort((a, b) => b.byte_size - a.byte_size);
        break;
      case "newest":
      default:
        next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    return next;
  }, [assets, searchQuery, sortMode]);

  const previewAsset = useMemo(
    () => sortedAssets.find((asset) => asset.id === previewAssetId) || assets.find((asset) => asset.id === previewAssetId) || null,
    [assets, previewAssetId, sortedAssets]
  );

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedIds.includes(asset.id)),
    [assets, selectedIds]
  );

  return (
    <div
      className={cn("flex h-full min-h-0 flex-col rounded-[28px] border border-border/70 bg-background/95 shadow-xl", className)}
      onPasteCapture={handlePasteCapture}
    >
      <div className="border-b border-border/70 bg-gradient-to-r from-primary/6 via-background to-secondary/10 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-2xl bg-primary/12 p-2 text-primary">
                <Images className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {title || t("imageRegistry.title")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {subtitle || t("imageRegistry.subtitle")}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("imageRegistry.pasteHint")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-60"
            >
              <ImagePlus className="h-4 w-4" />
              {t("imageRegistry.upload")}
            </button>
            <button
              type="button"
              onClick={() => void handlePasteImage()}
              disabled={isBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-60"
            >
              <ClipboardPaste className="h-4 w-4" />
              {t("imageRegistry.paste")}
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteSelected()}
              disabled={isBusy || selectedIds.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 bg-background px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {t("imageRegistry.deleteSelected")}
            </button>
            {showCloseButton && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <X className="h-4 w-4" />
                {t("common.close")}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-5 py-3">
        <label className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("imageRegistry.searchPlaceholder")}
            className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none transition-colors focus:border-primary"
          />
        </label>

        <label className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground">
          <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{t("imageRegistry.sortBy")}</span>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="bg-transparent outline-none"
          >
            <option value="newest">{t("imageRegistry.sortNewest")}</option>
            <option value="oldest">{t("imageRegistry.sortOldest")}</option>
            <option value="name">{t("imageRegistry.sortName")}</option>
            <option value="size">{t("imageRegistry.sortSize")}</option>
          </select>
        </label>

        <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {t("imageRegistry.selectedCount", { count: selectedIds.length })}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-0 overflow-y-auto p-5">
          {sortedAssets.length === 0 ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-[24px] border border-dashed border-border bg-muted/20 px-6 text-center">
              <Images className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">{t("imageRegistry.emptyTitle")}</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("imageRegistry.emptyDesc")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {sortedAssets.map((asset) => {
                const selected = selectedIds.includes(asset.id);
                const highlighted = highlightedIds.includes(asset.id);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => {
                      setPreviewAssetId(asset.id);
                      commitSelectedIds((prev) =>
                        prev.includes(asset.id) ? prev.filter((id) => id !== asset.id) : [...prev, asset.id]
                      );
                    }}
                    className={cn(
                      "group rounded-[22px] border bg-card text-left transition-all",
                      selected ? "border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/20" : "border-border hover:border-primary/40",
                      highlighted && "ring-2 ring-emerald-400/70"
                    )}
                  >
                    <div className="relative aspect-square overflow-hidden rounded-t-[22px] bg-muted">
                      <img
                        src={asset.data_url}
                        alt={asset.file_name || t("imageRegistry.assetAlt")}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-2">
                        {asset.is_referenced ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-white">
                            <Link2 className="h-3 w-3" />
                            {t("imageRegistry.inUse")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] font-medium text-white">
                            {t("imageRegistry.available")}
                          </span>
                        )}
                        {selected && (
                          <span className="rounded-full bg-primary p-1 text-primary-foreground">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 px-3 py-3">
                      <div className="truncate text-sm font-medium text-foreground">
                        {asset.file_name || t("imageRegistry.untitled")}
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span>{formatBytes(asset.byte_size)}</span>
                        {asset.width && asset.height ? <span>{asset.width}×{asset.height}</span> : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="flex min-h-0 flex-col border-l border-border/70 bg-muted/20">
          {previewAsset ? (
            <>
              <div className="border-b border-border/70 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {previewAsset.file_name || t("imageRegistry.untitled")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {previewAsset.is_referenced
                        ? t("imageRegistry.referenceCount", { count: previewAsset.reference_count || 0 })
                        : t("imageRegistry.notReferenced")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => commitSelectedIds((prev) =>
                      prev.includes(previewAsset.id)
                        ? prev.filter((id) => id !== previewAsset.id)
                        : [...prev, previewAsset.id]
                    )}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                      selectedIds.includes(previewAsset.id)
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background text-foreground hover:bg-muted"
                    )}
                  >
                    {selectedIds.includes(previewAsset.id) ? t("imageRegistry.selected") : t("imageRegistry.select")}
                  </button>
                </div>

                <div className="overflow-hidden rounded-[24px] border border-border bg-card">
                  <img
                    src={previewAsset.data_url}
                    alt={previewAsset.file_name || t("imageRegistry.assetAlt")}
                    className="h-auto max-h-[280px] w-full object-contain bg-black/5"
                  />
                </div>
              </div>

              <div className="space-y-4 p-4 text-sm">
                <div className="rounded-2xl border border-border bg-background p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    <Expand className="h-3.5 w-3.5" />
                    {t("imageRegistry.details")}
                  </div>
                  <dl className="space-y-2">
                    <MetadataRow label={t("imageRegistry.size")} value={formatBytes(previewAsset.byte_size)} />
                    <MetadataRow label={t("imageRegistry.dimensions")} value={formatDimensions(previewAsset)} />
                    <MetadataRow label={t("imageRegistry.type")} value={previewAsset.mime_type} />
                    <MetadataRow
                      label={t("imageRegistry.added")}
                      value={
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatDate(previewAsset.created_at)}
                        </span>
                      }
                    />
                  </dl>
                </div>

                <div className="rounded-2xl border border-border bg-background p-3">
                  <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {t("imageRegistry.selection")}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedAssets.length === 0 ? (
                      <span className="text-sm text-muted-foreground">{t("imageRegistry.noSelection")}</span>
                    ) : (
                      selectedAssets.map((asset) => (
                        <span
                          key={asset.id}
                          className="inline-flex max-w-full items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
                        >
                          <span className="truncate">{asset.file_name || t("imageRegistry.untitled")}</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {t("imageRegistry.previewEmpty")}
            </div>
          )}
        </aside>
      </div>

      {showConfirmButton && onConfirmSelection ? (
        <div className="flex items-center justify-between gap-3 border-t border-border/70 px-5 py-4">
          <div className="text-sm text-muted-foreground">
            {t("imageRegistry.selectionHelp")}
          </div>
          <div className="flex items-center gap-2">
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                {t("common.cancel")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onConfirmSelection(selectedIds)}
              disabled={selectedIds.length === 0}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
            >
              {confirmLabel || t("imageRegistry.useSelected")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDimensions(asset: ImageAsset) {
  if (!asset.width || !asset.height) return "Unknown";
  return `${asset.width} × ${asset.height}`;
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export default ImageRegistryLibrary;
