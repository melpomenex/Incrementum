/**
 * Video Extracts Components
 *
 * Components for creating, viewing, and managing video extracts
 * - timestamp-linked segments from videos for spaced repetition
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Scissors,
  Plus,
  X,
  Play,
  Clock,
  Tag as TagIcon,
  Trash2,
  Edit,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  BookOpen,
  Layers,
} from 'lucide-react';
import {
  createVideoExtract,
  updateVideoExtract,
  deleteVideoExtract,
  rateVideoExtract,
  getVideoExtracts,
  type VideoExtract,
  type CreateVideoExtractInput,
  formatSeconds,
  formatTimeRange,
  getTranscriptPreview,
  exceedsRecommendedDuration,
  exceedsMaximumDuration,
  getRatingLabel,
  getRatingColor,
} from '../../api/video-extracts';
import { useToast } from '../common/Toast';

// ============================================================================
// Create Video Extract Dialog
// ============================================================================

interface CreateVideoExtractDialogProps {
  documentId: string;
  documentTitle: string;
  isOpen: boolean;
  initialStartTime?: number;
  initialEndTime?: number;
  initialTranscriptText?: string;
  onClose: () => void;
  onCreate?: (extract: VideoExtract) => void;
}

export function CreateVideoExtractDialog({
  documentId,
  documentTitle,
  isOpen,
  initialStartTime = 0,
  initialEndTime = 0,
  initialTranscriptText = '',
  onClose,
  onCreate,
}: CreateVideoExtractDialogProps) {
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime || initialStartTime + 60);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [transcriptText, setTranscriptText] = useState(initialTranscriptText);
  const [addToQueue, setAddToQueue] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setStartTime(initialStartTime);
      setEndTime(initialEndTime || initialStartTime + 60);
      setTitle('');
      setNotes('');
      setTags([]);
      setTagInput('');
      setTranscriptText(initialTranscriptText);
      setAddToQueue(true);
      setError(null);
    }
  }, [isOpen, initialStartTime, initialEndTime, initialTranscriptText]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleCreate = async () => {
    // Validate
    if (startTime < 0) {
      setError('Start time cannot be negative');
      return;
    }
    if (endTime <= startTime) {
      setError('End time must be greater than start time');
      return;
    }
    const duration = endTime - startTime;
    if (duration > 600) {
      setError('Extract duration cannot exceed 10 minutes (600 seconds)');
      return;
    }
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const input: CreateVideoExtractInput = {
        document_id: documentId,
        start_time: startTime,
        end_time: endTime,
        title: title.trim(),
        transcript_text: transcriptText.trim() || undefined,
        notes: notes.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        add_to_queue: addToQueue,
      };

      const extract = await createVideoExtract(input);
      toast.success('Video extract created successfully');
      onCreate?.(extract);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create video extract');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  const duration = endTime - startTime;
  const isLong = duration > 300;
  const isTooLong = duration > 600;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Create Video Extract
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Document Context */}
        <div className="px-4 py-2 bg-muted/30 border-b border-border flex items-center gap-3">
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">{documentTitle}</div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Time Range */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Time Range (seconds)
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Start Time
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={startTime}
                    onChange={(e) => setStartTime(Number(e.target.value))}
                    min={0}
                    step={1}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm text-muted-foreground font-mono">
                    {formatSeconds(startTime)}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  End Time
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={endTime}
                    onChange={(e) => setEndTime(Number(e.target.value))}
                    min={0}
                    step={1}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm text-muted-foreground font-mono">
                    {formatSeconds(endTime)}
                  </span>
                </div>
              </div>
            </div>

            {/* Duration Warning */}
            {duration > 0 && (
              <div className={`mt-2 flex items-center gap-2 text-sm ${
                isTooLong ? 'text-destructive' : isLong ? 'text-amber-600' : 'text-muted-foreground'
              }`}>
                {isTooLong ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : isLong ? (
                  <Clock className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>
                  Duration: {formatSeconds(duration)}
                  {isTooLong && ' - Exceeds 10 minute limit!'}
                  {isLong && !isTooLong && ' - Longer than recommended (5 min)'}
                  {!isLong && ' - Good length'}
                </span>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Introduction to Recursion"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Transcript Text */}
          {transcriptText && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Transcript (auto-filled)
              </label>
              <div className="w-full px-3 py-2 bg-muted/50 border border-border rounded-md text-foreground text-sm max-h-32 overflow-y-auto">
                {transcriptText}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your thoughts, context, or explanations..."
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <TagIcon className="w-4 h-4 inline mr-1" />
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-md transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Add to Queue */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <input
              type="checkbox"
              id="addToQueue"
              checked={addToQueue}
              onChange={(e) => setAddToQueue(e.target.checked)}
              className="w-4 h-4 rounded border-border"
            />
            <label htmlFor="addToQueue" className="flex-1 text-sm text-foreground cursor-pointer">
              <div className="font-medium">Add to Review Queue</div>
              <div className="text-xs text-muted-foreground">
                Schedule this extract for spaced repetition review
              </div>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded-md text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-4 py-2 bg-card border border-border text-foreground rounded-md hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <span className="animate-spin">⏳</span>
                Creating...
              </>
            ) : (
              <>
                <Scissors className="w-4 h-4" />
                Create Extract
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Video Extracts List
// ============================================================================

interface VideoExtractsListProps {
  documentId: string;
  onPlayExtract?: (extract: VideoExtract) => void;
  onEditExtract?: (extract: VideoExtract) => void;
  className?: string;
}

export function VideoExtractsList({
  documentId,
  onPlayExtract,
  onEditExtract,
  className = '',
}: VideoExtractsListProps) {
  const [extracts, setExtracts] = useState<VideoExtract[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const loadExtracts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getVideoExtracts(documentId);
      setExtracts(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load extracts');
    } finally {
      setLoading(false);
    }
  }, [documentId, toast]);

  useEffect(() => {
    loadExtracts();
  }, [loadExtracts]);

  const handleDelete = async (extractId: string) => {
    if (!confirm('Are you sure you want to delete this extract?')) return;

    try {
      await deleteVideoExtract(extractId);
      setExtracts((prev) => prev.filter((e) => e.id !== extractId));
      toast.success('Extract deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete extract');
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <div className="text-sm text-muted-foreground">Loading extracts...</div>
      </div>
    );
  }

  if (extracts.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Scissors className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
        <p className="text-sm text-foreground-secondary">
          No video extracts yet. Create one to add timestamp-linked segments for review.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {extracts.map((extract) => (
        <VideoExtractCard
          key={extract.id}
          extract={extract}
          onPlay={onPlayExtract}
          onEdit={onEditExtract}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Video Extract Card
// ============================================================================

interface VideoExtractCardProps {
  extract: VideoExtract;
  onPlay?: (extract: VideoExtract) => void;
  onEdit?: (extract: VideoExtract) => void;
  onDelete?: (extractId: string) => void;
  onRate?: (extractId: string, rating: number) => void;
  showRating?: boolean;
}

export function VideoExtractCard({
  extract,
  onPlay,
  onEdit,
  onDelete,
  onRate,
  showRating = false,
}: VideoExtractCardProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [ratingResult, setRatingResult] = useState<string | null>(null);

  const handleRate = async (ratingValue: number) => {
    try {
      const result = await rateVideoExtract(extract.id, ratingValue);
      setRating(ratingValue);
      setRatingResult(result);
      onRate?.(extract.id, ratingValue);
    } catch (err) {
      console.error('Failed to rate extract:', err);
    }
  };

  const duration = extract.end_time - extract.start_time;
  const isDue = extract.next_review_date
    ? new Date(extract.next_review_date) <= new Date()
    : false;

  return (
    <div
      className={`p-3 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors group ${
        isDue ? 'ring-1 ring-primary' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <button
          onClick={() => onPlay?.(extract)}
          className="flex-1 text-left"
        >
          <h4 className="text-sm font-medium text-foreground hover:text-primary transition-colors">
            {extract.title}
          </h4>
        </button>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={() => onEdit(extract)}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="Edit extract"
            >
              <Edit className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(extract.id)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors"
              title="Delete extract"
            >
              <Trash2 className="w-3 h-3 text-red-500" />
            </button>
          )}
        </div>
      </div>

      {/* Time Range */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => onPlay?.(extract)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <Play className="w-3 h-3" />
          <span className="font-mono">{formatTimeRange(extract)}</span>
          <span>({formatSeconds(duration)})</span>
        </button>
        {extract.next_review_date && (
          <div className={`flex items-center gap-1 text-xs ${
            isDue ? 'text-primary' : 'text-muted-foreground'
          }`}>
            <Calendar className="w-3 h-3" />
            <span>
              {isDue ? 'Due now' : `Due ${new Date(extract.next_review_date).toLocaleDateString()}`}
            </span>
          </div>
        )}
      </div>

      {/* Transcript Preview */}
      {extract.transcript_text && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
          {getTranscriptPreview(extract, 150)}
        </p>
      )}

      {/* Tags */}
      {extract.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {extract.tags.map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Review Stats */}
      {extract.review_count > 0 && (
        <div className="text-xs text-muted-foreground">
          Reviewed {extract.review_count} time{extract.review_count !== 1 ? 's' : ''}
        </div>
      )}

      {/* Rating Buttons */}
      {showRating && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">Rate:</span>
          {[1, 2, 3, 4].map((r) => (
            <button
              key={r}
              onClick={() => handleRate(r)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                rating === r
                  ? 'text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              style={rating === r ? { backgroundColor: getRatingColor(r) } : {}}
              title={getRatingLabel(r)}
            >
              {getRatingLabel(r)}
            </button>
          ))}
          {ratingResult && (
            <span className="text-xs text-green-600">{ratingResult}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Due Video Extracts Review Component
// ============================================================================

interface DueVideoExtractsReviewProps {
  documentId?: string;
  onComplete?: () => void;
  className?: string;
}

export function DueVideoExtractsReview({
  documentId,
  onComplete,
  className = '',
}: DueVideoExtractsReviewProps) {
  const [extracts, setExtracts] = useState<VideoExtract[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    loadDueExtracts();
  }, [documentId]);

  const loadDueExtracts = async () => {
    setLoading(true);
    try {
      // Filter extracts by due date
      const allExtracts = documentId
        ? await getVideoExtracts(documentId)
        : []; // Would need a get_due_video_extracts API call

      const now = new Date();
      const due = allExtracts.filter(
        (e) => e.next_review_date && new Date(e.next_review_date) <= now
      );

      setExtracts(due);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load due extracts');
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async (rating: number) => {
    const current = extracts[currentIndex];
    if (!current) return;

    try {
      await rateVideoExtract(current.id, rating);

      // Move to next or finish
      if (currentIndex < extracts.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onComplete?.();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to rate extract');
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <div className="text-sm text-muted-foreground">Loading due extracts...</div>
      </div>
    );
  }

  if (extracts.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <p className="text-sm text-foreground-secondary">
          No video extracts due for review!
        </p>
      </div>
    );
  }

  const current = extracts[currentIndex];
  const progress = ((currentIndex + 1) / extracts.length) * 100;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Progress Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} / {extracts.length}
        </span>
      </div>

      {/* Current Extract */}
      {current && (
        <div className="p-4 bg-card border border-border rounded-lg">
          <VideoExtractCard
            extract={current}
            showRating
            onRate={(_, rating) => handleRate(rating)}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Export helper functions for external use
// ============================================================================

export { formatSeconds, formatTimeRange };
