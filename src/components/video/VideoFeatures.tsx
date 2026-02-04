/**
 * Video Features Component
 * Adds bookmarks, chapters, and transcript support to video players
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Bookmark,
  Bookmark as BookmarkIcon,
  List,
  Plus,
  Trash2,
  ChevronRight,
  FileText,
  Clock,
  Hash,
  ExternalLink,
  AlertCircle,
  Sparkles,
  Loader2,
  Info,
} from 'lucide-react';
import { invokeCommand } from '../../lib/tauri';
import { useDocumentStore } from '../../stores/documentStore';
import { getDocument } from '../../api/documents';
import { getVideoTranscript } from '../../api/video-extracts';
import { enqueueVideoTranscription, getVideoTranscriptionStatus, subscribeVideoTranscriptionStatus } from '../../lib/videoTranscriptionQueue';
import { useTranscriptionStore } from '../../stores/useTranscriptionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useToast } from '../common/Toast';
import { isTauri } from '../../lib/tauri';
import { isGroqConfigured } from '../../api/groqTranscription';

interface VideoBookmark {
  id: string;
  document_id: string;
  title: string;
  time: number; // Timestamp in seconds
  thumbnail_url?: string;
  created_at: string;
}

interface VideoChapter {
  id: string;
  document_id: string;
  title: string;
  start_time: number;
  end_time: number;
  order: number;
}

interface VideoTranscriptSegment {
  time: number;
  text: string;
}

interface VideoFeaturesProps {
  documentId: string;
  documentTitle?: string;
  filePath?: string;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  className?: string;
}

export function VideoFeatures({
  documentId,
  documentTitle,
  filePath,
  currentTime,
  duration,
  onSeek,
  className = '',
}: VideoFeaturesProps) {
  const [activeTab, setActiveTab] = useState<'bookmarks' | 'chapters' | 'transcript'>('bookmarks');
  const [bookmarks, setBookmarks] = useState<VideoBookmark[]>([]);
  const [chapters, setChapters] = useState<VideoChapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Get document from store
  const documents = useDocumentStore((state) => state.documents);
  const document = documents.find((d) => d.id === documentId);
  const resolvedFilePath = filePath ?? document?.filePath;
  const resolvedTitle = documentTitle ?? document?.title;

  // Load data when tab changes
  useEffect(() => {
    if (!documentId) return;
    loadData(activeTab);
  }, [documentId, activeTab]);

  const loadData = async (tab: string) => {
    setLoading(true);
    try {
      switch (tab) {
        case 'bookmarks':
          const bookmarksData = await invokeCommand<VideoBookmark[]>('get_video_bookmarks', {
            documentId,
          });
          setBookmarks(bookmarksData);
          break;
        case 'chapters':
          const chaptersData = await invokeCommand<VideoChapter[]>('get_video_chapters', {
            documentId,
          });
          setChapters(chaptersData);
          break;
        case 'transcript':
          // Transcript is loaded directly in TranscriptView component
          break;
      }
    } catch (error) {
      console.error(`Failed to load ${tab}:`, error);
    } finally {
      setLoading(false);
    }
  };

  // Add bookmark
  const addBookmark = async (title?: string) => {
    if (!documentId) return;

    const bookmarkTitle = title || `Bookmark at ${formatTime(currentTime)}`;

    try {
      const newBookmark = await invokeCommand<VideoBookmark>('add_video_bookmark', {
        documentId,
        title: bookmarkTitle,
        time: currentTime,
      });

      setBookmarks((prev) => [...prev, newBookmark].sort((a, b) => a.time - b.time));
    } catch (error) {
      console.error('Failed to add bookmark:', error);
    }
  };

  // Remove bookmark
  const removeBookmark = async (bookmarkId: string) => {
    try {
      await invokeCommand('delete_video_bookmark', {
        bookmarkId,
      });
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
    } catch (error) {
      console.error('Failed to remove bookmark:', error);
    }
  };

  // Fetch chapters from YouTube
  const handleFetchYouTubeChapters = async () => {
    if (!documentId) return;

    setLoading(true);
    setErrorMessage(null);
    try {
      // Get the document to retrieve its URL using the proper API
      const doc = await getDocument(documentId);

      if (!doc) {
        setErrorMessage('Document not found');
        return;
      }

      // Use filePath (correct property name) for YouTube videos
      const videoUrl = doc.filePath;

      if (!videoUrl || (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be'))) {
        setErrorMessage('This is not a YouTube video. Chapters can only be fetched from YouTube videos.');
        return;
      }

      // Fetch chapters from YouTube
      const youtubeChapters = await invokeCommand<VideoChapter[]>('get_youtube_chapters', {
        url: videoUrl,
        documentId,
      });

      if (!youtubeChapters || youtubeChapters.length === 0) {
        setErrorMessage('No chapters found for this video. Some videos may not have chapter information.');
        return;
      }

      setChapters(youtubeChapters);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Failed to fetch YouTube chapters:', errorMsg);
      setErrorMessage(`Failed to fetch chapters: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex flex-col bg-card border border-border rounded-lg ${className}`}>
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('bookmarks')}
          className={`flex-1 min-w-0 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'bookmarks'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground hover:text-foreground-secondary'
          }`}
        >
          <BookmarkIcon className="w-4 h-4" />
          <span className="truncate">Bookmarks</span>
          {bookmarks.length > 0 && (
            <span className="px-1.5 py-0.5 bg-primary text-primary-foreground text-xs rounded-full flex-shrink-0">
              {bookmarks.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('chapters')}
          className={`flex-1 min-w-0 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'chapters'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground hover:text-foreground-secondary'
          }`}
        >
          <List className="w-4 h-4" />
          <span className="truncate">Chapters</span>
          {chapters.length > 0 && (
            <span className="px-1.5 py-0.5 bg-primary text-primary-foreground text-xs rounded-full flex-shrink-0">
              {chapters.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('transcript')}
          className={`flex-1 min-w-0 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'transcript'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground hover:text-foreground-secondary'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span className="truncate">Transcript</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        ) : (
          <>
            {activeTab === 'bookmarks' && (
              <BookmarksView
                bookmarks={bookmarks}
                currentTime={currentTime}
                onSeek={onSeek}
                onAdd={addBookmark}
                onRemove={removeBookmark}
              />
            )}

            {activeTab === 'chapters' && (
              <ChaptersView
                chapters={chapters}
                currentTime={currentTime}
                duration={duration}
                onSeek={onSeek}
                errorMessage={errorMessage}
              />
            )}

            {activeTab === 'transcript' && (
              <TranscriptView
                documentId={documentId}
                documentTitle={resolvedTitle}
                filePath={resolvedFilePath}
                currentTime={currentTime}
                onSeek={onSeek}
              />
            )}
          </>
        )}
      </div>

      {/* Add button for current tab */}
      <div className="p-3 border-t border-border">
        {activeTab === 'bookmarks' && (
          <button
            onClick={() => addBookmark()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add Bookmark at {formatTime(currentTime)}
          </button>
        )}
        {activeTab === 'chapters' && (
          <button
            onClick={handleFetchYouTubeChapters}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <ExternalLink className="w-4 h-4" />
            {loading ? 'Fetching...' : 'Fetch from YouTube'}
          </button>
        )}
      </div>
    </div>
  );
}

