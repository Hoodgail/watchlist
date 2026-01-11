import React, { useState, useEffect } from 'react';
import { Collection, CollectionRole } from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';

interface CollectionsProps {
  onSelectCollection: (id: string) => void;
  onCreateCollection: () => void;
}

type TabType = 'my' | 'public' | 'starred';

export const Collections: React.FC<CollectionsProps> = ({
  onSelectCollection,
  onCreateCollection,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('my');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadCollections();
  }, [activeTab, page]);

  // Debounced search for public tab
  useEffect(() => {
    if (activeTab !== 'public') return;
    
    const timer = setTimeout(() => {
      setPage(1);
      loadCollections();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadCollections = async () => {
    setLoading(true);
    try {
      if (activeTab === 'my') {
        const data = await api.getMyCollections();
        const collectionsArray = Array.isArray(data) ? data : [];
        setCollections(collectionsArray);
        setTotal(collectionsArray.length);
        setHasMore(false);
      } else if (activeTab === 'public') {
        const result = await api.getPublicCollections({
          page,
          limit: 20,
          search: searchQuery || undefined,
        });
        const newData = Array.isArray(result.data) ? result.data : [];
        if (page === 1) {
          setCollections(newData);
        } else {
          setCollections((prev) => [...prev, ...newData]);
        }
        setTotal(result.total || 0);
        setHasMore(newData.length === 20 && collections.length + newData.length < (result.total || 0));
      } else if (activeTab === 'starred') {
        const data = await api.getStarredCollections();
        const collectionsArray = Array.isArray(data) ? data : [];
        setCollections(collectionsArray);
        setTotal(collectionsArray.length);
        setHasMore(false);
      }
    } catch (error: any) {
      console.error('Failed to load collections:', error);
      showToast(error.message || 'Failed to load collections', 'error');
      setCollections([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setCollections([]);
    setPage(1);
    setSearchQuery('');
  };

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
  };

  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'my':
        return {
          title: 'NO COLLECTIONS YET',
          subtitle: 'Create your first collection to organize media',
        };
      case 'public':
        return {
          title: searchQuery ? 'NO RESULTS FOUND' : 'NO PUBLIC COLLECTIONS',
          subtitle: searchQuery
            ? 'Try a different search term'
            : 'Public collections from other users will appear here',
        };
      case 'starred':
        return {
          title: 'NO STARRED COLLECTIONS',
          subtitle: 'Star collections you like to save them here',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
        <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest">
          LISTS
        </h2>
        {activeTab === 'my' && (
          <button
            onClick={onCreateCollection}
            className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 bg-white text-black hover:bg-neutral-200 transition-colors"
          >
            + CREATE
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border border-neutral-800">
        <button
          onClick={() => handleTabChange('my')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'my'
              ? 'bg-white text-black'
              : 'text-neutral-500 hover:bg-neutral-900'
          }`}
        >
          MY
        </button>
        <button
          onClick={() => handleTabChange('public')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-l border-neutral-800 ${
            activeTab === 'public'
              ? 'bg-white text-black'
              : 'text-neutral-500 hover:bg-neutral-900'
          }`}
        >
          PUBLIC
        </button>
        <button
          onClick={() => handleTabChange('starred')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-l border-neutral-800 ${
            activeTab === 'starred'
              ? 'bg-white text-black'
              : 'text-neutral-500 hover:bg-neutral-900'
          }`}
        >
          STARRED
        </button>
      </div>

      {/* Search Input (only for public tab) */}
      {activeTab === 'public' && (
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search public collections..."
            className="w-full bg-black border border-neutral-800 text-neutral-300 px-4 py-3 text-sm uppercase tracking-wider placeholder:text-neutral-600 outline-none focus:border-white transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && collections.length === 0 && (
        <div className="py-12 text-center text-neutral-500 uppercase tracking-wider animate-pulse">
          Loading...
        </div>
      )}

      {/* Empty State */}
      {!loading && collections.length === 0 && (
        <div className="py-12 text-center text-neutral-600 border border-neutral-800 border-dashed">
          <p className="text-sm uppercase">{getEmptyMessage().title}</p>
          <p className="text-xs mt-2 text-neutral-700">{getEmptyMessage().subtitle}</p>
        </div>
      )}

      {/* Collections Grid */}
      {collections.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                activeTab={activeTab}
                onClick={() => onSelectCollection(collection.id)}
              />
            ))}
          </div>

          {/* Load More Button (for public tab with pagination) */}
          {activeTab === 'public' && hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="text-xs font-bold uppercase tracking-wider px-6 py-2 border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}

          {/* Results count for public tab */}
          {activeTab === 'public' && total > 0 && (
            <div className="text-center text-xs text-neutral-600 uppercase tracking-wider">
              Showing {collections.length} of {total} collections
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface CollectionCardProps {
  collection: Collection;
  activeTab: TabType;
  onClick: () => void;
}

const CollectionCard: React.FC<CollectionCardProps> = ({
  collection,
  activeTab,
  onClick,
}) => {
  const showOwner = activeTab === 'public' || activeTab === 'starred';
  const showVisibilityBadge = activeTab === 'my';
  const showRoleBadge = activeTab === 'my' && collection.myRole;

  const getRoleBadgeStyle = (role: CollectionRole) => {
    switch (role) {
      case 'OWNER':
        return 'bg-white text-black';
      case 'EDITOR':
        return 'bg-blue-950 border border-blue-900 text-blue-400';
      case 'VIEWER':
        return 'bg-neutral-900 border border-neutral-800 text-neutral-400';
    }
  };

  return (
    <div
      onClick={onClick}
      className="border border-neutral-800 bg-black hover:border-neutral-600 transition-all cursor-pointer group overflow-hidden"
    >
      {/* Cover Image */}
      <div className="aspect-video relative overflow-hidden">
        {collection.coverUrl ? (
          <img
            src={collection.coverUrl}
            alt={collection.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900" />
        )}
        
        {/* Overlay badges */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {showVisibilityBadge && (
            <span
              className={`text-[10px] px-1.5 py-0.5 uppercase font-bold ${
                collection.isPublic
                  ? 'bg-green-950 border border-green-900 text-green-400'
                  : 'bg-neutral-900 border border-neutral-800 text-neutral-400'
              }`}
            >
              {collection.isPublic ? 'PUBLIC' : 'PRIVATE'}
            </span>
          )}
          {showRoleBadge && collection.myRole && (
            <span
              className={`text-[10px] px-1.5 py-0.5 uppercase font-bold ${getRoleBadgeStyle(collection.myRole)}`}
            >
              {collection.myRole}
            </span>
          )}
        </div>

        {/* Item count badge */}
        <div className="absolute bottom-2 right-2">
          <span className="text-[10px] px-1.5 py-0.5 bg-black/80 border border-neutral-700 text-neutral-300 uppercase font-bold">
            {collection.itemCount} {collection.itemCount === 1 ? 'ITEM' : 'ITEMS'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="font-bold text-sm uppercase tracking-tight text-white truncate group-hover:text-neutral-300 transition-colors">
          {collection.title}
        </h3>

        <div className="flex items-center justify-between mt-2">
          {/* Owner info (for public/starred tabs) */}
          {showOwner && (
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {collection.owner.avatarUrl ? (
                <img
                  src={collection.owner.avatarUrl}
                  alt={collection.owner.username}
                  className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-4 h-4 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 flex items-center justify-center flex-shrink-0 text-[8px] font-bold">
                  {(collection.owner.displayName || collection.owner.username)
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}
              <span className="text-[10px] text-neutral-500 uppercase truncate">
                {collection.owner.displayName || collection.owner.username}
              </span>
            </div>
          )}

          {/* Star count */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <svg
              className={`w-3.5 h-3.5 ${collection.isStarred ? 'text-yellow-500 fill-yellow-500' : 'text-neutral-600'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
            <span className="text-[10px] text-neutral-500 uppercase">
              {collection.starCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Collections;
