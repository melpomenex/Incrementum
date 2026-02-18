/**
 * Transcription API Key Dialog
 * 
 * Provides an inline, contextual dialog for entering Groq API key
 * without requiring navigation to the settings page.
 * 
 * This maintains perfect UX by keeping the user in context.
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  ExternalLink, 
  Check, 
  AlertCircle, 
  Zap,
  Shield,
  Info
} from 'lucide-react';
import { cn } from '../../utils';
import { useSettingsStore } from '../../stores/settingsStore';
import { 
  validateGroqApiKey, 
  GROQ_FREE_TIER,
  GROQ_PRICING 
} from '../../api/groqTranscription';

export interface TranscriptionKeyDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Called when dialog is closed */
  onClose: () => void;
  /** Called when API key is successfully saved */
  onSaved: () => void;
  /** Document title being transcribed (for context) */
  documentTitle?: string;
}

/**
 * Transcription Key Dialog
 * 
 * Inline API key configuration that doesn't require navigating away.
 */
export function TranscriptionKeyDialog({
  isOpen,
  onClose,
  onSaved,
  documentTitle,
}: TranscriptionKeyDialogProps) {
  const { settings, updateSettings } = useSettingsStore();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validation, setValidation] = useState<{ valid: boolean; message?: string }>({ valid: false });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setApiKey(settings.audioTranscription.groq.apiKey || '');
      setShowKey(false);
      setSaveSuccess(false);
      setIsSaving(false);
    }
  }, [isOpen, settings.audioTranscription.groq.apiKey]);

  // Validate key as user types
  useEffect(() => {
    if (apiKey) {
      setValidation(validateGroqApiKey(apiKey));
    } else {
      setValidation({ valid: false });
    }
  }, [apiKey]);

  const handleSave = async () => {
    if (!validation.valid) return;
    
    setIsSaving(true);
    
    // Update settings
    updateSettings({
      audioTranscription: {
        ...settings.audioTranscription,
        provider: 'groq',
        groq: {
          ...settings.audioTranscription.groq,
          apiKey: apiKey.trim(),
        },
      },
    });
    
    // Show success briefly then close
    setSaveSuccess(true);
    setTimeout(() => {
      onSaved();
    }, 800);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl">
              <Key className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Transcription Setup
              </h2>
              <p className="text-sm text-muted-foreground">
                Quick setup to transcribe your media
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Context */}
          {documentTitle && (
            <div className="p-3 bg-muted/50 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground">
                Transcribing: <span className="font-medium text-foreground">{documentTitle}</span>
              </p>
            </div>
          )}

          {/* Groq Info Card */}
          <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-orange-600">
              <Zap className="w-4 h-4" />
              <h3 className="font-semibold">Fast Cloud Transcription</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Groq provides ultra-fast AI transcription. Your API key is stored 
              locally and never shared.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-orange-500/20 text-orange-700 text-xs rounded-full font-medium">
                ⚡ 200x faster than real-time
              </span>
              <span className="px-2 py-1 bg-green-500/20 text-green-700 text-xs rounded-full font-medium">
                🎁 Generous free tier
              </span>
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              Groq API Key
              {validation.valid && (
                <span className="text-green-600 text-xs font-normal flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Valid
                </span>
              )}
            </label>
            
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="gsk_..."
                className={cn(
                  'w-full rounded-lg border bg-background px-3 py-2.5 pr-20 text-sm text-foreground focus:outline-none focus:ring-2 transition-all',
                  validation.valid 
                    ? 'border-green-500 focus:ring-green-500/20' 
                    : apiKey && !validation.valid
                    ? 'border-red-500 focus:ring-red-500/20'
                    : 'border-border focus:ring-primary/20'
                )}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            
            {apiKey && !validation.valid && validation.message && (
              <div className="flex items-center gap-1.5 text-xs text-red-500">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{validation.message}</span>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Don&apos;t have an API key?{' '}
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                Get one free from Groq
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          {/* Privacy Note */}
          <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <Shield className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-green-800/90">
              Your API key is stored only on your device. Audio is sent to Groq 
              temporarily for processing and is not retained.
            </p>
          </div>

          {/* Free Tier Info */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2 bg-muted/50 rounded-lg">
              <span className="text-muted-foreground">Daily limit:</span>
              <p className="font-medium text-foreground">
                {Math.floor(GROQ_FREE_TIER.AUDIO_SECONDS_PER_DAY / 3600)} hours
              </p>
            </div>
            <div className="p-2 bg-muted/50 rounded-lg">
              <span className="text-muted-foreground">Cost:</span>
              <p className="font-medium text-foreground">
                ${GROQ_PRICING['whisper-large-v3-turbo']}/hour
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!validation.valid || isSaving}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
              validation.valid && !isSaving
                ? 'bg-primary text-primary-foreground hover:opacity-90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : saveSuccess ? (
              <>
                <Check className="w-4 h-4" />
                Saved!
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                Save & Start Transcription
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact inline API key input for embedding in other components
 */
export function InlineTranscriptionKeyInput({
  onSaved,
  className,
}: {
  onSaved: () => void;
  className?: string;
}) {
  const { settings, updateSettings } = useSettingsStore();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validation, setValidation] = useState<{ valid: boolean; message?: string }>({ valid: false });

  useEffect(() => {
    if (apiKey) {
      setValidation(validateGroqApiKey(apiKey));
    } else {
      setValidation({ valid: false });
    }
  }, [apiKey]);

  const handleSave = () => {
    if (!validation.valid) return;
    
    updateSettings({
      audioTranscription: {
        ...settings.audioTranscription,
        provider: 'groq',
        groq: {
          ...settings.audioTranscription.groq,
          apiKey: apiKey.trim(),
        },
      },
    });
    
    onSaved();
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2 text-sm text-amber-600">
        <Info className="w-4 h-4" />
        <span className="font-medium">Groq API key required for transcription</span>
      </div>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="gsk_..."
            className={cn(
              'w-full rounded-lg border bg-background px-3 py-2 pr-16 text-sm text-foreground focus:outline-none focus:ring-2 transition-all',
              validation.valid 
                ? 'border-green-500 focus:ring-green-500/20' 
                : apiKey && !validation.valid
                ? 'border-red-500 focus:ring-red-500/20'
                : 'border-border focus:ring-primary/20'
            )}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={!validation.valid}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
      
      <p className="text-xs text-muted-foreground">
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-0.5"
        >
          Get free API key
          <ExternalLink className="w-3 h-3" />
        </a>
        {' '}• Stored locally on your device
      </p>
    </div>
  );
}
