import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MediaItem, MediaStatus, SortBy, FriendActivityFilter, FriendStatus, ActiveProgress, ProviderName } from '../types';
import { STATUS_OPTIONS } from '../constants';
import { SuggestToFriendModal } from './SuggestToFriendModal';
import type { GroupedListResponse, StatusGroupPagination } from '../services/api';
import { extractProviderFromRefId } from '../services/mediaSearch';

// ==================== Constants ====================

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'status', label: 'STATUS' },
  { value: 'title', label: 'TITLE' },
  { value: 'rating', label: 'RATING' },
  { value: 'updatedAt', label: 'RECENTLY UPDATED' },
  { value: 'createdAt', label: 'DATE ADDED' },
];

const FILTER_STATUS_OPTIONS = [
  { value: '', label: 'ALL' },
  ...STATUS_OPTIONS,
];

const FRIEND_ACTIVITY_OPTIONS: { value: FriendActivityFilter; label: string }[] = [
  { value: '', label: 'ALL' },
  { value: 'friends_watching', label: 'FRIENDS WATCHING/READING' },
  { value: 'friends_done', label: 'FRIENDS COMPLETED' },
  { value: 'friends_dropped', label: 'FRIENDS DROPPED' },
];

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w200';

// Provider base URLs for referer headers
const PROVIDER_BASE_URLS: Partial<Record<ProviderName, string>> = {
  // Anime providers
  'hianime': 'https://hianime.to',
  'animepahe': 'https://animepahe.com',
  'animekai': 'https://animekai.to',
  'kickassanime': 'https://kickassanime.am',
  // Movie/TV providers
  'flixhq': 'https://flixhq.to',
  'goku': 'https://goku.sx',
  'sflix': 'https://sflix.to',
  'himovies': 'https://himovies.to',
  'dramacool': 'https://dramacool.ee',
  // Manga providers
  'mangadex': 'https://mangadex.org',
  'mangahere': 'https://mangahere.cc',
  'mangapill': 'https://mangapill.com',
  'comick': 'https://comick.io',
  'mangakakalot': 'https://mangakakalot.com',
  'mangareader': 'https://mangareader.to',
  'asurascans': 'https://asuracomic.net',
  // Meta providers
  'anilist': 'https://anilist.co',
  'anilist-manga': 'https://anilist.co',
  'tmdb': 'https://www.themoviedb.org',
  // Other providers
  'libgen': 'https://libgen.is',
  'readlightnovels': 'https://readlightnovels.net',
  'getcomics': 'https://getcomics.info',
};

// Helper to proxy image URLs through our server to bypass hotlink protection
function proxyImageUrl(url: string, referer?: string): string {
  // Don't proxy blob URLs, already-proxied URLs, or TMDB images (they don't need proxying)
  if (url.startsWith('blob:') || url.startsWith('/api/') || url.includes('image.tmdb.org')) {
    return url;
  }
  let proxyUrl = `/api/proxy/image?url=${encodeURIComponent(url)}`;
  if (referer) {
    proxyUrl += `&referer=${encodeURIComponent(referer)}`;
  }
  return proxyUrl;
}

// Status group order and configuration
const STATUS_GROUP_CONFIG: {
  status: MediaStatus;
  label: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
}[] = [
    {
      status: 'WATCHING',
      label: 'WATCHING',
      icon: <PlayIcon />,
      color: 'text-green-400',
      borderColor: 'border-l-green-500',
    },
    {
      status: 'READING',
      label: 'READING',
      icon: <PlayIcon />,
      color: 'text-green-400',
      borderColor: 'border-l-green-500',
    },
    {
      status: 'PAUSED',
      label: 'PAUSED',
      icon: <PauseIcon />,
      color: 'text-yellow-500',
      borderColor: 'border-l-yellow-500',
    },
    {
      status: 'PLAN_TO_WATCH',
      label: 'PLANNED',
      icon: <ClockIcon />,
      color: 'text-blue-400',
      borderColor: 'border-l-blue-500',
    },
    {
      status: 'COMPLETED',
      label: 'COMPLETED',
      icon: <CheckIcon />,
      color: 'text-neutral-500',
      borderColor: 'border-l-neutral-600',
    },
    {
      status: 'DROPPED',
      label: 'DROPPED',
      icon: <XIcon />,
      color: 'text-red-400',
      borderColor: 'border-l-red-500',
    },
  ];

// Local storage keys
const COLLAPSE_STATE_KEY = 'medialist-collapse-state';
const VIEW_MODE_KEY = 'medialist-view-mode';

// ==================== Helpers ====================

// Format time as "H:MM:SS" or "MM:SS"
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ==================== Icons ====================

function PlayIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg className={`w-4 h-4 ${filled ? 'text-yellow-400' : 'text-neutral-700'}`} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

// ==================== Helper Functions ====================

