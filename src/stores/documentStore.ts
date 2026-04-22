import { create } from "zustand";
import { Document, Extract } from "../types";
import * as documentsApi from "../api/documents";
import * as segmentationApi from "../api/segmentation";
import { useCollectionStore } from "./collectionStore";
import { useSettingsStore } from "./settingsStore";
import { importFromUrl as importFromUrlUtil, importFromArxiv as importFromArxivUtil } from "../utils/documentImport";
import { listen, isTauri } from "../lib/tauri";
import { useToastStore } from "../components/common/Toast";
import { ToastType } from "../components/common/Toast";

interface DocumentState {
  // Data
  documents: Document[];
  currentDocument: Document | null;
  extracts: Extract[];
  currentExtract: Extract | null;

  // UI State
  isLoading: boolean;
  isSaving: boolean;
  isImporting: boolean;
  isSegmenting: boolean;
  importProgress: {
    current: number;
    total: number;
    fileName?: string;
  };
  error: string | null;
  searchQuery: string;

  // Optimistic state tracking
  pendingDeletions: Set<string>;
  pendingUpdates: Map<string, Partial<Document>>;

  // Pagination
  currentPage: number;
  totalPages: number;

  // Actions
  loadDocuments: () => Promise<void>;
  setDocuments: (documents: Document[]) => void;
  setCurrentDocument: (document: Document | null) => void;
  addDocument: (document: Document) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  updateDocumentOptimistic: (id: string, updates: Partial<Document>) => Promise<{ success: boolean; error?: Error }>;
  deleteDocument: (id: string) => Promise<void>;
  deleteDocumentOptimistic: (id: string) => Promise<{ success: boolean; error?: Error; rollback?: () => void }>;
  rollbackDocumentDeletion: (id: string, document: Document) => void;
  importFromFile: (filePath: string) => Promise<Document>;
  importFromFiles: (filePaths: string[]) => Promise<Document[]>;
  importFromUrl: (url: string) => Promise<Document>;
  importFromArxiv: (arxivIdOrUrl: string, format?: 'pdf' | 'html') => Promise<Document>;
  openFilePickerAndImport: () => Promise<Document[]>;
  segmentDocument: (documentId: string, fileType?: string) => Promise<number>;
  setExtracts: (extracts: Extract[]) => void;
  setCurrentExtract: (extract: Extract | null) => void;
  addExtract: (extract: Extract) => void;
  updateExtract: (id: string, updates: Partial<Extract>) => void;
  deleteExtract: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setCurrentPage: (page: number) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setImporting: (importing: boolean) => void;
  setImportProgress: (current: number, total: number, fileName?: string) => void;
  setError: (error: string | null) => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  // Initial State
  documents: [],
  currentDocument: null,
  extracts: [],
  currentExtract: null,
  isLoading: false,
  isSaving: false,
  isImporting: false,
  isSegmenting: false,
  importProgress: { current: 0, total: 0 },
  error: null,
  searchQuery: "",
  currentPage: 1,
  totalPages: 1,
  pendingDeletions: new Set(),
  pendingUpdates: new Map(),

