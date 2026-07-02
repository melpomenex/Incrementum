/**
 * Mobile Layout Wrapper
 *
 * Wraps the application with mobile-specific components:
 * - PWA install prompt
 * - Offline indicator
 * - Mobile bottom navigation
 */

import { useEffect, useState } from "react";
import { PWAInstallPrompt, OfflineIndicator } from "./PWAComponents";
import { MobileNavigation, PRIMARY_NAV_TAB_TYPES } from "./MobileNavigation";
import { useQueueStore, useTabsStore } from "../../stores";
import type { Pane, TabPane } from "../../stores";
import { useMobileShell } from "../../hooks/useMobileShell";
import { useEdgeSwipeBack } from "../../hooks/useEdgeSwipeBack";
import { useEdgeSwipeForward } from "../../hooks/useEdgeSwipeForward";
import { useSwipeBetweenTabs } from "../../hooks/useSwipeBetweenTabs";

interface MobileLayoutWrapperProps {
  children: React.ReactNode;
}

export function MobileLayoutWrapper({ children }: MobileLayoutWrapperProps) {
  const { items: queueItems } = useQueueStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isMobile = useMobileShell();

  // --- Global mobile navigation gestures ---
  // Edge-swipe back / forward move through the user's tab history; the full-width
  // horizontal swipe cycles between adjacent bottom-nav tabs. All three are
  // disabled in fullscreen reading so they never fight immersive viewers, and
  // useSwipeBetweenTabs itself skips edge-origin and .swipeable-item touches.
  const gesturesDisabled = !isMobile || isFullscreen;

  useEdgeSwipeBack(
    () => {
      useTabsStore.getState().goToPreviousTab();
    },
    { disabled: gesturesDisabled },
  );
  useEdgeSwipeForward(
    () => {
      useTabsStore.getState().goToNextTab();
    },
    { disabled: gesturesDisabled },
  );
  useSwipeBetweenTabs(
    (direction) => {
      const state = useTabsStore.getState();
      // Resolve the currently active tab in the first tab pane (the only pane
      // rendered on mobile).
      const findFirstTabPane = (p: Pane): TabPane | null => {
        if (p.type === "tabs") return p;
        if (p.type === "split") {
          for (const c of p.children) {
            const f = findFirstTabPane(c);
            if (f) return f;
          }
        }
        return null;
      };
      const firstPane = findFirstTabPane(state.rootPane);
      if (!firstPane || !firstPane.activeTabId) return;
      const activeTab = state.tabs.find((t) => t.id === firstPane.activeTabId);
      if (!activeTab) return;
      const order = PRIMARY_NAV_TAB_TYPES;
      const idx = order.indexOf(activeTab.type);
      // If the active tab isn't one of the primary nav tabs, jump to the Queue
      // (index 1) which is the most natural "home" on mobile.
      if (idx === -1) {
        const target = order[1];
        const tab = state.tabs.find((t) => t.type === target);
        if (tab && firstPane.tabIds.includes(tab.id)) {
          state.setActiveTab(firstPane.id, tab.id);
        }
        return;
      }
      const nextIdx =
        (idx + (direction === "left" ? 1 : -1) + order.length) % order.length;
      const targetType = order[nextIdx];
      const tab = state.tabs.find((t) => t.type === targetType);
      if (tab && firstPane.tabIds.includes(tab.id)) {
        state.setActiveTab(firstPane.id, tab.id);
      }
    },
    { disabled: gesturesDisabled },
  );

  // Calculate badge counts
  const dueCount = queueItems.filter(item => {
    if (item.itemType === "document") {
      const doc = item.dueDate ? new Date(item.dueDate) : null;
      return doc && doc <= new Date();
    }
    return false;
  }).length;

  const unreadCount = 0; // TODO: Implement RSS unread count

  useEffect(() => {
    const updateFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    updateFullscreen();
    document.addEventListener("fullscreenchange", updateFullscreen);
    document.addEventListener("webkitfullscreenchange", updateFullscreen as EventListener);

    return () => {
      document.removeEventListener("fullscreenchange", updateFullscreen);
      document.removeEventListener("webkitfullscreenchange", updateFullscreen as EventListener);
    };
  }, []);

  // Desktop (and wide tablets in landscape) render the full tabbed interface.
  // useMobileShell() returns true for native phones/tablets-in-portrait and for
  // narrow browser/PWA windows — including inside the actual native Android/iOS
  // build, where the old `isTauri()` gate used to suppress the mobile shell.
  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <>
      {/* PWA Components */}
      <PWAInstallPrompt />
      <OfflineIndicator />

      {/* Main Content */}
      {/* The top safe-area inset is applied once by the inner .app-shell (via the
          @media (max-width: 1024px) rule in index.css). Don't add .safe-top here —
          that re-applies the inset and compounds it, wasting screen space. */}
      <div className="mobile-main-content">
        {children}
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNavigation
        dueCount={dueCount}
        unreadCount={unreadCount}
        hidden={isFullscreen}
      />
    </>
  );
}
