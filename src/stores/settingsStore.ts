import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  createDefaultTTSSettings,
  sanitizeTTSSettings,
  type TTSSettings,
} from "../utils/ttsSettings";
import { normalizeFsrsParameters } from "../utils/fsrsParameters";

/**
 * FSRS Algorithm Parameters
 */
export interface FSRSParams {
  desiredRetention: number;
  maximumInterval: number;
  personalizedWeights?: number[];
  lastOptimizationAt?: string;
  optimizedReviewCount?: number;
}

export interface FSRSScopeOverride {
  id: string;
  scopeType: "deck" | "tag";
  scopeId: string;
  desiredRetention?: number;
  maximumInterval?: number;
  personalizedWeights?: number[];
  enabled: boolean;
}

/**
 * Postpone Settings (SM-20 algorithm-aware postponement)
 */
export interface PostponeSettings {
  // Item parameters
  itemIncrease: number;
  itemMinIncrease: number;
  itemMaxIncrease: number;
  itemCap: number;
  itemFloor: number;

  // Topic (document) parameters
  topicIncrease: number;
  topicMinIncrease: number;
  topicMaxIncrease: number;
  topicCap: number;
  topicFloor: number;

  // Eligibility thresholds
  minElapsed: number;
  minPriority: number;
  minPriority2: number;
  minStability: number;
  topicPriorityMin: number;
  topicRepMin: number;
  topicElapsedMin: number;

  // Behavior
  randomize: boolean;
  simpleMode: boolean;
  autoPostponeEnabled: boolean;
}

/**
 * Learning Settings
 */
export interface LearningSettings {
  algorithm: "fsrs" | "sm2" | "sm18" | "sm20";
  newCardsPerDay: number;
  reviewsPerDay: number;
  initialInterval: number;
  graduatingInterval: number;
  easyInterval: number;
  lapseSteps: number[];
  lapseInterval: number;
  leechThreshold: number;
  maxReviewTime: number;
  fsrsParams: FSRSParams;
  scopedFsrsOverrides: FSRSScopeOverride[];
  timezone: string;
  postpone: PostponeSettings;
}

/**
 * PDF Settings
 */
interface PDFSettings {
  defaultZoom: number;
  twoPageSpread: boolean;
  showOcrPageBreaks: boolean;
}

/**
 * EPUB Settings
 */
interface EPUBSettings {
  fontSize: number;
  fontFamily: "serif" | "sans-serif" | "monospace";
  lineHeight: number;
  autoScroll: boolean;
}

/**
 * HTML Viewer Settings
 */
interface HTMLSettings {
  fontSize: number;
  fontFamily: "serif" | "sans-serif" | "monospace";
  lineHeight: number;
}

/**
 * Segmentation Settings
 */
interface SegmentationSettings {
  method: "semantic" | "paragraph" | "fixed" | "smart";
  targetLength: number;
  overlap: number;
}

/**
 * OCR Settings
 */
interface OCRSettings {
  provider: "tesseract" | "google" | "aws" | "azure" | "marker" | "nougat" | "glm";
  language: string;
  autoOCR: boolean;
  tesseract_path?: string;
  googleProjectId?: string;
  googleLocation?: string;
  googleProcessorId?: string;
  googleCredentialsPath?: string;
  awsRegion?: string;
  awsAccessKey?: string;
  awsSecretKey?: string;
  azureEndpoint?: string;
  azureApiKey?: string;
  marker_path?: string;
  nougat_path?: string;
  glmEndpoint?: string;
  glmModel?: string;
  glmApiKey?: string;
  glmBackend?: "ollama" | "vllm";
  glmOllamaPath?: string;
  preferLocal: boolean;
  mathOcrEnabled: boolean;
  mathOcrCommand?: string;
  mathOcrModelDir?: string;
  keyPhraseExtraction: boolean;
  autoExtractOnLoad: boolean;
}

/**
 * Document Settings
 */
