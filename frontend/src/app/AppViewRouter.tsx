import React from 'react';
import { MediaList } from '@/features/library/components/MediaList';
import { SearchMedia } from '@/features/library/components/SearchMedia';
import { TrendingPage } from '@/features/discovery/components/TrendingPage';
import { FriendList } from '@/features/social/components/FriendList';
import { FriendsActivityStrip } from '@/features/social/components/FriendsActivityStrip';
import { SuggestionList } from '@/features/social/components/SuggestionList';
import { Settings } from '@/features/profile/components/Settings';
import { UnifiedDownloadManager } from '@/features/offline/components/UnifiedDownloadManager';
import Collections from '@/features/collections/components/Collections';
import CollectionView from '@/features/collections/components/CollectionView';
import type { GroupedListResponse } from '@/features/library/api';
import type { GroupedFriendListResponse } from '@/features/social/api';
import { OfflineVideoProvider } from '@/context/OfflineVideoContext';
import type { Collection, FriendActivityFilter, MediaItem, MediaStatus, SortBy, User, VideoProviderName, View } from '@/types';
import { parseMangaRefId } from '@/services/manga';
import { DEFAULT_ANIME_PROVIDER, DEFAULT_MOVIE_PROVIDER, parseVideoRefId } from '@/services/video';

export interface AppViewRouterProps {
  currentView: View;
  listLoading: boolean;
  watchlistItems: MediaItem[];
  readlistItems: MediaItem[];
  playlistItems: MediaItem[];
  watchlistGrouped: GroupedListResponse | null;
  readlistGrouped: GroupedListResponse | null;
  playlistGrouped: GroupedListResponse | null;
  watchlistFilter: MediaStatus | '';
  readlistFilter: MediaStatus | '';
  playlistFilter: MediaStatus | '';
  watchlistFriendFilter: FriendActivityFilter;
  readlistFriendFilter: FriendActivityFilter;
  playlistFriendFilter: FriendActivityFilter;
  watchlistSort: SortBy;
  readlistSort: SortBy;
  playlistSort: SortBy;
  watchlistLoadingStatuses: Set<MediaStatus>;
  readlistLoadingStatuses: Set<MediaStatus>;
  playlistLoadingStatuses: Set<MediaStatus>;
  setWatchlistFilter: React.Dispatch<React.SetStateAction<MediaStatus | ''>>;
  setReadlistFilter: React.Dispatch<React.SetStateAction<MediaStatus | ''>>;
  setPlaylistFilter: React.Dispatch<React.SetStateAction<MediaStatus | ''>>;
  setWatchlistFriendFilter: React.Dispatch<React.SetStateAction<FriendActivityFilter>>;
  setReadlistFriendFilter: React.Dispatch<React.SetStateAction<FriendActivityFilter>>;
  setPlaylistFriendFilter: React.Dispatch<React.SetStateAction<FriendActivityFilter>>;
  setWatchlistSort: React.Dispatch<React.SetStateAction<SortBy>>;
  setReadlistSort: React.Dispatch<React.SetStateAction<SortBy>>;
  setPlaylistSort: React.Dispatch<React.SetStateAction<SortBy>>;
  loadWatchlistPageForStatus: (status: MediaStatus, page: number) => Promise<void>;
  loadReadlistPageForStatus: (status: MediaStatus, page: number) => Promise<void>;
  loadPlaylistPageForStatus: (status: MediaStatus, page: number) => Promise<void>;
  handleUpdateMedia: (id: string, updates: Partial<MediaItem>) => Promise<void>;
  handleDeleteMedia: (id: string) => Promise<void>;
  handleVideoItemClick: (item: MediaItem) => void;
  handleMangaItemClick: (item: MediaItem) => void;
  handleAddMedia: (newItem: Omit<MediaItem, 'id'>) => Promise<void>;
  handleOpenMedia: (mediaId: string, provider: VideoProviderName, title?: string, mediaType?: 'movie' | 'tv' | 'anime') => void;
  handleOpenManga: (mangaId: string, provider?: any) => void;
  friends: User[];
  handleViewFriend: (friend: User) => Promise<void>;
  handleSearchUsers: (query: string) => Promise<User[]>;
  handleFollowUser: (userId: string) => Promise<void>;
  handleUnfollowUser: (userId: string) => Promise<void>;
  friendsLoading: boolean;
  selectedFriend: User | null;
  setCurrentView: React.Dispatch<React.SetStateAction<View>>;
  setFriendWatchlistGrouped: React.Dispatch<React.SetStateAction<GroupedFriendListResponse | null>>;
  setFriendReadlistGrouped: React.Dispatch<React.SetStateAction<GroupedFriendListResponse | null>>;
  setFriendPlaylistGrouped: React.Dispatch<React.SetStateAction<GroupedFriendListResponse | null>>;
  friendListLoading: boolean;
  friendWatchlistGrouped: GroupedFriendListResponse | null;
  friendReadlistGrouped: GroupedFriendListResponse | null;
  friendPlaylistGrouped: GroupedFriendListResponse | null;
  handleAddFromFriendList: (item: MediaItem) => Promise<void>;
  loadFriendWatchlistPageForStatus: (status: MediaStatus, page: number) => Promise<void>;
  loadFriendReadlistPageForStatus: (status: MediaStatus, page: number) => Promise<void>;
  loadFriendPlaylistPageForStatus: (status: MediaStatus, page: number) => Promise<void>;
  friendWatchlistLoadingStatuses: Set<MediaStatus>;
  friendReadlistLoadingStatuses: Set<MediaStatus>;
  friendPlaylistLoadingStatuses: Set<MediaStatus>;
  userWatchlistProgressMap: Map<string, number>;
  userReadlistProgressMap: Map<string, number>;
  userPlaylistProgressMap: Map<string, number>;
  friendWatchlistSort: SortBy;
  friendReadlistSort: SortBy;
  friendPlaylistSort: SortBy;
  handleFriendWatchlistSortChange: (sort: SortBy) => Promise<void>;
  handleFriendReadlistSortChange: (sort: SortBy) => Promise<void>;
  handleFriendPlaylistSortChange: (sort: SortBy) => Promise<void>;
  setPendingSuggestionsCount: React.Dispatch<React.SetStateAction<number>>;
  selectedCollectionId: string | null;
  setSelectedCollectionId: React.Dispatch<React.SetStateAction<string | null>>;
  setShowCollectionForm: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingCollection: React.Dispatch<React.SetStateAction<Collection | null>>;
}

