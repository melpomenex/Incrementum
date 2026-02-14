import { DocumentsView } from "../documents/DocumentsView";
import { useTabsStore } from "../../stores";
import { DocumentViewer } from "./TabRegistry";
import type { Document } from "../../types/document";
import { FileText, BookOpen, Youtube } from "lucide-react";

export function DocumentsTab() {
  const { addTab } = useTabsStore();

  const handleOpenDocument = (doc: Document) => {
    addTab({
      title: doc.title,
      icon: doc.fileType === "pdf" ? <FileText className="w-4 h-4 text-red-500" /> 
        : doc.fileType === "epub" ? <BookOpen className="w-4 h-4 text-blue-500" /> 
        : doc.fileType === "youtube" ? <Youtube className="w-4 h-4 text-red-600" /> 
        : <FileText className="w-4 h-4 text-muted-foreground" />,
      type: "document-viewer",
      content: DocumentViewer,
      closable: true,
      data: { documentId: doc.id },
    });
  };

  return <DocumentsView onOpenDocument={handleOpenDocument} enableYouTubeImport />;
}
