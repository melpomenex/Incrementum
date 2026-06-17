/**
 * ClusterPill
 * "Duplicate" or "Related" badge on clustered articles
 */

import { Copy, Link } from "@phosphor-icons/react";

interface ClusterPillProps {
  type: "duplicate" | "related";
  count?: number;
  onClick?: () => void;
}

export function ClusterPill({ type, count = 1, onClick }: ClusterPillProps) {
  if (type === "duplicate") {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
        title={`${count + 1} duplicate${count > 1 ? "s" : ""}`}
      >
        <Copy className="w-2.5 h-2.5" />
        {count + 1}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
      title={`${count} related stor${count > 1 ? "ies" : "y"}`}
    >
      <Link className="w-2.5 h-2.5" />
      {count}
    </button>
  );
}
