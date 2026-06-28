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
import { MobileNavigation } from "./MobileNavigation";
import { useQueueStore } from "../../stores";
import { useMobileShell } from "../../hooks/useMobileShell";

interface MobileLayoutWrapperProps {
  children: React.ReactNode;
}

export function MobileLayoutWrapper({ children }: MobileLayoutWrapperProps) {
  const { items: queueItems } = useQueueStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isMobile = useMobileShell();

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
      <div className="mobile-main-content safe-top">
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
