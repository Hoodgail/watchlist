import React, { useState, useEffect, useCallback } from 'react';
import { getFriendCommentsFeed, type Comment } from '@/features/social/api';
import { resolveMediaImageUrl } from '@/shared/media';
import { UserAvatar } from '@/shared/ui';
import { formatRelativeTime } from '@/shared/utils/time';

// Type alias for cleaner code
type FeedComment = Comment;

interface FriendActivityFeedProps {
  onViewMedia?: (refId: string, mediaType: string, title?: string) => void;
  onViewProfile?: (username: string) => void;
  limit?: number;
}

// ==================== Constants ====================

const DEFAULT_LIMIT = 20;
const COMMENT_PREVIEW_LENGTH = 100;

// ==================== Helpers ====================

const formatMediaContext = (comment: FeedComment): string => {
  const title = comment.media?.title || 'Unknown';
  
  if (comment.mediaType === 'MANGA' && comment.chapterNumber) {
    return `${title} Ch. ${comment.chapterNumber}`;
  }
  if (comment.seasonNumber && comment.episodeNumber) {
    return `${title} S${comment.seasonNumber}E${comment.episodeNumber}`;
  }
  if (comment.episodeNumber) {
    return `${title} E${comment.episodeNumber}`;
  }
  return title;
};

const getMediaTypeIcon = (mediaType: FeedComment['mediaType']): string => {
  switch (mediaType) {
    case 'MOVIE': return '\uD83C\uDFAC'; // Film clapper emoji
    case 'TV': return '\uD83D\uDCFA'; // TV emoji
    case 'ANIME': return '\uD83C\uDF8C'; // Japanese flags emoji (anime)
    case 'MANGA': return '\uD83D\uDCDA'; // Books emoji
    default: return '\uD83C\uDFAC';
  }
};

const truncateComment = (content: string, maxLength: number = COMMENT_PREVIEW_LENGTH): string => {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength).trim() + '...';
};

// ==================== Skeleton Loader ====================

