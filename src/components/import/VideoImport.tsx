/**
 * Video Import Component
 * Allows users to import local video files with metadata
 */

import { useState, useCallback } from 'react';
import { Film, Upload, X, FileVideo } from 'lucide-react';
import { invokeCommand, openFilePicker, isTauri } from '../../lib/tauri';
import { useSettingsStore } from '../../stores/settingsStore';
import { enqueueVideoTranscription } from '../../lib/videoTranscriptionQueue';
import type { Document } from '../../types/document';

interface VideoImportProps {
  onImport?: (document: Document) => void;
  onCancel?: () => void;
}

export function VideoImport({ onImport, onCancel }: VideoImportProps) {
  const { settings } = useSettingsStore();
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [title, setTitle] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(async () => {
    if (!isTauri()) {
      setError('Video import is only available in the desktop app');
      return;
    }

    try {
      const paths = await openFilePicker({
        title: 'Select Video File',
        multiple: false,
        filters: [
          { name: 'Video', extensions: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'] }
        ],
      });

      if (paths && paths.length > 0) {
        const selectedPath = paths[0];
        setFilePath(selectedPath);
        // Extract filename from path
        const name = selectedPath.split(/[/\\]/).pop() || selectedPath;
        setFileName(name);
        setTitle(name.replace(/\.[^/.]+$/, '')); // Remove extension
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select file');
    }
  }, []);

  const handleImport = async () => {
    if (!filePath) {
      setError('Please select a file');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Import via Tauri command - pass file path instead of bytes
      const result = await invokeCommand<Document>('import_video_file', {
        sourcePath: filePath,
        title: title.trim(),
      });

      if (settings.audioTranscription.autoTranscribeLocalVideos && result.filePath) {
        void enqueueVideoTranscription({
          documentId: result.id,
          filePath: result.filePath,
          documentTitle: result.title,
          modelId: settings.audioTranscription.preferredModelId,
          language: settings.audioTranscription.language || 'en',
        });
      }

      onImport?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import video');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Import Video</h3>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* File Selection */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Video File
          </label>
          <div className="flex items-center gap-4">
            <div
              onClick={handleFileSelect}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                filePath ? 'border-primary' : 'border-border'
              }`}
            >
              {filePath ? (
                <>
                  <FileVideo className="w-5 h-5 text-primary" />
                  <span className="text-sm truncate">{fileName}</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm">Choose file...</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Video Info */}
        {filePath && (
          <div className="p-3 bg-muted/30 rounded-lg space-y-1">
            <div className="text-sm text-foreground">
              <span className="font-medium">File:</span> {fileName}
            </div>
            <div className="text-sm text-foreground">
              <span className="font-medium">Path:</span> {filePath}
            </div>
          </div>
        )}

        {/* Title Input */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Video title"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleImport}
            disabled={!filePath || !title.trim() || processing}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {processing ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Film className="w-4 h-4" />
                Import Video
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
