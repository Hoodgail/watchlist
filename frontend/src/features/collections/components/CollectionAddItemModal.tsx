import React, { useState, useEffect, useCallback } from 'react';
import { addCollectionItem } from '@/features/collections/api';
import { SearchResult, MediaType, ProviderName } from '@/types';
import { searchMedia, SearchCategory, SearchOptions, searchWithProvider } from '@/services/mediaSearch';
import { useToast } from '@/context/ToastContext';
import { createRefId } from '@shared/refId';
import { getProxiedImageUrl, getProviderBaseUrl } from '@/shared/media';

const CATEGORIES: { value: SearchCategory; label: string }[] = [
  { value: 'all', label: 'ALL' },
  { value: 'tv', label: 'TV' },
  { value: 'movie', label: 'FILM' },
  { value: 'anime', label: 'ANIME' },
  { value: 'manga', label: 'MANGA' },
  { value: 'game', label: 'GAMES' },
];

interface CollectionAddItemModalProps {
  collectionId: string;
  collectionTitle: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CollectionAddItemModal: React.FC<CollectionAddItemModalProps> = ({
  collectionId,
  collectionTitle,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingItems, setAddingItems] = useState<Set<string>>(new Set());
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setResults([]);

    try {
      const options: SearchOptions = {};
      const items = await searchMedia(query, category, options);
      setResults(items);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Get refId from search result using shared utility
  const getItemRefId = (item: SearchResult): string => {
    const source = item.source || item.provider || 'unknown';
    return createRefId(source, item.id);
  };

  const handleAddToCollection = async (item: SearchResult) => {
    if (addingItems.has(item.id) || addedItems.has(item.id)) return;

    setAddingItems(prev => new Set(prev).add(item.id));

    try {
      await addCollectionItem(collectionId, {
        refId: getItemRefId(item),
        title: item.title,
        imageUrl: item.imageUrl,
        type: item.type,
      });
      setAddedItems(prev => new Set(prev).add(item.id));
      showToast(`Added "${item.title}" to collection`, 'success');
      onSuccess?.();
    } catch (err: any) {
      console.error('Failed to add to collection:', err);
      showToast(err.message || 'Failed to add to collection', 'error');
    } finally {
      setAddingItems(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  // Get type label for display
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'LIGHT_NOVEL': return 'LN';
      case 'COMIC': return 'COMIC';
      case 'BOOK': return 'BOOK';
      case 'GAME': return 'GAME';
      default: return type;
    }
  };

  // Get unit label (episodes/chapters/pages/hours)
  const getUnitLabel = (type: string) => {
    switch (type) {
      case 'MANGA':
      case 'LIGHT_NOVEL':
      case 'COMIC':
        return 'CH';
      case 'BOOK':
        return 'PG';
      case 'GAME':
        return 'HR';
      default:
        return 'EP';
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
    >
      <div className="modal-shell max-w-2xl">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest">
              ADD TO COLLECTION
            </h3>
            <p className="text-xs text-neutral-500 mt-1 uppercase truncate">
              {collectionTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Search Form */}
        <div className="modal-section space-y-3">
          {/* Category Filter */}
          <div className="chip-tabs">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`chip-tab ${category === cat.value ? 'active' : ''}`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SEARCH FOR MEDIA..."
              className="search-field flex-grow uppercase font-mono text-sm"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              className="action-btn px-4 disabled:opacity-50 text-sm"
            >
              {loading ? '...' : 'FIND'}
            </button>
          </form>
        </div>

        {/* Results */}
        <div className="modal-content">
          {!hasSearched ? (
            <div className="py-8 text-center text-neutral-600">
              <p className="text-sm uppercase">SEARCH FOR MEDIA TO ADD</p>
            </div>
          ) : loading ? (
            <div className="py-8 text-center text-neutral-500 uppercase tracking-wider animate-pulse">
              Searching...
            </div>
          ) : results.length === 0 ? (
              <div className="empty-state py-8">
              <p className="text-sm uppercase">NO RESULTS FOUND</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((item) => (
                <div
                  key={item.id}
                  className="option-card flex items-center gap-3"
                >
                  {/* Image */}
                  {item.imageUrl && (
                    <div className="flex-shrink-0 w-10 h-14 bg-neutral-900 overflow-hidden">
                      <img
                        src={getProxiedImageUrl(item.imageUrl, item.provider ? getProviderBaseUrl(item.provider) : undefined) || ''}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-grow min-w-0">
                    <h4 className="font-bold text-sm uppercase tracking-tight truncate">
                      {item.title}
                    </h4>
                    <div className="flex gap-2 text-xs text-neutral-500 mt-1 uppercase flex-wrap">
                        <span className="meta-pill">
                        {getTypeLabel(item.type)}
                      </span>
                      <span>
                        {item.total
                          ? `${item.total} ${getUnitLabel(item.type)}`
                          : 'ONGOING'}
                      </span>
                      {item.year && <span className="text-neutral-600">{item.year}</span>}
                    </div>
                  </div>

                  {/* Add Button */}
                  {addedItems.has(item.id) ? (
                      <span className="flex-shrink-0 text-xs border border-green-700 text-green-500 px-3 py-1.5 uppercase rounded-xl">
                      Added
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAddToCollection(item)}
                      disabled={addingItems.has(item.id)}
                      className="action-btn flex-shrink-0 px-3 py-1.5 !min-h-0 disabled:opacity-50"
                    >
                      {addingItems.has(item.id) ? '...' : 'ADD'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            onClick={onClose}
            className="action-btn-ghost w-full"
          >
            DONE
          </button>
        </div>
      </div>
    </div>
  );
};

export default CollectionAddItemModal;
