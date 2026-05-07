import { lazy, Suspense, type ComponentType } from "react";

// Central registry of all lazy-loaded tab components
// Components use named exports, so we need to convert them to default exports

/** Wrap a lazy import with error logging to identify which module fails to load */
function debugLazy<T extends ComponentType<unknown>>(
  name: string,
  loader: () => Promise<{ default: T }>
) {
  return lazy(() =>
    loader().catch((err) => {
      console.error(`[TabRegistry] Failed to lazy-load "${name}":`, err);
      // Re-throw so React.lazy triggers the error boundary
      throw err;
    })
  );
}

export const DashboardTab = debugLazy("DashboardTab", () => import("./DashboardTab").then(m => ({ default: m.DashboardTab })));
export const ContinueReadingTab = debugLazy("ContinueReadingTab", () => import("./ContinueReadingTab").then(m => ({ default: m.ContinueReadingTab })));
export const QueueTab = debugLazy("QueueTab", () => import("./QueueTab").then(m => ({ default: m.QueueTab })));
export const ReviewTab = debugLazy("ReviewTab", () => import("./ReviewTab").then(m => ({ default: m.ReviewTab })));
export const DocumentsTab = debugLazy("DocumentsTab", () => import("./DocumentsTab").then(m => ({ default: m.DocumentsTab })));
export const AnalyticsTab = debugLazy("AnalyticsTab", () => import("./AnalyticsTab").then(m => ({ default: m.AnalyticsTab })));
export const SettingsTab = debugLazy("SettingsTab", () => import("../settings/SettingsPage").then(m => ({ default: m.SettingsPage })));

export const DocumentViewer = debugLazy("DocumentViewer", () => import("../viewer/DocumentViewerWrapper").then(m => ({ default: m.DocumentViewer })));
export const KnowledgeNetworkTab = debugLazy("KnowledgeNetworkTab", () => import("./knowledge/KnowledgeNetworkTab").then(m => ({ default: m.KnowledgeNetworkTab })));
export const KnowledgeSphereTab = debugLazy("KnowledgeSphereTab", () => import("./knowledge/KnowledgeSphereTab").then(m => ({ default: m.KnowledgeSphereTab })));
export const WebBrowserTab = debugLazy("WebBrowserTab", () => import("./WebBrowserTab").then(m => ({ default: m.WebBrowserTab })));
export const RssTab = debugLazy("RssTab", () => import("./RssTab").then(m => ({ default: m.RssTab })));
export const RSSReader = debugLazy("RSSReader", () => import("../media/RSSReader").then(m => ({ default: m.RSSReader })));
export const NewsletterDirectoryTab = debugLazy("NewsletterDirectoryTab", () => import("../newsletter/NewsletterDirectory").then(m => ({ default: m.NewsletterDirectory })));
export const ScreenshotTab = debugLazy("ScreenshotTab", () => import("./ScreenshotTab").then(m => ({ default: m.ScreenshotTab })));
export const DocumentQATab = debugLazy("DocumentQATab", () => import("./DocumentQATab").then(m => ({ default: m.DocumentQATab })));
export const NotebookLMTab = debugLazy("NotebookLMTab", () => import("../../pages/NotebookLMPage").then(m => ({ default: m.NotebookLMPage })));
export const ImageRegistryTab = debugLazy("ImageRegistryTab", () => import("./ImageRegistryTab").then(m => ({ default: m.ImageRegistryTab })));
export const PodcastTab = debugLazy("PodcastTab", () => import("../media/PodcastManager").then(m => ({ default: m.PodcastManager })));
