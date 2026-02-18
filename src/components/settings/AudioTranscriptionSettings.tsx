import React, { useEffect, useMemo, useState } from "react";
import { 
  Mic, Languages, Download, Trash2, CheckCircle2, Loader2, Info, AlertCircle,
  Cloud, Zap, Settings2, Key, TrendingUp, Clock, AlertTriangle, Check,
  ExternalLink, Monitor, Lock
} from "lucide-react";
import { useTranscriptionStore } from "../../stores/useTranscriptionStore";
import { downloadTranscriptionModel, deleteTranscriptionModel } from "../../api/transcription";
import { useSettingsStore } from "../../stores/settingsStore";
import { isTauri } from "../../lib/tauri";
import { 
  isGroqConfigured, 
  validateGroqApiKey, 
  getUsageStats, 
  getRateLimitStatus,
  GROQ_FREE_TIER,
  GROQ_PRICING,
  type UsageStats 
} from "../../api/groqTranscription";
import { cn } from "../../utils";

type Provider = 'local' | 'groq';

export function AudioTranscriptionSettings() {
  const { profiles, fetchProfiles, downloadProgress, currentStatus } = useTranscriptionStore();
  const { settings, updateSettings } = useSettingsStore();
  const audioSettings = settings.audioTranscription;
  const isDesktop = isTauri();
  const [activeTab, setActiveTab] = useState<Provider>(audioSettings.provider);
  
  // Local state for form inputs
  const [apiKeyInput, setApiKeyInput] = useState(audioSettings.groq.apiKey);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [isKeyValid, setIsKeyValid] = useState(false);

  const handleUpdateSettings = (updates: Partial<typeof audioSettings>) => {
    updateSettings({ audioTranscription: { ...audioSettings, ...updates } });
  };

  const handleUpdateGroqSettings = (updates: Partial<typeof audioSettings.groq>) => {
    updateSettings({
      audioTranscription: {
        ...audioSettings,
        groq: { ...audioSettings.groq, ...updates },
      },
    });
  };

  useEffect(() => {
    fetchProfiles().catch(() => undefined);
  }, [fetchProfiles]);

  // In web/PWA mode, force provider to 'groq' since local is not available
  useEffect(() => {
    if (!isDesktop && audioSettings.provider !== 'groq') {
      handleUpdateSettings({ provider: 'groq' });
      setActiveTab('groq');
    }
  }, [isDesktop, audioSettings.provider]);

  // Update usage stats periodically when Groq is selected
  useEffect(() => {
    if (activeTab === 'groq') {
      setUsageStats(getUsageStats());
      const interval = setInterval(() => {
        setUsageStats(getUsageStats());
      }, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Validate API key when input changes
  useEffect(() => {
    if (apiKeyInput) {
      const validation = validateGroqApiKey(apiKeyInput);
      setApiKeyError(validation.valid ? null : validation.message || 'Invalid API key');
      setIsKeyValid(validation.valid);
    } else {
      setApiKeyError(null);
      setIsKeyValid(false);
    }
  }, [apiKeyInput]);

  // Check if API key is configured
  useEffect(() => {
    setIsKeyValid(isGroqConfigured());
  }, [audioSettings.groq.apiKey]);

  const handleDownload = async (id: string) => {
    try {
      await downloadTranscriptionModel(id);
      fetchProfiles();
    } catch (error) {
      console.error("Failed to download model:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTranscriptionModel(id);
      fetchProfiles();
    } catch (error) {
      console.error("Failed to delete model:", error);
    }
  };

  const handleSaveApiKey = () => {
    const validation = validateGroqApiKey(apiKeyInput);
    if (validation.valid) {
      handleUpdateGroqSettings({ apiKey: apiKeyInput });
      setUsageStats(getUsageStats());
    }
  };

  const handleProviderChange = (provider: Provider) => {
    setActiveTab(provider);
    handleUpdateSettings({ provider });
  };

  const hasInstalledModel = useMemo(
    () => profiles.some((profile) => profile.installed),
    [profiles]
  );

  const hasDownloadInProgress = useMemo(
    () => Object.values(downloadProgress).some((progress) => progress > 0 && progress < 100),
    [downloadProgress]
  );

  useEffect(() => {
    if (profiles.length === 0) return;
    if (audioSettings.preferredModelId && profiles.some((profile) => profile.id === audioSettings.preferredModelId)) return;
    const installed = profiles.find((profile) => profile.installed);
    const fallback = installed?.id ?? profiles[0].id;
    if (fallback && fallback !== audioSettings.preferredModelId) {
      handleUpdateSettings({ preferredModelId: fallback });
    }
  }, [profiles, audioSettings.preferredModelId]);

  const rateLimitStatus = getRateLimitStatus();
  const groqModel = audioSettings.groq.model;

  return (
    <div className="p-6 max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Mic className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">Audio Transcription</h3>
          <p className="text-sm text-muted-foreground">
            {isDesktop 
              ? "Choose your preferred transcription provider" 
              : "Cloud-based transcription for your audio and video files"
            }
          </p>
        </div>
      </div>

      {/* Web/PWA Notice - Only show in browser */}
      {!isDesktop && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Monitor className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-blue-900">Desktop App Recommended</p>
              <p className="text-sm text-blue-800/90 mt-1">
                For the best transcription experience, use the desktop app which supports:
              </p>
              <ul className="text-sm text-blue-800/90 mt-2 ml-4 list-disc">
                <li>Local Whisper transcription (fully offline)</li>
                <li>Large file chunking for Groq transcription</li>
                <li>Background transcription processing</li>
              </ul>
              <p className="text-sm text-blue-800/90 mt-2">
                In the web app, only direct Groq transcription of smaller files is available.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Provider Selection Tabs - Only show tabs on desktop */}
      {isDesktop ? (
        <div className="flex gap-2 p-1 bg-muted rounded-xl">
          <button
            onClick={() => handleProviderChange('local')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all",
              activeTab === 'local'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
            )}
          >
            <Settings2 className="w-4 h-4" />
            Local Whisper
          </button>
          <button
            onClick={() => handleProviderChange('groq')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all",
              activeTab === 'groq'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
            )}
          >
            <Cloud className="w-4 h-4" />
            Groq Cloud
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-600 rounded-full">
              Free Tier
            </span>
          </button>
        </div>
      ) : (
        /* In web mode, just show a label indicating Groq is being used */
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 rounded-xl border border-border">
          <Cloud className="w-5 h-5 text-primary" />
          <div>
            <p className="font-medium text-foreground">Groq Cloud Transcription</p>
            <p className="text-xs text-muted-foreground">
              Using Groq&apos;s fast cloud-based Whisper API
            </p>
          </div>
          <span className="ml-auto px-2 py-0.5 text-[10px] bg-green-500/20 text-green-600 rounded-full">
            Active
          </span>
        </div>
      )}

      {/* Local Whisper Settings - Desktop only */}
      {isDesktop && activeTab === 'local' && (
        <div className="space-y-8">
          {/* Auto-Transcription Toggle */}
          <section className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Mic className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Auto-transcribe local videos</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically generate transcripts for newly imported local videos in the background
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={audioSettings.autoTranscribeLocalVideos}
                  onChange={(e) => handleUpdateSettings({ autoTranscribeLocalVideos: e.target.checked })}
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
              <div className="space-y-1">
                <p className="font-medium">Resource warning</p>
                <p className="text-amber-800/90">
                  Background transcription can use significant CPU and battery on laptops. You can disable
                  auto-transcription at any time.
                </p>
              </div>
            </div>
          </section>

          {/* Default Model Selection */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Languages className="w-5 h-5 text-muted-foreground" />
              <h4 className="font-semibold text-foreground">Default Transcription Model</h4>
            </div>
            <label className="text-xs font-medium text-muted-foreground">
              Preferred model for auto-transcribe and quick actions
              <select
                value={audioSettings.preferredModelId || ''}
                onChange={(e) => handleUpdateSettings({ preferredModelId: e.target.value })}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                disabled={profiles.length === 0}
              >
                {profiles.length === 0 && (
                  <option value="">No models available</option>
                )}
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}{profile.installed ? " (Installed)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {/* Model Prompt */}
          {audioSettings.autoTranscribeLocalVideos && !hasInstalledModel && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
              <p className="font-semibold">Download a model to enable auto-transcription</p>
              <p className="text-xs text-muted-foreground mt-1">
                Choose a model below. Each model includes a short description to help you decide.
              </p>
              {hasDownloadInProgress && (
                <p className="text-xs text-muted-foreground mt-2">
                  A download is already in progress. Transcription will start after it finishes.
                </p>
              )}
            </div>
          )}

          {/* Model Selection */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Languages className="w-5 h-5 text-muted-foreground" />
              <h4 className="font-semibold text-foreground">Models & Profiles</h4>
            </div>
            
            <div className="grid gap-4">
              {profiles.map((profile) => {
                const progress = downloadProgress[profile.id];
                const isDownloading = progress !== undefined && progress < 100 && currentStatus === 'downloading';
                const isInstalled = profile.installed || progress === 100;
                
                return (
                  <div 
                    key={profile.id}
                    className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-foreground">{profile.name}</span>
                        {progress === 100 && !isDownloading && (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{profile.description}</p>
                      <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
                        <span>{(profile.size_bytes / 1024 / 1024).toFixed(0)} MB</span>
                        <span>•</span>
                        <span>SHA256: {profile.sha256.substring(0, 8)}...</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isDownloading ? (
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2 text-xs font-medium text-primary">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Downloading {Math.round(progress)}%</span>
                          </div>
                          <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      ) : isInstalled ? (
                        <button
                          onClick={() => handleDelete(profile.id)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          title="Delete model"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDownload(profile.id)}
                          disabled={currentStatus === 'downloading'}
                          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Info & Requirements */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <Info className="w-5 h-5" />
              <h5 className="font-bold">Offline & Private</h5>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Transcription happens entirely on your machine. Your audio files are never sent to any server. 
              The first-time setup requires downloading the models above.
            </p>
            <div className="pt-2 flex flex-wrap gap-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Min. 8GB RAM recommended</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>AVX/AVX2 support required</span>
              </div>
            </div>
            
            {/* GPU Support Info */}
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-medium text-foreground mb-2">GPU Acceleration</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  <span><strong>Apple Silicon (M1/M2/M3):</strong> Metal GPU acceleration enabled automatically</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  <span><strong>Linux + NVIDIA:</strong> CUDA acceleration enabled if drivers installed</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span><strong>Windows:</strong> CPU only (GPU support coming soon)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                  <span><strong>Intel Mac:</strong> CPU only (no Metal on Intel)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Groq Cloud Settings - Shown on both desktop and web */}
      {(activeTab === 'groq' || !isDesktop) && (
        <div className="space-y-8">
          {/* Groq Introduction */}
          <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-orange-600">
              <Zap className="w-5 h-5" />
              <h5 className="font-bold">Fast Cloud Transcription</h5>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Groq provides ultra-fast transcription powered by their LPU (Language Processing Unit) infrastructure. 
              Perfect for quickly transcribing videos and podcasts without using local resources.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="px-2 py-1 bg-orange-500/20 text-orange-700 text-xs rounded-full font-medium">
                ⚡ 200x faster than real-time
              </span>
              <span className="px-2 py-1 bg-green-500/20 text-green-700 text-xs rounded-full font-medium">
                🎁 Generous free tier
              </span>
              <span className="px-2 py-1 bg-purple-500/20 text-purple-700 text-xs rounded-full font-medium">
                📁 Unlimited file size (auto-chunking)
              </span>
              <span className="px-2 py-1 bg-blue-500/20 text-blue-700 text-xs rounded-full font-medium">
                🔒 API key never leaves your device
              </span>
            </div>
          </div>

          {/* Privacy Reminder - New! */}
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Lock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-green-900">Your Data Stays Private</p>
              <p className="text-sm text-green-800/90 mt-1">
                Even though transcription happens in the cloud, your API key and all transcripts 
                are stored locally on your device. Groq only receives the audio data temporarily 
                for processing and does not retain it.
              </p>
            </div>
          </div>

          {/* API Key Configuration */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-muted-foreground" />
              <h4 className="font-semibold text-foreground">API Configuration</h4>
            </div>
            
            <div className="space-y-3">
              {/* API Key Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Groq API Key
                  {isKeyValid && (
                    <span className="ml-2 text-green-600 text-xs font-normal flex items-center gap-1 inline-flex">
                      <Check className="w-3 h-3" />
                      Configured
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="gsk_..."
                      className={cn(
                        "w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground pr-20",
                        apiKeyError ? "border-red-500" : "border-border",
                        isKeyValid && "border-green-500"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? "Hide" : "Show"}
                    </button>
                  </div>
                  <button
                    onClick={handleSaveApiKey}
                    disabled={!apiKeyInput || !!apiKeyError || apiKeyInput === audioSettings.groq.apiKey}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                </div>
                {apiKeyError && (
                  <p className="text-xs text-red-500">{apiKeyError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Your API key is stored locally and never shared. 
                  <a 
                    href="https://console.groq.com/keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5 ml-1"
                  >
                    Get a free API key <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>

              {/* Model Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Model</label>
                <select
                  value={audioSettings.groq.model}
                  onChange={(e) => handleUpdateGroqSettings({ model: e.target.value as 'whisper-large-v3' | 'whisper-large-v3-turbo' })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="whisper-large-v3-turbo">
                    Whisper Large V3 Turbo - ${GROQ_PRICING['whisper-large-v3-turbo']}/hour (Fastest)
                  </option>
                  <option value="whisper-large-v3">
                    Whisper Large V3 - ${GROQ_PRICING['whisper-large-v3']}/hour (Most Accurate)
                  </option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {audioSettings.groq.model === 'whisper-large-v3-turbo' 
                    ? "Best price-performance ratio. Recommended for most use cases."
                    : "State-of-the-art accuracy. Best for error-sensitive applications."}
                </p>
              </div>
            </div>
          </section>

          {/* Usage Stats */}
          {isKeyValid && usageStats && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
                <h4 className="font-semibold text-foreground">Usage This Month</h4>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    Audio Processed
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {(usageStats.audioSecondsProcessed / 60).toFixed(0)} min
                  </p>
                  <p className="text-xs text-muted-foreground">
                    of {Math.floor(GROQ_FREE_TIER.AUDIO_SECONDS_PER_DAY / 60)} min free daily limit
                  </p>
                </div>
                
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Estimated Cost
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    ${usageStats.estimatedCost.toFixed(4)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    if you exceed free tier
                  </p>
                </div>
              </div>

              {/* Daily Remaining */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Daily Audio Remaining</span>
                  <span className="font-medium">
                    {Math.floor(usageStats.remainingDailySeconds / 60)} min
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500",
                      usageStats.remainingDailySeconds < 3600 ? "bg-red-500" :
                      usageStats.remainingDailySeconds < 7200 ? "bg-amber-500" : "bg-green-500"
                    )}
                    style={{ 
                      width: `${Math.min(100, (usageStats.remainingDailySeconds / GROQ_FREE_TIER.AUDIO_SECONDS_PER_DAY) * 100)}%` 
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Daily Requests Remaining</span>
                  <span className="font-medium">
                    {usageStats.remainingDailyRequests.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500",
                      usageStats.remainingDailyRequests < 100 ? "bg-red-500" :
                      usageStats.remainingDailyRequests < 500 ? "bg-amber-500" : "bg-green-500"
                    )}
                    style={{ 
                      width: `${Math.min(100, (usageStats.remainingDailyRequests / GROQ_FREE_TIER.REQUESTS_PER_DAY) * 100)}%` 
                    }}
                  />
                </div>
              </div>

              {/* Rate Limit Warnings */}
              {rateLimitStatus.isLimited && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Approaching Free Tier Limits</p>
                    <p className="text-red-800/90 text-xs mt-1">{rateLimitStatus.message}</p>
                  </div>
                </div>
              )}
              
              {!rateLimitStatus.isLimited && rateLimitStatus.isWarning && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <Info className="mt-0.5 h-4 w-4 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Free Tier Usage</p>
                    <p className="text-amber-800/90 text-xs mt-1">{rateLimitStatus.message}</p>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Language Selection */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Languages className="w-5 h-5 text-muted-foreground" />
              <h4 className="font-semibold text-foreground">Language</h4>
            </div>
            <select
              value={audioSettings.language}
              onChange={(e) => handleUpdateSettings({ language: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="auto">Auto-detect</option>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
              <option value="nl">Dutch</option>
              <option value="pl">Polish</option>
              <option value="ru">Russian</option>
              <option value="ja">Japanese</option>
              <option value="zh">Chinese</option>
              <option value="ko">Korean</option>
              <option value="ar">Arabic</option>
              <option value="hi">Hindi</option>
              <option value="tr">Turkish</option>
              <option value="vi">Vietnamese</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Specifying a language improves accuracy and speed. &quot;Auto-detect&quot; works for most cases.
            </p>
          </section>

          {/* Free Tier Info */}
          <div className="bg-muted/50 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-foreground">
              <Info className="w-4 h-4" />
              <h5 className="font-medium text-sm">Free Tier Limits (Resets Daily)</h5>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-muted-foreground">{GROQ_FREE_TIER.REQUESTS_PER_MINUTE} requests/min</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-muted-foreground">{GROQ_FREE_TIER.REQUESTS_PER_DAY.toLocaleString()} requests/day</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-muted-foreground">{GROQ_FREE_TIER.AUDIO_SECONDS_PER_DAY / 3600} hours audio/day</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-muted-foreground">{GROQ_FREE_TIER.MAX_FILE_SIZE_MB}MB per request</span>
              </div>
            </div>
            <div className="pt-2 border-t border-border space-y-2">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">💡 Large file support:</span> Files over 25MB are automatically split into chunks and transcribed seamlessly. No file size limits!
              </p>
              <p className="text-xs text-muted-foreground">
                For most users, the free tier covers ~8 hours of audio per day. 
                If you need more, consider upgrading at{' '}
                <a 
                  href="https://console.groq.com/settings/billing" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  console.groq.com
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