interface DocumentSettings {
  defaultCategory: string;
  autoProcessOnImport: boolean;
  detectDuplicates: boolean;
  webImportPreserveImages: boolean;
  pdfSettings: PDFSettings;
  epubSettings: EPUBSettings;
  htmlSettings: HTMLSettings;
  segmentation: SegmentationSettings;
  ocr: OCRSettings;
  cacheContent: boolean;
  autoCleanupCache: boolean;
}

/**
 * Appearance Settings
 */
interface AppearanceSettings {
  theme: "light" | "dark" | "system";
  fontSize: number;
  fontFamily: string;
  visualFeedbackEnabled?: boolean;
  themeCustomizations?: {
    primaryColor?: string;
    fontFamily?: string;
  };
}

/**
 * General Settings
 */
interface GeneralSettings {
  language: string;
  startOfWeek: "sunday" | "monday";
  dateFormat: "us" | "iso" | "european";
  restoreSession: boolean;
}

/**
 * Interface Settings
 */
interface InterfaceSettings {
  showSidebar: boolean;
  showStats: boolean;
  compactMode: boolean;
  animationsEnabled: boolean;
  /** Particle density / count multiplier for animated theme backdrops (0.25–8). */
  animationFrequency: number;
  /** Brightness gain stored in tenths, where 10 = 1.0x and 100 = 10.0x. */
  animationBrightness: number;
  reviewZenMode: boolean;
  conversationalReviewEnabled: boolean;
  toolbarPosition: "top" | "left" | "right";
  /**
   * Mouse gesture to duplicate the active tab into a new vertical split.
   * button: 0=left, 1=middle (wheel), 2=right
   */
  splitViewSpawn: {
    button: 0 | 1 | 2;
    modifier: "none" | "ctrl" | "alt" | "shift" | "meta";
  };
}

/**
 * AI Controls Settings (auto-generation, summarization, context window)
 */
export interface AIControlsSettings {
  autoGenerate: boolean;
  cardsPerExtract: number;
  qualityThreshold: number;
  requireApproval: boolean;
  autoSummarize: boolean;
  summaryLength: "short" | "medium" | "long";
  includeSummaryInCards: boolean;
  maxTokensPerRequest: number;
  contextFromRelatedCards: boolean;
  documentSnippetLength: number;
}

/**
 * AI Settings
 */
interface AISettings {
  enabled: boolean;
  provider: "openai" | "anthropic" | "openrouter" | "ollama";
  model: string;
  apiKey?: string;
  temperature: number;
  maxTokens: number;
  ollamaBaseUrl?: string;
  // PWA-only: floating voice assistant button while reading documents.
  pwaAssistantButtonEnabled: boolean;
  pwaAssistantButtonSide: "left" | "right";
  aiControls: AIControlsSettings;
  memoryEnabled: boolean;
}

/**
 * Sync Settings
 */
interface SyncSettings {
  enabled: boolean;
  provider: "dropbox" | "google-drive" | "onedrive";
  interval: number;
  onStartup: boolean;
  lastSync?: string;
  /** Auto-download behavior for files from other devices */
  autoDownloadMode: "always" | "wifi-only" | "manual";
}

/**
 * Import/Export Settings
 */
interface ImportExportSettings {
  autoBackup: boolean;
  backupInterval: number;
  includeMedia: boolean;
}

/**
 * Notification Settings
 */
interface NotificationSettings {
  enabled: boolean;
  studyReminders: boolean;
  reminderTime: string;
  dueDateReminders: boolean;
  soundEnabled: boolean;
  notificationSound: string;
  soundVolume: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  showBadge: boolean;
  feedbackSoundsEnabled: boolean;
  feedbackVolume: number;
}

/**
 * Privacy Settings
 */
interface PrivacySettings {
  telemetryEnabled: boolean;
  crashReportsEnabled: boolean;
  analyticsEnabled: boolean;
}

/**
 * Groq Transcription Settings
 */
