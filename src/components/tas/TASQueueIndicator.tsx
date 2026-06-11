// Tag-Aware Scheduling — Queue Header Indicator

import React from "react";
import { useTASStore } from "../../stores/tasStore";

const TASQueueIndicator: React.FC = () => {
  const config = useTASStore((s) => s.config);
  const blockedCount = useTASStore((s) => s.blockedItems.length);
  const eligibleCount = useTASStore((s) => s.eligibleItems.length);

  if (!config.enabled) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>TAS Active</span>
      <span className="text-primary/60">·</span>
      <span>{eligibleCount} ready</span>
      {blockedCount > 0 && (
        <>
          <span className="text-primary/60">·</span>
          <span>{blockedCount} blocked</span>
        </>
      )}
    </div>
  );
};

export default TASQueueIndicator;