const getImageUrl = (imageUrl?: string, refId?: string): string | null => {
  if (!imageUrl) return null;
  let url: string;
  if (imageUrl.startsWith('http')) {
    url = imageUrl;
  } else if (imageUrl.startsWith('/')) {
    url = `${TMDB_IMAGE_BASE}${imageUrl}`;
  } else {
    url = imageUrl;
  }
  // Get provider referer from refId if available
  const provider = refId ? extractProviderFromRefId(refId) : null;
  const referer = provider ? PROVIDER_BASE_URLS[provider] : undefined;
  // Proxy external images to bypass hotlink protection
  return proxyImageUrl(url, referer);
};

const getShortStatus = (status: MediaStatus): string => {
  switch (status) {
    case 'WATCHING':
    case 'READING':
      return 'ACTIVE';
    case 'COMPLETED':
      return 'DONE';
    case 'DROPPED':
      return 'DROP';
    case 'PAUSED':
      return 'PAUSE';
    case 'PLAN_TO_WATCH':
      return 'PLAN';
    default:
      return status;
  }
};

const getStatusConfig = (status: MediaStatus) => {
  return STATUS_GROUP_CONFIG.find(c => c.status === status) || STATUS_GROUP_CONFIG[0];
};

// ==================== Types ====================

interface MediaListProps {
  title: string;
  items: MediaItem[];
  // Grouped data for per-status pagination
  groupedData?: GroupedListResponse | null;
  mediaTypeFilter?: 'video' | 'manga';
  onUpdate?: (id: string, updates: Partial<MediaItem>) => void;
  onDelete?: (id: string) => void;
  onAddToMyList?: (item: MediaItem) => void;
  onItemClick?: (item: MediaItem) => void;
  readonly?: boolean;
  filterStatus?: MediaStatus | '';
  friendActivityFilter?: FriendActivityFilter;
  sortBy?: SortBy;
  onFilterChange?: (status: MediaStatus | '') => void;
  onFriendActivityFilterChange?: (filter: FriendActivityFilter) => void;
  onSortChange?: (sortBy: SortBy) => void;
  showSuggestButton?: boolean;
  // Per-status pagination
  onPageChange?: (status: MediaStatus, page: number) => void;
  loadingStatuses?: Set<MediaStatus>;
}

interface MediaItemCardProps {
  item: MediaItem;
  onUpdate?: (id: string, updates: Partial<MediaItem>) => void;
  onDelete?: (id: string) => void;
  onAddToMyList?: (item: MediaItem) => void;
  onItemClick?: (item: MediaItem) => void;
  readonly?: boolean;
  showSuggestButton?: boolean;
  searchQuery?: string;
  onSuggest?: (item: MediaItem) => void;
}

type ViewMode = 'grouped' | 'compact';

// ==================== Statistics Summary Component ====================

const StatisticsSummary: React.FC<{
  items: MediaItem[];
  onStatusClick: (status: MediaStatus | '') => void;
  activeStatus: MediaStatus | '';
}> = ({ items, onStatusClick, activeStatus }) => {
  const stats = useMemo(() => {
    const statusCounts: Partial<Record<MediaStatus, number>> = {};
    let totalRating = 0;
    let ratedCount = 0;

    items.forEach(item => {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
      if (item.rating != null) {
        totalRating += item.rating;
        ratedCount++;
      }
    });

    return {
      total: items.length,
      statusCounts,
      avgRating: ratedCount > 0 ? (totalRating / ratedCount).toFixed(1) : null,
    };
  }, [items]);

  return (
    <div className="flex flex-wrap items-center gap-2 py-3 px-4 bg-neutral-950 border border-neutral-800 rounded">
      {/* Total count */}
      <button
        onClick={() => onStatusClick('')}
        className={`text-xs px-2.5 py-1.5 border transition-colors ${activeStatus === ''
            ? 'border-white text-white bg-neutral-800'
            : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
          }`}
      >
        ALL: {stats.total}
      </button>

      {/* Status chips */}
      {STATUS_GROUP_CONFIG.map(config => {
        const count = stats.statusCounts[config.status] || 0;
        if (count === 0) return null;
        const isActive = activeStatus === config.status;
        return (
          <button
            key={config.status}
            onClick={() => onStatusClick(isActive ? '' : config.status)}
            className={`text-xs px-2.5 py-1.5 border transition-colors flex items-center gap-1.5 ${isActive
                ? `${config.color} border-current bg-neutral-800`
                : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
              }`}
          >
            {config.icon}
            <span className="uppercase">{config.label}: {count}</span>
          </button>
        );
      })}

      {/* Average rating */}
      {stats.avgRating && (
        <div className="ml-auto flex items-center gap-1 text-xs text-neutral-500">
          <StarIcon filled />
          <span>AVG: {stats.avgRating}</span>
        </div>
      )}
    </div>
  );
};

// ==================== Search Input Component ====================

const SearchInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-neutral-600">
        <SearchIcon />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search in list..."
        className="w-full bg-black border border-neutral-800 text-white pl-10 pr-8 py-2 text-sm focus:border-neutral-600 focus:outline-none placeholder-neutral-600"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-600 hover:text-white"
        >
          <span className="text-lg">×</span>
        </button>
      )}
    </div>
  );
};

// ==================== View Toggle Component ====================

const ViewToggle: React.FC<{
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}> = ({ viewMode, onChange }) => {
  return (
    <div className="flex border border-neutral-800">
      <button
        onClick={() => onChange('grouped')}
        className={`p-2 transition-colors ${viewMode === 'grouped'
            ? 'bg-neutral-800 text-white'
            : 'text-neutral-500 hover:text-white hover:bg-neutral-900'
          }`}
        title="Grouped view"
      >
        <ListIcon />
      </button>
      <button
        onClick={() => onChange('compact')}
        className={`p-2 transition-colors border-l border-neutral-800 ${viewMode === 'compact'
            ? 'bg-neutral-800 text-white'
            : 'text-neutral-500 hover:text-white hover:bg-neutral-900'
          }`}
        title="Compact view"
      >
        <GridIcon />
      </button>
    </div>
  );
};

// ==================== Status Group Header ====================

const StatusGroupHeader: React.FC<{
  config: typeof STATUS_GROUP_CONFIG[0];
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ config, count, isExpanded, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className={`sticky top-0 z-10 w-full flex items-center gap-3 px-4 py-3 bg-neutral-950 border border-neutral-800 ${config.borderColor} border-l-2 hover:bg-neutral-900 transition-colors`}
    >
      <ChevronIcon expanded={isExpanded} />
      <span className={config.color}>{config.icon}</span>
      <span className={`font-bold uppercase tracking-wider ${config.color}`}>
        {config.label}
      </span>
      <span className="text-neutral-600 text-sm">({count})</span>
    </button>
  );
};

// ==================== Compact Item Card ====================