  // Actions
  loadDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      const docs = await documentsApi.getDocuments();
      useCollectionStore.getState().ensureDocumentsAssigned(docs);
      set({ documents: docs, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load documents",
        isLoading: false,
      });
    }
  },

  setDocuments: (documents) => set({ documents }),

  setCurrentDocument: (document) =>
    set({
      currentDocument: document,
      currentPage: document?.currentPage || 1,
      totalPages: document?.totalPages || 1,
    }),

  addDocument: (document) =>
    set((state) => {
      const { activeCollectionId, assignDocument } = useCollectionStore.getState();
      if (activeCollectionId) {
        assignDocument(document.id, activeCollectionId);
      }
      return { documents: [...state.documents, document] };
    }),

  updateDocument: (id, updates) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === id ? { ...doc, ...updates, dateModified: new Date().toISOString() } : doc
      ),
      currentDocument:
        state.currentDocument?.id === id
          ? { ...state.currentDocument, ...updates, dateModified: new Date().toISOString() }
          : state.currentDocument,
    })),

  deleteDocument: async (id) => {
    await documentsApi.deleteDocument(id);
    set((state) => ({
      documents: state.documents.filter((doc) => doc.id !== id),
      currentDocument: state.currentDocument?.id === id ? null : state.currentDocument,
    }));
  },

  /**
   * Optimistic delete - removes from UI immediately, rolls back on failure
   */
  deleteDocumentOptimistic: async (id) => {
    // Capture the document for potential rollback
    const docToDelete = get().documents.find((doc) => doc.id === id);
    if (!docToDelete) {
      return { success: false, error: new Error('Document not found') };
    }

    // Optimistically remove from UI
    set((state) => ({
      documents: state.documents.filter((doc) => doc.id !== id),
      currentDocument: state.currentDocument?.id === id ? null : state.currentDocument,
      pendingDeletions: new Set(state.pendingDeletions).add(id),
    }));

    try {
      // Execute server deletion
      await documentsApi.deleteDocument(id);

      // Remove from pending on success
      set((state) => {
        const newPending = new Set(state.pendingDeletions);
        newPending.delete(id);
        return { pendingDeletions: newPending };
      });

      return { success: true };
    } catch (error) {
      // Rollback on failure
      set((state) => {
        const newPending = new Set(state.pendingDeletions);
        newPending.delete(id);
        return {
          documents: [...state.documents, docToDelete],
          pendingDeletions: newPending,
        };
      });

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        rollback: () => {
          set((state) => ({
            documents: [...state.documents, docToDelete],
          }));
        },
      };
    }
  },

  /**
   * Rollback a document deletion
   */
  rollbackDocumentDeletion: (id, document) => {
    set((state) => ({
      documents: [...state.documents, document],
      pendingDeletions: (() => {
        const newPending = new Set(state.pendingDeletions);
        newPending.delete(id);
        return newPending;
      })(),
    }));
  },

  /**
   * Optimistic update - applies changes immediately, rolls back on failure
   */
  updateDocumentOptimistic: async (id, updates) => {
    // Capture current state for rollback
    const currentDoc = get().documents.find((doc) => doc.id === id);
    if (!currentDoc) {
      return { success: false, error: new Error('Document not found') };
    }

    const originalDoc = { ...currentDoc };

    // Optimistically apply update
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === id ? { ...doc, ...updates, dateModified: new Date().toISOString() } : doc
      ),
      currentDocument:
        state.currentDocument?.id === id
          ? { ...state.currentDocument, ...updates, dateModified: new Date().toISOString() }
          : state.currentDocument,
      pendingUpdates: new Map(state.pendingUpdates).set(id, updates),
    }));

    try {
      // Execute server update
      await documentsApi.updateDocument(id, { ...currentDoc, ...updates } as Document);

      // Remove from pending on success
      set((state) => {
        const newPending = new Map(state.pendingUpdates);
        newPending.delete(id);
        return { pendingUpdates: newPending };
      });

      return { success: true };
    } catch (error) {
      // Rollback on failure
      set((state) => ({
        documents: state.documents.map((doc) =>
          doc.id === id ? originalDoc : doc
        ),
        currentDocument:
          state.currentDocument?.id === id ? originalDoc : state.currentDocument,
        pendingUpdates: (() => {
          const newPending = new Map(state.pendingUpdates);
          newPending.delete(id);
          return newPending;
        })(),
      }));

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  importFromFile: async (filePath) => {
    set({ isImporting: true, error: null });
    try {
      const doc = await documentsApi.importDocument(filePath);
      const { activeCollectionId, assignDocument } = useCollectionStore.getState();
      if (activeCollectionId) {
        assignDocument(doc.id, activeCollectionId);
      }
      set((state) => ({
        documents: [...state.documents, doc],
        isImporting: false,
      }));

      // Auto-segment if enabled
      const settings = useSettingsStore.getState().settings;
      if (settings.documents.autoProcessOnImport) {
        await get().segmentDocument(doc.id, doc.fileType);
      }

      return doc;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to import document",
        isImporting: false,
      });
      throw error;
    }
  },

  importFromFiles: async (filePaths) => {
    set({ isImporting: true, error: null, importProgress: { current: 0, total: filePaths.length } });
    const imported: Document[] = [];
    const settings = useSettingsStore.getState().settings;
    const autoSegment = settings.documents.autoProcessOnImport;
    let totalExtracts = 0;

    try {
      for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i];
        const fileName = filePath.split('/').pop() || filePath;

        set({
          importProgress: { current: i, total: filePaths.length, fileName }
        });

        try {
          const doc = await documentsApi.importDocument(filePath);
          imported.push(doc);
          const { activeCollectionId, assignDocument } = useCollectionStore.getState();
          if (activeCollectionId) {
            assignDocument(doc.id, activeCollectionId);
          }

          if (autoSegment) {
            set({ isSegmenting: true });
            const count = await get().segmentDocument(doc.id, doc.fileType);
            totalExtracts += count;
            set({ isSegmenting: false });
          }
        } catch (error) {
          console.error(`Failed to import ${fileName}:`, error);
        }

        set({
          importProgress: { current: i + 1, total: filePaths.length, fileName }
        });
      }

      set((state) => ({
        documents: [...state.documents, ...imported],
        isImporting: false,
        isSegmenting: false,
        importProgress: { current: imported.length, total: filePaths.length }
      }));

      // Show summary toast for multi-file auto-segmentation
      if (autoSegment && totalExtracts > 0) {
        useToastStore.getState().addToast({
          type: ToastType.Success,
          title: "Import complete",
          message: `${imported.length} document${imported.length !== 1 ? "s" : ""} imported, ${totalExtracts} extract${totalExtracts !== 1 ? "s" : ""} created`,
        });
      }

      return imported;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to import documents",
        isImporting: false,
        isSegmenting: false,
        importProgress: { current: 0, total: 0 }
      });
      throw error;
    }
  },

  openFilePickerAndImport: async () => {
    const filePaths = await documentsApi.openFilePicker({ multiple: true });
    if (!filePaths || filePaths.length === 0) {
      return [];
    }
    return get().importFromFiles(filePaths);
  },

  segmentDocument: async (documentId: string, fileType?: string) => {
    const settings = useSettingsStore.getState().settings;
    const { segmentation } = settings.documents;
    const toast = useToastStore.getState();

    set({ isSegmenting: true });

    try {
      const config: segmentationApi.SegmentationConfig = {
        method: segmentation.method,
        targetLength: segmentation.targetLength,
        overlap: segmentation.overlap,
      };

      console.log("[segmentDocument] Segmenting document", documentId, "with config:", config, "fileType:", fileType);

      const extractIds = await segmentationApi.autoSegmentAndCreateExtracts(documentId, config);
      console.log("[segmentDocument] Created", extractIds.length, "extracts");

      toast.addToast({
        type: ToastType.Success,
        title: "Segmentation complete",
        message: `${extractIds.length} extract${extractIds.length !== 1 ? "s" : ""} created`,
      });

      await get().loadDocuments();
      return extractIds.length;
    } catch (error) {
      console.error("[segmentDocument] Failed:", error);
      toast.addToast({
        type: ToastType.Error,
        title: "Segmentation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
      return 0;
    } finally {
      set({ isSegmenting: false });
    }
  },

  importFromUrl: async (url) => {
    console.log('[DocumentStore] Starting URL import:', url);
    set({ isImporting: true, error: null, importProgress: { current: 0, total: 1, fileName: `Fetching ${url}...` } });

    try {
      // Use existing utility to fetch and create document data
      console.log('[DocumentStore] Fetching content from URL...');
      const docData = await importFromUrlUtil(url, { preserveImages: true });
      console.log('[DocumentStore] Got docData:', docData);

      // Create document in backend
      console.log('[DocumentStore] Creating document in backend...');
      const doc = await documentsApi.createDocument(
        docData.title,
        docData.filePath,
        docData.fileType
      );
      console.log('[DocumentStore] Created document:', doc);

      // Prepare full update with all document data including FSRS fields
      const fullUpdate: Partial<Document> = {
        content: docData.content,
        tags: docData.tags,
        category: docData.category,
        metadata: docData.metadata,
        priorityRating: docData.priorityRating,
        prioritySlider: docData.prioritySlider,
        priorityScore: docData.priorityScore,
        // FSRS fields - new documents start fresh
        nextReadingDate: docData.nextReadingDate,
        stability: docData.stability,
        difficulty: docData.difficulty,
        reps: docData.reps,
        totalTimeSpent: docData.totalTimeSpent,
      };

      // Persist content separately for Tauri (update_document doesn't store content)
      if (docData.content && docData.content.trim().length > 0) {
        try {
          const updatedContentDoc = await documentsApi.updateDocumentContent(doc.id, docData.content);
          Object.assign(doc, updatedContentDoc);
        } catch (contentError) {
          console.warn("[DocumentStore] Failed to persist document content:", contentError);
        }
      }

      // Update document with all fields
      console.log('[DocumentStore] Updating document with full data...');
      try {
        const updatedDoc = await documentsApi.updateDocument(doc.id, fullUpdate as Document);
        console.log('[DocumentStore] Document updated with full data');
        Object.assign(doc, updatedDoc);
      } catch (updateError) {
        console.warn('[DocumentStore] Failed to update document fully:', updateError);
      }

      // Add to state and assign to active collection
      const { activeCollectionId, assignDocument } = useCollectionStore.getState();
      if (activeCollectionId) {
        console.log('[DocumentStore] Assigning to collection:', activeCollectionId);
        assignDocument(doc.id, activeCollectionId);
      }

      console.log('[DocumentStore] Adding to state, current doc count:', get().documents.length);
      set((state) => ({
        documents: [...state.documents, doc],
        isImporting: false,
        importProgress: { current: 1, total: 1, fileName: docData.title }
      }));
      console.log('[DocumentStore] Import complete, new doc count:', get().documents.length);

      return doc;
    } catch (error) {
      console.error('[DocumentStore] Import failed:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to import from URL',
        isImporting: false,
        importProgress: { current: 0, total: 0 }
      });
      throw error;
    }
  },

  importFromArxiv: async (arxivIdOrUrl, format: 'pdf' | 'html' = 'pdf') => {
    set({ isImporting: true, error: null, importProgress: { current: 0, total: 2, fileName: 'Fetching paper metadata...' } });

    try {
      // Use existing utility to fetch from Arxiv
      const docData = await importFromArxivUtil(arxivIdOrUrl, format);

      set({ importProgress: { current: 1, total: 2, fileName: 'Creating document...' } });

      // Create document in backend
      const doc = await documentsApi.createDocument(
        docData.title,
        docData.filePath,
        docData.fileType
      );

      // Add to state and assign to active collection
      const { activeCollectionId, assignDocument } = useCollectionStore.getState();
      if (activeCollectionId) {
        assignDocument(doc.id, activeCollectionId);
      }

      set((state) => ({
        documents: [...state.documents, doc],
        isImporting: false,
        importProgress: { current: 2, total: 2, fileName: docData.title }
      }));

      return doc;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to import from Arxiv',
        isImporting: false,
        importProgress: { current: 0, total: 0 }
      });
      throw error;
    }
  },


  setExtracts: (extracts) => set({ extracts }),

  setCurrentExtract: (extract) => set({ currentExtract: extract }),

  addExtract: (extract) =>
    set((state) => ({
      extracts: [...state.extracts, extract],
    })),

  updateExtract: (id, updates) =>
    set((state) => ({
      extracts: state.extracts.map((ext) =>
        ext.id === id ? { ...ext, ...updates, dateModified: new Date().toISOString() } : ext
      ),
      currentExtract:
        state.currentExtract?.id === id
          ? { ...state.currentExtract, ...updates, dateModified: new Date().toISOString() }
          : state.currentExtract,
    })),

  deleteExtract: (id) =>
    set((state) => ({
      extracts: state.extracts.filter((ext) => ext.id !== id),
      currentExtract: state.currentExtract?.id === id ? null : state.currentExtract,
    })),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setCurrentPage: (currentPage) => set({ currentPage }),

  setLoading: (isLoading) => set({ isLoading }),

  setSaving: (isSaving) => set({ isSaving: isSaving }),

  setImporting: (isImporting) => set({ isImporting }),

  setImportProgress: (current, total, fileName) => set({ importProgress: { current, total, fileName } }),

  setError: (error) => set({ error }),
}));

// Listen for browser extension save events (Tauri only)
if (isTauri()) {
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;

  listen<{ document_id: string; title: string; url: string }>(
    "browser-sync://document-saved",
    (event) => {
      const { title } = event.payload;

      // Show toast notification
      useToastStore.getState().addToast({
        type: ToastType.Success,
        title: "Page saved to Incrementum",
        message: title || undefined,
      });

      // Debounce document list refresh (500ms)
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        useDocumentStore.getState().loadDocuments();
        reloadTimer = null;
      }, 500);
    }
  ).catch((err) => {
    console.warn("[DocumentStore] Failed to register listener for browser-sync://document-saved:", err);
  });
}
