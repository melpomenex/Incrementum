/**
 * Import preview components for command palette URL import
 */

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertCircle, Youtube, Rss, Globe, Tag as TagIcon, Folder, X, Check, Plus, AlertTriangle, ExternalLink } from "lucide-react";
import { isTauri } from "../../lib/tauri";
import { URLType } from "../../hooks/useURLDetector";
import type { YouTubeVideo } from "../../api/youtube";
import type { Feed } from "../../api/rss";
import type { WebPageMetadata, DuplicateCheckResult } from "../../hooks/useURLMetadata";
import { getCollections, createCollection } from "../../api/collections";
import type { Collection } from "../../types/collection";

export interface ImportOptions {
  tags: string[];
  collectionId?: string;
}

interface ImportPreviewProps {
  urlType: URLType;
  url: string;
  data: YouTubeVideo | Feed | WebPageMetadata | null;
  isLoading: boolean;
  error: string | null;
  onImport: (options: ImportOptions) => void;
  isImporting: boolean;
  onOptionsChange?: (options: ImportOptions) => void;
  duplicateCheck: DuplicateCheckResult;
  onOpenExisting?: (id: string) => void;
}

export function ImportPreview({
  urlType,
  url,
  data,
  isLoading,
  error,
  onImport,
  isImporting,
  onOptionsChange,
  duplicateCheck,
  onOpenExisting,
}: ImportPreviewProps) {
  const [options, setOptions] = useState<ImportOptions>({ tags: [], collectionId: undefined });
  const [tagInput, setTagInput] = useState("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showCollections, setShowCollections] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [showNewCollection, setShowNewCollection] = useState(false);

  // Load collections on mount (Tauri only)
  useEffect(() => {
    if (isTauri()) {
      getCollections().then(setCollections).catch(console.error);
    }
  }, []);

  // Notify parent of options changes
  useEffect(() => {
    onOptionsChange?.(options);
  }, [options, onOptionsChange]);

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (trimmed && !options.tags.includes(trimmed)) {
      setOptions(prev => ({ ...prev, tags: [...prev.tags, trimmed] }));
      setTagInput("");
    }
  }, [tagInput, options.tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setOptions(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tagToRemove)
    }));
  }, []);

  const handleTagKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  }, [handleAddTag]);

  const handleCollectionSelect = useCallback((collectionId: string | undefined) => {
    setOptions(prev => ({ ...prev, collectionId }));
    setShowCollections(false);
  }, []);

  const handleCreateCollection = useCallback(async () => {
    if (!newCollectionName.trim()) return;
    try {
      const newCollection = await createCollection(newCollectionName.trim(), "manual");
      setCollections(prev => [...prev, newCollection]);
      setOptions(prev => ({ ...prev, collectionId: newCollection.id }));
      setNewCollectionName("");
      setShowNewCollection(false);
    } catch (err) {
      console.error("Failed to create collection:", err);
    }
  }, [newCollectionName]);

  const handleImportClick = useCallback(() => {
    onImport(options);
  }, [onImport, options]);

  const handleOpenExisting = useCallback(() => {
    if (duplicateCheck.existingItem && onOpenExisting) {
      onOpenExisting(duplicateCheck.existingItem.id);
    }
  }, [duplicateCheck.existingItem, onOpenExisting]);

  const selectedCollection = collections.find(c => c.id === options.collectionId);

  // Duplicate warning state
  const isDuplicate = duplicateCheck.isDuplicate && !isLoading;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 px-4 py-6">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        <div className="text-sm text-muted-foreground">
          Fetching preview...
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="px-4 py-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-muted-foreground" />
          <div className="flex-1">
            <div className="text-sm text-foreground truncate">{url}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Preview unavailable: {error}
            </div>
          </div>
          <button
            onClick={() => onImport({ tags: [], collectionId: undefined })}
            disabled={isImporting}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </span>
            ) : (
              "Import"
            )}
          </button>
        </div>
      </div>
    );
  }

  // No data yet - show import option anyway for URLs
  if (!data) {
    return (
      <div className="px-4 py-6">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-muted-foreground" />
          <div className="flex-1">
            <div className="text-sm text-foreground truncate">{url}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Preview unavailable, but you can still import
            </div>
          </div>
          <button
            onClick={() => onImport({ tags: [], collectionId: undefined })}
            disabled={isImporting}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </span>
            ) : (
              "Import"
            )}
          </button>
        </div>
      </div>
    );
  }

  // Render specific preview based on type
  switch (urlType) {
    case URLType.YouTube:
      return (
        <YouTubeImportPreview
          data={data as YouTubeVideo}
          options={options}
          tagInput={tagInput}
          setTagInput={setTagInput}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onTagKeyDown={handleTagKeyDown}
          collections={collections}
          selectedCollection={selectedCollection}
          showCollections={showCollections}
          setShowCollections={setShowCollections}
          onCollectionSelect={handleCollectionSelect}
          showNewCollection={showNewCollection}
          setShowNewCollection={setShowNewCollection}
          newCollectionName={newCollectionName}
          setNewCollectionName={setNewCollectionName}
          onCreateCollection={handleCreateCollection}
          onImport={handleImportClick}
          isImporting={isImporting}
          isDuplicate={isDuplicate}
          existingItem={duplicateCheck.existingItem}
          onOpenExisting={handleOpenExisting}
        />
      );
    case URLType.RSSFeed:
      return (
        <RSSImportPreview
          data={data as Feed}
          options={options}
          tagInput={tagInput}
          setTagInput={setTagInput}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onTagKeyDown={handleTagKeyDown}
          collections={collections}
          selectedCollection={selectedCollection}
          showCollections={showCollections}
          setShowCollections={setShowCollections}
          onCollectionSelect={handleCollectionSelect}
          showNewCollection={showNewCollection}
          setShowNewCollection={setShowNewCollection}
          newCollectionName={newCollectionName}
          setNewCollectionName={setNewCollectionName}
          onCreateCollection={handleCreateCollection}
          onImport={handleImportClick}
          isImporting={isImporting}
          isDuplicate={isDuplicate}
          existingItem={duplicateCheck.existingItem}
          onOpenExisting={handleOpenExisting}
        />
      );
    case URLType.WebPage:
      return (
        <WebPageImportPreview
          data={data as WebPageMetadata}
          options={options}
          tagInput={tagInput}
          setTagInput={setTagInput}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onTagKeyDown={handleTagKeyDown}
          collections={collections}
          selectedCollection={selectedCollection}
          showCollections={showCollections}
          setShowCollections={setShowCollections}
          onCollectionSelect={handleCollectionSelect}
          showNewCollection={showNewCollection}
          setShowNewCollection={setShowNewCollection}
          newCollectionName={newCollectionName}
          setNewCollectionName={setNewCollectionName}
          onCreateCollection={handleCreateCollection}
          onImport={handleImportClick}
          isImporting={isImporting}
          isDuplicate={isDuplicate}
          existingItem={duplicateCheck.existingItem}
          onOpenExisting={handleOpenExisting}
        />
      );
    default:
      return null;
  }
}

