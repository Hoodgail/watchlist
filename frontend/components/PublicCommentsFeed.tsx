import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProxiedImage } from './ProxiedImage';
import { getPublicCommentsFeed, Comment } from '../services/api';

// ==================== Types ====================

type PublicComment = Comment;

interface PublicCommentsFeedProps {
  onViewMedia?: (refId: string, mediaType: string) => void;
  limit?: number;
  title?: string;
}

// ==================== Helpers ====================

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w300';

// Helper to get full image URL
const getImageUrl = (imageUrl?: string): string | null => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  if (imageUrl.startsWith('/')) return `${TMDB_IMAGE_BASE}${imageUrl}`;
  return imageUrl;
};

// Format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'JUST NOW';
  if (diffMins < 60) return `${diffMins}M AGO`;
  if (diffHours < 24) return `${diffHours}H AGO`;
  if (diffDays < 7) return `${diffDays}D AGO`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
};

// Truncate text to a maximum length
const truncateText = (text: string, maxLength: number = 50): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

// ==================== Skeleton Component ====================

const CommentCardSkeleton: React.FC = () => (
  <div className="flex-shrink-0 w-[140px] animate-pulse">
    {/* Poster skeleton */}
    <div className="aspect-[2/3] bg-neutral-800 border border-neutral-700" />
    {/* Content skeleton */}
    <div className="mt-2 space-y-1.5">
      <div className="h-3 bg-neutral-800 rounded w-full" />
      <div className="h-2 bg-neutral-800 rounded w-2/3" />
      <div className="h-2 bg-neutral-800 rounded w-full" />
    </div>
  </div>
);

// ==================== Comment Card Component ====================

interface CommentCardProps {
  comment: PublicComment;
  onClick?: () => void;
}

const CommentCard: React.FC<CommentCardProps> = ({ comment, onClick }) => {
  const imageUrl = getImageUrl(comment.media?.imageUrl);
  const authorUsername = comment.author?.username || comment.externalAuthor || 'Unknown';
  const displayName = comment.author?.displayName || comment.externalAuthor || authorUsername;

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-[140px] text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-white snap-start"
    >
      {/* Poster */}
      <div className="relative overflow-hidden bg-zinc-800 border border-neutral-800 transition-all group-hover:border-neutral-600 group-hover:scale-[1.02] group-hover:brightness-110">
        <ProxiedImage
          src={imageUrl}
          alt={comment.media?.title || 'Media'}
          widthClass="w-[140px]"
          width={140}
          height={210}
        />
        
        {/* Spoiler Badge */}
        {comment.isSpoiler && (
          <div className="absolute top-2 right-2 bg-red-600/90 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 tracking-wider">
            SPOILER
          </div>
        )}

        {/* Like count badge */}
        {comment.reactionCounts?.LIKE && comment.reactionCounts.LIKE > 0 && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-neutral-300 text-[10px] px-1.5 py-0.5 flex items-center gap-1 border border-neutral-700">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
            </svg>
            {comment.reactionCounts.LIKE}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="mt-2 space-y-0.5">
        {/* Media Title */}
        <h4 
          className="text-xs font-bold uppercase tracking-tight truncate text-white group-hover:text-neutral-200"
          title={comment.media?.title}
        >
          {comment.media?.title || 'Unknown Media'}
        </h4>

        {/* Username */}
        <p className="text-[10px] text-neutral-500 truncate">
          @{authorUsername}
        </p>

        {/* Comment snippet */}
        <p 
          className={`text-[11px] leading-tight ${
            comment.isSpoiler 
              ? 'text-neutral-600 blur-sm hover:blur-none transition-all' 
              : 'text-neutral-400'
          }`}
          title={comment.isSpoiler ? 'Reveal spoiler' : comment.content}
        >
          "{truncateText(comment.content)}"
        </p>

        {/* Timestamp */}
        <p className="text-[9px] text-neutral-600 uppercase tracking-wider mt-1">
          {formatRelativeTime(comment.createdAt)}
        </p>
      </div>
    </button>
  );
};

// ==================== Main Component ====================

export const PublicCommentsFeed: React.FC<PublicCommentsFeedProps> = ({
  onViewMedia,
  limit = 20,
  title = 'LATEST DISCUSSIONS',
}) => {
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Fetch public comments
  useEffect(() => {
    const fetchComments = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await getPublicCommentsFeed({ limit });
        setComments(data.comments);
      } catch (err) {
        console.error('Failed to load public comments:', err);
        setError(err instanceof Error ? err.message : 'Failed to load comments');
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [limit]);

  // Handle scroll visibility for arrows
  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  }, []);

  // Update arrow visibility when comments load
  useEffect(() => {
    handleScroll();
  }, [comments, handleScroll]);

  // Scroll handler
  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Handle card click
  const handleCardClick = (comment: PublicComment) => {
    if (onViewMedia) {
      onViewMedia(comment.refId, comment.mediaType);
    }
  };

  // Don't render if no comments and not loading
  if (!loading && comments.length === 0) {
    return null;
  }

  // Don't render on error (graceful degradation)
  if (error && !loading) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">
          {title}
        </h3>
        {/* Optional "See All" link - can be enabled later */}
        {/* <button className="text-xs text-neutral-500 hover:text-white uppercase tracking-wider transition-colors">
          See All
        </button> */}
      </div>

      {/* Scrollable Container */}
      <div className="relative group">
        {/* Left Arrow */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 border border-neutral-700 p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-neutral-900"
            aria-label="Scroll left"
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
            aria-label="Scroll right"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Scrollable Content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {loading ? (
            // Loading skeletons
            <>
              {Array.from({ length: 6 }).map((_, i) => (
                <CommentCardSkeleton key={i} />
              ))}
            </>
          ) : (
            // Comment cards
            comments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                onClick={() => handleCardClick(comment)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicCommentsFeed;
