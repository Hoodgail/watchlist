import React, { useState, useEffect } from 'react';
import { MediaItem, User } from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w200';

// Helper to get full image URL
const getImageUrl = (imageUrl?: string): string | null => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  if (imageUrl.startsWith('/')) return `${TMDB_IMAGE_BASE}${imageUrl}`;
  return imageUrl;
};

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

  const imageUrl = getImageUrl(item.imageUrl);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const following = await api.getFollowing();
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
      await api.sendSuggestion(selectedFriendId, {
        title: item.title,
        type: item.type,
        refId: item.refId,
        imageUrl: item.imageUrl,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-black border border-neutral-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
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
        <div className="p-4 border-b border-neutral-800 bg-neutral-950">
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
        <div className="p-4 space-y-4">
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
              <div className="py-4 text-center text-neutral-600 text-sm border border-dashed border-neutral-800">
                <p>NO FRIENDS TO SUGGEST TO</p>
                <p className="text-xs mt-1 text-neutral-700">Follow users first</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {friends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => setSelectedFriendId(friend.id)}
                    className={`w-full p-3 text-left border transition-colors ${selectedFriendId === friend.id
                        ? 'border-white bg-white text-black'
                        : 'border-neutral-800 hover:border-neutral-600 text-white'
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
              className="w-full bg-neutral-950 border border-neutral-800 p-3 text-sm text-white placeholder-neutral-700 focus:border-white outline-none resize-none min-h-[80px]"
            />
            <div className="text-xs text-neutral-700 text-right">
              {message.length}/200
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-xs font-bold uppercase tracking-wider border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !selectedFriendId || friends.length === 0}
            className="flex-1 py-3 text-xs font-bold uppercase tracking-wider bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'SENDING...' : 'SEND'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuggestToFriendModal;