// Shared import options UI component
interface ImportOptionsUIProps {
  options: ImportOptions;
  tagInput: string;
  setTagInput: (v: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onTagKeyDown: (e: React.KeyboardEvent) => void;
  collections: Collection[];
  selectedCollection?: Collection;
  showCollections: boolean;
  setShowCollections: (v: boolean) => void;
  onCollectionSelect: (id: string | undefined) => void;
  showNewCollection: boolean;
  setShowNewCollection: (v: boolean) => void;
  newCollectionName: string;
  setNewCollectionName: (v: string) => void;
  onCreateCollection: () => void;
}

function ImportOptionsUI({
  options,
  tagInput,
  setTagInput,
  onAddTag,
  onRemoveTag,
  onTagKeyDown,
  collections,
  selectedCollection,
  showCollections,
  setShowCollections,
  onCollectionSelect,
  showNewCollection,
  setShowNewCollection,
  newCollectionName,
  setNewCollectionName,
  onCreateCollection,
}: ImportOptionsUIProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3 mt-3">
      {/* Tags */}
      <div className="flex items-center gap-2">
        <TagIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="flex flex-wrap items-center gap-1.5 flex-1">
          {options.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs"
            >
              #{tag}
              <button
                onClick={() => onRemoveTag(tag)}
                className="hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              onTagKeyDown(e);
            }}
            placeholder={options.tags.length === 0 ? "Add tags..." : ""}
            className="flex-1 min-w-[80px] bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
          {tagInput && (
            <button
              onClick={onAddTag}
              className="px-2 py-0.5 text-xs bg-muted hover:bg-muted/80 rounded"
            >
              Add
            </button>
          )}
        </div>
      </div>

