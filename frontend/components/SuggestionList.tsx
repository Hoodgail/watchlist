import React, { useState, useEffect } from 'react';
import { Suggestion, SuggestionStatus, SuggestionUser } from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w200';

const STATUS_FILTER_OPTIONS: { value: SuggestionStatus | ''; label: string }[] = [
  { value: 'PENDING', label: 'PENDING' },
  { value: 'ACCEPTED', label: 'ACCEPTED' },
  { value: 'DISMISSED', label: 'DISMISSED' },
];

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

// User avatar component for suggestions
const SuggestionUserAvatar: React.FC<{ user: SuggestionUser; size?: 'sm' | 'md' }> = ({ user, size = 'sm' }) => {
  const sizeClasses = {
    sm: 'w-5 h-5 text-[10px]',
    md: 'w-7 h-7 text-xs',
  };

  const initials = (user.displayName || user.username)
    .split(/[\s_]/)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (user.avatarUrl) {
    return (
      <img 
        src={user.avatarUrl} 
        alt={user.username}
        className={`${sizeClasses[size]} rounded-full object-cover flex-shrink-0`}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 flex items-center justify-center flex-shrink-0 font-bold`}>
      {initials}
    </div>
  );
};

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
        const data = await api.getReceivedSuggestions(statusFilter);
        setReceivedSuggestions(data);
      } else {
        const data = await api.getSentSuggestions();
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
      await api.acceptSuggestion(id);
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
      await api.dismissSuggestion(id);
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
      await api.deleteSuggestion(id);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-neutral-900 pb-2">
        <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest">
          SUGGESTIONS
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex border border-neutral-800">
        <button
          onClick={() => setActiveTab('received')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'received'
              ? 'bg-white text-black'
              : 'text-neutral-500 hover:bg-neutral-900'
          }`}
        >
          RECEIVED
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-l border-neutral-800 ${
            activeTab === 'sent'
              ? 'bg-white text-black'
              : 'text-neutral-500 hover:bg-neutral-900'
          }`}
        >
          SENT
        </button>
      </div>

      {/* Status Filter (only for received) */}
      {activeTab === 'received' && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-neutral-600 uppercase">STATUS:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SuggestionStatus)}
            className="bg-black border border-neutral-800 text-neutral-400 px-2 py-1 uppercase outline-none cursor-pointer hover:border-neutral-600 focus:border-white"
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
        <div className="py-12 text-center text-neutral-600 border border-neutral-800 border-dashed">
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
  const imageUrl = getImageUrl(suggestion.imageUrl);
  const user = isReceived ? suggestion.fromUser : suggestion.toUser;

  return (
    <div className="border border-neutral-800 bg-black hover:border-neutral-600 transition-all">
      <div className="p-4">
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
              
              <div className="flex flex-wrap gap-2 text-xs uppercase mt-1">
                <span className="bg-neutral-900 text-neutral-400 px-1.5 py-0.5 border border-neutral-800">
                  {suggestion.type}
                </span>
                <span className="text-neutral-600">
                  {formatRelativeTime(suggestion.createdAt)}
                </span>
              </div>

              {/* From/To User */}
              <div className="mt-2 text-xs text-neutral-500 uppercase flex items-center gap-2">
                {isReceived ? 'FROM' : 'TO'}{' '}
                <SuggestionUserAvatar user={user} size="sm" />
                <span className="text-neutral-300 font-bold">
                  {user.displayName || user.username}
                </span>
              </div>

              {/* Message */}
              {suggestion.message && (
                <div className="mt-2 p-2 bg-neutral-950 border border-neutral-800 text-sm text-neutral-400">
                  "{suggestion.message}"
                </div>
              )}

              {/* Status Badge (for non-pending) */}
              {suggestion.status !== 'PENDING' && (
                <div className={`mt-2 inline-block text-xs px-2 py-1 uppercase ${
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
                    className="w-full sm:w-auto text-xs px-4 py-2 bg-white text-black font-bold uppercase tracking-wider hover:bg-neutral-200 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? '...' : 'ACCEPT'}
                  </button>
                  <button
                    onClick={() => onDismiss(suggestion.id)}
                    disabled={isLoading}
                    className="w-full sm:w-auto text-xs px-4 py-2 border border-neutral-700 text-neutral-400 uppercase tracking-wider hover:border-neutral-500 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {isLoading ? '...' : 'DISMISS'}
                  </button>
                </>
              )}
              {!isReceived && (
                <button
                  onClick={() => onDelete(suggestion.id)}
                  disabled={isLoading}
                  className="w-full sm:w-auto text-xs px-4 py-2 border border-neutral-800 text-neutral-500 uppercase tracking-wider hover:border-red-900 hover:text-red-500 transition-colors disabled:opacity-50"
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
