import { useEffect, useRef } from "react";
import { useTabsStore } from "../../../stores";
import { useI18n } from "../../../lib/i18n";

interface TabContextMenuProps {
  tabId: string;
  x: number;
  y: number;
  onClose: () => void;
}

type SplitTarget = {
  direction: "horizontal" | "vertical";
  side: "before" | "after";
  labelKey: string;
};

const SPLIT_TARGETS: SplitTarget[] = [
  { direction: "horizontal", side: "after", labelKey: "tabContextMenu.splitRight" },
  { direction: "horizontal", side: "before", labelKey: "tabContextMenu.splitLeft" },
  { direction: "vertical", side: "after", labelKey: "tabContextMenu.splitDown" },
  { direction: "vertical", side: "before", labelKey: "tabContextMenu.splitUp" },
];

export function TabContextMenu({
  tabId,
  x,
  y,
  onClose,
}: TabContextMenuProps) {
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);
  const { closeTab, closeOtherTabs, closeTabsToRight, tabs, splitPane, findPaneContainingTab } = useTabsStore();

  // Close menu on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const tabIndex = tabs.findIndex((t) => t.id === tabId);
  const tab = tabs[tabIndex];
  const hasClosableTabsToRight = tabs
    .slice(tabIndex + 1)
    .some((t) => t.closable);
  const hasOtherClosableTabs = tabs.some(
    (t) => t.id !== tabId && t.closable
  );

  const handleClose = () => {
    closeTab(tabId);
    onClose();
  };

  const handleCloseOthers = () => {
    closeOtherTabs(tabId);
    onClose();
  };

  const handleCloseToRight = () => {
    closeTabsToRight(tabId);
    onClose();
  };

  const handleSplit = (direction: "horizontal" | "vertical", side: "before" | "after") => {
    const pane = findPaneContainingTab(tabId);
    if (pane) {
      splitPane(pane.id, tabId, direction, side);
    }
    onClose();
  };

  // Position menu to stay within viewport
  const menuStyle = {
    left: Math.min(x, window.innerWidth - 200),
    top: Math.min(y, window.innerHeight - 200),
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-48 bg-card border border-border rounded-lg shadow-lg py-1"
      style={menuStyle}
    >
      {/* Close */}
      <button
        onClick={handleClose}
        disabled={!tab?.closable}
        className={`
          w-full px-4 py-2 text-left text-sm
          hover:bg-muted hover:text-foreground
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-between gap-4
        `}
      >
        <span>{t("tabContextMenu.close")}</span>
        <span className="text-xs text-muted-foreground">Ctrl+W</span>
      </button>

      {/* Close Others */}
      <button
        onClick={handleCloseOthers}
        disabled={!hasOtherClosableTabs}
        className={`
          w-full px-4 py-2 text-left text-sm
          hover:bg-muted hover:text-foreground
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {t("tabContextMenu.closeOthers")}
      </button>

      {/* Close to Right */}
      <button
        onClick={handleCloseToRight}
        disabled={!hasClosableTabsToRight}
        className={`
          w-full px-4 py-2 text-left text-sm
          hover:bg-muted hover:text-foreground
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {t("tabContextMenu.closeTabsToRight")}
      </button>

      <div className="my-1 border-t border-border" />

      {/* Split */}
      <div className="px-4 pt-1 pb-0.5 text-xs text-muted-foreground">
        {t("tabContextMenu.split")}
      </div>
      {SPLIT_TARGETS.map((target) => (
        <button
          key={target.labelKey}
          onClick={() => handleSplit(target.direction, target.side)}
          className="
            w-full px-4 py-2 text-left text-sm
            hover:bg-muted hover:text-foreground
          "
        >
          {t(target.labelKey)}
        </button>
      ))}

      <div className="my-1 border-t border-border" />

      {/* Close All */}
      <button
        onClick={() => {
          useTabsStore.getState().closeAllTabs();
          onClose();
        }}
        className="
          w-full px-4 py-2 text-left text-sm
          hover:bg-destructive hover:text-destructive-foreground
          flex items-center justify-between gap-4
        "
      >
        <span>{t("tabContextMenu.closeAllTabs")}</span>
      </button>
    </div>
  );
}
