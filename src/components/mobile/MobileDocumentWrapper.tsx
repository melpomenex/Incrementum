/**
 * Mobile Document Wrapper with Pull-to-Refresh
 *
 * Wraps document viewers (PDF, EPUB, YouTube, Markdown) with:
 * - Pull-to-refresh functionality
 * - Touch gesture support
 * - Mobile-specific optimizations
 */

import { useState, useCallback } from "react";
import { PullToRefresh } from "./PullToRefresh";
import { useMobileShell } from "../../hooks/useMobileShell";

interface MobileDocumentWrapperProps {
  documentId: string;
  documentTitle: string;
  children: React.ReactNode;
  onRefresh?: () => Promise<void>;
}

export function MobileDocumentWrapper({
  documentId,
  documentTitle: _documentTitle,
  children,
  onRefresh,
}: MobileDocumentWrapperProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isMobile = useMobileShell();

  // Default refresh handler - reloads the document data
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      // Call the provided refresh handler
      if (onRefresh) {
        await onRefresh();
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('[Mobile] Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [documentId, onRefresh]);

  // If not mobile, just return children without wrapper
  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      disabled={isRefreshing}
      className="mobile-document-wrapper"
    >
      {children}
    </PullToRefresh>
  );
}

/**
 * Hook to use mobile document wrapper functionality
 */
export function useMobileDocumentRefresh(documentId: string) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Trigger document reload via invalidation
      // This would integrate with your data fetching layer
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setIsRefreshing(false);
    }
  }, [documentId]);

  return { isRefreshing, refresh };
}
