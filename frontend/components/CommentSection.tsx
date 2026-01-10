import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  getMediaComments, 
  createComment, 
  addCommentReaction, 
  removeCommentReaction,
  Comment as ApiComment,
  CommentMediaType,
} from '../services/api';

// Types
interface CommentUser {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string | null;
}

// Internal comment type that extends API type with UI-specific fields
interface Comment {
  id: string;
  content: string;
  isSpoiler: boolean;
  createdAt: string;
  updatedAt: string;
  user: CommentUser;
  reactions: CommentReaction[];
  reactionCount: number;
  userHasReacted: boolean;
  // External comment fields
  isExternal?: boolean;
  externalSource?: string;
  externalUrl?: string;
  externalAuthor?: string;
}

interface CommentReaction {
  id: string;
  reactionType: 'LIKE';
  userId: string;
}

interface CommentsResponse {
  comments: Comment[];
  nextCursor?: string;
  hasMore: boolean;
}

// Transform API comment to internal Comment type
function transformApiComment(apiComment: ApiComment): Comment {
  return {
    id: apiComment.id,
    content: apiComment.content,
    isSpoiler: apiComment.isSpoiler,
    createdAt: apiComment.createdAt,
    updatedAt: apiComment.updatedAt,
    user: apiComment.author ? {
      id: apiComment.author.id,
      username: apiComment.author.username,
      displayName: apiComment.author.displayName || undefined,
      avatarUrl: apiComment.author.avatarUrl,
    } : {
      id: 'external',
      username: apiComment.externalAuthor || 'Unknown',
    },
    reactions: [],
    reactionCount: apiComment.reactionCounts?.LIKE || 0,
    userHasReacted: apiComment.userReaction === 'LIKE',
    isExternal: !!apiComment.externalSource,
    externalSource: apiComment.externalSource || undefined,
    externalUrl: apiComment.externalUrl || undefined,
    externalAuthor: apiComment.externalAuthor || undefined,
  };
}

type FilterOption = 'all' | 'friends' | 'hide_spoilers' | 'show_external';

interface CommentSectionProps {
  refId: string;
  mediaType: 'TV' | 'MOVIE' | 'ANIME' | 'MANGA';
  mediaTitle: string;
  seasonNumber?: number;
  episodeNumber?: number;
  chapterNumber?: number;
  volumeNumber?: number;
  onCommentPosted?: () => void;
}

