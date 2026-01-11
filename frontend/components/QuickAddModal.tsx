import React, { useState, useEffect } from 'react';
import { MediaItem, MediaStatus, MediaType, SearchResult } from '../types';
import { STATUS_OPTIONS } from '../constants';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w200';

// Helper to get full image URL
const getImageUrl = (imageUrl?: string): string | null => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  if (imageUrl.startsWith('/')) return `${TMDB_IMAGE_BASE}${imageUrl}`;
  return imageUrl;
};

// Star icon component
function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg className={`w-4 h-4 ${filled ? 'text-yellow-400' : 'text-neutral-700'}`} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

interface QuickAddModalProps {
  item: SearchResult;
  onAdd: (item: Omit<MediaItem, 'id'>) => Promise<void> | void;
  onClose: () => void;
}

const RATING_OPTIONS = [
  { value: null, label: '-' },
  ...Array.from({ length: 11 }, (_, i) => ({ value: i, label: String(i) })),
];

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  item,
  onAdd,
  onClose,
}) => {
  const [status, setStatus] = useState<MediaStatus>('COMPLETED');
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [current, setCurrent] = useState(item.total || 0);
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState(false);

  const imageUrl = getImageUrl(item.imageUrl);

  // Determine default status based on media type
  useEffect(() => {
    if (item.type === 'GAME') {
      setStatus('PLAYING');
    } else {
      setStatus('COMPLETED');
    }
  }, [item.type]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const mediaItem: Omit<MediaItem, 'id'> = {
        title: item.title,
        type: item.type,
        current: current,
        total: item.total,
        status: status,
        notes: notes.trim() || undefined,
        rating: rating,
        imageUrl: item.imageUrl,
        refId: item.id,
      };
      
      // Add game-specific fields if present
      if (item.type === 'GAME') {
        if (item.platforms) mediaItem.platforms = item.platforms;
        if (item.metacritic !== undefined) mediaItem.metacritic = item.metacritic;
        if (item.genres) mediaItem.genres = item.genres;
        if (item.playtimeHours !== undefined) mediaItem.playtimeHours = item.playtimeHours;
      }
      
      await onAdd(mediaItem);
      onClose();
    } catch (error) {
      console.error('Failed to add item:', error);
    } finally {
      setSaving(false);
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

  // Get appropriate status options based on media type
  const getStatusOptions = () => {
    if (item.type === 'GAME') {
      // For games, hide WATCHING and READING, show PLAYING
      return STATUS_OPTIONS.filter(opt => opt.value !== 'WATCHING' && opt.value !== 'READING');
    }
    if (item.type === 'MANGA') {
      // For manga, hide WATCHING and PLAYING, show READING
      return STATUS_OPTIONS.filter(opt => opt.value !== 'WATCHING' && opt.value !== 'PLAYING');
    }
    // For video types (TV, MOVIE, ANIME), hide READING and PLAYING, show WATCHING
    return STATUS_OPTIONS.filter(opt => opt.value !== 'READING' && opt.value !== 'PLAYING');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-black border border-neutral-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-widest">
            ADD TO LIST
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
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-white uppercase tracking-tight">
                {item.title}
              </h4>
              <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1">
                <span className="uppercase">{item.type}</span>
                {item.year && <span>{item.year}</span>}
                {item.total && (
                  <span>{item.total} {item.type === 'MANGA' ? 'CH' : item.type === 'GAME' ? 'HRS' : 'EP'}</span>
                )}
              </div>
              {/* Game-specific info */}
              {item.type === 'GAME' && (
                <div className="mt-2 space-y-1">
                  {item.metacritic && (
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono px-1.5 py-0.5 border ${
                        item.metacritic >= 75 ? 'border-green-600 text-green-500' :
                        item.metacritic >= 50 ? 'border-yellow-600 text-yellow-500' :
                        'border-red-600 text-red-500'
                      }`}>
                        {item.metacritic}
                      </span>
                      <span className="text-xs text-neutral-600">METACRITIC</span>
                    </div>
                  )}
                  {item.genres && item.genres.length > 0 && (
                    <div className="text-xs text-neutral-500 truncate">
                      {item.genres.slice(0, 3).join(' / ')}
                    </div>
                  )}
                  {item.platforms && item.platforms.length > 0 && (
                    <div className="text-xs text-neutral-600 truncate">
                      {item.platforms.slice(0, 4).join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Status Selection */}
          <div className="space-y-2">
            <label className="text-xs text-neutral-600 uppercase tracking-wider block">
              STATUS
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MediaStatus)}
              className="w-full bg-neutral-950 border border-neutral-800 text-white px-3 py-2 text-sm uppercase outline-none cursor-pointer hover:border-neutral-600 focus:border-white"
            >
              {getStatusOptions().map(opt => (
                <option key={opt.value} value={opt.value} className="bg-black">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <label className="text-xs text-neutral-600 uppercase tracking-wider block">
              {item.type === 'GAME' ? 'HOURS PLAYED' : 'PROGRESS'}
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrent(Math.max(0, current - 1))}
                className="w-10 h-10 border border-neutral-800 hover:bg-neutral-900 text-neutral-400 transition-colors"
              >
                -
              </button>
              <input
                type="number"
                value={current}
                onChange={(e) => setCurrent(parseInt(e.target.value) || 0)}
                className="w-20 h-10 bg-black text-center border border-neutral-800 font-mono text-white focus:border-white outline-none"
              />
              <button
                onClick={() => setCurrent(current + 1)}
                className="w-10 h-10 border border-neutral-800 hover:bg-neutral-900 text-neutral-400 transition-colors"
              >
                +
              </button>
              {item.total && (
                <span className="text-neutral-500 text-sm">/ {item.total}</span>
              )}
            </div>
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <label className="text-xs text-neutral-600 uppercase tracking-wider block">
              RATING
            </label>
            <div className="flex items-center gap-1 flex-wrap">
              {RATING_OPTIONS.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setRating(opt.value)}
                  className={`w-8 h-8 text-xs border transition-colors ${
                    rating === opt.value
                      ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10'
                      : 'border-neutral-700 text-neutral-500 hover:border-neutral-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-xs text-neutral-600 uppercase tracking-wider block">
              NOTES (OPTIONAL)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your notes..."
              className="w-full bg-neutral-950 border border-neutral-800 p-3 text-sm text-white placeholder-neutral-700 focus:border-white outline-none resize-none min-h-[80px]"
            />
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
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 text-xs font-bold uppercase tracking-wider bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'ADDING...' : 'ADD'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickAddModal;
