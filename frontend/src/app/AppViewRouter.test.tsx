import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppViewRouter, type AppViewRouterProps } from './AppViewRouter';

vi.mock('@/features/library/components/MediaList', () => ({ MediaList: ({ title }: { title: string }) => <div>{title}</div> }));
vi.mock('@/features/library/components/SearchMedia', () => ({ SearchMedia: () => <div>SEARCH</div> }));
vi.mock('@/features/discovery/components/TrendingPage', () => ({ TrendingPage: () => <div>TRENDING</div>, default: () => <div>TRENDING</div> }));
vi.mock('@/features/social/components/FriendList', () => ({ FriendList: () => <div>FRIENDS</div> }));
vi.mock('@/features/social/components/SuggestionList', () => ({ SuggestionList: () => <div>SUGGESTIONS</div> }));
vi.mock('@/features/profile/components/Settings', () => ({ Settings: () => <div>SETTINGS</div> }));
vi.mock('@/features/offline/components/UnifiedDownloadManager', () => ({ UnifiedDownloadManager: () => <div>DOWNLOADS</div> }));
vi.mock('@/features/collections/components/Collections', () => ({ Collections: () => <div>COLLECTIONS</div>, default: () => <div>COLLECTIONS</div> }));
vi.mock('@/features/collections/components/CollectionView', () => ({ CollectionView: () => <div>COLLECTION VIEW</div>, default: () => <div>COLLECTION VIEW</div> }));

const baseProps: AppViewRouterProps = {
  currentView: 'WATCHLIST',
  listLoading: false,
  watchlistItems: [],
  readlistItems: [],
  playlistItems: [],
  watchlistGrouped: null,
  readlistGrouped: null,
  playlistGrouped: null,
  watchlistFilter: '',
  readlistFilter: '',
  playlistFilter: '',
  watchlistFriendFilter: '',
  readlistFriendFilter: '',
  playlistFriendFilter: '',
  watchlistSort: 'status',
  readlistSort: 'status',
  playlistSort: 'status',
  watchlistLoadingStatuses: new Set(),
  readlistLoadingStatuses: new Set(),
  playlistLoadingStatuses: new Set(),
  setWatchlistFilter: vi.fn(),
  setReadlistFilter: vi.fn(),
  setPlaylistFilter: vi.fn(),
  setWatchlistFriendFilter: vi.fn(),
  setReadlistFriendFilter: vi.fn(),
  setPlaylistFriendFilter: vi.fn(),
  setWatchlistSort: vi.fn(),
  setReadlistSort: vi.fn(),
  setPlaylistSort: vi.fn(),
  loadWatchlistPageForStatus: vi.fn(),
  loadReadlistPageForStatus: vi.fn(),
  loadPlaylistPageForStatus: vi.fn(),
  handleUpdateMedia: vi.fn(),
  handleDeleteMedia: vi.fn(),
  handleVideoItemClick: vi.fn(),
  handleMangaItemClick: vi.fn(),
  handleAddMedia: vi.fn(),
  handleOpenMedia: vi.fn(),
  handleOpenManga: vi.fn(),
  friends: [],
  handleViewFriend: vi.fn(),
  handleSearchUsers: vi.fn(),
  handleFollowUser: vi.fn(),
  handleUnfollowUser: vi.fn(),
  friendsLoading: false,
  selectedFriend: null,
  setCurrentView: vi.fn(),
  setFriendWatchlistGrouped: vi.fn(),
  setFriendReadlistGrouped: vi.fn(),
  setFriendPlaylistGrouped: vi.fn(),
  friendListLoading: false,
  friendWatchlistGrouped: null,
  friendReadlistGrouped: null,
  friendPlaylistGrouped: null,
  handleAddFromFriendList: vi.fn(),
  loadFriendWatchlistPageForStatus: vi.fn(),
  loadFriendReadlistPageForStatus: vi.fn(),
  loadFriendPlaylistPageForStatus: vi.fn(),
  friendWatchlistLoadingStatuses: new Set(),
  friendReadlistLoadingStatuses: new Set(),
  friendPlaylistLoadingStatuses: new Set(),
  userWatchlistProgressMap: new Map(),
  userReadlistProgressMap: new Map(),
  userPlaylistProgressMap: new Map(),
  friendWatchlistSort: 'status',
  friendReadlistSort: 'status',
  friendPlaylistSort: 'status',
  handleFriendWatchlistSortChange: vi.fn(),
  handleFriendReadlistSortChange: vi.fn(),
  handleFriendPlaylistSortChange: vi.fn(),
  setPendingSuggestionsCount: vi.fn(),
  selectedCollectionId: null,
  setSelectedCollectionId: vi.fn(),
  setShowCollectionForm: vi.fn(),
  setEditingCollection: vi.fn(),
};

describe('AppViewRouter', () => {
  it('renders watchlist view', () => {
    render(<AppViewRouter {...baseProps} />);
    expect(screen.getByText('MY WATCHLIST')).toBeInTheDocument();
  });

  it('renders loading state for empty list', () => {
    render(<AppViewRouter {...baseProps} listLoading={true} />);
    expect(screen.getByText('Loading your list...')).toBeInTheDocument();
  });
});
