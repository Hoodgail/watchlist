import React, { useState, useEffect } from 'react';
import { MediaItem, User } from '@/types';
import { getFollowing, sendSuggestion } from '@/features/social/api';
import { resolveMediaImageUrl } from '@/shared/media';
import { useToast } from '@/context/ToastContext';

interface SuggestToFriendModalProps {
  item: MediaItem;
  onClose: () => void;
}

export const SuggestToFriendModal: React.FC<SuggestToFriendModalProps> = ({
  item,
  onClose,
}) => {
  const { showToast } = useToast();
  const [friends, setFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [imageError, setImageError] = useState(false);

  const imageUrl = resolveMediaImageUrl(item.imageUrl);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const following = await getFollowing();
      setFriends(following);
    } catch (error) {
      console.error('Failed to load friends:', error);
      showToast('Failed to load friends', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!selectedFriendId) {
      showToast('Please select a friend', 'error');
      return;
    }

    if (!item.refId) {
      showToast('Cannot suggest this item - missing reference ID', 'error');
      return;
    }

    setSending(true);
    try {
      await sendSuggestion(selectedFriendId, {
        type: item.type,
        refId: item.refId,
        message: message.trim() || undefined,
      });

      const friendName = friends.find((f) => f.id === selectedFriendId)?.username || 'friend';
      showToast(`Suggested "${item.title}" to ${friendName}`, 'success');
      onClose();
    } catch (error: any) {
      console.error('Failed to send suggestion:', error);
      showToast(error.message || 'Failed to send suggestion', 'error');
    } finally {
      setSending(false);
    }
  };

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

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

  return (
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
    >
      <div className="modal-shell max-w-md overflow-y-auto">
        {/* Header */}
        <div className="modal-header">
          <h3 className="text-sm font-bold uppercase tracking-widest">
            SUGGEST TO FRIEND
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Media Info */}
        <div className="modal-section bg-neutral-950">
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
            <div>
              <h4 className="font-bold text-white uppercase tracking-tight">
                {item.title}
              </h4>
              <span className="text-xs text-neutral-500 uppercase">
                {item.type}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="modal-content space-y-4">
          {/* Friend Selection */}
          <div className="space-y-2">
            <label className="text-xs text-neutral-600 uppercase tracking-wider block">
              SELECT FRIEND
            </label>

            {loading ? (
              <div className="py-4 text-center text-neutral-500 text-sm uppercase animate-pulse">
                Loading friends...
              </div>
            ) : friends.length === 0 ? (
                <div className="empty-state py-4">
                <p>NO FRIENDS TO SUGGEST TO</p>
                <p className="text-xs mt-1 text-neutral-700">Follow users first</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {friends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => setSelectedFriendId(friend.id)}
                    className={`option-card text-left ${selectedFriendId === friend.id
                        ? 'selected text-white'
                        : 'text-white'
                       }`}
                  >
                    <span className="text-sm font-bold uppercase">
                      {friend.username}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Optional Message */}
          <div className="space-y-2">
            <label className="text-xs text-neutral-600 uppercase tracking-wider block">
              MESSAGE (OPTIONAL)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a note..."
              maxLength={200}
                className="search-field w-full text-sm resize-none min-h-[80px]"
              />
            <div className="text-xs text-neutral-700 text-right">
              {message.length}/200
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            onClick={onClose}
            className="action-btn-ghost flex-1"
          >
            CANCEL
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !selectedFriendId || friends.length === 0}
            className="action-btn flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'SENDING...' : 'SEND'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuggestToFriendModal;