      {/* Collection */}
      <div className="flex items-center gap-2 relative">
        <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <button
          onClick={() => setShowCollections(!showCollections)}
          className="flex-1 flex items-center justify-between px-2 py-1 bg-muted/50 hover:bg-muted rounded text-xs text-left"
        >
          <span className={selectedCollection ? "text-foreground" : "text-muted-foreground"}>
            {selectedCollection ? selectedCollection.name : "Add to collection..."}
          </span>
          <span className="text-muted-foreground">▼</span>
        </button>

        {showCollections && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowCollections(false)} />
            <div className="absolute z-20 left-6 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs font-medium">Collections</span>
                {!showNewCollection && (
                  <button
                    onClick={() => setShowNewCollection(true)}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded hover:opacity-90"
                  >
                    <Plus className="w-3 h-3" />
                    New
                  </button>
                )}
              </div>

              {showNewCollection && (
                <div className="p-2 border-b border-border bg-muted/30">
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") onCreateCollection();
                      else if (e.key === "Escape") {
                        setShowNewCollection(false);
                        setNewCollectionName("");
                      }
                    }}
                    placeholder="Name..."
                    className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                </div>
              )}

              <div className="max-h-48 overflow-y-auto">
                <button
                  onClick={() => onCollectionSelect(undefined)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted transition-colors text-left text-xs ${
                    !selectedCollection ? "bg-muted" : ""
                  }`}
                >
                  <div className="w-4 h-4 border rounded flex items-center justify-center">
                    {!selectedCollection && <Check className="w-3 h-3" />}
                  </div>
                  <span className="text-muted-foreground">None</span>
                </button>
                {collections.map((collection) => (
                  <button
                    key={collection.id}
                    onClick={() => onCollectionSelect(collection.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted transition-colors text-left text-xs ${
                      selectedCollection?.id === collection.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="w-4 h-4 border rounded flex items-center justify-center">
                      {selectedCollection?.id === collection.id && (
                        <Check className="w-3 h-3" />
                      )}
                    </div>
                    {collection.icon && <span>{collection.icon}</span>}
                    <span className="truncate">{collection.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface YouTubeImportPreviewProps extends ImportOptionsUIProps {
  data: YouTubeVideo;
  onImport: () => void;
  isImporting: boolean;
  isDuplicate: boolean;
  existingItem?: { id: string; title: string; type: "document" | "feed" };
  onOpenExisting?: () => void;
}

function YouTubeImportPreview({
  data,
  onImport,
  isImporting,
  isDuplicate,
  existingItem,
  onOpenExisting,
  ...optionsProps
}: YouTubeImportPreviewProps) {
  // Handle partial metadata (fallback case)
  const hasPartialData = data.title === "YouTube Video" || data.channel === "Unknown Channel";
  
  return (
    <div className="px-4 py-3">
      {/* Duplicate warning */}
      {isDuplicate && existingItem && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
              Already imported
            </div>
            <div className="text-xs text-yellow-600 dark:text-yellow-400 truncate">
              {existingItem.title}
            </div>
          </div>
          {onOpenExisting && (
            <button
              onClick={onOpenExisting}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 rounded hover:bg-yellow-500/30"
            >
              <ExternalLink className="w-3 h-3" />
              Open
            </button>
          )}
        </div>
      )}

      {/* Partial data warning */}
      {hasPartialData && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div className="text-xs text-blue-700 dark:text-blue-300">
            Limited preview available. Full details will be fetched after import.
          </div>
        </div>
      )}

      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-32 h-20 rounded overflow-hidden bg-muted">
          <img
            src={data.thumbnail}
            alt={data.title || "YouTube Video"}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to default thumbnail on error
              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${data.id}/hqdefault.jpg`;
            }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Youtube className="w-4 h-4 text-red-500" />
            <span className="text-xs font-medium text-muted-foreground uppercase">
              YouTube Video
            </span>
          </div>

          <h3 className={`text-sm font-medium text-foreground line-clamp-2 ${!data.title || data.title === "YouTube Video" ? "italic text-muted-foreground" : ""}`}>
            {data.title || "YouTube Video"}
          </h3>

          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{data.channel || "Unknown Channel"}</span>
            {data.duration > 0 && (
              <>
                <span>•</span>
                <span>{formatDuration(data.duration)}</span>
              </>
            )}
          </div>

          {data.description && data.description !== data.title && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
              {data.description}
            </p>
          )}
        </div>

        {/* Import button */}
        <button
          onClick={onImport}
          disabled={isImporting}
          className="flex-shrink-0 self-start px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isImporting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Importing...
            </span>
          ) : isDuplicate ? (
            "Re-import"
          ) : (
            "Import Video"
          )}
        </button>
      </div>

      {/* Import Options */}
      <ImportOptionsUI {...optionsProps} />
    </div>
  );
}

