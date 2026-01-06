import React, { useState } from 'react';
import { MediaItem, MediaStatus, SortBy } from '../types';
import { STATUS_OPTIONS } from '../constants';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'status', label: 'STATUS' },
  { value: 'title', label: 'TITLE' },
  { value: 'rating', label: 'RATING' },
  { value: 'updatedAt', label: 'RECENTLY UPDATED' },
  { value: 'createdAt', label: 'DATE ADDED' },
];

const FILTER_STATUS_OPTIONS = [
  { value: '', label: 'ALL' },
  ...STATUS_OPTIONS,
];

interface MediaListProps {
  title: string;
  items: MediaItem[];
  onUpdate?: (id: string, updates: Partial<MediaItem>) => void;
  onDelete?: (id: string) => void;
  readonly?: boolean;
  filterStatus?: MediaStatus | '';
  sortBy?: SortBy;
  onFilterChange?: (status: MediaStatus | '') => void;
  onSortChange?: (sortBy: SortBy) => void;
}

export const MediaList: React.FC<MediaListProps> = ({ 
  title, 
  items, 
  onUpdate, 
  onDelete, 
  readonly,
  filterStatus = '',
  sortBy = 'status',
  onFilterChange,
  onSortChange,
}) => {
  // Filter items client-side if no backend filter is applied
  const filteredItems = filterStatus 
    ? items.filter(item => item.status === filterStatus)
    : items;

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-neutral-600 border border-neutral-800 border-dashed">
        <h2 className="text-lg font-bold mb-2 uppercase">{title}</h2>
        <p className="text-sm">NO ITEMS FOUND</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-900 pb-2">
        <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest">{title}</h2>
        
        {/* Filter and Sort Controls */}
        {!readonly && (onFilterChange || onSortChange) && (
          <div className="flex items-center gap-4 text-xs">
            {/* Filter by Status */}
            {onFilterChange && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-600 uppercase">FILTER:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => onFilterChange(e.target.value as MediaStatus | '')}
                  className="bg-black border border-neutral-800 text-neutral-400 px-2 py-1 uppercase outline-none cursor-pointer hover:border-neutral-600 focus:border-white"
                >
                  {FILTER_STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-black">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort By */}
            {onSortChange && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-600 uppercase">SORT:</span>
                <select
                  value={sortBy}
                  onChange={(e) => onSortChange(e.target.value as SortBy)}
                  className="bg-black border border-neutral-800 text-neutral-400 px-2 py-1 uppercase outline-none cursor-pointer hover:border-neutral-600 focus:border-white"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-black">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Items count */}
      {filterStatus && (
        <div className="text-xs text-neutral-600 uppercase">
          Showing {filteredItems.length} of {items.length} items
        </div>
      )}

      {/* List */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-neutral-600 border border-neutral-800 border-dashed">
            <p className="text-sm">NO ITEMS MATCH FILTER</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <MediaItemCard 
              key={item.id} 
              item={item} 
              onUpdate={onUpdate} 
              onDelete={onDelete}
              readonly={readonly}
            />
          ))
        )}
      </div>
    </div>
  );
};

const RATING_OPTIONS = [
  { value: null, label: '-' },
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
  { value: 7, label: '7' },
  { value: 8, label: '8' },
  { value: 9, label: '9' },
  { value: 10, label: '10' },
];

const MediaItemCard: React.FC<{ 
  item: MediaItem; 
  onUpdate?: (id: string, updates: Partial<MediaItem>) => void;
  onDelete?: (id: string) => void;
  readonly?: boolean;
}> = ({ item, onUpdate, onDelete, readonly }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [notesValue, setNotesValue] = useState(item.notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  
  const progressPercentage = item.total ? Math.min(100, (item.current / item.total) * 100) : 0;
  
  // Minimalist Status Badge Color Logic (Grayscale variations)
  const getStatusStyle = (status: MediaStatus) => {
    switch (status) {
      case 'WATCHING':
      case 'READING':
        return 'border-white text-white';
      case 'COMPLETED':
        return 'border-neutral-600 text-neutral-600 line-through decoration-1';
      default:
        return 'border-neutral-700 text-neutral-500';
    }
  };

  const handleNotesBlur = () => {
    setIsEditingNotes(false);
    if (notesValue !== (item.notes || '')) {
      onUpdate && onUpdate(item.id, { notes: notesValue || undefined });
    }
  };

  const handleRatingChange = (value: number | null) => {
    onUpdate && onUpdate(item.id, { rating: value });
  };

  const hasDetails = item.notes || item.rating != null;

  return (
    <div className="group relative border border-neutral-800 bg-black transition-all hover:border-neutral-600">
      
      {/* Progress Bar Background */}
      {item.total && (
        <div className="absolute bottom-0 left-0 h-0.5 bg-neutral-900 w-full">
          <div 
            className="h-full bg-white transition-all duration-500" 
            style={{ width: `${progressPercentage}%` }} 
          />
        </div>
      )}

      {/* Main Content */}
      <div className="p-4">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          
          {/* Main Info */}
          <div className="flex-grow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <h3 className={`font-bold text-lg leading-tight uppercase tracking-tight ${item.status === 'COMPLETED' ? 'text-neutral-500' : 'text-white'}`}>
                  {item.title}
                </h3>
                {/* Rating Badge */}
                {item.rating != null && (
                  <span className="text-xs bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 text-neutral-300 font-mono">
                    {item.rating}/10
                  </span>
                )}
              </div>
              {/* Mobile Delete Button */}
              {!readonly && onDelete && (
                <button 
                  onClick={() => onDelete(item.id)}
                  className="sm:hidden text-neutral-700 hover:text-red-500 px-2"
                >
                  ×
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2 text-xs uppercase mt-1">
              <span className="bg-neutral-900 text-neutral-400 px-1.5 py-0.5 border border-neutral-800">
                {item.type}
              </span>
              {item.total ? (
                <span className="text-neutral-500 py-0.5">
                  {item.total} {item.type === 'MANGA' ? 'CH' : 'EP'}
                </span>
              ) : (
                <span className="text-neutral-500 py-0.5">ONGOING</span>
              )}
              {/* Notes indicator */}
              {item.notes && (
                <span className="text-neutral-600 py-0.5" title="Has notes">
                  [NOTE]
                </span>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:items-end gap-3 min-w-[140px]">
            {/* Status Select */}
            {readonly ? (
              <div className={`text-xs px-2 py-1 border ${getStatusStyle(item.status)} inline-block text-center w-full sm:w-auto`}>
                {item.status}
              </div>
            ) : (
              <select
                value={item.status}
                onChange={(e) => onUpdate && onUpdate(item.id, { status: e.target.value as MediaStatus })}
                className={`bg-black text-xs uppercase px-2 py-1 border outline-none cursor-pointer focus:bg-neutral-900 w-full sm:w-auto ${getStatusStyle(item.status)}`}
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-black text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {/* Progress Input */}
            <div className="flex items-center gap-2 justify-between sm:justify-end w-full">
              <span className="text-xs text-neutral-600 font-mono">PROG:</span>
              {readonly ? (
                <span className="font-mono text-white text-lg">
                  {item.current}
                  {item.total && <span className="text-neutral-600">/{item.total}</span>}
                </span>
              ) : (
                <div className="flex items-center">
                  <button 
                    onClick={() => onUpdate && onUpdate(item.id, { current: Math.max(0, item.current - 1) })}
                    className="w-6 h-8 border border-r-0 border-neutral-800 hover:bg-neutral-900 text-neutral-400"
                  >-</button>
                  <input
                    type="number"
                    value={item.current}
                    onChange={(e) => onUpdate && onUpdate(item.id, { current: parseInt(e.target.value) || 0 })}
                    className="w-12 h-8 bg-black text-center border border-neutral-800 font-mono text-white focus:border-white outline-none"
                  />
                  <button 
                    onClick={() => onUpdate && onUpdate(item.id, { current: item.current + 1 })}
                    className="w-6 h-8 border border-l-0 border-neutral-800 hover:bg-neutral-900 text-neutral-400"
                  >+</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Expand Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-3 text-xs text-neutral-600 hover:text-neutral-400 uppercase tracking-wider flex items-center gap-1"
        >
          <span>{isExpanded ? '▼' : '▶'}</span>
          <span>{isExpanded ? 'HIDE DETAILS' : (hasDetails ? 'SHOW DETAILS' : 'ADD DETAILS')}</span>
        </button>
      </div>

      {/* Expanded Details Section */}
      {isExpanded && (
        <div className="border-t border-neutral-800 p-4 bg-neutral-950 space-y-4">
          {/* Rating */}
          <div className="flex items-center gap-4">
            <span className="text-xs text-neutral-600 uppercase tracking-wider w-16">RATING:</span>
            {readonly ? (
              <span className="font-mono text-white">
                {item.rating != null ? `${item.rating}/10` : '-'}
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={item.rating ?? ''}
                  onChange={(e) => handleRatingChange(e.target.value === '' ? null : parseInt(e.target.value))}
                  className="bg-black border border-neutral-800 text-white px-2 py-1 text-sm font-mono focus:border-white outline-none"
                >
                  {RATING_OPTIONS.map(opt => (
                    <option key={opt.label} value={opt.value ?? ''} className="bg-black">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="text-neutral-500 text-xs">/10</span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <span className="text-xs text-neutral-600 uppercase tracking-wider">NOTES:</span>
            {readonly ? (
              <p className="text-sm text-neutral-400 whitespace-pre-wrap">
                {item.notes || <span className="text-neutral-700 italic">No notes</span>}
              </p>
            ) : isEditingNotes ? (
              <textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Add your notes here..."
                autoFocus
                className="w-full bg-black border border-neutral-700 p-3 text-sm text-white placeholder-neutral-700 focus:border-white outline-none resize-none min-h-[80px]"
              />
            ) : (
              <div
                onClick={() => setIsEditingNotes(true)}
                className="w-full min-h-[40px] border border-dashed border-neutral-800 p-3 text-sm cursor-text hover:border-neutral-600 transition-colors"
              >
                {notesValue ? (
                  <span className="text-neutral-400 whitespace-pre-wrap">{notesValue}</span>
                ) : (
                  <span className="text-neutral-700 italic">Click to add notes...</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Desktop Delete (Hover) */}
      {!readonly && onDelete && (
        <button 
          onClick={() => onDelete(item.id)}
          className="hidden sm:flex absolute -top-2 -right-2 w-6 h-6 bg-black border border-neutral-800 text-neutral-500 hover:text-red-500 hover:border-red-900 opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center text-lg leading-none z-10"
        >
          ×
        </button>
      )}
    </div>
  );
};
