import React, { useState, useEffect } from 'react';
import { MediaItem, MediaType } from '../types';
import { useToast } from '../context/ToastContext';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w200';

/**
 * Helper to get full image URL
 */
function getImageUrl(imageUrl?: string): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  if (imageUrl.startsWith('/')) return `${TMDB_IMAGE_BASE}${imageUrl}`;
  return imageUrl;
}

/**
 * Helper to proxy image URLs with provider referer
 */
function proxyImageUrl(url: string | null, providerReferer?: string): string | null {
  if (!url) return null;
  if (url.startsWith('blob:') || url.startsWith('/api/')) return url;
  let proxyUrl = `/api/proxy/image?url=${encodeURIComponent(url)}`;
  if (providerReferer) {
    proxyUrl += `&referer=${encodeURIComponent(providerReferer)}`;
  }
  return proxyUrl;
}

/**
 * Extract source name from refId (e.g., "tmdb:12345" -> "tmdb")
 */
function extractSourceName(refId: string): string {
  const colonIndex = refId.indexOf(':');
  if (colonIndex > 0) {
    return refId.substring(0, colonIndex);
  }
  return 'unknown';
}

/**
 * Get display name for a source
 */
function getSourceDisplayName(source: string): string {
  const displayNames: Record<string, string> = {
    tmdb: 'TMDB',
    anilist: 'AniList',
    'anilist-manga': 'AniList Manga',
    hianime: 'HiAnime',
    animepahe: 'AnimePahe',
    animekai: 'AnimeKai',
    flixhq: 'FlixHQ',
    goku: 'Goku',
    mangadex: 'MangaDex',
    comick: 'ComicK',
    mangapill: 'MangaPill',
    mangahere: 'MangaHere',
    mangakakalot: 'MangaKakalot',
    mangareader: 'MangaReader',
    asurascans: 'AsuraScans',
  };
  return displayNames[source.toLowerCase()] || source.toUpperCase();
}

/**
 * Get confidence display with color
 */
function getSimilarityDisplay(score: number): { text: string; colorClass: string } {
  const percent = Math.round(score * 100);
  if (score >= 0.9) {
    return { text: `${percent}%`, colorClass: 'text-green-500' };
  } else if (score >= 0.7) {
    return { text: `${percent}%`, colorClass: 'text-yellow-500' };
  } else if (score >= 0.5) {
    return { text: `${percent}%`, colorClass: 'text-orange-500' };
  }
  return { text: `${percent}%`, colorClass: 'text-red-500' };
}

/**
 * New item data for conflict resolution
 */
export interface NewItemData {
  refId: string;
  title: string;
  imageUrl?: string;
  year?: number;
  type: MediaType;
}

export interface ConflictResolutionModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called to close the modal */
  onClose: () => void;
  /** The new item being added */
  newItem: NewItemData;
  /** The similar item found in user's list */
  existingItem: MediaItem;
  /** Similarity score between 0 and 1 */
  similarityScore: number;
  /** Whether titles match but appear to be different seasons */
  seasonMismatch: boolean;
  /** Called when user chooses to link sources (add as alias) */
  onMerge: (existingItemId: string, newRefId: string) => Promise<void>;
  /** Called when user chooses to replace existing with new */
  onReplace: (existingItemId: string, newItem: NewItemData) => Promise<void>;
  /** Called when user chooses to keep both as separate entries */
  onKeepBoth: (newItem: NewItemData) => Promise<void>;
}

