/**
 * FolderContextMenu
 * Context menu for folder operations: new subfolder, rename, move, delete, set icon, auto-mark timing, statistics
 */

import { useState } from "react";
import {
  Pencil,
  Trash2,
  FolderPlus,
  Image,
  Clock,
  BarChart3,
} from "lucide-react";
import { updateFolderAuto, deleteFolderAuto, type RssFolder } from "../../api/rss-folders";
import { IconPicker } from "./IconPicker";

interface FolderContextMenuProps {
  folder: RssFolder;
  onClose: () => void;
  onAction?: (action: string, folderId: string) => void;
  position?: { x: number; y: number };
}

export function FolderContextMenu({ folder, onClose, onAction, position }: FolderContextMenuProps) {
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(folder.name);
  const [showSubmenu, setShowSubmenu] = useState<string | null>(null);

  const handleAction = (action: string) => {
    onAction?.(action, folder.id);
    onClose();
  };

  const handleRename = async () => {
    if (newName.trim() && newName !== folder.name) {
      await updateFolderAuto(folder.id, { name: newName.trim() });
      onAction?.("rename", folder.id);
    }
    setIsRenaming(false);
    onClose();
  };

  const handleDelete = async () => {
    if (confirm(`Delete folder "${folder.name}"? Feeds will be moved to uncategorized.`)) {
      await deleteFolderAuto(folder.id);
      onAction?.("delete", folder.id);
    }
    onClose();
  };

  const handleIconSelect = async (icon: string) => {
    await updateFolderAuto(folder.id, { icon });
    onAction?.("icon", folder.id);
  };

  const autoMarkOptions = [
    { value: 1, label: "1 day" },
    { value: 3, label: "3 days" },
    { value: 7, label: "1 week" },
    { value: 14, label: "2 weeks" },
    { value: 30, label: "1 month" },
  ];

  if (isRenaming) {
    return (
      <div className="fixed inset-0 z-50" onClick={onClose}>
        <div
          className="absolute bg-card border border-border rounded-lg shadow-lg p-2 z-50 w-48"
          style={position ? { left: position.x, top: position.y } : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRename();
              if (e.key === "Escape") onClose();
            }}
            className="w-full px-2 py-1 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-1 mt-1">
            <button onClick={() => void handleRename()} className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded">
              Save
            </button>
            <button onClick={onClose} className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose}>
        <div
          className="absolute bg-card border border-border rounded-lg shadow-lg py-1 min-w-[180px] z-50"
          style={position ? { left: position.x, top: position.y } : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleAction("new-subfolder")}
            className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted/60 flex items-center gap-2"
          >
            <FolderPlus className="w-3.5 h-3.5" /> New subfolder
          </button>
          <button
            onClick={() => setIsRenaming(true)}
            className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted/60 flex items-center gap-2"
          >
            <Pencil className="w-3.5 h-3.5" /> Rename
          </button>
          <button
            onClick={() => setShowIconPicker(true)}
            className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted/60 flex items-center gap-2"
          >
            <Image className="w-3.5 h-3.5" /> Change icon
          </button>

          <div className="border-t border-border my-1" />

          <div className="relative">
            <button
              onClick={() => setShowSubmenu(showSubmenu === "automark" ? null : "automark")}
              className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted/60 flex items-center gap-2"
            >
              <Clock className="w-3.5 h-3.5" /> Auto-mark as read
            </button>
            {showSubmenu === "automark" && (
              <div className="absolute left-full top-0 ml-1 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px] z-50">
                <button
                  onClick={() => { void updateFolderAuto(folder.id, { auto_mark_after_days: null }); onClose(); }}
                  className="w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-muted/60"
                >
                  Never
                </button>
                {autoMarkOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { void updateFolderAuto(folder.id, { auto_mark_after_days: opt.value }); onClose(); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-muted/60"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => handleAction("statistics")}
            className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted/60 flex items-center gap-2"
          >
            <BarChart3 className="w-3.5 h-3.5" /> Statistics
          </button>

          <div className="border-t border-border my-1" />

          <button
            onClick={() => void handleDelete()}
            className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {showIconPicker && (
        <IconPicker
          currentIcon={folder.icon}
          onSelect={handleIconSelect}
          onClose={() => setShowIconPicker(false)}
        />
      )}
    </>
  );
}
