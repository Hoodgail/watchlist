import React, { useState } from 'react';
import { MediaItem, SearchResult } from '../types';
import { searchMedia, searchResultToMediaItem, SearchCategory, SearchOptions } from '../services/mediaSearch';
import { QuickAddModal } from './QuickAddModal';

interface SearchMediaProps {
  onAdd: (item: Omit<MediaItem, 'id'>) => Promise<void> | void;
}

const CATEGORIES: { value: SearchCategory; label: string }[] = [
  { value: 'all', label: 'ALL' },
  { value: 'tv', label: 'TV' },
  { value: 'movie', label: 'FILM' },
  { value: 'anime', label: 'ANIME' },
  { value: 'manga', label: 'MANGA' },
];

export const SearchMedia: React.FC<SearchMediaProps> = ({ onAdd }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const [year, setYear] = useState('');
  const [includeAdult, setIncludeAdult] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [addingItems, setAddingItems] = useState<Set<string>>(new Set());
  const [quickAddItem, setQuickAddItem] = useState<SearchResult | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setResults([]);

    try {
      const options: SearchOptions = {
        includeAdult,
        year: year.trim() || undefined,
      };
      const items = await searchMedia(query, category, options);
      setResults(items);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (result: SearchResult) => {
    if (addedItems.has(result.id) || addingItems.has(result.id)) return;
    
    setAddingItems(prev => new Set(prev).add(result.id));
    
    try {
      const mediaItem = searchResultToMediaItem(result);
      await onAdd(mediaItem);
      setAddedItems(prev => new Set(prev).add(result.id));
    } finally {
      setAddingItems(prev => {
        const next = new Set(prev);
        next.delete(result.id);
        return next;
      });
    }
  };

  // Quick add to planned
  const handleQuickAdd = async (result: SearchResult) => {
    if (addedItems.has(result.id) || addingItems.has(result.id)) return;
    
    setAddingItems(prev => new Set(prev).add(result.id));
    
    try {
      const mediaItem = searchResultToMediaItem(result);
      await onAdd({ ...mediaItem, status: 'PLAN_TO_WATCH', current: 0 });
      setAddedItems(prev => new Set(prev).add(result.id));
    } finally {
      setAddingItems(prev => {
        const next = new Set(prev);
        next.delete(result.id);
        return next;
      });
    }
  };

  // Handle add from modal
  const handleModalAdd = async (mediaItem: Omit<MediaItem, 'id'>) => {
    if (!quickAddItem) return;
    
    setAddingItems(prev => new Set(prev).add(quickAddItem.id));
    try {
      await onAdd(mediaItem);
      setAddedItems(prev => new Set(prev).add(quickAddItem.id));
    } finally {
      setAddingItems(prev => {
        const next = new Set(prev);
        if (quickAddItem) next.delete(quickAddItem.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-900 pb-2">
          ADD CONTENT
        </h2>

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`px-3 py-1 text-xs uppercase tracking-wider border transition-colors ${
                category === cat.value
                  ? 'bg-white text-black border-white'
                  : 'bg-transparent text-neutral-500 border-neutral-700 hover:border-neutral-500'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Options */}
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="year" className="text-xs text-neutral-500 uppercase tracking-wider">
              Year
            </label>
            <input
              id="year"
              type="text"
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="e.g. 2024"
              className="w-20 bg-black border border-neutral-700 px-2 py-1 text-white placeholder-neutral-700 text-xs focus:border-white outline-none font-mono rounded-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAdult}
              onChange={(e) => setIncludeAdult(e.target.checked)}
              className="w-4 h-4 bg-black border border-neutral-700 rounded-none accent-white cursor-pointer"
            />
            <span className="text-xs text-neutral-500 uppercase tracking-wider">
              Include Adult
            </span>
          </label>
        </div>

        <form onSubmit={handleSearch} className="flex gap-0">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="TYPE TITLE (e.g. 'AKIRA')"
            className="flex-grow bg-black border border-neutral-700 p-4 text-white placeholder-neutral-700 uppercase focus:border-white outline-none font-mono rounded-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-white text-black font-bold uppercase px-6 py-4 hover:bg-neutral-300 disabled:opacity-50 rounded-none border-l-0"
          >
            {loading ? '...' : 'FIND'}
          </button>
        </form>
      </div>

      {hasSearched && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-xs text-neutral-600 uppercase tracking-widest">
            {loading ? 'SEARCHING...' : `RESULTS FOR "${query}"`}
          </h3>

          {!loading && results.length === 0 && (
            <div className="p-4 border border-red-900/50 text-red-700 uppercase text-sm">
              No results found. Try a different query.
            </div>
          )}

          <div className="grid gap-4">
            {results.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 border border-neutral-800 hover:border-white transition-colors group bg-black"
              >
                {/* Image */}
                {item.imageUrl && (
                  <div className="flex-shrink-0 w-12 h-16 bg-neutral-900 overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Info */}
                <div className="flex-grow min-w-0">
                  <h4 className="font-bold text-lg uppercase tracking-tight truncate">
                    {item.title}
                  </h4>
                  <div className="flex gap-2 text-xs text-neutral-500 mt-1 uppercase">
                    <span className="bg-neutral-900 px-1 border border-neutral-800">
                      {item.type}
                    </span>
                    <span>
                      {item.total
                        ? `${item.total} ${item.type === 'MANGA' ? 'CH' : 'EP'}`
                        : 'ONGOING'}
                    </span>
                    {item.year && <span className="text-neutral-600">{item.year}</span>}
                  </div>
                </div>

                {/* Add Buttons */}
                {addedItems.has(item.id) ? (
                  <span className="flex-shrink-0 text-sm border border-green-700 text-green-500 px-4 py-2 uppercase rounded-none">
                    Added
                  </span>
                ) : (
                  <div className="flex-shrink-0 flex gap-2">
                    <button
                      onClick={() => handleQuickAdd(item)}
                      disabled={addingItems.has(item.id)}
                      className="text-sm bg-white text-black px-3 py-2 hover:bg-neutral-200 transition-all uppercase rounded-none disabled:opacity-50 font-bold"
                    >
                      {addingItems.has(item.id) ? '...' : '+ Planned'}
                    </button>
                    <button
                      onClick={() => setQuickAddItem(item)}
                      disabled={addingItems.has(item.id)}
                      className="text-sm border border-neutral-700 text-neutral-400 px-3 py-2 hover:border-white hover:text-white transition-all uppercase rounded-none disabled:opacity-50"
                    >
                      + Details
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visual filler for empty state */}
      {!hasSearched && (
        <div className="text-neutral-800 text-center py-20 select-none">
          <div className="text-6xl mb-4 opacity-20">Type</div>
          <div className="text-6xl mb-4 opacity-10">To</div>
          <div className="text-6xl opacity-5">Search</div>
        </div>
      )}

      {/* Quick Add Modal */}
      {quickAddItem && (
        <QuickAddModal
          item={quickAddItem}
          onAdd={handleModalAdd}
          onClose={() => setQuickAddItem(null)}
        />
      )}
    </div>
  );
};