const ActivitySkeleton: React.FC = () => (
  <div className="list-card pad animate-pulse">
    <div className="flex gap-3 items-start">
      {/* Avatar skeleton */}
      <div className="w-10 h-10 rounded-full bg-neutral-800 flex-shrink-0" />
      
      <div className="flex-grow">
        {/* Header skeleton */}
        <div className="h-4 w-48 bg-neutral-800 rounded mb-3" />
        
        <div className="flex gap-3">
          {/* Poster skeleton */}
          <div className="w-12 h-[72px] bg-neutral-800 flex-shrink-0" />
          
          <div className="flex-grow">
            {/* Title skeleton */}
            <div className="h-4 w-32 bg-neutral-800 rounded mb-2" />
            {/* Comment skeleton */}
            <div className="h-3 w-full bg-neutral-800 rounded mb-2" />
            <div className="h-3 w-3/4 bg-neutral-800 rounded mb-2" />
            {/* Time skeleton */}
            <div className="h-3 w-16 bg-neutral-800 rounded" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ==================== Activity Card ====================

interface ActivityCardProps {
  comment: FeedComment;
  onViewMedia?: (refId: string, mediaType: string, title?: string) => void;
  onViewProfile?: (username: string) => void;
}

const ActivityCard: React.FC<ActivityCardProps> = ({
  comment,
  onViewMedia,
  onViewProfile,
}) => {
  const [imageError, setImageError] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  
  // Handle nullable author (for external comments or edge cases)
  const authorUsername = comment.author?.username || comment.externalAuthor || 'Unknown';
  const authorDisplayName = comment.author?.displayName || comment.externalAuthor || authorUsername;
  const authorAvatarUrl = comment.author?.avatarUrl || comment.externalAuthorAvatar;
  
  const imageUrl = resolveMediaImageUrl(comment.media?.imageUrl);
  const mediaContext = formatMediaContext(comment);
  const mediaTypeIcon = getMediaTypeIcon(comment.mediaType);
  
  const handleMediaClick = () => {
    if (onViewMedia) {
      onViewMedia(comment.refId, comment.mediaType, comment.media?.title);
    }
  };
  
  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onViewProfile && comment.author?.username) {
      onViewProfile(comment.author.username);
    }
  };

  return (
    <div 
      className="list-card hover:border-neutral-600 transition-all cursor-pointer group"
      onClick={handleMediaClick}
    >
      <div className="p-4">
        <div className="flex gap-3 items-start">
          {/* User Avatar */}
          <button
            onClick={handleProfileClick}
            className="flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            <UserAvatar
              username={authorUsername}
              displayName={authorDisplayName}
              avatarUrl={authorAvatarUrl}
              sizeClassName="w-10 h-10 text-sm"
              fallbackClassName="bg-neutral-800 text-white border border-neutral-700"
            />
          </button>
          
          <div className="flex-grow min-w-0">
            {/* Header: username commented on */}
            <div className="text-sm mb-2">
              <button
                onClick={handleProfileClick}
                className="font-bold text-white uppercase tracking-tight hover:underline decoration-1 underline-offset-2"
              >
                {authorDisplayName}
              </button>
              <span className="text-neutral-500 ml-1">commented on</span>
            </div>
            
            <div className="flex gap-3">
              {/* Media Poster */}
              {imageUrl && !imageError ? (
                <div className="flex-shrink-0 w-12 border border-neutral-800 group-hover:border-neutral-700 transition-colors">
                  <img
                    src={imageUrl}
                    alt={comment.media?.title || 'Media'}
                    onError={() => setImageError(true)}
                    className="w-full aspect-[2/3] object-cover"
                  />
                </div>
              ) : (
                <div className="flex-shrink-0 w-12 aspect-[2/3] bg-neutral-900 border border-neutral-800 flex items-center justify-center text-lg">
                  {mediaTypeIcon}
                </div>
              )}
              
              <div className="flex-grow min-w-0">
                {/* Media title with type icon */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg" title={comment.mediaType}>{mediaTypeIcon}</span>
                  <h4 className="font-bold text-white uppercase tracking-tight truncate text-sm group-hover:underline decoration-1 underline-offset-2">
                    {mediaContext}
                  </h4>
                </div>
                
                {/* Comment content */}
                {comment.isSpoiler && !spoilerRevealed ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSpoilerRevealed(true);
                    }}
                    className="text-sm text-neutral-600 italic flex items-center gap-2 hover:text-neutral-400 transition-colors"
                  >
                    <span className="blur-sm select-none">Hidden spoiler content</span>
                    <span className="bg-yellow-900/50 text-yellow-500 text-xs px-1.5 py-0.5 uppercase font-bold border border-yellow-800 no-blur">
                      SPOILER
                    </span>
                  </button>
                ) : (
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    "{truncateComment(comment.content)}"
                    {comment.isSpoiler && (
                      <span className="ml-2 bg-yellow-900/50 text-yellow-500 text-xs px-1.5 py-0.5 uppercase font-bold border border-yellow-800">
                        SPOILER
                      </span>
                    )}
                  </p>
                )}
                
                {/* Timestamp */}
                <div className="text-xs text-neutral-600 uppercase mt-2">
                  {formatRelativeTime(comment.createdAt)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== Main Component ====================

export const FriendActivityFeed: React.FC<FriendActivityFeedProps> = ({
  onViewMedia,
  onViewProfile,
  limit = DEFAULT_LIMIT,
}) => {
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async (cursor?: string) => {
    const isInitialLoad = !cursor;
    
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const data = await getFriendCommentsFeed({ limit, cursor });

      if (isInitialLoad) {
        setComments(data.comments);
      } else {
        setComments(prev => [...prev, ...data.comments]);
      }
      setNextCursor(data.nextCursor);
    } catch (err) {
      console.error('Failed to fetch friend activity feed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchFeed(nextCursor);
    }
  };

  return (
    <div className="screen-stack">
      {/* Header */}
      <div className="section-label-row">
        <h2>
          FRIEND ACTIVITY
        </h2>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          <ActivitySkeleton />
          <ActivitySkeleton />
          <ActivitySkeleton />
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="empty-state text-red-400">
          <p className="text-red-400 text-sm uppercase mb-3">{error}</p>
          <button
            onClick={() => fetchFeed()}
            className="action-btn-ghost px-4"
          >
            RETRY
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && comments.length === 0 && (
        <div className="empty-state">
          <p className="text-sm uppercase">NO RECENT ACTIVITY FROM FRIENDS</p>
          <p className="text-xs mt-2 text-neutral-700">
            Comments from people you follow will appear here
          </p>
        </div>
      )}

      {/* Activity Feed */}
      {!loading && !error && comments.length > 0 && (
        <div className="space-y-4">
          {comments.map((comment) => (
            <ActivityCard
              key={comment.id}
              comment={comment}
              onViewMedia={onViewMedia}
              onViewProfile={onViewProfile}
            />
          ))}
        </div>
      )}

      {/* Load More Button */}
      {!loading && nextCursor && (
        <div className="flex justify-center pt-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="action-btn-ghost px-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <span className="animate-pulse">LOADING...</span>
            ) : (
              'LOAD MORE'
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default FriendActivityFeed;