// Bookmarks View Component
interface BookmarksViewProps {
  bookmarks: VideoBookmark[];
  currentTime: number;
  onSeek: (time: number) => void;
  onAdd: (title?: string) => void;
  onRemove: (id: string) => void;
}

function BookmarksView({ bookmarks, currentTime, onSeek, onAdd, onRemove }: BookmarksViewProps) {
  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-8">
        <BookmarkIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
        <p className="text-sm text-foreground-secondary">
          No bookmarks yet. Click the button below to add one at the current position.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {bookmarks.map((bookmark) => (
        <div
          key={bookmark.id}
          className="flex items-center gap-3 p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors group"
        >
          <button
            onClick={() => onSeek(bookmark.time)}
            className="flex-1 flex items-center gap-2 text-left"
          >
            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">
                {bookmark.title}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatTime(bookmark.time)}
              </div>
            </div>
          </button>
          <button
            onClick={() => onRemove(bookmark.id)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors opacity-0 group-hover:opacity-100"
            title="Remove bookmark"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ))}
    </div>
  );
}

// Chapters View Component
interface ChaptersViewProps {
  chapters: VideoChapter[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  errorMessage?: string | null;
}

function ChaptersView({ chapters, currentTime, duration, onSeek, errorMessage }: ChaptersViewProps) {
  if (errorMessage) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3 opacity-50" />
        <p className="text-sm text-foreground-secondary">
          {errorMessage}
        </p>
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="text-center py-8">
        <List className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
        <p className="text-sm text-foreground-secondary">
          No chapters available. Click "Fetch from YouTube" to load chapters from the video.
        </p>
      </div>
    );
  }

  const getCurrentChapter = () => {
    return chapters.find((ch) => currentTime >= ch.start_time && currentTime < ch.end_time);
  };

  const currentChapter = getCurrentChapter();

  return (
    <div className="space-y-2">
      {/* Current Chapter Indicator */}
      {currentChapter && (
        <div className="p-2 bg-primary/10 border border-primary/30 rounded-lg text-sm text-primary">
          Currently watching: {currentChapter.title}
        </div>
      )}

      {chapters.map((chapter, index) => {
        const isCurrent = currentTime >= chapter.start_time && currentTime < chapter.end_time;
        const progress = ((currentTime - chapter.start_time) / (chapter.end_time - chapter.start_time)) * 100;
        const isCompleted = currentTime >= chapter.end_time;

        return (
          <button
            key={chapter.id}
            onClick={() => onSeek(chapter.start_time)}
            className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors text-left ${
              isCurrent
                ? 'bg-primary text-primary-foreground'
                : isCompleted
                ? 'opacity-50'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            }`}
          >
            <span className="text-xs text-muted-foreground w-6">{index + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{chapter.title}</div>
              <div className="text-xs text-muted-foreground">
                {formatTime(chapter.start_time)} - {formatTime(chapter.end_time)}
              </div>
            </div>
            {isCurrent && (
              <div className="text-xs text-primary-foreground">
                {Math.round(progress)}%
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Transcript View Component
interface TranscriptViewProps {
  documentId: string;
  documentTitle?: string;
  filePath?: string;
  currentTime: number;
  onSeek: (time: number) => void;
}

function TranscriptView({ documentId, documentTitle, filePath, currentTime, onSeek }: TranscriptViewProps) {
  const [transcript, setTranscript] = useState<VideoTranscriptSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<ReturnType<typeof getVideoTranscriptionStatus>>(null);
  const { settings, updateSettings } = useSettingsStore();
  const audioSettings = settings.audioTranscription;
  const [selectedProvider, setSelectedProvider] = useState<'local' | 'groq'>(audioSettings.provider);
  const [selectedModel, setSelectedModel] = useState<string>(audioSettings.preferredModelId || "distil-small.en");
  const [language, setLanguage] = useState<string>(audioSettings.language || "en");
  const toast = useToast();

  const { profiles, fetchProfiles } = useTranscriptionStore();

  const loadTranscript = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getVideoTranscript(documentId);
      if (result) {
        setTranscript(result.segments);
      } else {
        setTranscript([]);
      }
    } catch (error) {
      console.error('Failed to load transcript:', error);
      setTranscript([]);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadTranscript();
  }, [loadTranscript]);

  useEffect(() => {
    fetchProfiles().catch(() => undefined);
  }, [fetchProfiles]);

  useEffect(() => {
    if (profiles.length === 0) return;
    if (profiles.find((profile) => profile.id === selectedModel)) return;
    const installed = profiles.find((profile) => profile.installed);
    const fallback = installed?.id ?? profiles[0].id;
    if (fallback && fallback !== selectedModel) {
      setSelectedModel(fallback);
      updateSettings({ audioTranscription: { ...audioSettings, preferredModelId: fallback } });
    }
  }, [profiles, selectedModel, updateSettings, audioSettings]);

  useEffect(() => {
    if (audioSettings.preferredModelId && audioSettings.preferredModelId !== selectedModel) {
      setSelectedModel(audioSettings.preferredModelId);
    }
  }, [audioSettings.preferredModelId, selectedModel]);

  useEffect(() => {
    if (audioSettings.language && audioSettings.language !== language) {
      setLanguage(audioSettings.language);
    }
  }, [audioSettings.language, language]);

  useEffect(() => {
    if (audioSettings.provider !== selectedProvider) {
      setSelectedProvider(audioSettings.provider);
    }
  }, [audioSettings.provider, selectedProvider]);

  useEffect(() => {
    setAutoStatus(getVideoTranscriptionStatus(documentId));
    const unsubscribe = subscribeVideoTranscriptionStatus(documentId, (status) => {
      setAutoStatus(status);
      if (status === "completed") {
        loadTranscript();
      }
    });
    return unsubscribe;
  }, [documentId, loadTranscript]);

  const handleGenerateTranscript = async () => {
    if (selectedProvider === 'local' && !isTauri()) {
      toast.error("Desktop app required", "Local video transcription only works in the Tauri app.");
      return;
    }
    if (!filePath) {
      toast.error("Missing file path", "This video does not have a local file path.");
      return;
    }
    if (selectedProvider === 'local' && !selectedModel) {
      toast.error("Model required", "Select a Whisper model in Settings → Audio Transcription.");
      return;
    }
    if (selectedProvider === 'groq' && !isGroqConfigured()) {
      toast.error("Groq API key required", "Add your Groq API key in Settings → Audio Transcription.");
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    try {
      await enqueueVideoTranscription({
        documentId,
        filePath,
        documentTitle: resolvedTitle,
        provider: selectedProvider,
        modelId: selectedProvider === 'local' ? selectedModel : undefined,
        language,
      });
      toast.success("Transcription queued", "Your video will be transcribed in the background.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate transcript";
      setGenerationError(message);
      toast.error("Transcription failed", message);
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">Loading transcript...</div>
      </div>
    );
  }

  const autoInProgress = autoStatus === "queued" || autoStatus === "processing";
  const autoFailed = autoStatus === "failed";
  const autoNeedsModel = autoStatus === "needs-model";
  const autoNeedsApiKey = autoStatus === "needs-api-key";
  const autoFileTooLarge = autoStatus === "file-too-large";

  if (transcript.length === 0) {
    return (
      <div className="space-y-4">
        {autoInProgress && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-primary text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              Transcribing in the background…
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              This transcript will appear automatically when processing completes.
            </p>
          </div>
        )}

        {autoNeedsModel && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <p className="font-medium">Model required for auto-transcription</p>
            <p className="mt-1 text-amber-800/90">
              Download a model in Settings → Audio Transcription to enable background transcription.
            </p>
          </div>
        )}
        {autoNeedsApiKey && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-xs text-orange-900">
            <p className="font-medium">Groq API key required</p>
            <p className="mt-1 text-orange-800/90">
              Add your Groq API key in Settings → Audio Transcription to use cloud transcription.
            </p>
          </div>
        )}
        {autoFileTooLarge && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
            <p className="font-medium">File too large</p>
            <p className="mt-1 text-blue-800/90">
              {isTauri()
                ? "This video exceeds Groq's 25MB free tier limit. Switch to Local Whisper in settings."
                : "This video is too large to transcribe in the web app. Please use the desktop app for large files."}
            </p>
          </div>
        )}

        <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 via-background to-muted/40 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Generate a transcript</p>
              <p className="text-xs text-muted-foreground">
                {selectedProvider === 'groq'
                  ? "Groq transcribes quickly in the cloud. Keep watching while it works."
                  : "Whisper runs locally on your machine. Keep watching while it works."}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-muted-foreground">
                Provider
                <select
                  value={selectedProvider}
                  onChange={(e) => {
                    const next = e.target.value as 'local' | 'groq';
                    setSelectedProvider(next);
                    updateSettings({ audioTranscription: { ...audioSettings, provider: next } });
                  }}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="local">Local Whisper</option>
                  <option value="groq">Groq Cloud</option>
                </select>
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                {selectedProvider === 'groq' ? "Groq Model" : "Model"}
                {selectedProvider === 'groq' ? (
                  <select
                    value={audioSettings.groq.model}
                    onChange={(e) =>
                      updateSettings({
                        audioTranscription: {
                          ...audioSettings,
                          groq: { ...audioSettings.groq, model: e.target.value as 'whisper-large-v3' | 'whisper-large-v3-turbo' },
                        },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="whisper-large-v3-turbo">Whisper Large V3 Turbo (Fastest)</option>
                    <option value="whisper-large-v3">Whisper Large V3 (Most Accurate)</option>
                  </select>
                ) : (
                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      const next = e.target.value;
                      setSelectedModel(next);
                      updateSettings({ audioTranscription: { ...audioSettings, preferredModelId: next } });
                    }}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    {profiles.length === 0 && (
                      <option value="distil-small.en">Distil Small (English)</option>
                    )}
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Language
                <select
                  value={language}
                  onChange={(e) => {
                    const next = e.target.value;
                    setLanguage(next);
                    updateSettings({ audioTranscription: { ...audioSettings, language: next } });
                  }}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="en">English</option>
                  <option value="auto">Auto detect</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="pt">Portuguese</option>
                  <option value="it">Italian</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                  <option value="zh">Chinese</option>
                </select>
              </label>
            </div>

            <button
              onClick={handleGenerateTranscript}
              disabled={isGenerating || autoInProgress || !filePath}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Transcribing…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Transcript
                </>
              )}
            </button>

            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="text-xs">
                  Models are managed in <span className="font-medium text-foreground">Settings → Audio Transcription</span>.
                  {documentTitle ? ` This transcript will be saved to “${documentTitle}”.` : " Transcript is saved to this video."}
                </p>
              </div>
            </div>

            {generationError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                {generationError}
              </div>
            )}

            {autoFailed && !generationError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                Background transcription failed. You can try again manually.
              </div>
            )}
          </div>
        </div>

        <div className="text-center py-4">
          <Hash className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-xs text-muted-foreground">
            No transcript available yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {transcript.map((segment, index) => {
        const isActive = Math.abs(currentTime - segment.time) < 1;

        return (
          <button
            key={index}
            onClick={() => onSeek(segment.time)}
            className={`w-full flex items-start gap-2 p-2 rounded-lg text-left transition-colors ${
              isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
            }`}
          >
            <span className="text-xs text-muted-foreground font-mono">
              {formatTime(segment.time)}
            </span>
            <span className="text-sm text-foreground">{segment.text}</span>
          </button>
        );
      })}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
