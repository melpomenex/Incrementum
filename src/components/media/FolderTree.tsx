/**
 * FolderTree
 * Recursive sidebar rendering of RSS folders with expand/collapse
 */

import { useState } from "react";
import { ChevronRight, ChevronDown, FolderOpen, Folder, Plus, MoreVertical, Trash2, Edit3 } from "lucide-react";
import type { RssFolder } from "../../api/rss-folders";
import type { Feed } from "../../api/rss";

interface FolderTreeProps {
  folders: RssFolder[];
  feeds: Feed[];
  selectedFeedId?: string;
  onSelectFeed: (feed: Feed) => void;
  onFolderAction?: (folderId: string, action: string) => void;
  onNewSubfolder?: (parentId: string) => void;
  depth?: number;
}

export function FolderTree({
  folders,
  feeds,
  selectedFeedId,
  onSelectFeed,
  onFolderAction,
  onNewSubfolder,
  depth = 0,
}: FolderTreeProps) {
  return (
    <div className={depth > 0 ? "ml-3 border-l border-border/50 pl-1" : ""}>
      {folders.map((folder) => {
        const childFolders = folders.filter((f) => f.parent_id === folder.id);
        const folderFeeds = folder.feed_ids
          .map((fid) => feeds.find((f) => f.id === fid))
          .filter((f): f is Feed => Boolean(f));

        return (
          <FolderNode
            key={folder.id}
            folder={folder}
            childFolders={childFolders}
            feeds={folderFeeds}
            allFeeds={feeds}
            allFolders={folders}
            selectedFeedId={selectedFeedId}
            onSelectFeed={onSelectFeed}
            onFolderAction={onFolderAction}
            onNewSubfolder={onNewSubfolder}
            depth={depth}
          />
        );
      })}
    </div>
  );
}

function FolderNode({
  folder,
  childFolders,
  feeds,
  allFeeds,
  allFolders: _allFolders,
  selectedFeedId,
  onSelectFeed,
  onFolderAction,
  onNewSubfolder,
  depth,
}: {
  folder: RssFolder;
  childFolders: RssFolder[];
  feeds: Feed[];
  allFeeds: Feed[];
  allFolders: RssFolder[];
  selectedFeedId?: string;
  onSelectFeed: (feed: Feed) => void;
  onFolderAction?: (folderId: string, action: string) => void;
  onNewSubfolder?: (parentId: string) => void;
  depth: number;
}) {
  const [isExpanded, setIsExpanded] = useState(depth < 1);
  const [showMenu, setShowMenu] = useState(false);

  const totalUnread = feeds.reduce((acc, f) => acc + f.unreadCount, 0);

  return (
    <div>
      {/* Folder header */}
      <div
        className="group flex items-center gap-1 px-2 py-1 hover:bg-muted/50 rounded cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsExpanded(!isExpanded); }}
      >
        <span className="text-muted-foreground">
          {isExpanded && (childFolders.length > 0 || feeds.length > 0) ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </span>
        <span className="text-muted-foreground">
          {isExpanded ? (
            <FolderOpen className="w-3.5 h-3.5" />
          ) : (
            <Folder className="w-3.5 h-3.5" />
          )}
        </span>
        <span className="flex-1 text-xs font-medium text-foreground truncate">{folder.name}</span>
        {totalUnread > 0 && (
          <span className="px-1 bg-orange-500 text-white text-[10px] rounded-full">{totalUnread}</span>
        )}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-0.5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 rounded"
          >
            <MoreVertical className="w-3 h-3" />
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-full mt-1 w-32 bg-card border border-border rounded-lg shadow-lg py-1 z-20"
              role="menu"
              onClick={(e) => e.stopPropagation()}
            >
              {onNewSubfolder && (
                <button
                  onClick={() => {
                    onNewSubfolder(folder.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted/60 flex items-center gap-1.5"
                >
                  <Plus className="w-3 h-3" />
                  New subfolder
                </button>
              )}
              {onFolderAction && (
                <>
                  <button
                    onClick={() => {
                      onFolderAction(folder.id, "rename");
                      setShowMenu(false);
                    }}
                    className="w-full px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted/60 flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3 h-3" />
                    Rename
                  </button>
                  <button
                    onClick={() => {
                      onFolderAction(folder.id, "delete");
                      setShowMenu(false);
                    }}
                    className="w-full px-2 py-1.5 text-left text-xs text-red-500 hover:bg-red-500/10 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && (
        <div className="ml-3 border-l border-border/50 pl-1">
          {feeds.map((feed) => (
            <div
              key={feed.id}
              role="button"
              tabIndex={0}
              className={`px-2 py-1 text-xs hover:bg-muted/50 rounded cursor-pointer flex items-center gap-2 ${
                selectedFeedId === feed.id ? "bg-muted/60" : ""
              }`}
              onClick={() => onSelectFeed(feed)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelectFeed(feed); }}
            >
              <span className="flex-1 truncate text-foreground">{feed.title}</span>
              {feed.unreadCount > 0 && (
                <span className="px-1 bg-orange-500 text-white text-[10px] rounded-full">
                  {feed.unreadCount}
                </span>
              )}
            </div>
          ))}
          {childFolders.length > 0 && (
            <FolderTree
              folders={childFolders}
              feeds={allFeeds}
              selectedFeedId={selectedFeedId}
              onSelectFeed={onSelectFeed}
              onFolderAction={onFolderAction}
              onNewSubfolder={onNewSubfolder}
              depth={depth + 1}
            />
          )}
        </div>
      )}
    </div>
  );
}