// Helper function for relative time formatting
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${diffYears}y ago`;
}

// Avatar component
const CommentAvatar: React.FC<{
  user: CommentUser | { username: string; avatarUrl?: string | null };
  size?: 'sm' | 'md';
}> = ({ user, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
  };

  const displayName = ('displayName' in user && user.displayName) || user.username;
  const initials = displayName
    .split(/[_\s]/)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const baseClasses = `${sizeClasses[size]} rounded-full flex items-center justify-center font-bold uppercase flex-shrink-0`;

  if (user.avatarUrl) {
    return (
      <div className={`${baseClasses} overflow-hidden`}>
        <img
          src={user.avatarUrl}
          alt={user.username}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            if (e.currentTarget.parentElement) {
              e.currentTarget.parentElement.innerHTML = `<span class="w-full h-full bg-neutral-800 text-white border border-neutral-700 rounded-full flex items-center justify-center">${initials}</span>`;
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className={`${baseClasses} bg-neutral-800 text-white border border-neutral-700`}>
      {initials}
    </div>
  );
};

// External source badge component
const ExternalSourceBadge: React.FC<{ source: string; url?: string }> = ({ source, url }) => {
  const sourceColors: Record<string, string> = {
    reddit: 'bg-orange-900/50 border-orange-700 text-orange-400',
    mal: 'bg-blue-900/50 border-blue-700 text-blue-400',
    anilist: 'bg-cyan-900/50 border-cyan-700 text-cyan-400',
    default: 'bg-neutral-800 border-neutral-700 text-neutral-400',
  };

  const colorClass = sourceColors[source.toLowerCase()] || sourceColors.default;

  return (
    <div className="flex items-center gap-1">
      <span className={`px-1.5 py-0.5 text-[10px] uppercase border ${colorClass}`}>
        {source}
      </span>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-500 hover:text-white transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  );
};

// Single comment component
const CommentCard: React.FC<{
  comment: Comment;
  onReact: (commentId: string, hasReacted: boolean) => void;
  isReacting: boolean;
  showSpoilerComments: boolean;
}> = ({ comment, onReact, isReacting, showSpoilerComments }) => {
  const [revealed, setRevealed] = useState(false);

  const isSpoilerHidden = comment.isSpoiler && !showSpoilerComments && !revealed;

  const displayName = comment.isExternal
    ? comment.externalAuthor || 'Anonymous'
    : comment.user.displayName || comment.user.username;

  return (
    <div className="border border-neutral-800 bg-neutral-900/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {comment.isExternal ? (
            <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
            </div>
          ) : (
            <CommentAvatar user={comment.user} size="md" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-white truncate">
                {comment.isExternal ? `u/${displayName}` : displayName}
              </span>
              <span className="text-neutral-600 text-xs">
                {formatRelativeTime(new Date(comment.createdAt))}
              </span>
            </div>
          </div>
        </div>

        {/* External source badge or spoiler indicator */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {comment.isExternal && comment.externalSource && (
            <ExternalSourceBadge source={comment.externalSource} url={comment.externalUrl} />
          )}
          {comment.isSpoiler && (
            <span className="px-1.5 py-0.5 text-[10px] uppercase bg-red-900/30 border border-red-800 text-red-400">
              Spoiler
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        {isSpoilerHidden ? (
          <div className="relative">
            <p className="text-sm text-neutral-400 blur-sm select-none">
              {comment.content}
            </p>
            <button
              onClick={() => setRevealed(true)}
              className="absolute inset-0 flex items-center justify-center bg-neutral-900/80"
            >
              <span className="px-3 py-1.5 text-xs uppercase tracking-wider border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors">
                Reveal Spoiler
              </span>
            </button>
          </div>
        ) : (
          <p className="text-sm text-neutral-300 whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        )}
      </div>

      {/* Actions */}
      {!comment.isExternal && (
        <div className="flex items-center gap-4 mt-3 pt-2 border-t border-neutral-800">
          <button
            onClick={() => onReact(comment.id, comment.userHasReacted)}
            disabled={isReacting}
            className={`flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50 ${
              comment.userHasReacted
                ? 'text-red-400 hover:text-red-300'
                : 'text-neutral-500 hover:text-white'
            }`}
          >
            <svg
              className="w-4 h-4"
              fill={comment.userHasReacted ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <span>{comment.reactionCount}</span>
          </button>

          <button className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span>Reply</span>
          </button>
        </div>
      )}
    </div>
  );
};

// Main CommentSection component
export const CommentSection: React.FC<CommentSectionProps> = ({
  refId,
  mediaType,
  mediaTitle,
  seasonNumber,
  episodeNumber,
  chapterNumber,
  volumeNumber,
  onCommentPosted,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [showSpoilerComments, setShowSpoilerComments] = useState(false);
  const [includeExternal, setIncludeExternal] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reactingCommentId, setReactingCommentId] = useState<string | null>(null);
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Fetch comments
  const fetchComments = useCallback(async (cursor?: string) => {
    const isInitialLoad = !cursor;
    if (isInitialLoad) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const data = await getMediaComments(refId, {
        mediaType: mediaType as CommentMediaType,
        seasonNumber,
        episodeNumber,
        chapterNumber,
        volumeNumber,
        includeExternal,
        cursor,
      });

      const transformedComments = data.comments.map(transformApiComment);

      if (isInitialLoad) {
        setComments(transformedComments);
      } else {
        setComments(prev => [...prev, ...transformedComments]);
      }
      setNextCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
      setError('Failed to load comments');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [refId, mediaType, seasonNumber, episodeNumber, chapterNumber, volumeNumber, includeExternal]);

  // Fetch comments when expanded
  useEffect(() => {
    if (isExpanded && comments.length === 0 && !isLoading) {
      fetchComments();
    }
  }, [isExpanded, fetchComments]);

  // Refetch when filter changes
  useEffect(() => {
    if (isExpanded) {
      fetchComments();
    }
  }, [includeExternal]);

  // Post a new comment
  const handlePostComment = async () => {
    if (!newComment.trim() || !user) return;

    setIsPosting(true);
    try {
      const createdApiComment = await createComment({
        content: newComment.trim(),
        refId,
        mediaType: mediaType as CommentMediaType,
        isSpoiler,
        seasonNumber,
        episodeNumber,
        chapterNumber,
        volumeNumber,
      });

      const createdComment = transformApiComment(createdApiComment);

      // Add to beginning of list
      setComments(prev => [createdComment, ...prev]);
      setNewComment('');
      setIsSpoiler(false);
      showToast('Comment posted!', 'success');
      onCommentPosted?.();
    } catch (err: any) {
      console.error('Failed to post comment:', err);
      showToast(err.message || 'Failed to post comment', 'error');
    } finally {
      setIsPosting(false);
    }
  };

  // Handle reaction (like/unlike)
  const handleReaction = async (commentId: string, hasReacted: boolean) => {
    if (!user) {
      showToast('Please log in to react', 'error');
      return;
    }

    setReactingCommentId(commentId);
    try {
      if (hasReacted) {
        await removeCommentReaction(commentId);
      } else {
        await addCommentReaction(commentId, 'LIKE');
      }

      // Update local state
      setComments(prev =>
        prev.map(c => {
          if (c.id === commentId) {
            return {
              ...c,
              userHasReacted: !hasReacted,
              reactionCount: hasReacted ? c.reactionCount - 1 : c.reactionCount + 1,
            };
          }
          return c;
        })
      );
    } catch (err) {
      console.error('Failed to update reaction:', err);
      showToast('Failed to update reaction', 'error');
    } finally {
      setReactingCommentId(null);
    }
  };

  // Handle filter change
  const handleFilterChange = (option: FilterOption) => {
    setFilterOption(option);
    setShowFilterDropdown(false);

    switch (option) {
      case 'hide_spoilers':
        setShowSpoilerComments(false);
        break;
      case 'show_external':
        setIncludeExternal(true);
        break;
      case 'all':
        setShowSpoilerComments(true);
        setIncludeExternal(true);
        break;
      default:
        break;
    }
  };

  // Filter comments based on selected filter
  const filteredComments = comments.filter(comment => {
    if (filterOption === 'hide_spoilers' && comment.isSpoiler) {
      return false;
    }
    if (filterOption === 'friends') {
      // TODO: Implement friends-only filter when friend data is available
      return true;
    }
    return true;
  });

  const commentCount = filteredComments.length;

  return (
    <div className="border border-neutral-800 bg-black">
      {/* Header - Collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-900 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-neutral-400 uppercase tracking-wider">
            Comments
          </span>
          {commentCount > 0 && (
            <span className="text-xs text-neutral-600">({commentCount})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Filter dropdown trigger */}
          {isExpanded && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFilterDropdown(!showFilterDropdown);
                }}
                className="px-2 py-1 text-xs uppercase text-neutral-500 hover:text-white border border-neutral-800 hover:border-neutral-600 transition-colors flex items-center gap-1"
              >
                Filters
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showFilterDropdown && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-neutral-900 border border-neutral-800 z-50">
                  {(['all', 'friends', 'hide_spoilers', 'show_external'] as FilterOption[]).map(option => (
                    <button
                      key={option}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFilterChange(option);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs uppercase hover:bg-neutral-800 transition-colors ${
                        filterOption === option ? 'text-yellow-500' : 'text-neutral-400'
                      }`}
                    >
                      {option.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Expand/Collapse icon */}
          <svg
            className={`w-4 h-4 text-neutral-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-neutral-800">
          {/* Comment form */}
          {user && (
            <div className="p-4 border-b border-neutral-800 bg-neutral-950">
              <div className="flex gap-3">
                <CommentAvatar
                  user={{ username: user.username, avatarUrl: user.avatarUrl }}
                  size="md"
                />
                <div className="flex-1">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={`Comment on ${mediaTitle}...`}
                    rows={3}
                    className="w-full bg-neutral-900 border border-neutral-800 p-3 text-sm text-white placeholder-neutral-600 resize-none outline-none focus:border-neutral-600 transition-colors"
                    disabled={isPosting}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSpoiler}
                        onChange={(e) => setIsSpoiler(e.target.checked)}
                        className="w-4 h-4 bg-neutral-800 border-neutral-700 rounded cursor-pointer"
                        disabled={isPosting}
                      />
                      <span className="text-xs text-neutral-500 uppercase">Spoiler</span>
                    </label>
                    <button
                      onClick={handlePostComment}
                      disabled={isPosting || !newComment.trim()}
                      className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isPosting ? 'Posting...' : 'Post Comment'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Not logged in message */}
          {!user && (
            <div className="p-4 border-b border-neutral-800 bg-neutral-950 text-center">
              <p className="text-sm text-neutral-500">
                <span className="text-neutral-400">Log in</span> to post comments
              </p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="p-8 text-center">
              <div className="text-neutral-500 uppercase tracking-wider text-sm animate-pulse">
                Loading comments...
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="p-8 text-center">
              <div className="text-red-500 text-sm mb-2">{error}</div>
              <button
                onClick={() => fetchComments()}
                className="text-xs text-neutral-500 hover:text-white uppercase"
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && filteredComments.length === 0 && (
            <div className="p-8 text-center border-dashed">
              <p className="text-neutral-600 text-sm uppercase">No comments yet</p>
              <p className="text-neutral-700 text-xs mt-1">Be the first to comment!</p>
            </div>
          )}

          {/* Comments list */}
          {!isLoading && !error && filteredComments.length > 0 && (
            <div className="divide-y divide-neutral-800">
              {filteredComments.map(comment => (
                <div key={comment.id} className="p-4">
                  <CommentCard
                    comment={comment}
                    onReact={handleReaction}
                    isReacting={reactingCommentId === comment.id}
                    showSpoilerComments={showSpoilerComments}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Load more button */}
          {hasMore && !isLoading && (
            <div className="p-4 text-center border-t border-neutral-800">
              <button
                onClick={() => fetchComments(nextCursor)}
                disabled={isLoadingMore}
                className="px-4 py-2 text-xs uppercase tracking-wider border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors disabled:opacity-50"
              >
                {isLoadingMore ? 'Loading...' : 'Load More Comments'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
