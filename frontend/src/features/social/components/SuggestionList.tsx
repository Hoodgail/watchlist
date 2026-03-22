import React, { useState, useEffect } from 'react';
import { Suggestion, SuggestionStatus, SuggestionUser } from '@/types';
import {
  acceptSuggestion,
  deleteSuggestion,
  dismissSuggestion,
  getReceivedSuggestions,
  getSentSuggestions,
} from '@/features/social/api';
import { resolveMediaImageUrl } from '@/shared/media';
import { UserAvatar } from '@/shared/ui';
import { formatRelativeTime } from '@/shared/utils/time';
import { useToast } from '@/context/ToastContext';

const STATUS_FILTER_OPTIONS: { value: SuggestionStatus | ''; label: string }[] = [
  { value: 'PENDING', label: 'PENDING' },
  { value: 'ACCEPTED', label: 'ACCEPTED' },
  { value: 'DISMISSED', label: 'DISMISSED' },
];

interface SuggestionListProps {
  onSuggestionCountChange?: (count: number) => void;
}

export const SuggestionList: React.FC<SuggestionListProps> = ({ onSuggestionCountChange }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus>('PENDING');
  const [receivedSuggestions, setReceivedSuggestions] = useState<Suggestion[]>([]);
  const [sentSuggestions, setSentSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadSuggestions();
  }, [statusFilter]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      if (activeTab === 'received') {
        const data = await getReceivedSuggestions(statusFilter);
        setReceivedSuggestions(data);
      } else {
        const data = await getSentSuggestions();
        setSentSuggestions(data);
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
      showToast('Failed to load suggestions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, [activeTab]);

  // Update pending count when received suggestions change
  useEffect(() => {
    if (onSuggestionCountChange && activeTab === 'received' && statusFilter === 'PENDING') {
      onSuggestionCountChange(receivedSuggestions.length);
    }
  }, [receivedSuggestions, onSuggestionCountChange, activeTab, statusFilter]);

  const handleAccept = async (id: string) => {
    setActionLoading(id);
    try {
      await acceptSuggestion(id);
      setReceivedSuggestions((prev) => prev.filter((s) => s.id !== id));
      showToast('Suggestion accepted and added to your list!', 'success');
      if (onSuggestionCountChange) {
        onSuggestionCountChange(receivedSuggestions.length - 1);
      }
    } catch (error: any) {
      console.error('Failed to accept suggestion:', error);
      showToast(error.message || 'Failed to accept suggestion', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (id: string) => {
    setActionLoading(id);
    try {
      await dismissSuggestion(id);
      setReceivedSuggestions((prev) => prev.filter((s) => s.id !== id));
      showToast('Suggestion dismissed', 'info');
      if (onSuggestionCountChange) {
        onSuggestionCountChange(receivedSuggestions.length - 1);
      }
    } catch (error: any) {
      console.error('Failed to dismiss suggestion:', error);
      showToast(error.message || 'Failed to dismiss suggestion', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await deleteSuggestion(id);
      setSentSuggestions((prev) => prev.filter((s) => s.id !== id));
      showToast('Suggestion deleted', 'info');
    } catch (error: any) {
      console.error('Failed to delete suggestion:', error);
      showToast(error.message || 'Failed to delete suggestion', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const suggestions = activeTab === 'received' ? receivedSuggestions : sentSuggestions;

  return (
    <div className="screen-stack">
      <div className="screen-head-block">
        <span className="screen-kicker">Recommendation inbox</span>
        <h2 className="screen-title">Suggestions</h2>
        <p className="screen-note">Accept what looks promising, dismiss the misses, and keep your social queue tidy.</p>
      </div>

      {/* Tabs */}
      <div className="chip-tabs">
        <button
          onClick={() => setActiveTab('received')}
          className={`chip-tab ${
            activeTab === 'received'
              ? 'active'
              : ''
          }`}
        >
          RECEIVED
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`chip-tab ${
            activeTab === 'sent'
              ? 'active'
              : ''
          }`}
        >
          SENT
        </button>
      </div>

      {/* Status Filter (only for received) */}
      {activeTab === 'received' && (
        <div className="screen-panel pad flex items-center gap-2 text-xs">
          <span className="screen-kicker">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SuggestionStatus)}
            className="inline-select uppercase"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-black">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="py-12 text-center text-neutral-500 uppercase tracking-wider animate-pulse">
          Loading...
        </div>
      )}

      {/* Empty State */}
      {!loading && suggestions.length === 0 && (
        <div className="empty-state">
          <p className="text-sm uppercase">
            {activeTab === 'received'
              ? `NO ${statusFilter} SUGGESTIONS`
              : 'NO SENT SUGGESTIONS'}
          </p>
          <p className="text-xs mt-2 text-neutral-700">
            {activeTab === 'received'
              ? 'Suggestions from friends will appear here'
              : 'Suggest media to friends from your list'}
          </p>
        </div>
      )}

      {/* Suggestions List */}
      {!loading && suggestions.length > 0 && (
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              isReceived={activeTab === 'received'}
              onAccept={handleAccept}
              onDismiss={handleDismiss}
              onDelete={handleDelete}
              isLoading={actionLoading === suggestion.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface SuggestionCardProps {
  suggestion: Suggestion;
  isReceived: boolean;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  isReceived,
  onAccept,
  onDismiss,
  onDelete,
  isLoading,
}) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = resolveMediaImageUrl(suggestion.imageUrl);
  const user = isReceived ? suggestion.fromUser : suggestion.toUser;

  return (
    <div className="border border-neutral-800 bg-black hover:border-neutral-600 transition-all">
      <div className="p-4 list-card">
        <div className="flex gap-4">
          {/* Poster Image */}
          {imageUrl && !imageError && (
            <div className="flex-shrink-0 w-16 sm:w-20">
              <img
                src={imageUrl}
                alt={suggestion.title}
                onError={() => setImageError(true)}
                className="w-full aspect-[2/3] object-cover border border-neutral-800"
              />
            </div>
          )}

          <div className="flex-grow flex flex-col sm:flex-row justify-between gap-4">
            {/* Main Info */}
            <div className="flex-grow">
              <h3 className="font-bold text-lg leading-tight uppercase tracking-tight text-white">
                {suggestion.title}
              </h3>
              
                <div className="flex flex-wrap gap-2 text-xs uppercase mt-2 items-center">
                  <span className="meta-pill">
                    {suggestion.type}
                  </span>
                <span className="text-neutral-600">
                  {formatRelativeTime(suggestion.createdAt)}
                </span>
              </div>

              {/* From/To User */}
              <div className="mt-2 text-xs text-neutral-500 uppercase flex items-center gap-2">
                {isReceived ? 'FROM' : 'TO'}{' '}
                  <UserAvatar
                    username={user.username}
                    displayName={user.displayName}
                    avatarUrl={user.avatarUrl}
                    sizeClassName="w-5 h-5 text-[10px]"
                    fallbackClassName="bg-neutral-800 text-neutral-400 border border-neutral-700"
                  />
                <span className="text-neutral-300 font-bold">
                  {user.displayName || user.username}
                </span>
              </div>

              {/* Message */}
              {suggestion.message && (
                  <div className="mt-2 screen-panel pad soft text-sm text-neutral-400">
                    "{suggestion.message}"
                  </div>
                )}

              {/* Status Badge (for non-pending) */}
              {suggestion.status !== 'PENDING' && (
                  <div className={`mt-2 inline-block text-xs px-2 py-1 uppercase rounded-xl ${
                    suggestion.status === 'ACCEPTED'
                      ? 'bg-green-950 border border-green-900 text-green-400'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-500'
                }`}>
                  {suggestion.status}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:items-end gap-2 min-w-[120px]">
              {isReceived && suggestion.status === 'PENDING' && (
                <>
                  <button
                    onClick={() => onAccept(suggestion.id)}
                    disabled={isLoading}
                    className="w-full sm:w-auto action-btn disabled:opacity-50"
                  >
                    {isLoading ? '...' : 'ACCEPT'}
                  </button>
                  <button
                    onClick={() => onDismiss(suggestion.id)}
                    disabled={isLoading}
                    className="w-full sm:w-auto action-btn-ghost disabled:opacity-50"
                  >
                    {isLoading ? '...' : 'DISMISS'}
                  </button>
                </>
              )}
              {!isReceived && (
                <button
                  onClick={() => onDelete(suggestion.id)}
                  disabled={isLoading}
                  className="w-full sm:w-auto action-btn-danger disabled:opacity-50"
                >
                  {isLoading ? '...' : 'DELETE'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuggestionList;
