// Tag-Aware Scheduling — Queue Item Badges

import React from "react";
import type { QueueItem } from "../../types/queue";

interface TASQueueBadgeProps {
  item: QueueItem;
  onForceShow?: (itemId: string) => void;
}

const TASQueueBadge: React.FC<TASQueueBadgeProps> = ({ item, onForceShow }) => {
  if (!item.prerequisiteBlocked && !item.interferenceDelayUntil) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {item.prerequisiteBlocked && item.blockReason && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-6.364A9 9 0 112.636 5.636a9 9 0 0118.728 0z" />
          </svg>
          {item.blockReason}
        </span>
      )}

      {item.interferenceDelayUntil && !item.prerequisiteBlocked && item.blockReason && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {item.blockReason}
        </span>
      )}

      {onForceShow && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onForceShow(item.id);
          }}
          className="px-2 py-0.5 rounded text-primary hover:bg-primary/10 transition-colors"
          title="Add to review queue for this session"
        >
          Force show
        </button>
      )}
    </div>
  );
};

export default TASQueueBadge;
