import React, { useState, useEffect } from 'react';
import { Collection, MediaType, SearchResult, MediaItem } from '../types';
import { getMyCollections, addCollectionItem } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w200';

// Helper to get full image URL
const getImageUrl = (imageUrl?: string): string | null => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  if (imageUrl.startsWith('/')) return `${TMDB_IMAGE_BASE}${imageUrl}`;
  return imageUrl;
};

// Data that can be added to a collection (works for both SearchResult and MediaItem)
export interface CollectionItemData {
  id: string;
  title: string;
  type: MediaType;
  imageUrl?: string;
  year?: number;
  total?: number | null;
  refId?: string; // For MediaItem, this is the refId; for SearchResult, we'll construct it from id + source/provider
  source?: string;
  provider?: string;
}

interface AddToCollectionModalProps {
  item: CollectionItemData;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddToCollectionModal: React.FC<AddToCollectionModalProps> = ({
  item,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const imageUrl = getImageUrl(item.imageUrl);

  // Get the refId for the item
  const getRefId = (): string => {
    // If item already has a refId, use it
    if (item.refId) return item.refId;
    // Otherwise, construct from source/provider and id
    const source = item.source || item.provider || 'unknown';
    return `${source}:${item.id}`;
  };

  // Load user's collections
  useEffect(() => {
    const loadCollections = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getMyCollections();
        // Only show collections where user can edit (OWNER or EDITOR)
        const editableCollections = data.filter(
          (c) => c.myRole === 'OWNER' || c.myRole === 'EDITOR'
        );
        setCollections(editableCollections);
        // Pre-select first collection if available
        if (editableCollections.length > 0) {
          setSelectedCollectionId(editableCollections[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load collections:', err);
        setError(err.message || 'Failed to load collections');
      } finally {
        setLoading(false);
      }
    };
    loadCollections();
  }, []);

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

  const handleSave = async () => {
    if (!selectedCollectionId) return;

    const selectedCollection = collections.find(c => c.id === selectedCollectionId);
    setSaving(true);
    setError(null);

    try {
      await addCollectionItem(selectedCollectionId, {
        refId: getRefId(),
        title: item.title,
        imageUrl: item.imageUrl,
        type: item.type,
        note: note.trim() || undefined,
      });
      showToast(`Added "${item.title}" to ${selectedCollection?.title || 'collection'}`, 'success');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to add to collection:', err);
      const errorMessage = err.message || 'Failed to add to collection';
      // Check for duplicate error and show a friendlier message
      if (errorMessage.toLowerCase().includes('already in the collection')) {
        setError(`"${item.title}" is already in this collection`);
        showToast('Item already in collection', 'error');
      } else {
        setError(errorMessage);
        showToast(errorMessage, 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  // Get unit label based on type
  const getUnitLabel = (type: MediaType): string => {
    switch (type) {
      case 'MANGA':
      case 'BOOK':
      case 'LIGHT_NOVEL':
      case 'COMIC':
        return 'CH';
      case 'GAME':
        return 'HRS';
      default:
        return 'EP';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-black border border-neutral-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-widest">
            ADD TO COLLECTION
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Media Info */}
        <div className="p-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex gap-4">
            {imageUrl && !imageError && (
              <div className="flex-shrink-0 w-16">
                <img
                  src={imageUrl}
                  alt={item.title}
                  onError={() => setImageError(true)}
                  className="w-full aspect-[2/3] object-cover border border-neutral-800"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-white uppercase tracking-tight">
                {item.title}
              </h4>
              <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1">
                <span className="uppercase">{item.type}</span>
                {item.year && <span>{item.year}</span>}
                {item.total && (
                  <span>{item.total} {getUnitLabel(item.type)}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="py-8 text-center text-neutral-500 uppercase tracking-wider animate-pulse">
              Loading collections...
            </div>
          ) : error ? (
            <div className="py-4 text-center text-red-500 text-sm">
              {error}
            </div>
          ) : collections.length === 0 ? (
            <div className="py-8 text-center text-neutral-600 border border-neutral-800 border-dashed">
              <p className="text-sm uppercase">NO COLLECTIONS</p>
              <p className="text-xs mt-2 text-neutral-700">
                Create a collection first to add items
              </p>
            </div>
          ) : (
            <>
              {/* Collection Selection */}
              <div className="space-y-2">
                <label className="text-xs text-neutral-600 uppercase tracking-wider block">
                  SELECT COLLECTION
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {collections.map((collection) => (
                    <button
                      key={collection.id}
                      onClick={() => setSelectedCollectionId(collection.id)}
                      className={`w-full p-3 text-left border transition-colors ${
                        selectedCollectionId === collection.id
                          ? 'border-white bg-neutral-900'
                          : 'border-neutral-800 hover:border-neutral-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-white uppercase truncate">
                            {collection.title}
                          </div>
                          <div className="text-xs text-neutral-500 flex items-center gap-2 mt-0.5">
                            <span>{collection.itemCount} items</span>
                            <span className={collection.isPublic ? 'text-green-600' : 'text-neutral-600'}>
                              {collection.isPublic ? 'PUBLIC' : 'PRIVATE'}
                            </span>
                          </div>
                        </div>
                        {selectedCollectionId === collection.id && (
                          <svg className="w-5 h-5 text-white flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Note (Optional) */}
              <div className="space-y-2">
                <label className="text-xs text-neutral-600 uppercase tracking-wider block">
                  NOTE (OPTIONAL)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note about this item..."
                  className="w-full bg-neutral-950 border border-neutral-800 p-3 text-sm text-white placeholder-neutral-700 focus:border-white outline-none resize-none min-h-[80px]"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-xs font-bold uppercase tracking-wider border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !selectedCollectionId || collections.length === 0}
            className="flex-1 py-3 text-xs font-bold uppercase tracking-wider bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'ADDING...' : 'ADD'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddToCollectionModal;