interface GroqTranscriptionSettings {
  apiKey: string;
  model: "whisper-large-v3" | "whisper-large-v3-turbo";
  useFreeTier: boolean;
  usage: {
    lastResetDate: string;
    audioSecondsProcessed: number;
    requestsMade: number;
  };
}

/**
 * Audio Transcription Settings
 */
interface AudioTranscriptionSettings {
  provider: "local" | "groq";
  autoTranscription: boolean;
  autoTranscribeLocalVideos: boolean;
  preferredModelId?: string;
  language: string;
  timestampGeneration: boolean;
  speakerDiarization: boolean;
  confidenceScores: boolean;
  confidenceThreshold: number;
  groq: GroqTranscriptionSettings;
}

/**
 * Smart Queue Settings
 */
interface SmartQueueSettings {
  autoRefresh: boolean;
  refreshInterval: number;
  queueStrategyPreset: string;
  sessionItemTypes?: {
    documents?: boolean;
    extracts?: boolean;
    learningItems?: boolean;
  };
}

/**
 * Scroll Queue Settings
 */
interface ScrollQueueSettings {
  flashcardPercentage: number; // 0-100, percentage of queue that should be flashcards
  extractsCountAsFlashcards: boolean; // Whether extracts count towards the flashcard percentage
}

/**
 * RSS Queue Settings
 */
export interface RSSQueueSettings {
  /** Whether to include RSS items in the main queue at all */
  includeInQueue: boolean;
  /** Percentage of queue items that should be RSS (0-100) */
  percentage: number;
  /** Maximum number of RSS items to include per session (0 = unlimited) */
  maxItemsPerSession: number;
  /** Hide RSS items older than this many days (0 = no limit) */
  maxItemAgeDays: number;
  /** Specific feed IDs to include in the queue (empty = all feeds) */
  includedFeedIds: string[];
  /** Feed IDs explicitly excluded from the queue */
  excludedFeedIds: string[];
  /** Whether to only include unread items */
  unreadOnly: boolean;
  /** Whether to prefer newer items */
  preferRecent: boolean;
  /** Show cover images in the article reader by default */
  showCoverImage?: boolean;
}

export interface PodcastQueueSettings {
  /** Whether to include podcast episodes in the scroll queue */
  includeInQueue: boolean;
  /** Maximum number of podcast episodes to include per session (0 = unlimited) */
  maxItemsPerSession: number;
  /** Whether to only include unplayed episodes */
  unreadOnly: boolean;
}

/**
 * RSS Summary Settings
 */
export interface RSSSummarySettings {
  /** Display mode: modern or terminal */
  mode: "modern" | "terminal";
  /** Default summary length */
  defaultLength: "brief" | "medium" | "detailed";
  /** Default focus area */
  defaultFocus: "key-points" | "actionable" | "background";
  /** Panel width in pixels */
  panelWidth: number;
  /** Panel position: left or right */
  panelPosition: "left" | "right";
  /** Whether panel is visible by default */
  autoOpen: boolean;
}

/**
 * YouTube API Settings
 */
interface YouTubeSettings {
  apiKey?: string;
  enabled: boolean;
}

/**
 * Feature Flags
 */
interface FeatureFlags {
  notebooklmEnabled: boolean;
  fsrsScopedParametersEnabled: boolean;
  reviewUndoEnabled: boolean;
  cramModeEnabled: boolean;
}

/**
 * Main Settings Interface
 */
export interface Settings {
  general: GeneralSettings;
  appearance: AppearanceSettings;
  interface: InterfaceSettings;
  learning: LearningSettings;
  documents: DocumentSettings;
  ai: AISettings;
  sync: SyncSettings;
  importExport: ImportExportSettings;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  audioTranscription: AudioTranscriptionSettings;
  smartQueue: SmartQueueSettings;
  tts: TTSSettings;
  scrollQueue: ScrollQueueSettings;
  rssQueue: RSSQueueSettings;
  podcastQueue: PodcastQueueSettings;
  rssSummary: RSSSummarySettings;
  youtube: YouTubeSettings;
  features: FeatureFlags;
}