interface RSSImportPreviewProps extends ImportOptionsUIProps {
  data: Feed;
  onImport: () => void;
  isImporting: boolean;
  isDuplicate: boolean;
  existingItem?: { id: string; title: string; type: "document" | "feed" };
  onOpenExisting?: () => void;
}

function RSSImportPreview({
  data,
  onImport,
  isImporting,
  isDuplicate,
  existingItem,
  onOpenExisting,
  ...optionsProps
}: RSSImportPreviewProps) {
  return (
    <div className="px-4 py-3">
      {/* Duplicate warning */}
      {isDuplicate && existingItem && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
              Already subscribed
            </div>
            <div className="text-xs text-yellow-600 dark:text-yellow-400 truncate">
              {existingItem.title}
            </div>
          </div>
          {onOpenExisting && (
            <button
              onClick={onOpenExisting}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 rounded hover:bg-yellow-500/30"
            >
              <ExternalLink className="w-3 h-3" />
              Open
            </button>
          )}
        </div>
      )}

      <div className="flex gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 w-12 h-12 rounded bg-orange-500/10 flex items-center justify-center">
          <Rss className="w-6 h-6 text-orange-500" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Rss className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-medium text-muted-foreground uppercase">
              RSS Feed
            </span>
          </div>

          <h3 className="text-sm font-medium text-foreground">
            {data.title}
          </h3>

          {data.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {data.description}
            </p>
          )}

          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span>{data.items.length} items</span>
            {data.category && (
              <>
                <span>•</span>
                <span className="px-1.5 py-0.5 bg-muted rounded">{data.category}</span>
              </>
            )}
          </div>
        </div>

        {/* Subscribe button */}
        <button
          onClick={onImport}
          disabled={isImporting}
          className="flex-shrink-0 self-start px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isImporting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Subscribing...
            </span>
          ) : isDuplicate ? (
            "Re-subscribe"
          ) : (
            "Subscribe"
          )}
        </button>
      </div>

      {/* Import Options */}
      <ImportOptionsUI {...optionsProps} />
    </div>
  );
}

interface WebPageImportPreviewProps extends ImportOptionsUIProps {
  data: WebPageMetadata;
  onImport: () => void;
  isImporting: boolean;
  isDuplicate: boolean;
  existingItem?: { id: string; title: string; type: "document" | "feed" };
  onOpenExisting?: () => void;
}

function WebPageImportPreview({
  data,
  onImport,
  isImporting,
  isDuplicate,
  existingItem,
  onOpenExisting,
  ...optionsProps
}: WebPageImportPreviewProps) {
  return (
    <div className="px-4 py-3">
      {/* Duplicate warning */}
      {isDuplicate && existingItem && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
              Already imported
            </div>
            <div className="text-xs text-yellow-600 dark:text-yellow-400 truncate">
              {existingItem.title}
            </div>
          </div>
          {onOpenExisting && (
            <button
              onClick={onOpenExisting}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 rounded hover:bg-yellow-500/30"
            >
              <ExternalLink className="w-3 h-3" />
              Open
            </button>
          )}
        </div>
      )}

      <div className="flex gap-4">
        {/* Favicon */}
        <div className="flex-shrink-0 w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden">
          {data.favicon ? (
            <img src={data.favicon} alt="" className="w-6 h-6" />
          ) : (
            <Globe className="w-6 h-6 text-muted-foreground" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Web Article
            </span>
          </div>

          <h3 className="text-sm font-medium text-foreground line-clamp-2">
            {data.title}
          </h3>

          {data.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {data.description}
            </p>
          )}

          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <span className="truncate max-w-xs">{data.url}</span>
          </div>
        </div>

        {/* Import button */}
        <button
          onClick={onImport}
          disabled={isImporting}
          className="flex-shrink-0 self-start px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isImporting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Importing...
            </span>
          ) : isDuplicate ? (
            "Re-import"
          ) : (
            "Import Article"
          )}
        </button>
      </div>

      {/* Import Options */}
      <ImportOptionsUI {...optionsProps} />
    </div>
  );
}

/**
 * Format duration in seconds to readable format
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
