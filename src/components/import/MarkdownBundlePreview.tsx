/**
 * Markdown Bundle Preview Component
 *
 * Displays a preview of a markdown bundle before import,
 * showing metadata, image count, and content preview.
 */

import { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Image as ImageIcon,
  Clock,
  Tag,
  User,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { MarkdownBundle, MarkdownMetadata } from '../../utils/markdownBundleImport';
import { cn } from '../../utils';

interface MarkdownBundlePreviewProps {
  bundle: MarkdownBundle;
  isOpen: boolean;
  onClose: () => void;
  onImport: (options: ImportBundleOptions) => Promise<void>;
}

export interface ImportBundleOptions {
  title: string;
  tags: string[];
  category?: string;
  collectionId?: string;
  priority: number;
}

interface PreviewState {
  loading: boolean;
  error?: string;
  success: boolean;
}

export function MarkdownBundlePreview({
  bundle,
  isOpen,
  onClose,
  onImport,
}: MarkdownBundlePreviewProps) {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [category, setCategory] = useState('Notes');
  const [priority, setPriority] = useState(5);
  const [state, setState] = useState<PreviewState>({ loading: false, success: false });

  // Initialize from bundle metadata
  useEffect(() => {
    if (bundle) {
      setTitle(bundle.metadata?.title || getBaseName(bundle.markdownFile.name));
      setTags(bundle.metadata?.tags || []);
      setCategory('Notes');
      setPriority(5);
      setState({ loading: false, success: false });
    }
  }, [bundle]);

  const handleImport = async () => {
    setState({ loading: true, success: false });

    try {
      await onImport({
        title,
        tags,
        category,
        priority,
      });
      setState({ loading: false, success: true, error: undefined });

      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setState({
        loading: false,
        success: false,
        error: error instanceof Error ? error.message : 'Import failed',
      });
    }
  };

  const handleAddTag = () => {
    const tag = newTag.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setNewTag('');
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

  if (!isOpen) return null;

  const wordCount = bundle.markdownContent.split(/\s+/).filter((w) => w.length > 0).length;
  const readingTime = Math.ceil(wordCount / 250);
  const imageCount = bundle.images.size;
  const previewContent = bundle.markdownContent.slice(0, 500);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            Import Markdown Bundle
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Success state */}
          {state.success && (
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Imported successfully!</span>
            </div>
          )}

          {/* Error state */}
          {state.error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <div>
                <div className="font-medium">Import failed</div>
                <div className="text-sm">{state.error}</div>
              </div>
            </div>
          )}

          {/* Bundle info */}
          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <FileText className="w-4 h-4" />
                <span>Markdown</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <ImageIcon className="w-4 h-4" />
                <span>{imageCount} images</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                <span>{readingTime} min read</span>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {wordCount.toLocaleString()} words
              {bundle.metadata?.author && ` · by ${bundle.metadata.author}`}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Tag className="w-4 h-4 inline mr-1" />
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md text-sm"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-blue-900 dark:hover:text-blue-100"
                    aria-label={`Remove tag ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add tag..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <button
                onClick={handleAddTag}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Add
              </button>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="Notes">Notes</option>
              <option value="Research">Research</option>
              <option value="Documentation">Documentation</option>
              <option value="Personal">Personal</option>
              <option value="Work">Work</option>
            </select>
          </div>

          {/* Content preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Content Preview
            </label>
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto">
              <pre className="whitespace-pre-wrap font-sans">{previewContent}...</pre>
            </div>
          </div>

          {/* Image thumbnails */}
          {imageCount > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Images ({imageCount})
              </label>
              <div className="flex flex-wrap gap-2">
                {Array.from(bundle.images.entries())
                  .slice(0, 5)
                  .map(([path, file]) => (
                    <div
                      key={path}
                      className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center overflow-hidden"
                    >
                      {file.type.startsWith('image/') ? (
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                  ))}
                {imageCount > 5 && (
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center text-sm text-gray-500">
                    +{imageCount - 5}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={state.loading}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={state.loading || !title.trim() || state.success}
            className={cn(
              "px-4 py-2 rounded-lg flex items-center gap-2 min-w-[100px] justify-center",
              state.success
                ? "bg-green-500 text-white"
                : "bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
            )}
          >
            {state.loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : state.success ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Imported
              </>
            ) : (
              'Import'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper
function getBaseName(filename: string): string {
  return filename.replace(/\.(md|markdown)$/i, '').replace(/_metadata$/i, '');
}
