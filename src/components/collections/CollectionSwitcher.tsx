import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Check, Download, Upload } from 'lucide-react';
import { useCollectionStore } from '../../stores/collectionStore';
import { DEFAULT_COLLECTION_ID } from '../../types/collection';
import { buildCollectionArchive } from '../../utils/collectionArchive';
import { invokeCommand, isTauri, openFilePicker } from '../../lib/tauri';
import { useToast } from '../common/Toast';

export function CollectionSwitcher() {
  const collections = useCollectionStore((s) => s.collections);
  const activeCollectionId = useCollectionStore((s) => s.activeCollectionId);
  const dueCounts = useCollectionStore((s) => s.dueCounts);
  const switchCollection = useCollectionStore((s) => s.switchCollection);
  const createCollection = useCollectionStore((s) => s.createCollection);
  const deleteCollection = useCollectionStore((s) => s.deleteCollection);
  const refreshDueCounts = useCollectionStore((s) => s.refreshDueCounts);

  const [isOpen, setIsOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const active = collections.find((c) => c.id === activeCollectionId);

  useEffect(() => {
    refreshDueCounts();
  }, [refreshDueCounts]);

  useEffect(() => {
    if (showCreate && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCreate]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowCreate(false);
        setConfirmDeleteId(null);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const handleSwitch = async (id: string) => {
    await switchCollection(id);
    setIsOpen(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createCollection(newName.trim());
    setNewName('');
    setShowCreate(false);
    setIsOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId === id) {
      await deleteCollection(id);
      setConfirmDeleteId(null);
      setIsOpen(false);
    } else {
      setConfirmDeleteId(id);
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { blob, filename } = await buildCollectionArchive({
        scope: 'current',
        activeCollectionId,
        collections,
      });
      if (isTauri()) {
        const [{ save }, { writeFile }] = await Promise.all([
          import('@tauri-apps/plugin-dialog'),
          import('@tauri-apps/plugin-fs'),
        ]);
        const savePath = await save({
          defaultPath: filename,
          filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
        });
        if (!savePath) { setExporting(false); return; }
        const buffer = await blob.arrayBuffer();
        await writeFile(savePath, new Uint8Array(buffer));
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success('Export complete', `Exported to ${filename}`);
      setIsOpen(false);
    } catch (err) {
      toast.error('Export failed', err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const files = await openFilePicker({
        multiple: false,
        filters: [{ name: 'Collection Archive', extensions: ['zip'] }],
      });
      if (!files || files.length === 0) { setImporting(false); return; }
      const filePath = (files[0] as string & { path?: string }).path || files[0];
      const result = await invokeCommand<string>('import_collection_archive_merge', { archivePath: filePath });
      await useCollectionStore.getState().loadCollections();
      await refreshDueCounts();
      toast.success('Import complete', result);
      setIsOpen(false);
    } catch (err) {
      toast.error('Import failed', err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex justify-center py-1 px-1 relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2 rounded transition-colors hover:bg-muted"
        title={active?.name || 'Collections'}
      >
        <span className="text-base">{active?.icon || '📁'}</span>
      </button>

      {isOpen && (
        <div className="absolute left-full ml-2 top-0 w-56 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {collections.map((c) => {
              const due = dueCounts[c.id] ?? 0;
              const isDefault = c.id === DEFAULT_COLLECTION_ID;
              return (
                <div key={c.id} className="flex items-center group">
                  <button
                    onClick={() => handleSwitch(c.id)}
                    className="flex-1 flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left"
                  >
                    <span>{c.icon || '📁'}</span>
                    <span className="text-sm flex-1 truncate">{c.name}</span>
                    {due > 0 && c.id !== activeCollectionId && (
                      <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                        {due}
                      </span>
                    )}
                    {c.id === activeCollectionId && <Check className="w-3 h-3 text-primary" />}
                  </button>
                  {!isDefault && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                      className={`px-2 py-2 transition-colors ${confirmDeleteId === c.id ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground opacity-0 group-hover:opacity-100'} hover:text-red-500`}
                      title={confirmDeleteId === c.id ? 'Click again to confirm' : 'Delete collection'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {!showCreate ? (
            <>
              <div className="border-t border-border">
                <button
                  onClick={handleExport}
                  disabled={exporting || activeCollectionId === DEFAULT_COLLECTION_ID}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{exporting ? 'Exporting...' : 'Export Collection'}</span>
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{importing ? 'Importing...' : 'Import Collection'}</span>
                </button>
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-2 px-3 py-2 border-t border-border hover:bg-muted transition-colors text-left"
              >
                <Plus className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">New Collection</span>
              </button>
            </>
          ) : (
            <div className="p-2 border-t border-border" onMouseDown={(e) => e.stopPropagation()}>
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') { setShowCreate(false); setNewName(''); }
                }}
                placeholder="Collection name..."
                className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-1 mt-1">
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="flex-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  onClick={() => { setShowCreate(false); setNewName(''); }}
                  className="px-2 py-1 text-xs text-foreground hover:bg-muted rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