/**
 * Default Settings
 */
export const defaultSettings: Settings = {
  general: {
    language: "en",
    startOfWeek: "monday",
    dateFormat: "iso",
    restoreSession: true,
  },
  appearance: {
    theme: "system",
    fontSize: 14,
    fontFamily: "Inter",
  },
  interface: {
    showSidebar: true,
    showStats: true,
    compactMode: false,
    animationsEnabled: true,
    animationFrequency: 1,
    animationBrightness: 12,
    reviewZenMode: false,
    conversationalReviewEnabled: true,
    toolbarPosition: "left",
    splitViewSpawn: { button: 1, modifier: "none" },
  },
  learning: {
    algorithm: "fsrs",
    newCardsPerDay: 20,
    reviewsPerDay: 100,
    initialInterval: 0,
    graduatingInterval: 1,
    easyInterval: 4,
    lapseSteps: [10, 20, 30],
    lapseInterval: 1,
    leechThreshold: 8,
    maxReviewTime: 60,
    fsrsParams: {
      desiredRetention: 0.9,
      maximumInterval: 36500,
    },
    scopedFsrsOverrides: [],
    timezone: "auto",
    postpone: {
      itemIncrease: 50,
      itemMinIncrease: 1,
      itemMaxIncrease: 365,
      itemCap: 365,
      itemFloor: 1,
      topicIncrease: 40,
      topicMinIncrease: 1,
      topicMaxIncrease: 200,
      topicCap: 180,
      topicFloor: 1,
      minElapsed: 30,
      minPriority: 50,
      minPriority2: 60,
      minStability: 30,
      topicPriorityMin: 60,
      topicRepMin: 10,
      topicElapsedMin: 14,
      randomize: true,
      simpleMode: false,
      autoPostponeEnabled: false,
    },
  },
  documents: {
    defaultCategory: "Uncategorized",
    autoProcessOnImport: false,
    detectDuplicates: true,
    webImportPreserveImages: true,
    pdfSettings: {
      defaultZoom: 1.0,
      twoPageSpread: false,
      showOcrPageBreaks: false,
    },
    epubSettings: {
      fontSize: 16,
      fontFamily: "serif",
      lineHeight: 1.6,
      autoScroll: true,
    },
    htmlSettings: {
      fontSize: 16,
      fontFamily: "serif",
      lineHeight: 1.6,
    },
    segmentation: {
      method: "semantic",
      targetLength: 200,
      overlap: 20,
    },
    ocr: {
      provider: "tesseract",
      language: "eng",
      autoOCR: false,
      tesseract_path: undefined,
      googleProjectId: undefined,
      googleLocation: "us",
      googleProcessorId: undefined,
      googleCredentialsPath: undefined,
      awsRegion: "us-east-1",
      awsAccessKey: undefined,
      awsSecretKey: undefined,
      azureEndpoint: undefined,
      azureApiKey: undefined,
      marker_path: undefined,
      nougat_path: undefined,
      glmEndpoint: "http://localhost:11434/v1",
      glmModel: "",
      glmApiKey: undefined,
      glmBackend: "ollama",
      glmOllamaPath: undefined,
      preferLocal: true,
      mathOcrEnabled: false,
      mathOcrCommand: "nougat",
      mathOcrModelDir: undefined,
      keyPhraseExtraction: false,
      autoExtractOnLoad: false,
    },
    cacheContent: true,
    autoCleanupCache: false,
  },
  ai: {
    enabled: false,
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 4096,
    pwaAssistantButtonEnabled: true,
    pwaAssistantButtonSide: "right",
    aiControls: {
      autoGenerate: false,
      cardsPerExtract: 5,
      qualityThreshold: 0.0,
      requireApproval: false,
      autoSummarize: false,
      summaryLength: "medium",
      includeSummaryInCards: false,
      maxTokensPerRequest: 4096,
      contextFromRelatedCards: false,
      documentSnippetLength: 2000,
    },
    memoryEnabled: false,
  },
  sync: {
    enabled: false,
    provider: "dropbox",
    interval: 3600,
    onStartup: false,
    autoDownloadMode: "wifi-only",
  },
  importExport: {
    autoBackup: false,
    backupInterval: 86400,
    includeMedia: false,
  },
  notifications: {
    enabled: false,
    studyReminders: false,
    reminderTime: "09:00",
    dueDateReminders: true,
    soundEnabled: true,
    notificationSound: "default",
    soundVolume: 0.5,
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    showBadge: true,
    feedbackSoundsEnabled: false,
    feedbackVolume: 0.3,
  },
  privacy: {
    telemetryEnabled: false,
    crashReportsEnabled: false,
    analyticsEnabled: false,
  },
  audioTranscription: {
    provider: "local",
    autoTranscription: false,
    autoTranscribeLocalVideos: true,
    preferredModelId: "distil-small.en",
    language: "en",
    timestampGeneration: true,
    speakerDiarization: false,
    confidenceScores: false,
    confidenceThreshold: 0.7,
    groq: {
      apiKey: "",
      model: "whisper-large-v3-turbo",
      useFreeTier: true,
      usage: {
        lastResetDate: new Date().toISOString(),
        audioSecondsProcessed: 0,
        requestsMade: 0,
      },
    },
  },
  smartQueue: {
    autoRefresh: false,
    refreshInterval: 60,
    queueStrategyPreset: "maximize-retention",
    sessionItemTypes: {
      documents: true,
      extracts: false,
      learningItems: false,
    },
  },
  tts: createDefaultTTSSettings(),
  scrollQueue: {
    flashcardPercentage: 30, // 30% of queue should be flashcards by default
    extractsCountAsFlashcards: true, // Extracts count towards the flashcard percentage
  },
  rssQueue: {
    includeInQueue: true,
    percentage: 20, // 20% of queue should be RSS by default
    maxItemsPerSession: 10, // Max 10 RSS items per session
    maxItemAgeDays: 2, // Hide RSS items older than 2 days by default
    includedFeedIds: [], // Empty = all feeds included by default
    excludedFeedIds: [], // No feeds excluded by default
    unreadOnly: true, // Only include unread items
    preferRecent: true, // Prefer newer items
    showCoverImage: false, // Hide cover images by default
  },
  podcastQueue: {
    includeInQueue: false,
    maxItemsPerSession: 10,
    unreadOnly: true,
  },
  rssSummary: {
    mode: "modern",
    defaultLength: "medium",
    defaultFocus: "key-points",
    panelWidth: 320,
    panelPosition: "right",
    autoOpen: false,
  },
  youtube: {
    apiKey: undefined,
    enabled: false,
  },
  features: {
    notebooklmEnabled: false,
    fsrsScopedParametersEnabled: true,
    reviewUndoEnabled: true,
    cramModeEnabled: true,
  },
};

