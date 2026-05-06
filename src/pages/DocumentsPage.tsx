import { DocumentsView } from "../components/documents/DocumentsView";
import { DocumentViewer } from "../components/tabs/TabRegistry";
import { AudiobookEpubSyncView } from "../components/viewer/AudiobookEpubSyncView";
import { useTabsStore } from "../stores";
import type { Document } from "../types/document";

export function DocumentsPage() {
  const { addTab } = useTabsStore();

  const handleOpenDocument = (doc: Document) => {
    addTab({
      title: doc.title,
      icon: doc.fileType === "pdf" ? "📕" : doc.fileType === "epub" ? "📖" : doc.fileType === "youtube" ? "📺" : "📄",
      type: "document-viewer",
      content: DocumentViewer,
      closable: true,
      data: { documentId: doc.id },
    });
  };

  const handleReadAlong = (audioDoc: Document, epubDoc: Document) => {
    addTab({
      title: `${audioDoc.title} — Read Along`,
      icon: "🎧",
      type: "audiobook-epub-sync",
      content: AudiobookEpubSyncView,
      closable: true,
      data: { audioDocumentId: audioDoc.id, epubDocumentId: epubDoc.id },
    });
  };

  return <DocumentsView onOpenDocument={handleOpenDocument} onReadAlong={handleReadAlong} enableYouTubeImport />;
}
