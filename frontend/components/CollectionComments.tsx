import React, { useState, useEffect } from 'react';
import { CollectionComment } from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';

interface CollectionCommentsProps {
  collectionId: string;
  canComment: boolean;
  currentUserId?: string;
}

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

export const CollectionComments: React.FC<CollectionCommentsProps> = ({
  collectionId,
  canComment,
  currentUserId,
}) => {
  const { showToast } = useToast();

  // State
  const [comments, setComments] = useState<CollectionComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Load comments on mount and collectionId change
  useEffect(() => {
    const loadComments = async () => {
      setLoading(true);
      try {
        const data = await api.getCollectionComments(collectionId);
        setComments(data);
      } catch (err: any) {
        console.error('Failed to load comments:', err);
        showToast(err.message || 'Failed to load comments', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadComments();
  }, [collectionId, showToast]);

  // Add comment
  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setActionLoading('add');
    try {
      const comment = await api.addCollectionComment(collectionId, newComment.trim());
      setComments(prev => [comment, ...prev]);
      setNewComment('');
      showToast('Comment posted', 'success');
    } catch (err: any) {
      console.error('Failed to add comment:', err);
      showToast(err.message || 'Failed to add comment', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Start editing
  const handleStartEdit = (comment: CollectionComment) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditContent('');
  };

  // Save edit
  const handleSaveEdit = async (commentId: string) => {
    if (!editContent.trim()) return;

    setActionLoading(commentId);
    try {
      const updated = await api.updateCollectionComment(collectionId, commentId, editContent.trim());
      setComments(prev => prev.map(c => (c.id === commentId ? updated : c)));
      setEditingCommentId(null);
      setEditContent('');
      showToast('Comment updated', 'success');
    } catch (err: any) {
      console.error('Failed to update comment:', err);
      showToast(err.message || 'Failed to update comment', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Delete comment
  const handleDelete = async (commentId: string) => {
    setActionLoading(commentId);
    try {
      await api.deleteCollectionComment(collectionId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      showToast('Comment deleted', 'success');
    } catch (err: any) {
      console.error('Failed to delete comment:', err);
      showToast(err.message || 'Failed to delete comment', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Check if comment belongs to current user
  const isOwnComment = (comment: CollectionComment): boolean => {
    return !!currentUserId && comment.user.id === currentUserId;
  };

  // Get user initials for avatar
  const getInitials = (user: CollectionComment['user']): string => {
    const name = user.displayName || user.username;
    return name
      .split(/[_\s]/)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-4">
      {/* Add comment form */}
      {canComment && (
        <div className="bg-neutral-950 p-4 border border-neutral-800">
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            className="w-full bg-black border border-neutral-800 p-3 text-sm text-white placeholder-neutral-600 resize-none outline-none focus:border-white transition-colors"
            disabled={actionLoading === 'add'}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || actionLoading === 'add'}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-white text-black hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading === 'add' ? 'POSTING...' : 'POST'}
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-8 text-center">
          <div className="text-neutral-500 uppercase tracking-wider text-sm animate-pulse">
            Loading comments...
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && comments.length === 0 && (
        <div className="py-8 text-center border border-dashed border-neutral-800">
          <p className="text-neutral-600 text-sm uppercase">No comments yet</p>
          {canComment && (
            <p className="text-neutral-700 text-xs mt-1">Be the first to comment!</p>
          )}
        </div>
      )}

      {/* Comments list */}
      {!loading && comments.length > 0 && (
        <div className="space-y-0">
          {comments.map(comment => (
            <div
              key={comment.id}
              className="border-b border-neutral-800 py-4 first:pt-0 last:border-b-0"
            >
              {editingCommentId === comment.id ? (
                // Edit mode
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    rows={3}
                    className="w-full bg-black border border-neutral-800 p-3 text-sm text-white placeholder-neutral-600 resize-none outline-none focus:border-white transition-colors"
                    disabled={actionLoading === comment.id}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleCancelEdit}
                      disabled={actionLoading === comment.id}
                      className="px-3 py-1.5 text-xs uppercase tracking-wider text-neutral-400 hover:text-white transition-colors"
                    >
                      CANCEL
                    </button>
                    <button
                      onClick={() => handleSaveEdit(comment.id)}
                      disabled={!editContent.trim() || actionLoading === comment.id}
                      className="px-3 py-1.5 text-xs uppercase tracking-wider bg-white text-black hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {actionLoading === comment.id ? 'SAVING...' : 'SAVE'}
                    </button>
                  </div>
                </div>
              ) : (
                // Display mode
                <div>
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-2">
                    {/* Avatar */}
                    {comment.user.avatarUrl ? (
                      <img
                        src={comment.user.avatarUrl}
                        alt={comment.user.username}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {getInitials(comment.user)}
                      </div>
                    )}

                    {/* User info and time */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white truncate">
                          {comment.user.displayName || comment.user.username}
                        </span>
                        <span className="text-neutral-600 text-xs">
                          {formatRelativeTime(comment.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions for own comments */}
                    {isOwnComment(comment) && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleStartEdit(comment)}
                          disabled={actionLoading === comment.id}
                          className="text-xs uppercase text-neutral-500 hover:text-white transition-colors disabled:opacity-50"
                        >
                          EDIT
                        </button>
                        <button
                          onClick={() => handleDelete(comment.id)}
                          disabled={actionLoading === comment.id}
                          className="text-xs uppercase text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === comment.id ? 'DELETING...' : 'DELETE'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <p className="text-sm text-neutral-300 whitespace-pre-wrap break-words pl-11">
                    {comment.content}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CollectionComments;