export const AppViewRouter: React.FC<AppViewRouterProps> = ({
  currentView,
  listLoading,
  watchlistItems,
  readlistItems,
  playlistItems,
  watchlistGrouped,
  readlistGrouped,
  playlistGrouped,
  watchlistFilter,
  readlistFilter,
  playlistFilter,
  watchlistFriendFilter,
  readlistFriendFilter,
  playlistFriendFilter,
  watchlistSort,
  readlistSort,
  playlistSort,
  watchlistLoadingStatuses,
  readlistLoadingStatuses,
  playlistLoadingStatuses,
  setWatchlistFilter,
  setReadlistFilter,
  setPlaylistFilter,
  setWatchlistFriendFilter,
  setReadlistFriendFilter,
  setPlaylistFriendFilter,
  setWatchlistSort,
  setReadlistSort,
  setPlaylistSort,
  loadWatchlistPageForStatus,
  loadReadlistPageForStatus,
  loadPlaylistPageForStatus,
  handleUpdateMedia,
  handleDeleteMedia,
  handleVideoItemClick,
  handleMangaItemClick,
  handleAddMedia,
  handleOpenMedia,
  handleOpenManga,
  friends,
  handleViewFriend,
  handleSearchUsers,
  handleFollowUser,
  handleUnfollowUser,
  friendsLoading,
  selectedFriend,
  setCurrentView,
  setFriendWatchlistGrouped,
  setFriendReadlistGrouped,
  setFriendPlaylistGrouped,
  friendListLoading,
  friendWatchlistGrouped,
  friendReadlistGrouped,
  friendPlaylistGrouped,
  handleAddFromFriendList,
  loadFriendWatchlistPageForStatus,
  loadFriendReadlistPageForStatus,
  loadFriendPlaylistPageForStatus,
  friendWatchlistLoadingStatuses,
  friendReadlistLoadingStatuses,
  friendPlaylistLoadingStatuses,
  userWatchlistProgressMap,
  userReadlistProgressMap,
  userPlaylistProgressMap,
  friendWatchlistSort,
  friendReadlistSort,
  friendPlaylistSort,
  handleFriendWatchlistSortChange,
  handleFriendReadlistSortChange,
  handleFriendPlaylistSortChange,
  setPendingSuggestionsCount,
  selectedCollectionId,
  setSelectedCollectionId,
  setShowCollectionForm,
  setEditingCollection,
}) => {
  const renderContent = () => {
    const isMergedLibraryView = currentView === 'WATCHLIST' || currentView === 'READLIST' || currentView === 'PLAYLIST';
    const libraryItems = [...watchlistItems, ...readlistItems, ...playlistItems];
    const libraryFilter = currentView === 'READLIST'
      ? readlistFilter
      : currentView === 'PLAYLIST'
        ? playlistFilter
        : watchlistFilter;
    const libraryFriendFilter = currentView === 'READLIST'
      ? readlistFriendFilter
      : currentView === 'PLAYLIST'
        ? playlistFriendFilter
        : watchlistFriendFilter;
    const librarySort = currentView === 'READLIST'
      ? readlistSort
      : currentView === 'PLAYLIST'
        ? playlistSort
        : watchlistSort;
    const setLibraryFilter = currentView === 'READLIST'
      ? setReadlistFilter
      : currentView === 'PLAYLIST'
        ? setPlaylistFilter
        : setWatchlistFilter;
    const setLibraryFriendFilter = currentView === 'READLIST'
      ? setReadlistFriendFilter
      : currentView === 'PLAYLIST'
        ? setPlaylistFriendFilter
        : setWatchlistFriendFilter;
    const setLibrarySort = currentView === 'READLIST'
      ? setReadlistSort
      : currentView === 'PLAYLIST'
        ? setPlaylistSort
        : setWatchlistSort;
    const defaultLibraryTypeFilter = currentView === 'READLIST'
      ? 'manga'
      : currentView === 'PLAYLIST'
        ? 'game'
        : 'all';

    const handleLibraryItemClick = (item: MediaItem) => {
      if (item.type === 'MANGA') {
        handleMangaItemClick(item);
        return;
      }

      if (item.type !== 'GAME') {
        handleVideoItemClick(item);
      }
    };

    if (listLoading && watchlistItems.length === 0 && readlistItems.length === 0 && playlistItems.length === 0) {
      return (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-neutral-500 uppercase tracking-wider animate-pulse">
            Loading your list...
          </div>
        </div>
      );
    }

    switch (currentView) {
      case 'WATCHLIST':
      case 'READLIST':
      case 'PLAYLIST':
        return (
          <>
            <FriendsActivityStrip
              onFriendClick={(friendId) => {
                const friend = friends.find(f => f.id === friendId);
                if (friend) handleViewFriend(friend);
              }}
            />
            <MediaList
              title="MY LIBRARY"
              items={isMergedLibraryView ? libraryItems : watchlistItems}
              onUpdate={handleUpdateMedia}
              onDelete={handleDeleteMedia}
              onItemClick={handleLibraryItemClick}
              readonly={false}
              filterStatus={libraryFilter}
              friendActivityFilter={libraryFriendFilter}
              sortBy={librarySort}
              onFilterChange={setLibraryFilter}
              onFriendActivityFilterChange={setLibraryFriendFilter}
              onSortChange={setLibrarySort}
              showSuggestButton={true}
              defaultTypeFilter={defaultLibraryTypeFilter}
            />
          </>
        );
      case 'SEARCH':
        return <SearchMedia onAdd={handleAddMedia} onOpenMedia={handleOpenMedia} />;
      case 'TRENDING':
        return (
          <TrendingPage
            onAdd={handleAddMedia}
            onViewMedia={(refId, mediaType, title) => {
              // Determine the provider and media type for navigation
              const parsed = parseVideoRefId(refId);
              const lowerType = mediaType.toLowerCase() as 'movie' | 'tv' | 'anime';
              const isManga = mediaType === 'MANGA';
              
              if (isManga) {
                // Handle manga navigation
                const mangaParsed = parseMangaRefId(refId);
                if (mangaParsed) {
                  handleOpenManga(mangaParsed.mangaId, mangaParsed.provider);
                } else {
                  // Legacy: assume mangadex if no provider prefix
                  const mangaId = refId.includes(':') ? refId.split(':')[1] : refId;
                  handleOpenManga(mangaId, 'mangadex');
                }
              } else if (parsed) {
                // Already a video provider ID
                handleOpenMedia(parsed.mediaId, parsed.provider, title, lowerType);
              } else {
                // External ID (tmdb, anilist, etc.) - use default provider with title for resolution
                const defaultProvider = mediaType === 'ANIME' ? DEFAULT_ANIME_PROVIDER : DEFAULT_MOVIE_PROVIDER;
                handleOpenMedia(refId, defaultProvider, title, lowerType);
              }
            }}
          />
        );
      case 'FRIENDS':
        return (
          <FriendList
            friends={friends}
            onViewFriend={handleViewFriend}
            onSearchUsers={handleSearchUsers}
            onFollowUser={handleFollowUser}
            onUnfollowUser={handleUnfollowUser}
            isLoading={friendsLoading}
            onViewMedia={(refId, mediaType, title) => {
              // Determine the provider and media type for navigation
              const parsed = parseVideoRefId(refId);
              const lowerType = mediaType.toLowerCase() as 'movie' | 'tv' | 'anime';
              const isManga = mediaType === 'MANGA';
              
              if (isManga) {
                // Handle manga navigation
                const mangaParsed = parseMangaRefId(refId);
                if (mangaParsed) {
                  handleOpenManga(mangaParsed.mangaId, mangaParsed.provider);
                } else {
                  // Legacy: assume mangadex if no provider prefix
                  const mangaId = refId.includes(':') ? refId.split(':')[1] : refId;
                  handleOpenManga(mangaId, 'mangadex');
                }
              } else if (parsed) {
                // Already a video provider ID
                handleOpenMedia(parsed.mediaId, parsed.provider, title, lowerType);
              } else {
                // External ID (tmdb, anilist, etc.) - use default provider with title for resolution
                const defaultProvider = mediaType === 'ANIME' ? DEFAULT_ANIME_PROVIDER : DEFAULT_MOVIE_PROVIDER;
                handleOpenMedia(refId, defaultProvider, title, lowerType);
              }
            }}
          />
        );
      case 'FRIEND_VIEW':
        if (!selectedFriend) return null;
        
        // Derive flat lists from grouped data for friend's lists
        const friendWatchlistItems: MediaItem[] = friendWatchlistGrouped 
          ? Object.values(friendWatchlistGrouped.groups).flatMap(g => g.items)
          : [];
        const friendReadlistItems: MediaItem[] = friendReadlistGrouped
          ? Object.values(friendReadlistGrouped.groups).flatMap(g => g.items)
          : [];
        const friendPlaylistItems: MediaItem[] = friendPlaylistGrouped
          ? Object.values(friendPlaylistGrouped.groups).flatMap(g => g.items)
          : [];
        
        // Convert GroupedFriendListResponse to GroupedListResponse format for MediaList
        const friendWatchlistForMediaList = friendWatchlistGrouped ? {
          groups: friendWatchlistGrouped.groups,
          grandTotal: friendWatchlistGrouped.grandTotal,
        } : null;
        const friendReadlistForMediaList = friendReadlistGrouped ? {
          groups: friendReadlistGrouped.groups,
          grandTotal: friendReadlistGrouped.grandTotal,
        } : null;
        const friendPlaylistForMediaList = friendPlaylistGrouped ? {
          groups: friendPlaylistGrouped.groups,
          grandTotal: friendPlaylistGrouped.grandTotal,
        } : null;
        
        return (
          <div className="space-y-8">
            <div className="border-b border-white pb-4 mb-4">
              <button
                onClick={() => {
                  setCurrentView('FRIENDS');
                  setFriendWatchlistGrouped(null);
                  setFriendReadlistGrouped(null);
                  setFriendPlaylistGrouped(null);
                }}
                className="text-gray-500 hover:text-white mb-2 text-sm uppercase tracking-wider"
              >
                &larr; Back to Friends
              </button>
              <h2 className="text-2xl font-bold uppercase tracking-tighter">
                {selectedFriend.username}'s LISTS
              </h2>
            </div>
            {friendListLoading ? (
              <div className="flex items-center justify-center min-h-[40vh]">
                <div className="text-neutral-500 uppercase tracking-wider animate-pulse">
                  Loading lists...
                </div>
              </div>
            ) : (
              <>
                <MediaList
                  title="WATCHLIST"
                  items={friendWatchlistItems}
                  groupedData={friendWatchlistForMediaList}
                  mediaTypeFilter="video"
                  onAddToMyList={handleAddFromFriendList}
                  readonly={true}
                  onPageChange={loadFriendWatchlistPageForStatus}
                  loadingStatuses={friendWatchlistLoadingStatuses}
                  userProgressMap={userWatchlistProgressMap}
                  sortBy={friendWatchlistSort}
                  onSortChange={handleFriendWatchlistSortChange}
                />
                <MediaList
                  title="READLIST"
                  items={friendReadlistItems}
                  groupedData={friendReadlistForMediaList}
                  mediaTypeFilter="manga"
                  onAddToMyList={handleAddFromFriendList}
                  readonly={true}
                  onPageChange={loadFriendReadlistPageForStatus}
                  loadingStatuses={friendReadlistLoadingStatuses}
                  userProgressMap={userReadlistProgressMap}
                  sortBy={friendReadlistSort}
                  onSortChange={handleFriendReadlistSortChange}
                />
                <MediaList
                  title="PLAYLIST"
                  items={friendPlaylistItems}
                  groupedData={friendPlaylistForMediaList}
                  mediaTypeFilter="game"
                  onAddToMyList={handleAddFromFriendList}
                  readonly={true}
                  onPageChange={loadFriendPlaylistPageForStatus}
                  loadingStatuses={friendPlaylistLoadingStatuses}
                  userProgressMap={userPlaylistProgressMap}
                  sortBy={friendPlaylistSort}
                  onSortChange={handleFriendPlaylistSortChange}
                />
              </>
            )}
          </div>
        );
      case 'SUGGESTIONS':
        return (
          <SuggestionList
            onSuggestionCountChange={(count) => setPendingSuggestionsCount(count)}
          />
        );
      case 'SETTINGS':
        return (
          <Settings onBack={() => setCurrentView('WATCHLIST')} />
        );
      case 'DOWNLOADS':
        return (
          <OfflineVideoProvider>
            <UnifiedDownloadManager 
              onMangaClick={handleOpenManga}
              onVideoClick={(mediaId, provider, title) => {
                // Open video detail in offline mode
                handleOpenMedia(mediaId, provider, title, 'anime');
              }}
            />
          </OfflineVideoProvider>
        );
      case 'COLLECTIONS':
        return (
          <Collections
            onSelectCollection={(id) => {
              setSelectedCollectionId(id);
              setCurrentView('COLLECTION_VIEW');
            }}
            onCreateCollection={() => {
              setEditingCollection(null);
              setShowCollectionForm(true);
            }}
          />
        );
      case 'COLLECTION_VIEW':
        if (!selectedCollectionId) return null;
        return (
          <CollectionView
            collectionId={selectedCollectionId}
            onBack={() => setCurrentView('COLLECTIONS')}
            onEdit={(collection) => {
              setEditingCollection(collection);
              setShowCollectionForm(true);
            }}
            onAddItem={() => {
              // Open search with special mode to add to collection
              // For now, can just navigate to SEARCH
              setCurrentView('SEARCH');
            }}
          />
        );
      default:
        return null;
    }
  };


  return renderContent();
};

export default AppViewRouter;
