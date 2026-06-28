import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  CaretLeft,
  CaretRight,
  CircleNotch,
  Crosshair,
  MagnifyingGlass,
  Warning,
  X,
} from "@phosphor-icons/react";
import { useDocumentStore } from "../../stores/documentStore";
import { ResizableSplit } from "./ResizableSplit";
import { AudiobookViewer } from "./AudiobookViewer";
import { EPUBViewer } from "./EPUBViewer";
import * as documentsApi from "../../api/documents";
import { resolveLocalMediaSource } from "./localMediaSource";
import { parseChapters, parseAudiobookMetadata } from "../../api/audiobooks";
import { getTranscript, type TranscriptSegment as TranscriptionSegment } from "../../api/transcription";
import type { SyncSegment } from "../../utils/epubSync";

interface AudiobookEpubSyncViewProps {
  audioDocumentId: string;
  epubDocumentId: string;
  onClose?: () => void;
}

export function AudiobookEpubSyncView({
  audioDocumentId,
  epubDocumentId,
  onClose,
}: AudiobookEpubSyncViewProps) {
  const documents = useDocumentStore((s) => s.documents);
  const audioDoc = documents.find((d) => d.id === audioDocumentId);
  const epubDoc = documents.find((d) => d.id === epubDocumentId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [epubKey, setEpubKey] = useState(0);

  const [epubFileData, setEpubFileData] = useState<Uint8Array | null>(null);
  const [mediaSource, setMediaSource] = useState<{ src: string; mimeType?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [_audioChapters, setAudioChapters] = useState<Array<{ title: string; startTime: number; endTime: number }>>([]);
  const [transcriptSegments, setTranscriptSegments] = useState<Array<{ text: string; startTime: number; endTime: number }>>([]);
  const [_epubChapters, setEpubChapters] = useState<Array<{ href: string; label: string; text: string }>>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const wasHidden = useRef(false);

  // Detect tab visibility changes — remount EPUB when becoming visible after hidden
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        wasHidden.current = true;
      } else if (wasHidden.current) {
        wasHidden.current = false;
        setEpubKey((k) => k + 1);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!audioDoc?.filePath || !epubDoc?.filePath) {
      setLoadError("Missing file paths for one or both documents.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [audioRes, epubData] = await Promise.all([
          resolveLocalMediaSource(audioDoc!.filePath, "audio"),
          documentsApi.readDocumentFile(epubDoc!.filePath),
        ]);

        if (cancelled) return;

        setMediaSource({ src: audioRes.src, mimeType: audioRes.mimeType });

        const binaryString = atob(epubData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        setEpubFileData(bytes);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load documents");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [audioDoc?.filePath, epubDoc?.filePath]);

  // Load audiobook metadata (chapters + transcript)
  useEffect(() => {
    if (!audioDoc?.filePath) return;

    let cancelled = false;

    async function loadMeta() {
      try {
        const chapters = await parseChapters(audioDoc!.filePath);
        if (!cancelled && chapters.length > 0) {
          setAudioChapters(chapters.map(c => ({ title: c.title, startTime: c.startTime, endTime: c.endTime })));
        }

        const meta = await parseAudiobookMetadata(audioDoc!.filePath);
        if (!cancelled && meta.chapters && meta.chapters.length > 0) {
          const rawSegments: TranscriptionSegment[] = [];
          for (const ch of meta.chapters) {
            try {
              const resp = await getTranscript(audioDoc!.id, String(ch.startTime));
              if (resp?.segments) {
                rawSegments.push(...resp.segments);
              }
            } catch { /* ignore partial fetch failure */ }
          }
          if (rawSegments.length > 0 && !cancelled) {
            setTranscriptSegments(rawSegments.map(seg => ({
              text: seg.text,
              startTime: seg.start_ms / 1000,
              endTime: seg.end_ms / 1000,
            })));
          }
        }
      } catch { /* ignore metadata load failure */ }
    }

    loadMeta();
    return () => { cancelled = true; };
  }, [audioDoc?.filePath, audioDoc?.id]);

  const handleEpubLoad = useCallback((toc: any[]) => {
    const chapters = toc.map((item: any) => ({
      href: item.href || "",
      label: item.label?.trim() || "",
      text: "",
    }));
    setEpubChapters(chapters);
  }, []);

  const syncSegments: SyncSegment[] = useMemo(() =>
    transcriptSegments.map((seg, idx) => ({
      index: idx,
      text: seg.text,
      startTime: seg.startTime,
      endTime: seg.endTime,
    })),
    [transcriptSegments]
  );

  const [syncState, setSyncState] = useState<{ status: "idle" | "building" | "ready" | "error"; mappedCount: number; totalSegments: number }>({
    status: "idle",
    mappedCount: 0,
    totalSegments: 0,
  });

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState<number | null>(null);
  const [searchTotal, setSearchTotal] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync jump signal
  const [syncJumpSignal, setSyncJumpSignal] = useState(0);

  if (!audioDoc || !epubDoc) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Documents not found.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md px-4">
          <Warning className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-muted-foreground">{loadError}</p>
        </div>
      </div>
    );
  }

  const audioPanel = (
    <div className="h-full flex flex-col relative">
      {/* Exit button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Exit split view"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      {isLoading || !mediaSource ? (
        <div className="flex items-center justify-center h-full">
          <CircleNotch className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <AudiobookViewer
          document={audioDoc}
          fileContent={mediaSource.src}
          audioRef={audioRef}
          onTimeUpdate={setAudioCurrentTime}
        />
      )}
    </div>
  );

  const epubPanel = (
    <div className="h-full flex flex-col">
      {/* EPUB toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-card flex-shrink-0">
        {/* Search toggle / input */}
        {showSearch ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search in book..."
              aria-label="Search in book"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchMatchIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const next = e.shiftKey
                    ? (searchMatchIndex ?? 0) - 1
                    : (searchMatchIndex ?? 0) + 1;
                  setSearchMatchIndex(((next % searchTotal) + searchTotal) % searchTotal);
                } else if (e.key === "Escape") {
                  setShowSearch(false);
                  setSearchQuery("");
                  setSearchMatchIndex(null);
                }
              }}
              className="flex-1 min-w-0 px-2 py-1 bg-background border border-border rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            {searchQuery.trim() && searchTotal > 0 && (
              <span className="text-xs text-muted-foreground whitespace-nowrap px-1">
                {(searchMatchIndex ?? 0) + 1}/{searchTotal}
              </span>
            )}
            {searchQuery.trim() && searchTotal > 0 && (
              <>
                <button
                  onClick={() => setSearchMatchIndex(((searchMatchIndex! - 1) + searchTotal) % searchTotal)}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="Previous match"
                >
                  <CaretLeft className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={() => setSearchMatchIndex((searchMatchIndex! + 1) % searchTotal)}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="Next match"
                >
                  <CaretRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </>
            )}
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery("");
                setSearchMatchIndex(null);
              }}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setShowSearch(true);
              requestAnimationFrame(() => searchInputRef.current?.focus());
            }}
            className="p-1.5 hover:bg-muted rounded transition-colors text-muted-foreground"
            title="Search in book"
          >
            <MagnifyingGlass className="w-4 h-4" />
          </button>
        )}

        <div className="flex-1" />

        {/* Sync status indicator */}
        {syncState.status === "building" && (
          <span className="text-xs text-blue-600 flex items-center gap-1">
            <CircleNotch className="w-3 h-3 animate-spin" />
            Syncing...
          </span>
        )}
        {syncState.status === "ready" && (
          <span className="text-xs text-green-600">
            {syncState.mappedCount} matched
          </span>
        )}
        {syncState.status === "error" && (
          <span className="text-xs text-amber-600">No sync</span>
        )}

        {/* Jump to audio position */}
        <button
          onClick={() => setSyncJumpSignal((s) => s + 1)}
          disabled={syncState.status !== "ready"}
          className="p-1.5 hover:bg-muted rounded transition-colors text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          title="Jump to audio position"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {isLoading || !epubFileData ? (
        <div className="flex items-center justify-center flex-1">
          <CircleNotch className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <EPUBViewer
            key={epubKey}
            fileData={epubFileData}
            fileName={epubDoc.title}
            documentId={epubDoc.id}
            onLoad={handleEpubLoad}
            syncSegments={syncSegments}
            syncCurrentTime={audioCurrentTime}
            onSyncStateChange={setSyncState}
            syncJumpSignal={syncJumpSignal}
            searchQuery={searchQuery || undefined}
            searchMatchIndex={searchMatchIndex}
            onSearchResultsChange={({ total, activeIndex }) => {
              setSearchTotal(total);
              setSearchMatchIndex(activeIndex);
            }}
          />
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="h-full w-full bg-background">
      <ResizableSplit left={audioPanel} right={epubPanel} defaultLeftWidth={40} />
    </div>
  );
}
