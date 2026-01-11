import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getPublicCommentsFeed, Comment } from '../services/api';

// ==================== Types ====================

type PublicComment = Comment;

interface PublicCommentsFeedProps {
  onViewMedia?: (refId: string, mediaType: string, title?: string) => void;
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
const truncateText = (text: string, maxLength: number = 80): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

// Get initials from a name or username
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

// ==================== Avatar Component ====================

interface AuthorAvatarProps {
  avatarUrl?: string | null;
  username: string;
  displayName?: string | null;
  size?: 'sm' | 'md';
}

const AuthorAvatar: React.FC<AuthorAvatarProps> = ({ avatarUrl, username, displayName, size = 'sm' }) => {
  const [imageError, setImageError] = useState(false);
  const initials = getInitials(displayName || username);
  const sizeClasses = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';
  
  if (avatarUrl && !imageError) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        className={`${sizeClasses} rounded-full object-cover border border-neutral-600`}
        onError={() => setImageError(true)}
      />
    );
  }
  
  // Fallback to initials
  return (
    <div 
      className={`${sizeClasses} rounded-full bg-neutral-700 border border-neutral-600 flex items-center justify-center font-bold text-neutral-300`}
      title={displayName || username}
    >
      {initials}
    </div>
  );
};

// ==================== Skeleton Component ====================

const CommentCardSkeleton: React.FC = () => (
  <div className="flex-shrink-0 w-[200px] sm:w-[240px] h-[140px] sm:h-[160px] animate-pulse bg-neutral-800 rounded-lg border border-neutral-700" />
);

// ==================== Comment Card Component ====================

interface CommentCardProps {
  comment: PublicComment;
  onClick?: () => void;
}

const CommentCard: React.FC<CommentCardProps> = ({ comment, onClick }) => {
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const imageUrl = getImageUrl(comment.media?.imageUrl);
  const authorUsername = comment.author?.username || comment.externalAuthor || 'Unknown';
  const displayName = comment.author?.displayName || comment.externalAuthor || authorUsername;
  const avatarUrl = comment.author?.avatarUrl || comment.externalAuthorAvatar;

  const isSpoilerHidden = comment.isSpoiler && !spoilerRevealed;

  const handleRevealSpoiler = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click from navigating
    setSpoilerRevealed(true);
  };

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-[200px] sm:w-[240px] h-[140px] sm:h-[160px] relative overflow-hidden rounded-lg border border-neutral-800 group focus:outline-none focus-visible:ring-2 focus-visible:ring-white snap-start transition-all hover:border-neutral-600 hover:scale-[1.02]"
    >
      {/* Background Image */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={comment.media?.title || 'Media'}
          className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-neutral-800" />
      )}
      
      {/* Dark Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
      
      {/* Spoiler Badge */}
      {comment.isSpoiler && (
        <div className="absolute top-2 right-2 bg-red-600/90 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 tracking-wider rounded">
          SPOILER
        </div>
      )}

      {/* Like count badge */}
      {comment.reactionCounts?.LIKE && comment.reactionCounts.LIKE > 0 && (
        <div className="absolute top-2 left-2 bg-black/60 text-neutral-200 text-[10px] px-1.5 py-0.5 flex items-center gap-1 rounded">
          <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
          </svg>
          {comment.reactionCounts.LIKE}
        </div>
      )}

      {/* Content Overlay */}
      <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col gap-1.5">
        {/* Media Title */}
        <h4 
          className="text-xs font-bold uppercase tracking-tight text-white line-clamp-1 drop-shadow-lg"
          title={comment.media?.title}
        >
          {comment.media?.title || 'Unknown Media'}
        </h4>

        {/* Comment snippet with spoiler handling */}
        <div className="relative">
          <p 
            className={`text-[11px] leading-tight line-clamp-2 drop-shadow ${
              isSpoilerHidden 
                ? 'text-neutral-400 blur-sm select-none' 
                : 'text-neutral-200'
            }`}
          >
            "{truncateText(comment.content)}"
          </p>
          
          {/* Reveal Spoiler Button Overlay */}
          {isSpoilerHidden && (
            <div 
              className="absolute inset-0 flex items-center justify-center"
              onClick={handleRevealSpoiler}
            >
              <span className="bg-neutral-900/80 border border-neutral-600 text-neutral-300 text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer">
                Reveal
              </span>
            </div>
          )}
        </div>

        {/* Author Row */}
        <div className="flex items-center gap-2 mt-1">
          <AuthorAvatar
            avatarUrl={avatarUrl}
            username={authorUsername}
            displayName={displayName}
            size="sm"
          />
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-[10px] text-neutral-300 truncate font-medium">
              {displayName}
            </span>
            <span className="text-[9px] text-neutral-500 uppercase tracking-wider flex-shrink-0">
              {formatRelativeTime(comment.createdAt)}
            </span>
          </div>
        </div>
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
      onViewMedia(comment.refId, comment.mediaType, comment.media?.title);
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