type ActionType = 'merge' | 'replace' | 'keepBoth' | null;

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  onClose,
  newItem,
  existingItem,
  similarityScore,
  seasonMismatch,
  onMerge,
  onReplace,
  onKeepBoth,
}) => {
  const { showToast } = useToast();
  const [loadingAction, setLoadingAction] = useState<ActionType>(null);
  const [existingImageError, setExistingImageError] = useState(false);
  const [newImageError, setNewImageError] = useState(false);

  // Extract source names from refIds
  const existingSource = extractSourceName(existingItem.refId);
  const newSource = extractSourceName(newItem.refId);

  // Get display info
  const similarityDisplay = getSimilarityDisplay(similarityScore);

  // Reset image errors when items change
  useEffect(() => {
    setExistingImageError(false);
    setNewImageError(false);
  }, [existingItem.id, newItem.refId]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loadingAction) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, loadingAction]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loadingAction) {
      onClose();
    }
  };

  // Action handlers
  const handleMerge = async () => {
    setLoadingAction('merge');
    try {
      await onMerge(existingItem.id, newItem.refId);
      showToast('Sources linked successfully', 'success');
      onClose();
    } catch (error: any) {
      console.error('[ConflictResolutionModal] Merge failed:', error);
      showToast(error.message || 'Failed to link sources', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReplace = async () => {
    setLoadingAction('replace');
    try {
      await onReplace(existingItem.id, newItem);
      showToast('Item replaced successfully', 'success');
      onClose();
    } catch (error: any) {
      console.error('[ConflictResolutionModal] Replace failed:', error);
      showToast(error.message || 'Failed to replace item', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleKeepBoth = async () => {
    setLoadingAction('keepBoth');
    try {
      await onKeepBoth(newItem);
      showToast('Item added as separate entry', 'success');
      onClose();
    } catch (error: any) {
      console.error('[ConflictResolutionModal] Keep both failed:', error);
      showToast(error.message || 'Failed to add item', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  // Get explanation text based on similarity
  const getExplanationText = (): string => {
    if (seasonMismatch) {
      return 'These may be different seasons of the same series. Consider keeping both if tracking separately.';
    }
    if (similarityScore >= 0.9) {
      return 'These appear to be the same content from different providers. Linking them will combine tracking.';
    }
    if (similarityScore >= 0.7) {
      return 'These items seem related. Review the details before deciding.';
    }
    return 'These items have some similarities. Please review carefully.';
  };

  // Image URLs
  const existingImageUrl = getImageUrl(existingItem.imageUrl);
  const newImageUrl = getImageUrl(newItem.imageUrl);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-black border border-neutral-700 w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-yellow-500 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest">
                {similarityScore >= 0.9 ? 'POTENTIAL DUPLICATE DETECTED' : 'SIMILAR ITEM FOUND'}
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                This item may already exist in your list
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Side-by-side comparison */}
          <div className="p-4 border-b border-neutral-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Existing Item */}
              <div className="border border-neutral-800 bg-neutral-950 p-3">
                <p className="text-xs text-neutral-600 uppercase tracking-wider mb-2">
                  IN YOUR LIST
                </p>
                <div className="flex gap-3">
                  {/* Image */}
                  <div className="flex-shrink-0 w-16">
                    {existingImageUrl && !existingImageError ? (
                      <img
                        src={proxyImageUrl(existingImageUrl) || existingImageUrl}
                        alt={existingItem.title}
                        onError={() => setExistingImageError(true)}
                        className="w-full aspect-[2/3] object-cover border border-neutral-800 bg-neutral-900"
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-700 text-xs text-center p-1">
                        No Image
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white uppercase tracking-tight line-clamp-2 text-sm">
                      {existingItem.title}
                    </h4>
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-600 uppercase">Source:</span>
                        <span className="text-xs bg-neutral-800 px-1.5 py-0.5 text-neutral-300">
                          {getSourceDisplayName(existingSource)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-600 uppercase">Type:</span>
                        <span className="text-xs text-neutral-400">{existingItem.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-600 uppercase">Status:</span>
                        <span className="text-xs text-neutral-400">{existingItem.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* New Item */}
              <div className="border border-neutral-800 bg-neutral-950 p-3">
                <p className="text-xs text-neutral-600 uppercase tracking-wider mb-2">
                  NEW ITEM
                </p>
                <div className="flex gap-3">
                  {/* Image */}
                  <div className="flex-shrink-0 w-16">
                    {newImageUrl && !newImageError ? (
                      <img
                        src={proxyImageUrl(newImageUrl) || newImageUrl}
                        alt={newItem.title}
                        onError={() => setNewImageError(true)}
                        className="w-full aspect-[2/3] object-cover border border-neutral-800 bg-neutral-900"
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-700 text-xs text-center p-1">
                        No Image
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white uppercase tracking-tight line-clamp-2 text-sm">
                      {newItem.title}
                    </h4>
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-600 uppercase">Source:</span>
                        <span className="text-xs bg-neutral-800 px-1.5 py-0.5 text-neutral-300">
                          {getSourceDisplayName(newSource)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-600 uppercase">Type:</span>
                        <span className="text-xs text-neutral-400">{newItem.type}</span>
                      </div>
                      {newItem.year && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-neutral-600 uppercase">Year:</span>
                          <span className="text-xs text-neutral-400">{newItem.year}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Similarity Score */}
          <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-950">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-600 uppercase tracking-wider">
                Similarity
              </span>
              <span className={`text-sm font-bold ${similarityDisplay.colorClass}`}>
                {similarityDisplay.text}
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-1 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  similarityScore >= 0.9
                    ? 'bg-green-500'
                    : similarityScore >= 0.7
                    ? 'bg-yellow-500'
                    : similarityScore >= 0.5
                    ? 'bg-orange-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.round(similarityScore * 100)}%` }}
              />
            </div>
          </div>

          {/* Explanation / Warning */}
          <div className="px-4 py-3 border-b border-neutral-800">
            <div
              className={`flex items-start gap-2 p-3 border ${
                seasonMismatch
                  ? 'border-yellow-900 bg-yellow-950/30'
                  : similarityScore >= 0.9
                  ? 'border-green-900 bg-green-950/30'
                  : 'border-neutral-800 bg-neutral-900/30'
              }`}
            >
              {seasonMismatch ? (
                <svg
                  className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : similarityScore >= 0.9 ? (
                <svg
                  className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4 text-neutral-500 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
              <p className="text-xs text-neutral-400 leading-relaxed">
                {getExplanationText()}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-neutral-800 space-y-2 flex-shrink-0">
          {/* Primary Action - Link Sources */}
          <button
            onClick={handleMerge}
            disabled={loadingAction !== null}
            className="w-full py-3 text-xs font-bold uppercase tracking-wider bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loadingAction === 'merge' ? (
              <>
                <span className="animate-spin">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </span>
                LINKING...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                LINK SOURCES - THESE ARE THE SAME
              </>
            )}
          </button>

          {/* Secondary Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleReplace}
              disabled={loadingAction !== null}
              className="py-3 text-xs font-bold uppercase tracking-wider border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingAction === 'replace' ? (
                <>
                  <span className="animate-spin">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </span>
                  REPLACING...
                </>
              ) : (
                'REPLACE EXISTING'
              )}
            </button>

            <button
              onClick={handleKeepBoth}
              disabled={loadingAction !== null}
              className="py-3 text-xs font-bold uppercase tracking-wider border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingAction === 'keepBoth' ? (
                <>
                  <span className="animate-spin">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </span>
                  ADDING...
                </>
              ) : (
                'KEEP BOTH'
              )}
            </button>
          </div>

          {/* Cancel */}
          <button
            onClick={onClose}
            disabled={loadingAction !== null}
            className="w-full py-2 text-xs uppercase tracking-wider text-neutral-600 hover:text-neutral-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolutionModal;