/**
 * Settings Store State
 */
interface SettingsState {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;
  updateSettingsCategory: <K extends keyof Settings>(
    category: K,
    updates: Partial<Settings[K]>
  ) => void;
  resetSettings: () => void;
  resetCategory: <K extends keyof Settings>(category: K) => void;
}

/**
 * Settings Store
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,

      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),

      updateSettingsCategory: (category, updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [category]: { ...state.settings[category], ...updates },
          },
        })),

      resetSettings: () => set({ settings: defaultSettings }),

      resetCategory: (category) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [category]: { ...defaultSettings[category] },
          },
        })),
    }),
    {
      name: "incrementum-settings",
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        return persisted as SettingsState;
      },
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return;
        const persisted = state.settings || defaultSettings;
        const persistedFsrsParams = persisted.learning?.fsrsParams;
        const normalizedGlobalWeights = normalizeFsrsParameters(
          persistedFsrsParams?.personalizedWeights
        );
        const normalizedScopedOverrides = Array.isArray(persisted.learning?.scopedFsrsOverrides)
          ? persisted.learning.scopedFsrsOverrides.map((entry) => ({
              ...entry,
              personalizedWeights: normalizeFsrsParameters(entry.personalizedWeights),
            }))
          : defaultSettings.learning.scopedFsrsOverrides;
        const merged: Settings = {
          ...defaultSettings,
          ...persisted,
          general: { ...defaultSettings.general, ...persisted.general },
          appearance: { ...defaultSettings.appearance, ...persisted.appearance },
          interface: { ...defaultSettings.interface, ...persisted.interface },
          learning: {
            ...defaultSettings.learning,
            ...persisted.learning,
            fsrsParams: {
              ...defaultSettings.learning.fsrsParams,
              ...persistedFsrsParams,
              personalizedWeights: normalizedGlobalWeights,
            },
            scopedFsrsOverrides: normalizedScopedOverrides,
          },
          documents: {
            ...defaultSettings.documents,
            ...persisted.documents,
            pdfSettings: {
              ...defaultSettings.documents.pdfSettings,
              ...persisted.documents?.pdfSettings,
            },
            epubSettings: {
              ...defaultSettings.documents.epubSettings,
              ...persisted.documents?.epubSettings,
            },
            htmlSettings: {
              ...defaultSettings.documents.htmlSettings,
              ...persisted.documents?.htmlSettings,
            },
            segmentation: {
              ...defaultSettings.documents.segmentation,
              ...persisted.documents?.segmentation,
            },
            ocr: {
              ...defaultSettings.documents.ocr,
              ...persisted.documents?.ocr,
            },
          },
          ai: { ...defaultSettings.ai, ...persisted.ai, aiControls: { ...defaultSettings.ai.aiControls, ...persisted.ai?.aiControls } },
          sync: { ...defaultSettings.sync, ...persisted.sync },
          importExport: { ...defaultSettings.importExport, ...persisted.importExport },
          notifications: { ...defaultSettings.notifications, ...persisted.notifications },
          privacy: { ...defaultSettings.privacy, ...persisted.privacy },
          audioTranscription: {
            ...defaultSettings.audioTranscription,
            ...persisted.audioTranscription,
            groq: {
              ...defaultSettings.audioTranscription.groq,
              ...persisted.audioTranscription?.groq,
              usage: {
                ...defaultSettings.audioTranscription.groq.usage,
                ...persisted.audioTranscription?.groq?.usage,
              },
            },
          },
          smartQueue: { ...defaultSettings.smartQueue, ...persisted.smartQueue },
          tts: sanitizeTTSSettings(persisted.tts),
          scrollQueue: { ...defaultSettings.scrollQueue, ...persisted.scrollQueue },
          rssQueue: { ...defaultSettings.rssQueue, ...persisted.rssQueue },
          podcastQueue: { ...defaultSettings.podcastQueue, ...persisted.podcastQueue },
          rssSummary: { ...defaultSettings.rssSummary, ...persisted.rssSummary },
          youtube: { ...defaultSettings.youtube, ...persisted.youtube },
          features: { ...defaultSettings.features, ...persisted.features },
        };

        if (!Array.isArray(merged.learning.lapseSteps)) {
          merged.learning.lapseSteps = defaultSettings.learning.lapseSteps;
        }
        if (!Array.isArray(merged.rssQueue.includedFeedIds)) {
          merged.rssQueue.includedFeedIds = [];
        }
        if (!Array.isArray(merged.rssQueue.excludedFeedIds)) {
          merged.rssQueue.excludedFeedIds = [];
        }
        if (
          typeof merged.rssQueue.maxItemAgeDays !== "number" ||
          merged.rssQueue.maxItemAgeDays < 0
        ) {
          merged.rssQueue.maxItemAgeDays = defaultSettings.rssQueue.maxItemAgeDays;
        }
        if (!merged.documents.ocr.language) {
          merged.documents.ocr.language = defaultSettings.documents.ocr.language;
        }

        state.settings = merged;
      },
    }
  )
);
