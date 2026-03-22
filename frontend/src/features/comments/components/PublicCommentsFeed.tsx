import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getPublicCommentsFeed, type Comment } from '@/features/social/api';
import { resolveMediaImageUrl } from '@/shared/media';
import { UserAvatar } from '@/shared/ui';
import { formatRelativeTime } from '@/shared/utils/time';

// ==================== Types ====================

type PublicComment = Comment;

interface PublicCommentsFeedProps {
  onViewMedia?: (refId: string, mediaType: string, title?: string) => void;
  limit?: number;
  title?: string;
}

// ==================== Helpers ====================

// Truncate text to a maximum length
const truncateText = (text: string, maxLength: number = 80): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

// ==================== Skeleton Component ====================

const CommentCardSkeleton: React.FC = () => (
  <div className="flex-shrink-0 w-[220px] sm:w-[240px] h-[160px] animate-pulse comment-card-shell" />
);

// ==================== Comment Card Component ====================

interface CommentCardProps {
  comment: PublicComment;
  onClick?: () => void;
}

const CommentCard: React.FC<CommentCardProps> = ({ comment, onClick }) => {
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const imageUrl = resolveMediaImageUrl(comment.media?.imageUrl);
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
      className="comment-card-shell flex-shrink-0 w-[220px] sm:w-[240px] h-[160px] relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-white snap-start transition-all hover:border-neutral-600 hover:scale-[1.02]"
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
          <UserAvatar
            username={authorUsername}
            displayName={displayName}
            avatarUrl={avatarUrl}
            sizeClassName="w-6 h-6 text-[10px]"
            fallbackClassName="bg-neutral-700 border border-neutral-600 text-neutral-300"
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
    <div className="screen-stack">
      {/* Header */}
      <div className="section-label-row px-1">
        <h3>
          {title}
        </h3>
        {/* Optional "See All" link - can be enabled later */}
        {/* <button className="text-xs text-neutral-500 hover:text-white uppercase tracking-wider transition-colors">
          See All
        </button> */}
      </div>

      {/* Scrollable Container */}
      <div className="relative group screen-panel pad soft">
        {/* Left Arrow */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 app-icon-button opacity-0 group-hover:opacity-100"
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
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 app-icon-button opacity-0 group-hover:opacity-100"
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
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory"
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
