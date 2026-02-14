/**
 * Modern Lucide icons for tabs
 * Centralized icon registry for consistent tab icons across the application
 */

import {
  LayoutDashboard,
  Library,
  ListTodo,
  Brain,
  BarChart3,
  Settings,
  FileText,
  BookOpen,
  Youtube,
  Globe,
  Rss,
  Newspaper,
  Network,
  Orbit,
  Monitor,
  MessageSquare,
  BookMarked,
  Layers,
  type LucideIcon,
} from "lucide-react";

// Icon configuration with consistent sizing and styling
const createTabIcon = (Icon: LucideIcon, className = "w-4 h-4") => {
  return <Icon className={className} />;
};

// Main navigation tab icons
export const TabIcons = {
  // Main tabs
  dashboard: createTabIcon(LayoutDashboard),
  documents: createTabIcon(Library),
  queue: createTabIcon(ListTodo),
  review: createTabIcon(Brain),
  analytics: createTabIcon(BarChart3),
  settings: createTabIcon(Settings),
  
  // Document type icons
  document: createTabIcon(FileText),
  pdf: createTabIcon(FileText),
  epub: createTabIcon(BookOpen),
  youtube: createTabIcon(Youtube),
  web: createTabIcon(Globe),
  html: createTabIcon(Globe),
  
  // Feature tabs
  rss: createTabIcon(Rss),
  newsletter: createTabIcon(Newspaper),
  knowledgeNetwork: createTabIcon(Network),
  knowledgeSphere: createTabIcon(Orbit),
  webBrowser: createTabIcon(Monitor),
  docQA: createTabIcon(MessageSquare),
  continueReading: createTabIcon(BookMarked),
  queueScroll: createTabIcon(Layers),
};

// Helper to get icon based on file type
export function getIconForFileType(fileType: string): React.ReactNode {
  switch (fileType) {
    case "pdf":
      return TabIcons.pdf;
    case "epub":
      return TabIcons.epub;
    case "youtube":
      return TabIcons.youtube;
    case "html":
      return TabIcons.html;
    default:
      return TabIcons.document;
  }
}

// Re-export individual icons for custom use
export {
  LayoutDashboard,
  Library,
  ListTodo,
  Brain,
  BarChart3,
  Settings,
  FileText,
  BookOpen,
  Youtube,
  Globe,
  Rss,
  Newspaper,
  Network,
  Orbit,
  Monitor,
  MessageSquare,
  BookMarked,
  Layers,
};
