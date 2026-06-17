/**
 * Centralized tab-icon registry.
 *
 * Single source of truth mapping each `TabType` to its Phosphor icon component.
 * The `TabBar` renders the icon for a tab by looking it up via `getTabIcon(tab.type)`
 * rather than reading a stored `tab.icon` value, so every navigation path
 * (keyboard shortcuts, vimium, dashboard quick-actions, mobile nav, session
 * restore, middle-click opens) gets a consistent Phosphor glyph regardless of
 * how the tab was created.
 */

import type { ReactNode } from "react";
import {
  BookOpen,
  Bookmarks,
  Books,
  Brain,
  ChartBar,
  ChatCircle,
  Desktop,
  Files,
  Gear,
  Globe,
  Graph,
  Headphones,
  Image,
  ListChecks,
  Microphone,
  Newspaper,
  Notebook,
  Planet,
  Rss,
  Sparkle,
  SquaresFour,
  Stack,
  TextT,
  YoutubeLogo,
  type Icon,
} from "@phosphor-icons/react";
import type { TabType } from "../../stores/tabsStore";

/**
 * Map every tab type to its Phosphor icon component.
 * Exhaustive over `TabType` so the render layer never needs a fallback at runtime.
 */
export const TAB_TYPE_ICONS: Record<TabType, Icon> = {
  dashboard: SquaresFour,
  "continue-reading": Bookmarks,
  queue: ListChecks,
  "queue-scroll": Stack,
  review: Brain,
  documents: Books,
  "document-viewer": TextT,
  analytics: ChartBar,
  settings: Gear,
  "knowledge-sphere": Planet,
  "knowledge-network": Graph,
  rss: Rss,
  newsletter: Newspaper,
  "web-browser": Desktop,
  "doc-qa": ChatCircle,
  notebooklm: Sparkle,
  "image-registry": Image,
  podcast: Microphone,
  "audiobook-epub-sync": Headphones,
};

/**
 * Render the Phosphor icon for a tab type, sized for the tab strip.
 * Falls back to `Files` for an unrecognized type (defensive — only relevant
 * for stale persisted tabs from older versions).
 */
export function getTabIcon(type: TabType): ReactNode {
  const IconComp = TAB_TYPE_ICONS[type] ?? Files;
  return <IconComp className="w-4 h-4" />;
}

// File-type icon helper for document/doc-row UI.
export function getIconForFileType(fileType: string): ReactNode {
  switch (fileType) {
    case "pdf":
      return <TextT className="w-4 h-4" />;
    case "epub":
      return <BookOpen className="w-4 h-4" />;
    case "youtube":
      return <YoutubeLogo className="w-4 h-4" />;
    case "html":
    case "web":
      return <Globe className="w-4 h-4" />;
    default:
      return <TextT className="w-4 h-4" />;
  }
}

// Re-export individual icons for components that compose their own tab UI.
export {
  BookOpen,
  Bookmarks,
  Books,
  Brain,
  ChartBar,
  ChatCircle,
  Desktop,
  Files,
  Gear,
  Globe,
  Graph,
  Headphones,
  Image,
  ListChecks,
  Microphone,
  Newspaper,
  Notebook,
  Planet,
  Rss,
  Sparkle,
  SquaresFour,
  Stack,
  TextT,
  YoutubeLogo,
};
