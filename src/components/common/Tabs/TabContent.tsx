import { Suspense, createContext, useContext } from "react";
import { type Tab } from "../../../stores";

interface TabContentProps {
  tabs: Tab[];
  activeTabId: string | null;
  paneId?: string;
}

// Context to provide pane ID to tab content components
const PaneIdContext = createContext<string | undefined>(undefined);

/**
 * Hook to get the current pane ID from within a tab component.
 * Use this when you need to add tabs to the same pane.
 */
export function usePaneId(): string | undefined {
  return useContext(PaneIdContext);
}

function TabLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div
          className="inline-block w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"
          style={{ borderWidth: "3px" }}
        />
        <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="text-6xl mb-4">📭</div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          No tabs open
        </h3>
        <p className="text-muted-foreground">
          Open a tab to get started
        </p>
      </div>
    </div>
  );
}

export function TabContent({ tabs, activeTabId, paneId }: TabContentProps) {
  const activeTab = tabs.find((t) => t.id === activeTabId);

  if (!activeTab) {
    return <EmptyState />;
  }

  return (
    <div className="h-full w-full overflow-hidden bg-background min-h-0">
      <Suspense fallback={<TabLoader />}>
        {tabs.map((tab) => {
          const ContentComponent = tab.content;
          const isActive = tab.id === activeTab.id;
          return (
            <div
              key={tab.id}
              className={isActive ? "h-full w-full animate-tab-enter" : "hidden h-full w-full"}
              aria-hidden={!isActive}
            >
              <PaneIdContext.Provider value={paneId}>
                <ContentComponent {...(tab.data || {})} />
              </PaneIdContext.Provider>
            </div>
          );
        })}
      </Suspense>
    </div>
  );
}
