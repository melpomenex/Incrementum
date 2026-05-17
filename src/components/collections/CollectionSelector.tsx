import { useState } from 'react';
import { Folder, Check, ChevronDown } from 'lucide-react';
import { useCollectionStore } from '../../stores/collectionStore';

interface CollectionSelectorProps {
  documentCollectionId: string;
  onCollectionChange?: (collectionId: string) => void;
  className?: string;
}

export function CollectionSelector({
  documentCollectionId,
  onCollectionChange,
  className = '',
}: CollectionSelectorProps) {
  const collections = useCollectionStore((s) => s.collections);
  const [isOpen, setIsOpen] = useState(false);

  const current = collections.find((c) => c.id === documentCollectionId);

  const handleSelect = (collectionId: string) => {
    setIsOpen(false);
    onCollectionChange?.(collectionId);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-lg hover:bg-muted transition-colors"
      >
        <span className="text-base">{current?.icon || '📁'}</span>
        <span className="text-sm text-foreground">{current?.name || 'Unknown'}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 w-56 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  onClick={() => handleSelect(collection.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left"
                >
                  <span className="text-base">{collection.icon || '📁'}</span>
                  <span className="flex-1 text-sm text-foreground truncate">
                    {collection.name}
                  </span>
                  {collection.id === documentCollectionId && (
                    <Check className="w-3 h-3 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
