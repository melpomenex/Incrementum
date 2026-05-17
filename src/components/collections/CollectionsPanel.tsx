import { useState, useEffect } from 'react';
import { Folder, Plus } from 'lucide-react';
import { useCollectionStore } from '../../stores/collectionStore';
import { useDocumentStore } from '../../stores/documentStore';
import type { Collection } from '../../types/collection';

interface CollectionsPanelProps {
  className?: string;
  onCollectionSelect?: (collectionId: string | null) => void;
  selectedCollectionId?: string | null;
}

export function CollectionsPanel({
  className = '',
  onCollectionSelect,
  selectedCollectionId,
}: CollectionsPanelProps) {
  const collections = useCollectionStore((s) => s.collections);
  const dueCounts = useCollectionStore((s) => s.dueCounts);
  const documents = useDocumentStore((state) => state.documents);

  const getDocumentCount = (collection: Collection): number => {
    return documents.filter((doc) => doc.collectionId === collection.id).length;
  };

  const handleSelect = (collectionId: string) => {
    onCollectionSelect?.(collectionId);
  };

  const handleSelectAll = () => {
    onCollectionSelect?.(null);
  };

  return (
    <div className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Collections</h3>
      </div>

      <button
        onClick={handleSelectAll}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors mb-1 ${
          selectedCollectionId === null
            ? 'bg-primary/10 text-primary'
            : 'hover:bg-muted text-foreground'
        }`}
      >
        <span className="text-sm flex-1 text-left">All Collections</span>
        <span className="text-xs text-muted-foreground">{documents.length}</span>
      </button>

      <div className="space-y-0.5">
        {collections.map((collection) => {
          const count = getDocumentCount(collection);
          const due = dueCounts[collection.id] ?? 0;

          return (
            <div key={collection.id}>
              <button
                onClick={() => handleSelect(collection.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                  selectedCollectionId === collection.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted text-foreground'
                }`}
              >
                <span className="text-base">{collection.icon || '📁'}</span>
                <span className="text-sm flex-1 text-left">{collection.name}</span>
                {due > 0 && (
                  <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                    {due}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{count}</span>
              </button>
            </div>
          );
        })}
      </div>

      {collections.length === 0 && (
        <div className="text-center py-4">
          <Folder className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-xs text-muted-foreground">No collections yet</p>
        </div>
      )}
    </div>
  );
}