const CompactItemCard: React.FC<{
  item: MediaItem;
  onUpdate?: (id: string, updates: Partial<MediaItem>) => void;
  onDelete?: (id: string) => void;
  readonly?: boolean;
  searchQuery?: string;
}> = ({ item, onUpdate, onDelete, readonly, searchQuery }) => {
  const progressPercentage = item.total ? Math.min(100, (item.current / item.total) * 100) : 0;
  const config = getStatusConfig(item.status);
  const imageUrl = getImageUrl(item.imageUrl, item.refId);
  const [imageError, setImageError] = useState(false);

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="bg-yellow-500/30 text-white">{part}</mark>
        : part
    );
  };

  return (
    <div className={`group relative flex items-center gap-3 p-2 bg-black border border-neutral-800 ${config.borderColor} border-l-2 hover:border-neutral-600 transition-colors`}>
      {/* Tiny poster */}
      {imageUrl && !imageError ? (
        <img
          src={imageUrl}
          alt={item.title}
          onError={() => setImageError(true)}
          className="w-8 h-12 object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-12 bg-neutral-900 flex-shrink-0" />
      )}

      {/* Title and type */}
      <div className="flex-grow min-w-0">
        <h4 className="font-medium text-sm text-white truncate">
          {highlightText(item.title, searchQuery || '')}
        </h4>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span>{item.type}</span>
          {item.rating != null && (
            <span className="flex items-center gap-0.5">
              <StarIcon filled />
              {item.rating}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="hidden sm:flex flex-col items-end gap-1 min-w-[80px]">
        <span className="text-xs font-mono text-neutral-400">
          {item.current}{item.total && `/${item.total}`}
        </span>
        {item.total && (
          <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}
      </div>

      {/* Quick +1 button */}
      {!readonly && onUpdate && (
        <button
          onClick={() => onUpdate(item.id, { current: item.current + 1 })}
          className="w-8 h-8 flex items-center justify-center border border-neutral-700 text-neutral-400 hover:border-white hover:text-white transition-colors"
        >
          +1
        </button>
      )}

      {/* Delete button */}
      {!readonly && onDelete && (
        <button
          onClick={() => onDelete(item.id)}
          className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-neutral-600 hover:text-red-500 transition-all"
        >
          ×
        </button>
      )}
    </div>
  );
};

// ==================== Full Item Card ====================

const RATING_OPTIONS = [
  { value: null, label: '-' },
  ...Array.from({ length: 11 }, (_, i) => ({ value: i, label: String(i) })),
];

const MediaItemCard: React.FC<MediaItemCardProps> = ({ 
  item, 
  onUpdate, 
  onDelete, 
  onAddToMyList,
  onItemClick,
  readonly, 
  showSuggestButton, 
  searchQuery,
  onSuggest,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [notesValue, setNotesValue] = useState(item.notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const progressPercentage = item.total ? Math.min(100, (item.current / item.total) * 100) : 0;
  const imageUrl = getImageUrl(item.imageUrl, item.refId);
  const config = getStatusConfig(item.status);

  const getStatusStyle = (status: MediaStatus) => {
    switch (status) {
      case 'WATCHING':
      case 'READING':
        return 'border-white text-white';
      case 'COMPLETED':
        return 'border-neutral-600 text-neutral-600 line-through decoration-1';
      default:
        return 'border-neutral-700 text-neutral-500';
    }
  };

  const handleNotesBlur = () => {
    setIsEditingNotes(false);
    if (notesValue !== (item.notes || '')) {
      onUpdate && onUpdate(item.id, { notes: notesValue || undefined });
    }
  };

  const handleRatingChange = (value: number | null) => {
    onUpdate && onUpdate(item.id, { rating: value });
  };

  // Touch handlers for swipe actions
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStart;
    // Only allow left swipe (negative diff) up to -100px
    if (diff < 0 && diff > -100) {
      setSwipeOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset < -50) {
      // Trigger +1 action
      if (onUpdate) {
        onUpdate(item.id, { current: item.current + 1 });
      }
    }
    setSwipeOffset(0);
    setTouchStart(null);
  };

  const hasDetails = item.notes || item.rating != null || (item.friendsStatuses && item.friendsStatuses.length > 0);

  const friendsByStatus = (item.friendsStatuses || []).reduce((acc, friend) => {
    const key = friend.status;
    if (!acc[key]) acc[key] = [];
    acc[key].push(friend);
    return acc;
  }, {} as Record<MediaStatus, FriendStatus[]>);

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="bg-yellow-500/30 text-white">{part}</mark>
        : part
    );
  };

  return (
    <div
      ref={cardRef}
      className={`group relative border border-neutral-800 bg-black transition-all hover:border-neutral-600 ${config.borderColor} border-l-2 overflow-visible`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ transform: `translateX(${swipeOffset}px)` }}
    >
      {/* Swipe action indicator */}
      {swipeOffset < -20 && (
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-green-600 flex items-center justify-center text-white font-bold">
          +1
        </div>
      )}

      {/* Progress Bar Background */}
      {item.total && (
        <div className="absolute bottom-0 left-0 h-1 bg-neutral-900 w-full">
          <div
            className={`h-full transition-all duration-500 ${progressPercentage === 100 ? 'bg-green-500' : 'bg-white'
              }`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="p-4 pb-5">
        <div className="flex gap-4">
          {/* Poster Image */}
          {imageUrl && !imageError && (
            <div className="flex-shrink-0 w-16 sm:w-20 relative">
              <img
                src={imageUrl}
                alt={item.title}
                onError={() => setImageError(true)}
                className="w-full aspect-[2/3] object-cover border border-neutral-800"
              />
              {/* Playback progress bar overlay on poster */}
              {item.activeProgress && !item.activeProgress.completed && item.activeProgress.percentComplete > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-800/80">
                  <div
                    className="h-full bg-red-500 transition-all duration-300"
                    style={{ width: `${item.activeProgress.percentComplete}%` }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex-grow flex flex-col sm:flex-row justify-between gap-4">
            {/* Main Info */}
            <div className="flex-grow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  {onItemClick ? (
                    <button
                      onClick={() => onItemClick(item)}
                      className={`font-bold text-lg leading-tight uppercase tracking-tight text-left hover:underline ${item.status === 'COMPLETED' ? 'text-neutral-500' : 'text-white'}`}
                    >
                      {highlightText(item.title, searchQuery || '')}
                    </button>
                  ) : (
                    <h3 className={`font-bold text-lg leading-tight uppercase tracking-tight ${item.status === 'COMPLETED' ? 'text-neutral-500' : 'text-white'}`}>
                      {highlightText(item.title, searchQuery || '')}
                    </h3>
                  )}
                  {/* Rating Badge */}
                  {item.rating != null && (
                    <span className="text-xs bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 text-neutral-300 font-mono flex items-center gap-1">
                      <StarIcon filled />
                      {item.rating}
                    </span>
                  )}
                </div>
                {/* Mobile Delete Button */}
                {!readonly && onDelete && (
                  <button
                    onClick={() => onDelete(item.id)}
                    className="sm:hidden text-neutral-700 hover:text-red-500 px-2 text-xl"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-xs uppercase mt-1">
                <span className="bg-neutral-900 text-neutral-400 px-1.5 py-0.5 border border-neutral-800">
                  {item.type}
                </span>
                {item.total ? (
                  <span className="text-neutral-500 py-0.5">
                    {item.total} {item.type === 'MANGA' ? 'CH' : 'EP'}
                  </span>
                ) : (
                  <span className="text-neutral-500 py-0.5">ONGOING</span>
                )}
                {item.notes && (
                  <span className="text-neutral-600 py-0.5" title="Has notes">
                    [NOTE]
                  </span>
                )}
                {/* Resume indicator for video content with active progress */}
                {item.activeProgress && !item.activeProgress.completed && item.activeProgress.percentComplete > 0 && (
                  <span 
                    className="text-red-400 py-0.5 flex items-center gap-1"
                    title={`Resume at ${formatTime(item.activeProgress.currentTime)}`}
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    RESUME E{item.activeProgress.episodeNumber || '?'}
                  </span>
                )}
              </div>

              {/* Friends status summary */}
              {item.friendsStatuses && item.friendsStatuses.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(Object.entries(friendsByStatus) as [MediaStatus, FriendStatus[]][]).map(([status, friends]) => (
                    <span
                      key={status}
                      className="text-[10px] px-1.5 py-0.5 bg-neutral-900 border border-neutral-700 text-neutral-400 uppercase"
                      title={friends.map(f => f.displayName || f.username).join(', ')}
                    >
                      {friends.length} {getShortStatus(status)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:items-end gap-3 min-w-[140px]">
              {/* Add to My List button */}
              {readonly && onAddToMyList && (
                <button
                  onClick={() => onAddToMyList(item)}
                  className="text-xs px-3 py-1.5 border border-neutral-600 text-neutral-300 hover:border-white hover:text-white uppercase tracking-wider transition-colors"
                >
                  + ADD TO MY LIST
                </button>
              )}

              {/* Status Select */}
              {readonly ? (
                <div className={`text-xs px-2 py-1 border ${getStatusStyle(item.status)} inline-block text-center w-full sm:w-auto`}>
                  {item.status}
                </div>
              ) : (
                <select
                  value={item.status}
                  onChange={(e) => onUpdate && onUpdate(item.id, { status: e.target.value as MediaStatus })}
                  className={`bg-black text-xs uppercase px-2 py-1 border outline-none cursor-pointer focus:bg-neutral-900 w-full sm:w-auto ${getStatusStyle(item.status)}`}
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-black text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              {/* Progress Input */}
              <div className="flex items-center gap-2 justify-between sm:justify-end w-full">
                <span className="text-xs text-neutral-600 font-mono">PROG:</span>
                {readonly ? (
                  <span className="font-mono text-white text-lg">
                    {item.current}
                    {item.total && <span className="text-neutral-600">/{item.total}</span>}
                  </span>
                ) : (
                  <div className="flex items-center">
                    <button
                      onClick={() => onUpdate && onUpdate(item.id, { current: Math.max(0, item.current - 1) })}
                      className="w-8 h-8 border border-r-0 border-neutral-800 hover:bg-neutral-900 text-neutral-400 transition-colors"
                    >-</button>
                    <input
                      type="number"
                      value={item.current}
                      onChange={(e) => onUpdate && onUpdate(item.id, { current: parseInt(e.target.value) || 0 })}
                      className="w-14 h-8 bg-black text-center border border-neutral-800 font-mono text-white focus:border-white outline-none"
                    />
                    <button
                      onClick={() => onUpdate && onUpdate(item.id, { current: item.current + 1 })}
                      className="w-8 h-8 border border-l-0 border-neutral-800 hover:bg-neutral-900 text-neutral-400 transition-colors"
                    >+</button>
                  </div>
                )}
              </div>

              {/* Quick Rating (inline) */}
              {!readonly && !isExpanded && (
                <div className="flex items-center gap-1">
                  {[2, 4, 6, 8, 10].map(rating => (
                    <button
                      key={rating}
                      onClick={() => handleRatingChange(item.rating === rating ? null : rating)}
                      className={`w-6 h-6 text-xs border transition-colors ${item.rating != null && item.rating >= rating
                          ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10'
                          : 'border-neutral-700 text-neutral-600 hover:border-neutral-500'
                        }`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              )}

              {/* Suggest to Friend Button */}
              {showSuggestButton && item.refId && onSuggest && (
                <button
                  onClick={() => onSuggest(item)}
                  className="text-xs px-3 py-1.5 border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white uppercase tracking-wider transition-colors"
                >
                  SUGGEST
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expand Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-3 text-xs text-neutral-600 hover:text-neutral-400 uppercase tracking-wider flex items-center gap-1"
        >
          <ChevronIcon expanded={isExpanded} />
          <span>{isExpanded ? 'HIDE DETAILS' : (hasDetails ? 'SHOW DETAILS' : 'ADD DETAILS')}</span>
        </button>
      </div>

      {/* Expanded Details Section */}
      {isExpanded && (
        <div className="border-t border-neutral-800 p-4 bg-neutral-950 space-y-4 animate-fadeIn">
          {/* Rating */}
          <div className="flex items-center gap-4">
            <span className="text-xs text-neutral-600 uppercase tracking-wider w-16">RATING:</span>
            {readonly ? (
              <span className="font-mono text-white">
                {item.rating != null ? `${item.rating}/10` : '-'}
              </span>
            ) : (
              <div className="flex items-center gap-1">
                {RATING_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => handleRatingChange(opt.value)}
                    className={`w-7 h-7 text-xs border transition-colors ${item.rating === opt.value
                        ? 'border-white text-white bg-white/10'
                        : 'border-neutral-700 text-neutral-500 hover:border-neutral-500'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <span className="text-xs text-neutral-600 uppercase tracking-wider">NOTES:</span>
            {readonly ? (
              <p className="text-sm text-neutral-400 whitespace-pre-wrap">
                {item.notes || <span className="text-neutral-700 italic">No notes</span>}
              </p>
            ) : isEditingNotes ? (
              <textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Add your notes here..."
                autoFocus
                className="w-full bg-black border border-neutral-700 p-3 text-sm text-white placeholder-neutral-700 focus:border-white outline-none resize-none min-h-[80px]"
              />
            ) : (
              <div
                onClick={() => setIsEditingNotes(true)}
                className="w-full min-h-[40px] border border-dashed border-neutral-800 p-3 text-sm cursor-text hover:border-neutral-600 transition-colors"
              >
                {notesValue ? (
                  <span className="text-neutral-400 whitespace-pre-wrap">{notesValue}</span>
                ) : (
                  <span className="text-neutral-700 italic">Click to add notes...</span>
                )}
              </div>
            )}
          </div>

          {/* Friends who have this item */}
          {item.friendsStatuses && item.friendsStatuses.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-neutral-600 uppercase tracking-wider">FRIENDS:</span>
              <div className="flex flex-wrap gap-2">
                {item.friendsStatuses.map((friend) => (
                  <div
                    key={friend.id}
                    className="text-xs px-2 py-1 bg-neutral-900 border border-neutral-800 flex items-center gap-2"
                  >
                    <span className="text-neutral-300">{friend.displayName || friend.username}</span>
                    <span className={`uppercase ${friend.status === 'WATCHING' || friend.status === 'READING'
                        ? 'text-white'
                        : friend.status === 'COMPLETED'
                          ? 'text-neutral-500'
                          : 'text-neutral-600'
                      }`}>
                      {friend.status}
                    </span>
                    {friend.rating != null && (
                      <span className="text-neutral-500 font-mono">{friend.rating}/10</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Desktop Delete (Hover) */}
      {!readonly && onDelete && (
        <button
          onClick={() => onDelete(item.id)}
          className="hidden sm:flex absolute -top-2 -right-2 w-6 h-6 bg-black border border-neutral-800 text-neutral-500 hover:text-red-500 hover:border-red-900 opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center text-lg leading-none z-10"
        >
          ×
        </button>
      )}
    </div>
  );
};

// ==================== Status Group Component ====================

const StatusGroup: React.FC<{
  config: typeof STATUS_GROUP_CONFIG[0];
  items: MediaItem[];
  totalCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate?: (id: string, updates: Partial<MediaItem>) => void;
  onDelete?: (id: string) => void;
  onAddToMyList?: (item: MediaItem) => void;
  onItemClick?: (item: MediaItem) => void;
  readonly?: boolean;
  showSuggestButton?: boolean;
  viewMode: ViewMode;
  searchQuery?: string;
  onSuggest?: (item: MediaItem) => void;
  // Pagination
  pagination?: StatusGroupPagination;
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
}> = ({
  config,
  items,
  totalCount,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  onAddToMyList,
  onItemClick,
  readonly,
  showSuggestButton,
  viewMode,
  searchQuery,
  onSuggest,
  pagination,
  isLoading = false,
  onPageChange,
}) => {
    // Use totalCount (which accounts for filtering) for display, but items.length for empty check
    if (totalCount === 0) return null;

    const itemsPerPage = 50;
    const totalPages = pagination ? Math.ceil(pagination.total / itemsPerPage) : 1;

    return (
      <div className="space-y-2">
        <StatusGroupHeader
          config={config}
          count={totalCount}
          isExpanded={isExpanded}
          onToggle={onToggle}
        />

        {isExpanded && (
          <>
            <div className={`space-y-2 pl-0 sm:pl-2 animate-fadeIn ${viewMode === 'compact' ? 'grid grid-cols-1 gap-1' : ''}`}>
              {items.map((item) => (
                viewMode === 'compact' ? (
                  <CompactItemCard
                    key={item.id}
                    item={item}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    readonly={readonly}
                    searchQuery={searchQuery}
                  />
                ) : (
                  <MediaItemCard
                    key={item.id}
                    item={item}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onAddToMyList={onAddToMyList}
                    onItemClick={onItemClick}
                    readonly={readonly}
                    showSuggestButton={showSuggestButton}
                    searchQuery={searchQuery}
                    onSuggest={onSuggest}
                  />
                )
              ))}
            </div>

            {/* Pagination controls */}
            {pagination && onPageChange && totalPages > 1 && (
              <div className="pl-0 sm:pl-2">
                <PaginationControls
                  currentPage={pagination.page}
                  totalPages={totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={itemsPerPage}
                  isLoading={isLoading}
                  onPageChange={onPageChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  };

// ==================== Pagination Controls Component ====================

const PaginationControls: React.FC<{
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalPages, totalItems, itemsPerPage, isLoading, onPageChange }) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('ellipsis');
      }
      
      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }
      
      // Always show last page
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    
    return pages;
  };

  return (
    <div className="flex items-center justify-between gap-4 py-3 px-2 bg-neutral-950 border border-neutral-800 rounded text-xs">
      {/* Item count */}
      <span className="text-neutral-500 hidden sm:inline">
        {startItem}-{endItem} of {totalItems}
      </span>

      {/* Page controls */}
      <div className="flex items-center gap-1 mx-auto sm:mx-0">
        {/* Previous */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
          className="px-2 py-1 border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          &larr;
        </button>

        {/* Page numbers */}
        {getPageNumbers().map((page, idx) => (
          page === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-neutral-600">...</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              disabled={isLoading}
              className={`min-w-[28px] px-2 py-1 border transition-colors ${
                page === currentPage
                  ? 'border-white text-white bg-neutral-800'
                  : 'border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white'
              } disabled:opacity-50`}
            >
              {page}
            </button>
          )
        ))}

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || isLoading}
          className="px-2 py-1 border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          &rarr;
        </button>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <svg className="animate-spin h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
    </div>
  );
};

// ==================== Main MediaList Component ====================

export const MediaList: React.FC<MediaListProps> = ({
  title,
  items,
  groupedData,
  mediaTypeFilter,
  onUpdate,
  onDelete,
  onAddToMyList,
  onItemClick,
  readonly,
  filterStatus = '',
  friendActivityFilter = '',
  sortBy = 'status',
  onFilterChange,
  onFriendActivityFilterChange,
  onSortChange,
  showSuggestButton = false,
  // Per-status pagination
  onPageChange,
  loadingStatuses,
}) => {
  // State for collapse
  const [collapseState, setCollapseState] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_STATE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // View mode state (persisted)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      return (saved === 'compact' || saved === 'grouped') ? saved : 'grouped';
    } catch {
      return 'grouped';
    }
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Suggest modal state (lifted from MediaItemCard)
  const [suggestItem, setSuggestItem] = useState<MediaItem | null>(null);

  // Save collapse state to localStorage
  useEffect(() => {
    localStorage.setItem(COLLAPSE_STATE_KEY, JSON.stringify(collapseState));
  }, [collapseState]);

  // Save view mode to localStorage
  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  // Filter items
  let filteredItems = filterStatus
    ? items.filter(item => item.status === filterStatus)
    : items;

  // Apply friend activity filter
  if (friendActivityFilter) {
    filteredItems = filteredItems.filter(item => {
      const friendsStatuses = item.friendsStatuses || [];
      if (friendsStatuses.length === 0) return false;

      switch (friendActivityFilter) {
        case 'friends_watching':
          return friendsStatuses.some(f => f.status === 'WATCHING' || f.status === 'READING');
        case 'friends_done':
          return friendsStatuses.some(f => f.status === 'COMPLETED');
        case 'friends_dropped':
          return friendsStatuses.some(f => f.status === 'DROPPED');
        default:
          return true;
      }
    });
  }

  // Apply search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredItems = filteredItems.filter(item =>
      item.title.toLowerCase().includes(query)
    );
  }

  // Group items by status
  const groupedItems = useMemo(() => {
    const groups: Record<MediaStatus, MediaItem[]> = {
      WATCHING: [],
      READING: [],
      PAUSED: [],
      PLAN_TO_WATCH: [],
      COMPLETED: [],
      DROPPED: [],
    };

    filteredItems.forEach(item => {
      groups[item.status].push(item);
    });

    return groups;
  }, [filteredItems]);

  // Toggle a single group
  const toggleGroup = useCallback((status: MediaStatus) => {
    setCollapseState(prev => ({
      ...prev,
      [status]: !prev[status],
    }));
  }, []);

  // Expand/collapse all
  const toggleAll = useCallback((expand: boolean) => {
    const newState: Record<string, boolean> = {};
    STATUS_GROUP_CONFIG.forEach(config => {
      newState[config.status] = !expand;
    });
    setCollapseState(newState);
  }, []);

  // Check if group is expanded (default to expanded)
  const isGroupExpanded = useCallback((status: MediaStatus) => {
    return collapseState[status] !== true;
  }, [collapseState]);

  // Determine which groups to show based on items type
  const relevantGroups = useMemo(() => {
    const isMangaList = items.some(i => i.type === 'MANGA');
    return STATUS_GROUP_CONFIG.filter(config => {
      // For manga list, show READING instead of WATCHING
      if (isMangaList && config.status === 'WATCHING') return false;
      if (!isMangaList && config.status === 'READING') return false;
      return true;
    });
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-neutral-600 border border-neutral-800 border-dashed">
        <h2 className="text-lg font-bold mb-2 uppercase">{title}</h2>
        <p className="text-sm">NO ITEMS FOUND</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-900 pb-2">
        <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest">{title}</h2>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle */}
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />

          {/* Expand/Collapse All */}
          <div className="flex border border-neutral-800">
            <button
              onClick={() => toggleAll(true)}
              className="px-2 py-1.5 text-xs text-neutral-500 hover:text-white hover:bg-neutral-900 transition-colors"
              title="Expand all"
            >
              EXPAND
            </button>
            <button
              onClick={() => toggleAll(false)}
              className="px-2 py-1.5 text-xs text-neutral-500 hover:text-white hover:bg-neutral-900 transition-colors border-l border-neutral-800"
              title="Collapse all"
            >
              COLLAPSE
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Summary */}
      <StatisticsSummary
        items={items}
        onStatusClick={(status) => onFilterChange && onFilterChange(status)}
        activeStatus={filterStatus}
      />

      {/* Search Input */}
      <SearchInput value={searchQuery} onChange={setSearchQuery} />

      {/* Filter and Sort Controls */}
      {!readonly && (onFilterChange || onSortChange || onFriendActivityFilterChange) && (
        <div className="flex flex-wrap items-center gap-4 text-xs py-2">
          {/* Filter by Friend Activity */}
          {onFriendActivityFilterChange && (
            <div className="flex items-center gap-2">
              <span className="text-neutral-600 uppercase">FRIENDS:</span>
              <select
                value={friendActivityFilter}
                onChange={(e) => onFriendActivityFilterChange(e.target.value as FriendActivityFilter)}
                className="bg-black border border-neutral-800 text-neutral-400 px-2 py-1 uppercase outline-none cursor-pointer hover:border-neutral-600 focus:border-white"
              >
                {FRIEND_ACTIVITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-black">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort By */}
          {onSortChange && (
            <div className="flex items-center gap-2">
              <span className="text-neutral-600 uppercase">SORT:</span>
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value as SortBy)}
                className="bg-black border border-neutral-800 text-neutral-400 px-2 py-1 uppercase outline-none cursor-pointer hover:border-neutral-600 focus:border-white"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-black">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Items count when filtered */}
      {(filterStatus || friendActivityFilter || searchQuery) && (
        <div className="text-xs text-neutral-600 uppercase flex items-center gap-2">
          <span>Showing {filteredItems.length} of {groupedData?.grandTotal ?? items.length} items</span>
          {(filterStatus || searchQuery) && (
            <button
              onClick={() => {
                if (onFilterChange) onFilterChange('');
                setSearchQuery('');
              }}
              className="text-neutral-500 hover:text-white underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Grouped List */}
      {filteredItems.length === 0 ? (
        <div className="py-8 text-center text-neutral-600 border border-neutral-800 border-dashed">
          <p className="text-sm">NO ITEMS MATCH FILTER</p>
          <button
            onClick={() => {
              if (onFilterChange) onFilterChange('');
              setSearchQuery('');
            }}
            className="mt-2 text-xs text-neutral-500 hover:text-white underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {relevantGroups.map(config => {
            const statusItems = groupedItems[config.status];
            const pagination = groupedData?.groups[config.status];
            const isLoading = loadingStatuses?.has(config.status) ?? false;
            // Use pagination total if available, otherwise use local items length
            const totalCount = pagination?.total ?? statusItems.length;
            
            return (
              <StatusGroup
                key={config.status}
                config={config}
                items={statusItems}
                totalCount={totalCount}
                isExpanded={isGroupExpanded(config.status)}
                onToggle={() => toggleGroup(config.status)}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onAddToMyList={onAddToMyList}
                onItemClick={onItemClick}
                readonly={readonly}
                showSuggestButton={showSuggestButton}
                viewMode={viewMode}
                searchQuery={searchQuery}
                onSuggest={setSuggestItem}
                pagination={pagination}
                isLoading={isLoading}
                onPageChange={onPageChange ? (page) => onPageChange(config.status, page) : undefined}
              />
            );
          })}
        </div>
      )}

      {/* Mobile hint for swipe */}
      {!readonly && (
        <div className="sm:hidden text-center text-xs text-neutral-700 py-2">
          Swipe left on an item to increment progress
        </div>
      )}

      {/* Suggest to Friend Modal - lifted to MediaList level */}
      {suggestItem && (
        <SuggestToFriendModal
          item={suggestItem}
          onClose={() => setSuggestItem(null)}
        />
      )}
    </div>
  );
};
