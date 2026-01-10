import React, { useState, useEffect, useRef } from 'react';
import { MediaItem, SearchResult, MediaStatus } from '../types';
import { 
  getAllTrendingCategories, 
  TrendingCategory, 
  searchResultToMediaItem 
} from '../services/mediaSearch';
import { SuggestToFriendModal } from './SuggestToFriendModal';
import { QuickAddModal } from './QuickAddModal';
import { getStatusesByRefIds, BulkStatusItem } from '../services/api';
import PublicCommentsFeed from './PublicCommentsFeed';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w300';

interface TrendingPageProps {
  onAdd: (item: Omit<MediaItem, 'id'>) => Promise<void> | void;
  onViewMedia?: (refId: string, mediaType: string) => void;
}

// Helper to get full image URL
const getImageUrl = (imageUrl?: string): string | null => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  if (imageUrl.startsWith('/')) return `${TMDB_IMAGE_BASE}${imageUrl}`;
  return imageUrl;
};

// Horizontal scrollable row component
const TrendingRow: React.FC<{
  category: TrendingCategory;
  onQuickAdd: (item: SearchResult) => void;
  onAddWithDetails: (item: SearchResult) => void;
  onSuggest: (item: SearchResult) => void;
  addedItems: Set<string>;
  addingItems: Set<string>;
  userStatuses: Record<string, BulkStatusItem>;
}> = ({ category, onQuickAdd, onAddWithDetails, onSuggest, addedItems, addingItems, userStatuses }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    handleScroll();
  }, [category.items]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest px-1">
        {category.title}
      </h3>
      
      <div className="relative group">
        {/* Left Arrow */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 border border-neutral-700 p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-neutral-900"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Right Arrow */}
        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 border border-neutral-700 p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-neutral-900"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Scrollable Container */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {category.items.map((item) => (
            <TrendingCard
              key={item.id}
              item={item}
              onQuickAdd={() => onQuickAdd(item)}
              onAddWithDetails={() => onAddWithDetails(item)}
              onSuggest={() => onSuggest(item)}
              isAdded={addedItems.has(item.id)}
              isAdding={addingItems.has(item.id)}
              userStatus={userStatuses[item.id]}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Format status for display
const formatStatusBadge = (status: BulkStatusItem): { text: string; color: string } => {
  const statusMap: Record<MediaStatus, { label: string; color: string }> = {
    WATCHING: { label: 'Watching', color: 'bg-blue-600' },
    READING: { label: 'Reading', color: 'bg-blue-600' },
    COMPLETED: { label: 'Completed', color: 'bg-green-600' },
    PLAN_TO_WATCH: { label: 'Planned', color: 'bg-neutral-600' },
    DROPPED: { label: 'Dropped', color: 'bg-red-600' },
    PAUSED: { label: 'Paused', color: 'bg-yellow-600' },
  };
  
  const { label, color } = statusMap[status.status] || { label: status.status, color: 'bg-neutral-600' };
  
  // Show progress for active statuses
  if ((status.status === 'WATCHING' || status.status === 'READING') && status.current > 0) {
    if (status.total) {
      return { text: `EP ${status.current}/${status.total}`, color };
    }
    return { text: `EP ${status.current}`, color };
  }
  
  return { text: label, color };
};

// Individual card component
const TrendingCard: React.FC<{
  item: SearchResult;
  onQuickAdd: () => void;
  onAddWithDetails: () => void;
  onSuggest: () => void;
  isAdded: boolean;
  isAdding: boolean;
  userStatus?: BulkStatusItem;
}> = ({ item, onQuickAdd, onAddWithDetails, onSuggest, isAdded, isAdding, userStatus }) => {
  const [imageError, setImageError] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const imageUrl = getImageUrl(item.imageUrl);
  
  // Check if user already has this in their list
  const isInList = !!userStatus;
  const statusBadge = userStatus ? formatStatusBadge(userStatus) : null;

  return (
    <div
      className="flex-shrink-0 w-32 sm:w-40 group/card"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] bg-neutral-900 border border-neutral-800 overflow-hidden">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={item.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform group-hover/card:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-700 text-xs uppercase p-2 text-center">
            {item.title}
          </div>
        )}

        {/* Type Badge */}
        <div className="absolute top-2 left-2 bg-black/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wider border border-neutral-700">
          {item.type}
        </div>

        {/* User Status Badge - shown when user has item in list */}
        {statusBadge && !showActions && (
          <div className={`absolute bottom-0 left-0 right-0 ${statusBadge.color} px-2 py-1.5 text-[10px] uppercase tracking-wider font-bold text-center`}>
            {statusBadge.text}
          </div>
        )}

        {/* Hover Actions Overlay */}
        <div
          className={`absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 transition-opacity ${
            showActions ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {isInList ? (
            <span className={`text-xs uppercase font-bold px-3 py-2 ${statusBadge?.color || 'bg-neutral-600'}`}>
              {statusBadge?.text || 'In List'}
            </span>
          ) : isAdded ? (
            <span className="text-xs text-green-500 uppercase font-bold px-3 py-2 border border-green-700">
              Added
            </span>
          ) : (
            <>
              {/* Quick Add to Planned */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickAdd();
                }}
                disabled={isAdding}
                className="text-xs uppercase font-bold px-3 py-2 bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 w-24 text-center"
              >
                {isAdding ? '...' : '+ Planned'}
              </button>
              {/* Add with Details */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddWithDetails();
                }}
                disabled={isAdding}
                className="text-xs uppercase font-bold px-3 py-2 border border-neutral-400 text-neutral-200 hover:border-white hover:text-white transition-colors disabled:opacity-50 w-24 text-center"
              >
                + Details
              </button>
            </>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSuggest();
            }}
            className="text-xs uppercase font-bold px-3 py-2 border border-neutral-600 text-neutral-300 hover:border-white hover:text-white transition-colors w-24 text-center"
          >
            Suggest
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="mt-2 space-y-0.5">
        <h4 className="text-xs font-bold uppercase tracking-tight truncate" title={item.title}>
          {item.title}
        </h4>
        <div className="flex items-center gap-2 text-[10px] text-neutral-500">
          {item.year && <span>{item.year}</span>}
        </div>
      </div>
    </div>
  );
};

export const TrendingPage: React.FC<TrendingPageProps> = ({ onAdd, onViewMedia }) => {
  const [categories, setCategories] = useState<TrendingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [addingItems, setAddingItems] = useState<Set<string>>(new Set());
  const [suggestItem, setSuggestItem] = useState<MediaItem | null>(null);
  const [quickAddItem, setQuickAddItem] = useState<SearchResult | null>(null);
  const [userStatuses, setUserStatuses] = useState<Record<string, BulkStatusItem>>({});

  useEffect(() => {
    loadTrending();
  }, []);

  // Fetch user statuses after categories are loaded
  useEffect(() => {
    if (categories.length > 0) {
      fetchUserStatuses();
    }
  }, [categories]);

  const loadTrending = async () => {
    setLoading(true);
    try {
      const data = await getAllTrendingCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load trending:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStatuses = async () => {
    // Collect all refIds from all categories
    const allRefIds = categories.flatMap(cat => cat.items.map(item => item.id));
    
    if (allRefIds.length === 0) return;
    
    try {
      const statuses = await getStatusesByRefIds(allRefIds);
      setUserStatuses(statuses);
    } catch (error) {
      // Silently fail - user might not be logged in
      console.error('Failed to fetch user statuses:', error);
    }
  };

  const handleAdd = async (item: SearchResult) => {
    if (addedItems.has(item.id) || addingItems.has(item.id)) return;

    setAddingItems(prev => new Set(prev).add(item.id));

    try {
      const mediaItem = searchResultToMediaItem(item);
      await onAdd(mediaItem);
      setAddedItems(prev => new Set(prev).add(item.id));
    } finally {
      setAddingItems(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  // Quick add to planned
  const handleQuickAdd = async (item: SearchResult) => {
    if (addedItems.has(item.id) || addingItems.has(item.id)) return;

    setAddingItems(prev => new Set(prev).add(item.id));

    try {
      const mediaItem = searchResultToMediaItem(item);
      // Set status to PLAN_TO_WATCH for quick add
      await onAdd({ ...mediaItem, status: 'PLAN_TO_WATCH', current: 0 });
      setAddedItems(prev => new Set(prev).add(item.id));
    } finally {
      setAddingItems(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  // Open modal for adding with details
  const handleAddWithDetails = (item: SearchResult) => {
    setQuickAddItem(item);
  };

  // Handle add from modal
  const handleModalAdd = async (mediaItem: Omit<MediaItem, 'id'>) => {
    if (!quickAddItem) return;
    
    setAddingItems(prev => new Set(prev).add(quickAddItem.id));
    try {
      await onAdd(mediaItem);
      setAddedItems(prev => new Set(prev).add(quickAddItem.id));
    } finally {
      setAddingItems(prev => {
        const next = new Set(prev);
        if (quickAddItem) next.delete(quickAddItem.id);
        return next;
      });
    }
  };

  const handleSuggest = (item: SearchResult) => {
    // Convert SearchResult to MediaItem-like object for the modal
    const mediaItem: MediaItem = {
      id: '',
      title: item.title,
      type: item.type,
      current: 0,
      total: item.total,
      status: 'PLAN_TO_WATCH',
      imageUrl: item.imageUrl,
      refId: item.id,
    };
    setSuggestItem(mediaItem);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-900 pb-2">
          TRENDING
        </h2>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-neutral-500 uppercase tracking-wider animate-pulse">
            Loading trending...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-900 pb-2">
        TRENDING
      </h2>

      {/* Public Comments Feed - Hot Discussions */}
      <PublicCommentsFeed 
        onViewMedia={onViewMedia}
        title="HOT DISCUSSIONS"
      />

      {categories.length === 0 ? (
        <div className="text-center py-20 text-neutral-600">
          <p className="uppercase tracking-wider">No trending content available</p>
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map((category, index) => (
            <TrendingRow
              key={index}
              category={category}
              onQuickAdd={handleQuickAdd}
              onAddWithDetails={handleAddWithDetails}
              onSuggest={handleSuggest}
              addedItems={addedItems}
              addingItems={addingItems}
              userStatuses={userStatuses}
            />
          ))}
        </div>
      )}

      {/* Quick Add Modal */}
      {quickAddItem && (
        <QuickAddModal
          item={quickAddItem}
          onAdd={handleModalAdd}
          onClose={() => setQuickAddItem(null)}
        />
      )}

      {/* Suggest Modal */}
      {suggestItem && (
        <SuggestToFriendModal
          item={suggestItem}
          onClose={() => setSuggestItem(null)}
        />
      )}
    </div>
  );
};

export default TrendingPage;
