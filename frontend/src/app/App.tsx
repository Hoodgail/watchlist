import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import AppOverlays from '@/app/AppOverlays';
import AppShell from '@/app/AppShell';
import AppViewRouter from '@/app/AppViewRouter';
import { Layout } from '@/components/Layout';
import { AuthForm } from '@/components/AuthForm';
import { OAuthCallback } from '@/components/OAuthCallback';
import { PublicProfile } from '@/components/PublicProfile';
import { PublicCollectionView } from '@/components/PublicCollectionView';
import { AccountRecovery } from '@/components/AccountRecovery';
import * as libraryApi from '@/features/library/api';
import * as socialApi from '@/features/social/api';
import type { GroupedListResponse } from '@/features/library/api';
import type { GroupedFriendListResponse } from '@/features/social/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useOffline } from '@/context/OfflineContext';
import { View, User, MediaItem, MediaStatus, SortBy, FriendActivityFilter, VideoProviderName, VideoEpisode, ProviderName, Collection } from '@/types';
import { ChapterInfo } from '@/services/mangadexTypes';
import * as manga from '@/services/manga';
import { calculateSimilarity, MatchableItem } from '@shared/matching';
import type { NewItemData } from '@/features/playback/components/ConflictResolutionModal';
import { parseMangaRefId, MangaProviderName } from '@/services/manga';
import { parseVideoRefId, DEFAULT_ANIME_PROVIDER, DEFAULT_MOVIE_PROVIDER } from '@/services/video';

// Check if current path is OAuth callback
const isOAuthCallbackPath = (path: string, search: string): boolean => {
  return path === '/auth/callback' || (search.includes('accessToken') && search.includes('refreshToken'));
};

// Main App component that handles the authenticated app
const MainApp: React.FC = () => {
  const { user, isLoading: authLoading, logout, isOfflineAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { isOnline, isChapterDownloaded, getOfflineChapters, downloadedManga } = useOffline();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Determine initial view based on offline status
  const getInitialView = (): View => {
    // If offline and we have downloaded content, show downloads
    if (!navigator.onLine) {
      return 'DOWNLOADS';
    }
    return 'WATCHLIST';
  };
  
  const [currentView, setCurrentView] = useState<View>(getInitialView());
  const [isOAuthCallback, setIsOAuthCallback] = useState(isOAuthCallbackPath(location.pathname, location.search));
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [showRecovery, setShowRecovery] = useState(false);

  // Collection state
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);

  // Friend's grouped lists (for FRIEND_VIEW)
  const [friendWatchlistGrouped, setFriendWatchlistGrouped] = useState<GroupedFriendListResponse | null>(null);
  const [friendReadlistGrouped, setFriendReadlistGrouped] = useState<GroupedFriendListResponse | null>(null);
  const [friendPlaylistGrouped, setFriendPlaylistGrouped] = useState<GroupedFriendListResponse | null>(null);
  const [friendListLoading, setFriendListLoading] = useState(false);
  const [friendWatchlistLoadingStatuses, setFriendWatchlistLoadingStatuses] = useState<Set<MediaStatus>>(new Set());
  const [friendReadlistLoadingStatuses, setFriendReadlistLoadingStatuses] = useState<Set<MediaStatus>>(new Set());
  const [friendPlaylistLoadingStatuses, setFriendPlaylistLoadingStatuses] = useState<Set<MediaStatus>>(new Set());

  // User's own lists - separate state for watchlist (video), readlist (manga), and playlist (game)
  const [watchlistGrouped, setWatchlistGrouped] = useState<GroupedListResponse | null>(null);
  const [readlistGrouped, setReadlistGrouped] = useState<GroupedListResponse | null>(null);
  const [playlistGrouped, setPlaylistGrouped] = useState<GroupedListResponse | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [watchlistLoadingStatuses, setWatchlistLoadingStatuses] = useState<Set<MediaStatus>>(new Set());
  const [readlistLoadingStatuses, setReadlistLoadingStatuses] = useState<Set<MediaStatus>>(new Set());
  const [playlistLoadingStatuses, setPlaylistLoadingStatuses] = useState<Set<MediaStatus>>(new Set());

  // Filter and sort state
  const [watchlistFilter, setWatchlistFilter] = useState<MediaStatus | ''>('');
  const [watchlistSort, setWatchlistSort] = useState<SortBy>('status');
  const [watchlistFriendFilter, setWatchlistFriendFilter] = useState<FriendActivityFilter>('');
  const [readlistFilter, setReadlistFilter] = useState<MediaStatus | ''>('');
  const [readlistSort, setReadlistSort] = useState<SortBy>('status');
  const [readlistFriendFilter, setReadlistFriendFilter] = useState<FriendActivityFilter>('');
  const [playlistFilter, setPlaylistFilter] = useState<MediaStatus | ''>('');
  const [playlistSort, setPlaylistSort] = useState<SortBy>('status');
  const [playlistFriendFilter, setPlaylistFriendFilter] = useState<FriendActivityFilter>('');

  // Friend list sort state (separate from user's own list sort)
  const [friendWatchlistSort, setFriendWatchlistSort] = useState<SortBy>('status');
  const [friendReadlistSort, setFriendReadlistSort] = useState<SortBy>('status');
  const [friendPlaylistSort, setFriendPlaylistSort] = useState<SortBy>('status');

  // Derived flat lists for components that need them
  const watchlistItems = useMemo(() => {
    if (!watchlistGrouped) return [];
    const allItems: MediaItem[] = [];
    for (const status of Object.keys(watchlistGrouped.groups) as MediaStatus[]) {
      allItems.push(...watchlistGrouped.groups[status].items);
    }
    return allItems;
  }, [watchlistGrouped]);

  const readlistItems = useMemo(() => {
    if (!readlistGrouped) return [];
    const allItems: MediaItem[] = [];
    for (const status of Object.keys(readlistGrouped.groups) as MediaStatus[]) {
      allItems.push(...readlistGrouped.groups[status].items);
    }
    return allItems;
  }, [readlistGrouped]);

  const playlistItems = useMemo(() => {
    if (!playlistGrouped) return [];
    const allItems: MediaItem[] = [];
    for (const status of Object.keys(playlistGrouped.groups) as MediaStatus[]) {
      allItems.push(...playlistGrouped.groups[status].items);
    }
    return allItems;
  }, [playlistGrouped]);

  // Combined list for backward compatibility (friend view, etc.)
  const myList = useMemo(() => {
    return [...watchlistItems, ...readlistItems, ...playlistItems];
  }, [watchlistItems, readlistItems, playlistItems]);

  // Create progress maps for spoiler detection (refId -> current progress)
  const userWatchlistProgressMap = useMemo(() => {
    const map = new Map<string, number>();
    watchlistItems.forEach(item => {
      if (item.refId) {
        map.set(item.refId, item.current);
      }
    });
    return map;
  }, [watchlistItems]);

  const userReadlistProgressMap = useMemo(() => {
    const map = new Map<string, number>();
    readlistItems.forEach(item => {
      if (item.refId) {
        map.set(item.refId, item.current);
      }
    });
    return map;
  }, [readlistItems]);

  const userPlaylistProgressMap = useMemo(() => {
    const map = new Map<string, number>();
    playlistItems.forEach(item => {
      if (item.refId) {
        map.set(item.refId, item.current);
      }
    });
    return map;
  }, [playlistItems]);

  // Followed friends
  const [friends, setFriends] = useState<User[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  // Pending suggestions count for badge
  const [pendingSuggestionsCount, setPendingSuggestionsCount] = useState(0);

  // Manga reader state
  const [selectedManga, setSelectedManga] = useState<{
    id: string;
    provider: MangaProviderName;
  } | null>(null);
  const [readerState, setReaderState] = useState<{
    mangaId: string;
    chapterId: string;
    chapters: ChapterInfo[];
    provider: MangaProviderName;
  } | null>(null);

  // Video media detail state
  const [selectedMedia, setSelectedMedia] = useState<{
    id: string;
    provider: VideoProviderName;
    title?: string;
    mediaType?: 'movie' | 'tv' | 'anime';
  } | null>(null);

  // Video player state
  const [playerState, setPlayerState] = useState<{
    mediaId: string;
    episodeId: string;
    episodes: VideoEpisode[];
    provider: VideoProviderName;
    mediaTitle: string;
    episodeNumber?: number;
    seasonNumber?: number;
    mediaType?: 'anime' | 'movie' | 'tv';
  } | null>(null);

  // Conflict resolution modal state
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictData, setConflictData] = useState<{
    newItem: Omit<MediaItem, 'id'>;
    newItemData: NewItemData;
    existingItem: MediaItem;
    similarityScore: number;
    seasonMismatch: boolean;
  } | null>(null);

  // Load user's list when authenticated (skip when offline-authenticated)
  useEffect(() => {
    if (user && !isOfflineAuthenticated) {
      // Online: load from API
      loadMyList();
      loadFriends();
      loadPendingSuggestionsCount();
    } else if (user && isOfflineAuthenticated) {
      // Offline: set default view to downloads if there's downloaded content
      console.log('[App] Offline mode - skipping API calls');
      setCurrentView('DOWNLOADS');
    } else {
      setWatchlistGrouped(null);
      setReadlistGrouped(null);
      setPlaylistGrouped(null);
      setFriends([]);
      setPendingSuggestionsCount(0);
    }
  }, [user, isOfflineAuthenticated]);

  const loadMyList = useCallback(async () => {
    setListLoading(true);
    try {
      // Load watchlist (video), readlist (manga), and playlist (game) in parallel
      const [watchlistResult, readlistResult, playlistResult] = await Promise.all([
        libraryApi.getMyGroupedList({ limit: 50, mediaTypeFilter: 'video' }),
        libraryApi.getMyGroupedList({ limit: 50, mediaTypeFilter: 'manga' }),
        libraryApi.getMyGroupedList({ limit: 50, mediaTypeFilter: 'game' }),
      ]);
      setWatchlistGrouped(watchlistResult);
      setReadlistGrouped(readlistResult);
      setPlaylistGrouped(playlistResult);
    } catch (error) {
      console.error('Failed to load list:', error);
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadWatchlistPageForStatus = useCallback(async (status: MediaStatus, page: number) => {
    if (!watchlistGrouped || watchlistLoadingStatuses.has(status)) return;
    
    setWatchlistLoadingStatuses(prev => new Set(prev).add(status));
    try {
      // Build statusPages with this status at the requested page
      const statusPages: Partial<Record<MediaStatus, number>> = {};
      // Keep existing pages for all other statuses
      for (const s of Object.keys(watchlistGrouped.groups) as MediaStatus[]) {
        statusPages[s] = s === status ? page : watchlistGrouped.groups[s].page;
      }
      
      const result = await libraryApi.getMyGroupedList({ limit: 50, statusPages, mediaTypeFilter: 'video' });
      
      // Replace the items for this status with the new page
      setWatchlistGrouped(prev => {
        if (!prev) return result;
        return {
          ...prev,
          groups: {
            ...prev.groups,
            [status]: result.groups[status],
          },
        };
      });
    } catch (error) {
      console.error(`Failed to load watchlist page ${page} for ${status}:`, error);
    } finally {
      setWatchlistLoadingStatuses(prev => {
        const next = new Set(prev);
        next.delete(status);
        return next;
      });
    }
  }, [watchlistGrouped, watchlistLoadingStatuses]);

  const loadReadlistPageForStatus = useCallback(async (status: MediaStatus, page: number) => {
    if (!readlistGrouped || readlistLoadingStatuses.has(status)) return;
    
    setReadlistLoadingStatuses(prev => new Set(prev).add(status));
    try {
      // Build statusPages with this status at the requested page
      const statusPages: Partial<Record<MediaStatus, number>> = {};
      // Keep existing pages for all other statuses
      for (const s of Object.keys(readlistGrouped.groups) as MediaStatus[]) {
        statusPages[s] = s === status ? page : readlistGrouped.groups[s].page;
      }
      
      const result = await libraryApi.getMyGroupedList({ limit: 50, statusPages, mediaTypeFilter: 'manga' });
      
      // Replace the items for this status with the new page
      setReadlistGrouped(prev => {
        if (!prev) return result;
        return {
          ...prev,
          groups: {
            ...prev.groups,
            [status]: result.groups[status],
          },
        };
      });
    } catch (error) {
      console.error(`Failed to load readlist page ${page} for ${status}:`, error);
    } finally {
      setReadlistLoadingStatuses(prev => {
        const next = new Set(prev);
        next.delete(status);
        return next;
      });
    }
  }, [readlistGrouped, readlistLoadingStatuses]);

  const loadPlaylistPageForStatus = useCallback(async (status: MediaStatus, page: number) => {
    if (!playlistGrouped || playlistLoadingStatuses.has(status)) return;
    
    setPlaylistLoadingStatuses(prev => new Set(prev).add(status));
    try {
      // Build statusPages with this status at the requested page
      const statusPages: Partial<Record<MediaStatus, number>> = {};
      // Keep existing pages for all other statuses
      for (const s of Object.keys(playlistGrouped.groups) as MediaStatus[]) {
        statusPages[s] = s === status ? page : playlistGrouped.groups[s].page;
      }
      
      const result = await libraryApi.getMyGroupedList({ limit: 50, statusPages, mediaTypeFilter: 'game' });
      
      // Replace the items for this status with the new page
      setPlaylistGrouped(prev => {
        if (!prev) return result;
        return {
          ...prev,
          groups: {
            ...prev.groups,
            [status]: result.groups[status],
          },
        };
      });
    } catch (error) {
      console.error(`Failed to load playlist page ${page} for ${status}:`, error);
    } finally {
      setPlaylistLoadingStatuses(prev => {
        const next = new Set(prev);
        next.delete(status);
        return next;
      });
    }
  }, [playlistGrouped, playlistLoadingStatuses]);

  const loadFriendWatchlistPageForStatus = useCallback(async (status: MediaStatus, page: number) => {
    if (!friendWatchlistGrouped || !selectedFriend || friendWatchlistLoadingStatuses.has(status)) return;
    
    setFriendWatchlistLoadingStatuses(prev => new Set(prev).add(status));
    try {
      // Build statusPages with this status at the requested page
      const statusPages: Partial<Record<MediaStatus, number>> = {};
      // Keep existing pages for all other statuses
      for (const s of Object.keys(friendWatchlistGrouped.groups) as MediaStatus[]) {
        statusPages[s] = s === status ? page : friendWatchlistGrouped.groups[s].page;
      }
      
      const result = await socialApi.getFriendGroupedList(selectedFriend.id, { limit: 50, statusPages, mediaTypeFilter: 'video', sortBy: friendWatchlistSort });
      
      // Replace the items for this status with the new page
      setFriendWatchlistGrouped(prev => {
        if (!prev) return result;
        return {
          ...prev,
          groups: {
            ...prev.groups,
            [status]: result.groups[status],
          },
        };
      });
    } catch (error) {
      console.error(`Failed to load friend watchlist page ${page} for ${status}:`, error);
    } finally {
      setFriendWatchlistLoadingStatuses(prev => {
        const next = new Set(prev);
        next.delete(status);
        return next;
      });
    }
  }, [friendWatchlistGrouped, friendWatchlistLoadingStatuses, selectedFriend, friendWatchlistSort]);

  const loadFriendReadlistPageForStatus = useCallback(async (status: MediaStatus, page: number) => {
    if (!friendReadlistGrouped || !selectedFriend || friendReadlistLoadingStatuses.has(status)) return;
    
    setFriendReadlistLoadingStatuses(prev => new Set(prev).add(status));
    try {
      // Build statusPages with this status at the requested page
      const statusPages: Partial<Record<MediaStatus, number>> = {};
      // Keep existing pages for all other statuses
      for (const s of Object.keys(friendReadlistGrouped.groups) as MediaStatus[]) {
        statusPages[s] = s === status ? page : friendReadlistGrouped.groups[s].page;
      }
      
      const result = await socialApi.getFriendGroupedList(selectedFriend.id, { limit: 50, statusPages, mediaTypeFilter: 'manga', sortBy: friendReadlistSort });
      
      // Replace the items for this status with the new page
      setFriendReadlistGrouped(prev => {
        if (!prev) return result;
        return {
          ...prev,
          groups: {
            ...prev.groups,
            [status]: result.groups[status],
          },
        };
      });
    } catch (error) {
      console.error(`Failed to load friend readlist page ${page} for ${status}:`, error);
    } finally {
      setFriendReadlistLoadingStatuses(prev => {
        const next = new Set(prev);
        next.delete(status);
        return next;
      });
    }
  }, [friendReadlistGrouped, friendReadlistLoadingStatuses, selectedFriend, friendReadlistSort]);

  const loadFriendPlaylistPageForStatus = useCallback(async (status: MediaStatus, page: number) => {
    if (!friendPlaylistGrouped || !selectedFriend || friendPlaylistLoadingStatuses.has(status)) return;
    
    setFriendPlaylistLoadingStatuses(prev => new Set(prev).add(status));
    try {
      // Build statusPages with this status at the requested page
      const statusPages: Partial<Record<MediaStatus, number>> = {};
      // Keep existing pages for all other statuses
      for (const s of Object.keys(friendPlaylistGrouped.groups) as MediaStatus[]) {
        statusPages[s] = s === status ? page : friendPlaylistGrouped.groups[s].page;
      }
      
      const result = await socialApi.getFriendGroupedList(selectedFriend.id, { limit: 50, statusPages, mediaTypeFilter: 'game', sortBy: friendPlaylistSort });
      
      // Replace the items for this status with the new page
      setFriendPlaylistGrouped(prev => {
        if (!prev) return result;
        return {
          ...prev,
          groups: {
            ...prev.groups,
            [status]: result.groups[status],
          },
        };
      });
    } catch (error) {
      console.error(`Failed to load friend playlist page ${page} for ${status}:`, error);
    } finally {
      setFriendPlaylistLoadingStatuses(prev => {
        const next = new Set(prev);
        next.delete(status);
        return next;
      });
    }
  }, [friendPlaylistGrouped, friendPlaylistLoadingStatuses, selectedFriend, friendPlaylistSort]);

  // Handlers for friend list sort changes - reload the entire list with new sort
  const handleFriendWatchlistSortChange = useCallback(async (newSort: SortBy) => {
    if (!selectedFriend) return;
    setFriendWatchlistSort(newSort);
    setFriendListLoading(true);
    try {
      const result = await socialApi.getFriendGroupedList(selectedFriend.id, { limit: 50, mediaTypeFilter: 'video', sortBy: newSort });
      setFriendWatchlistGrouped(result);
    } catch (error) {
      console.error('Failed to reload friend watchlist with new sort:', error);
    } finally {
      setFriendListLoading(false);
    }
  }, [selectedFriend]);

  const handleFriendReadlistSortChange = useCallback(async (newSort: SortBy) => {
    if (!selectedFriend) return;
    setFriendReadlistSort(newSort);
    setFriendListLoading(true);
    try {
      const result = await socialApi.getFriendGroupedList(selectedFriend.id, { limit: 50, mediaTypeFilter: 'manga', sortBy: newSort });
      setFriendReadlistGrouped(result);
    } catch (error) {
      console.error('Failed to reload friend readlist with new sort:', error);
    } finally {
      setFriendListLoading(false);
    }
  }, [selectedFriend]);

  const handleFriendPlaylistSortChange = useCallback(async (newSort: SortBy) => {
    if (!selectedFriend) return;
    setFriendPlaylistSort(newSort);
    setFriendListLoading(true);
    try {
      const result = await socialApi.getFriendGroupedList(selectedFriend.id, { limit: 50, mediaTypeFilter: 'game', sortBy: newSort });
      setFriendPlaylistGrouped(result);
    } catch (error) {
      console.error('Failed to reload friend playlist with new sort:', error);
    } finally {
      setFriendListLoading(false);
    }
  }, [selectedFriend]);

  const loadFriends = useCallback(async () => {
    setFriendsLoading(true);
    try {
      const following = await socialApi.getFollowing();
      setFriends(following);
    } catch (error) {
      console.error('Failed to load friends:', error);
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  const loadPendingSuggestionsCount = useCallback(async () => {
    try {
      const suggestions = await socialApi.getReceivedSuggestions('PENDING');
      setPendingSuggestionsCount(suggestions.length);
    } catch (error) {
      console.error('Failed to load suggestions count:', error);
    }
  }, []);

  // Helper to extract year from refId or other sources
  const extractYear = (item: { refId?: string; title?: string; year?: number | null }): number | null => {
    // Use year directly if provided
    if (item.year) {
      return item.year;
    }
    // Try to extract year from refId format like "tmdb:12345:2020"
    if (item.refId) {
      const parts = item.refId.split(':');
      if (parts.length >= 3) {
        const maybeYear = parseInt(parts[2], 10);
        if (maybeYear >= 1900 && maybeYear <= 2100) {
          return maybeYear;
        }
      }
    }
    // Try to extract year from title like "Show Name (2020)"
    if (item.title) {
      const match = item.title.match(/\((\d{4})\)\s*$/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return null;
  };

  // Helper to find item by refId
  const findItemByRefId = useCallback((refId: string): MediaItem | null => {
    for (const item of myList) {
      if (item.refId === refId) {
        return item;
      }
    }
    return null;
  }, [myList]);

  // Helper to get all list items for conflict checking
  const getAllListItems = useCallback((): MediaItem[] => {
    return myList;
  }, [myList]);

  const handleAddMedia = async (newItem: Omit<MediaItem, 'id'>) => {
    try {
      // 1. Check exact refId match
      const exactMatch = findItemByRefId(newItem.refId);
      if (exactMatch) {
        showToast('This item is already in your list', 'error');
        return;
      }

      // 2. Check for similar items
      const existingItems = getAllListItems();
      const target: MatchableItem = {
        title: newItem.title,
        year: extractYear({ refId: newItem.refId, title: newItem.title, year: newItem.year }),
      };

      for (const existing of existingItems) {
        const existingMatchable: MatchableItem = {
          title: existing.title,
          year: extractYear({ refId: existing.refId, title: existing.title, year: existing.year }),
        };

        const result = calculateSimilarity(target, existingMatchable);

        if (result.score > 0.85 || result.seasonMismatch) {
          // Show conflict modal
          const newItemData: NewItemData = {
            refId: newItem.refId,
            title: newItem.title,
            imageUrl: newItem.imageUrl,
            year: target.year ?? undefined,
            type: newItem.type,
          };
          setConflictData({
            newItem,
            newItemData,
            existingItem: existing,
            similarityScore: result.score,
            seasonMismatch: result.seasonMismatch,
          });
          setConflictModalOpen(true);
          return;
        }
      }

      // 3. No conflict - proceed with normal add
      const created = await libraryApi.addToList(newItem);
      const status = created.status;
      const isManga = created.type === 'MANGA';
      const isGame = created.type === 'GAME';
      
      // Add to the appropriate list based on type
      if (isManga) {
        setReadlistGrouped(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            grandTotal: prev.grandTotal + 1,
            groups: {
              ...prev.groups,
              [status]: {
                ...prev.groups[status],
                items: [...prev.groups[status].items, created],
                total: prev.groups[status].total + 1,
              },
            },
          };
        });
      } else if (isGame) {
        setPlaylistGrouped(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            grandTotal: prev.grandTotal + 1,
            groups: {
              ...prev.groups,
              [status]: {
                ...prev.groups[status],
                items: [...prev.groups[status].items, created],
                total: prev.groups[status].total + 1,
              },
            },
          };
        });
      } else {
        setWatchlistGrouped(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            grandTotal: prev.grandTotal + 1,
            groups: {
              ...prev.groups,
              [status]: {
                ...prev.groups[status],
                items: [...prev.groups[status].items, created],
                total: prev.groups[status].total + 1,
              },
            },
          };
        });
      }
      // Don't navigate away - let user continue adding items
      showToast(`Added "${newItem.title}" to your list`, 'success');
    } catch (error: any) {
      console.error('Failed to add item:', error);
      const message = error?.message || error?.response?.data?.error || 'Failed to add item to your list';
      showToast(message, 'error');
    }
  };

  // Conflict resolution handlers
  const handleConflictMerge = async (existingItemId: string, newRefId: string) => {
    if (!conflictData) return;
    
    // Find the existing item to get its source ID
    const existingItem = conflictData.existingItem;
    
    // Call API to link the new refId as an alias to the existing source
    await libraryApi.linkSource(existingItem.refId, newRefId);
    
    // Refresh list to get updated aliases
    await loadMyList();
  };

  const handleConflictReplace = async (existingItemId: string, newItemData: NewItemData) => {
    if (!conflictData) return;
    
    // Remove old item
    await libraryApi.deleteListItem(existingItemId);
    
    // Add new item
    const created = await libraryApi.addToList(conflictData.newItem);
    
    // Update local state
    const status = created.status;
    const isManga = created.type === 'MANGA';
    const isGame = created.type === 'GAME';
    
    if (isManga) {
      setReadlistGrouped(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          groups: {
            ...prev.groups,
            [status]: {
              ...prev.groups[status],
              items: [...prev.groups[status].items, created],
              total: prev.groups[status].total + 1,
            },
          },
        };
      });
    } else if (isGame) {
      setPlaylistGrouped(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          groups: {
            ...prev.groups,
            [status]: {
              ...prev.groups[status],
              items: [...prev.groups[status].items, created],
              total: prev.groups[status].total + 1,
            },
          },
        };
      });
    } else {
      setWatchlistGrouped(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          groups: {
            ...prev.groups,
            [status]: {
              ...prev.groups[status],
              items: [...prev.groups[status].items, created],
              total: prev.groups[status].total + 1,
            },
          },
        };
      });
    }
  };

  const handleConflictKeepBoth = async (newItemData: NewItemData) => {
    if (!conflictData) return;
    
    // Just add the new item normally
      const created = await libraryApi.addToList(conflictData.newItem);
    
    const status = created.status;
    const isManga = created.type === 'MANGA';
    const isGame = created.type === 'GAME';
    
    if (isManga) {
      setReadlistGrouped(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          grandTotal: prev.grandTotal + 1,
          groups: {
            ...prev.groups,
            [status]: {
              ...prev.groups[status],
              items: [...prev.groups[status].items, created],
              total: prev.groups[status].total + 1,
            },
          },
        };
      });
    } else if (isGame) {
      setPlaylistGrouped(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          grandTotal: prev.grandTotal + 1,
          groups: {
            ...prev.groups,
            [status]: {
              ...prev.groups[status],
              items: [...prev.groups[status].items, created],
              total: prev.groups[status].total + 1,
            },
          },
        };
      });
    } else {
      setWatchlistGrouped(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          grandTotal: prev.grandTotal + 1,
          groups: {
            ...prev.groups,
            [status]: {
              ...prev.groups[status],
              items: [...prev.groups[status].items, created],
              total: prev.groups[status].total + 1,
            },
          },
        };
      });
    }
  };

  const handleCloseConflictModal = () => {
    setConflictModalOpen(false);
    setConflictData(null);
  };

  const handleAddFromFriendList = async (item: MediaItem) => {
    // Add as PLAN_TO_WATCH status
    const newItem: Omit<MediaItem, 'id'> = {
      title: item.title,
      type: item.type,
      status: 'PLAN_TO_WATCH',
      current: 0,
      total: item.total,
      imageUrl: item.imageUrl,
      refId: item.refId,
    };
    
    try {
      const created = await libraryApi.addToList(newItem);
      const isManga = created.type === 'MANGA';
      const isGame = created.type === 'GAME';
      const setGrouped = isManga ? setReadlistGrouped : isGame ? setPlaylistGrouped : setWatchlistGrouped;
      
      setGrouped(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          grandTotal: prev.grandTotal + 1,
          groups: {
            ...prev.groups,
            PLAN_TO_WATCH: {
              ...prev.groups.PLAN_TO_WATCH,
              items: [...prev.groups.PLAN_TO_WATCH.items, created],
              total: prev.groups.PLAN_TO_WATCH.total + 1,
            },
          },
        };
      });
      showToast(`Added "${item.title}" to your list`, 'success');
    } catch (error: any) {
      console.error('Failed to add item:', error);
      const message = error?.response?.data?.error || 'Failed to add item to your list';
      showToast(message, 'error');
    }
  };

  const handleUpdateMedia = async (id: string, updates: Partial<MediaItem>) => {
    // Find the item and its current status in all lists
    let oldStatus: MediaStatus | null = null;
    let foundItem: MediaItem | null = null;
    let listType: 'watchlist' | 'readlist' | 'playlist' = 'watchlist';
    
    // Check watchlist first
    if (watchlistGrouped) {
      for (const status of Object.keys(watchlistGrouped.groups) as MediaStatus[]) {
        const item = watchlistGrouped.groups[status].items.find(i => i.id === id);
        if (item) {
          oldStatus = status;
          foundItem = item;
          listType = 'watchlist';
          break;
        }
      }
    }
    
    // Check readlist if not found
    if (!foundItem && readlistGrouped) {
      for (const status of Object.keys(readlistGrouped.groups) as MediaStatus[]) {
        const item = readlistGrouped.groups[status].items.find(i => i.id === id);
        if (item) {
          oldStatus = status;
          foundItem = item;
          listType = 'readlist';
          break;
        }
      }
    }
    
    // Check playlist if not found
    if (!foundItem && playlistGrouped) {
      for (const status of Object.keys(playlistGrouped.groups) as MediaStatus[]) {
        const item = playlistGrouped.groups[status].items.find(i => i.id === id);
        if (item) {
          oldStatus = status;
          foundItem = item;
          listType = 'playlist';
          break;
        }
      }
    }
    
    if (!foundItem || !oldStatus) return;
    
    const newStatus = updates.status || oldStatus;
    const updatedItem = { ...foundItem, ...updates };
    const setGrouped = listType === 'readlist' ? setReadlistGrouped : listType === 'playlist' ? setPlaylistGrouped : setWatchlistGrouped;
    
    // Optimistic update
    setGrouped(prev => {
      if (!prev) return prev;
      
      // If status changed, move item between groups
      if (newStatus !== oldStatus) {
        return {
          ...prev,
          groups: {
            ...prev.groups,
            [oldStatus]: {
              ...prev.groups[oldStatus],
              items: prev.groups[oldStatus].items.filter(i => i.id !== id),
              total: prev.groups[oldStatus].total - 1,
            },
            [newStatus]: {
              ...prev.groups[newStatus],
              items: [...prev.groups[newStatus].items, updatedItem],
              total: prev.groups[newStatus].total + 1,
            },
          },
        };
      }
      
      // Same status, just update in place
      return {
        ...prev,
        groups: {
          ...prev.groups,
          [oldStatus]: {
            ...prev.groups[oldStatus],
            items: prev.groups[oldStatus].items.map(i => i.id === id ? updatedItem : i),
          },
        },
      };
    });

    try {
      await libraryApi.updateListItem(id, updates);
    } catch (error) {
      console.error('Failed to update item:', error);
      showToast('Failed to update item', 'error');
      // Revert on error
      loadMyList();
    }
  };

  const handleDeleteMedia = async (id: string) => {
    // Find which group and list contains this item
    let itemStatus: MediaStatus | null = null;
    let listType: 'watchlist' | 'readlist' | 'playlist' = 'watchlist';
    
    // Check watchlist first
    if (watchlistGrouped) {
      for (const status of Object.keys(watchlistGrouped.groups) as MediaStatus[]) {
        if (watchlistGrouped.groups[status].items.some(i => i.id === id)) {
          itemStatus = status;
          listType = 'watchlist';
          break;
        }
      }
    }
    
    // Check readlist if not found
    if (!itemStatus && readlistGrouped) {
      for (const status of Object.keys(readlistGrouped.groups) as MediaStatus[]) {
        if (readlistGrouped.groups[status].items.some(i => i.id === id)) {
          itemStatus = status;
          listType = 'readlist';
          break;
        }
      }
    }
    
    // Check playlist if not found
    if (!itemStatus && playlistGrouped) {
      for (const status of Object.keys(playlistGrouped.groups) as MediaStatus[]) {
        if (playlistGrouped.groups[status].items.some(i => i.id === id)) {
          itemStatus = status;
          listType = 'playlist';
          break;
        }
      }
    }
    
    const setGrouped = listType === 'readlist' ? setReadlistGrouped : listType === 'playlist' ? setPlaylistGrouped : setWatchlistGrouped;
    
    // Optimistic update
    if (itemStatus) {
      setGrouped(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          grandTotal: prev.grandTotal - 1,
          groups: {
            ...prev.groups,
            [itemStatus]: {
              ...prev.groups[itemStatus],
              items: prev.groups[itemStatus].items.filter(i => i.id !== id),
              total: prev.groups[itemStatus].total - 1,
            },
          },
        };
      });
    }

    try {
      await libraryApi.deleteListItem(id);
      showToast('Item removed from your list', 'success');
    } catch (error) {
      console.error('Failed to delete item:', error);
      showToast('Failed to delete item', 'error');
      // Revert on error
      loadMyList();
    }
  };

  const handleViewFriend = async (friend: User) => {
    setSelectedFriend(friend);
    setCurrentView('FRIEND_VIEW');
    setFriendListLoading(true);
    
    try {
      // Load friend's grouped lists for video, manga, and game in parallel
      const [watchlistResult, readlistResult, playlistResult] = await Promise.all([
        socialApi.getFriendGroupedList(friend.id, { limit: 50, mediaTypeFilter: 'video' }),
        socialApi.getFriendGroupedList(friend.id, { limit: 50, mediaTypeFilter: 'manga' }),
        socialApi.getFriendGroupedList(friend.id, { limit: 50, mediaTypeFilter: 'game' }),
      ]);
      setFriendWatchlistGrouped(watchlistResult);
      setFriendReadlistGrouped(readlistResult);
      setFriendPlaylistGrouped(playlistResult);
    } catch (error) {
      console.error('Failed to load friend list:', error);
    } finally {
      setFriendListLoading(false);
    }
  };

  const handleSearchUsers = async (query: string): Promise<User[]> => {
    return await socialApi.searchUsers(query);
  };

  const handleFollowUser = async (userId: string) => {
    try {
      await socialApi.followUser(userId);
      await loadFriends(); // Reload friends list
      showToast('User followed successfully', 'success');
    } catch (error) {
      console.error('Failed to follow user:', error);
      showToast('Failed to follow user', 'error');
    }
  };

  const handleUnfollowUser = async (userId: string) => {
    try {
      await socialApi.unfollowUser(userId);
      setFriends((prev) => prev.filter((f) => f.id !== userId));
      showToast('User unfollowed', 'success');
    } catch (error) {
      console.error('Failed to unfollow user:', error);
      showToast('Failed to unfollow user', 'error');
    }
  };

  const handleLogout = async () => {
    await logout();
    setCurrentView('WATCHLIST');
    setSelectedFriend(null);
    showToast('Logged out successfully', 'info');
  };

  const handleOAuthComplete = () => {
    setIsOAuthCallback(false);
    // Clean up URL using navigate
    navigate('/', { replace: true });
    setCurrentView('WATCHLIST');
    showToast('Welcome!', 'success');
  };

  const handleOAuthError = (error: string) => {
    setIsOAuthCallback(false);
    // Clean up URL using navigate
    navigate('/', { replace: true });
    showToast(error, 'error');
  };

  // Manga reader handlers
  const handleOpenManga = useCallback((mangaId: string, provider: MangaProviderName = 'mangadex') => {
    setSelectedManga({ id: mangaId, provider });
  }, []);

  const handleCloseManga = useCallback(() => {
    setSelectedManga(null);
  }, []);

  const handleReadChapter = useCallback(async (mangaId: string, chapterId: string) => {
    const provider = selectedManga?.provider || 'mangadex';
    try {
      let chapters: ChapterInfo[];
      
      // If offline or chapter is downloaded, try to load chapters from offline storage first
      if (!isOnline || isChapterDownloaded(chapterId)) {
        const offlineChapters = await getOfflineChapters(mangaId);
        if (offlineChapters.length > 0) {
          chapters = offlineChapters;
        } else if (!isOnline) {
          throw new Error('No offline chapters available');
        } else {
          // Online but no offline chapters - fetch from API
          chapters = await manga.getAllChapters(mangaId, provider);
        }
      } else {
        // Online and chapter not downloaded - fetch from API
        chapters = await manga.getAllChapters(mangaId, provider);
      }
      
      setReaderState({ mangaId, chapterId, chapters, provider });
    } catch (error) {
      console.error('Failed to load chapters:', error);
      showToast('Failed to open chapter', 'error');
    }
  }, [showToast, selectedManga, isOnline, isChapterDownloaded, getOfflineChapters]);

  const handleCloseReader = useCallback(() => {
    setReaderState(null);
  }, []);

  const handleChapterChange = useCallback((chapterId: string) => {
    if (readerState) {
      setReaderState({ ...readerState, chapterId });
    }
  }, [readerState]);

  // Video media handlers
  const handleOpenMedia = useCallback((
    mediaId: string,
    provider: ProviderName,
    title?: string,
    mediaType?: 'movie' | 'tv' | 'anime'
  ) => {
    // Only handle video providers (anime, movie, tv types)
    const videoProviders: VideoProviderName[] = ['hianime', 'animepahe', 'animekai', 'kickassanime', 'flixhq', 'goku', 'sflix', 'himovies', 'dramacool'];
    if (videoProviders.includes(provider as VideoProviderName)) {
      setSelectedMedia({ id: mediaId, provider: provider as VideoProviderName, title, mediaType });
    }
  }, []);

  const handleCloseMedia = useCallback(() => {
    setSelectedMedia(null);
  }, []);

  const handleWatchEpisode = useCallback((
    mediaId: string,
    episodeId: string,
    episodes: VideoEpisode[],
    provider: VideoProviderName,
    mediaTitle: string,
    episodeNumber?: number,
    seasonNumber?: number,
    mediaType?: 'anime' | 'movie' | 'tv'
  ) => {
    setPlayerState({ mediaId, episodeId, episodes, provider, mediaTitle, episodeNumber, seasonNumber, mediaType });
  }, []);

  const handleClosePlayer = useCallback(() => {
    setPlayerState(null);
  }, []);

  const handleEpisodeChange = useCallback((episodeId: string, episodeNumber?: number, seasonNumber?: number) => {
    if (playerState) {
      setPlayerState({ ...playerState, episodeId, episodeNumber, seasonNumber });
    }
  }, [playerState]);

  // Handle provider change from VideoPlayer (when switching sources)
  const handleProviderChange = useCallback((newProvider: VideoProviderName) => {
    if (playerState) {
      console.log('[App] Switching provider from', playerState.provider, 'to', newProvider);
      setPlayerState({ ...playerState, provider: newProvider });
    }
  }, [playerState]);

  // Open manga from list item (click on manga in readlist)
  const handleMangaItemClick = useCallback((item: MediaItem) => {
    if (item.type === 'MANGA' && item.refId) {
      const parsed = parseMangaRefId(item.refId);
      if (parsed) {
        handleOpenManga(parsed.mangaId, parsed.provider);
      } else {
        // Legacy support: assume mangadex if no provider prefix
        handleOpenManga(item.refId, 'mangadex');
      }
    }
  }, [handleOpenManga]);

  // Open video media from list item (click on tv/movie/anime in watchlist)
  const handleVideoItemClick = useCallback((item: MediaItem) => {
    if ((item.type === 'TV' || item.type === 'MOVIE' || item.type === 'ANIME') && item.refId) {
      // Determine media type for resolution
      const mediaType: 'movie' | 'tv' | 'anime' = 
        item.type === 'ANIME' ? 'anime' : 
        item.type === 'MOVIE' ? 'movie' : 'tv';
      
      const parsed = parseVideoRefId(item.refId);
      if (parsed) {
        // Already a video provider ID - pass title for fallback
        handleOpenMedia(parsed.mediaId, parsed.provider, item.title, mediaType);
      } else {
        // External ID (tmdb, anilist, etc.) - need title for resolution
        const defaultProvider = item.type === 'ANIME' ? DEFAULT_ANIME_PROVIDER : DEFAULT_MOVIE_PROVIDER;
        handleOpenMedia(item.refId, defaultProvider, item.title, mediaType);
      }
    }
  }, [handleOpenMedia]);

  // Handle OAuth callback
  if (isOAuthCallback) {
    return (
      <Layout currentView={currentView} onViewChange={setCurrentView} user={null}>
        <OAuthCallback onComplete={handleOAuthComplete} onError={handleOAuthError} />
      </Layout>
    );
  }

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <Layout currentView={currentView} onViewChange={setCurrentView} user={null}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-neutral-500 uppercase tracking-wider animate-pulse">
            Loading...
          </div>
        </div>
      </Layout>
    );
  }

  // Show auth form if not logged in
  if (!user) {
    // Show recovery flow
    if (showRecovery) {
      return (
        <Layout currentView={currentView} onViewChange={setCurrentView} user={null}>
          <AccountRecovery 
            onSuccess={() => {
              setShowRecovery(false);
              showToast('Account recovered! You are now logged in.', 'success');
            }} 
            onBack={() => setShowRecovery(false)} 
          />
        </Layout>
      );
    }

    return (
      <Layout currentView={currentView} onViewChange={setCurrentView} user={null}>
        <AuthForm 
          isLogin={isLoginMode} 
          onToggleMode={() => setIsLoginMode(!isLoginMode)}
          onRecovery={() => setShowRecovery(true)}
        />
      </Layout>
    );
  }

  const overlays = (
    <AppOverlays
      readerState={readerState}
      onCloseReader={handleCloseReader}
      onChapterChange={handleChapterChange}
      playerState={playerState}
      onClosePlayer={handleClosePlayer}
      onEpisodeChange={handleEpisodeChange}
      onProviderChange={handleProviderChange}
      selectedManga={selectedManga}
      onCloseManga={handleCloseManga}
      onReadChapter={handleReadChapter}
      selectedMedia={selectedMedia}
      onCloseMedia={handleCloseMedia}
      onWatchEpisode={handleWatchEpisode}
      conflictData={conflictData}
      conflictModalOpen={conflictModalOpen}
      onCloseConflictModal={handleCloseConflictModal}
      onConflictMerge={handleConflictMerge}
      onConflictReplace={handleConflictReplace}
      onConflictKeepBoth={handleConflictKeepBoth}
      showCollectionForm={showCollectionForm}
      editingCollection={editingCollection}
      onCloseCollectionForm={() => {
        setShowCollectionForm(false);
        setEditingCollection(null);
      }}
      onSaveCollectionForm={(collection) => {
        setShowCollectionForm(false);
        setEditingCollection(null);
        if (!editingCollection) {
          setSelectedCollectionId(collection.id);
          setCurrentView('COLLECTION_VIEW');
        }
      }}
    />
  );

  if (readerState || playerState || selectedManga || selectedMedia) {
    return overlays;
  }

  return (
    <AppShell
      currentView={currentView}
      onViewChange={setCurrentView}
      user={user}
      onLogout={handleLogout}
      pendingSuggestionsCount={pendingSuggestionsCount}
      isOnline={isOnline}
      isOfflineAuthenticated={isOfflineAuthenticated}
      onSetupRecovery={() => setCurrentView('SETTINGS')}
      modalLayer={overlays}
    >
      <AppViewRouter
        currentView={currentView}
        listLoading={listLoading}
        watchlistItems={watchlistItems}
        readlistItems={readlistItems}
        playlistItems={playlistItems}
        watchlistGrouped={watchlistGrouped}
        readlistGrouped={readlistGrouped}
        playlistGrouped={playlistGrouped}
        watchlistFilter={watchlistFilter}
        readlistFilter={readlistFilter}
        playlistFilter={playlistFilter}
        watchlistFriendFilter={watchlistFriendFilter}
        readlistFriendFilter={readlistFriendFilter}
        playlistFriendFilter={playlistFriendFilter}
        watchlistSort={watchlistSort}
        readlistSort={readlistSort}
        playlistSort={playlistSort}
        watchlistLoadingStatuses={watchlistLoadingStatuses}
        readlistLoadingStatuses={readlistLoadingStatuses}
        playlistLoadingStatuses={playlistLoadingStatuses}
        setWatchlistFilter={setWatchlistFilter}
        setReadlistFilter={setReadlistFilter}
        setPlaylistFilter={setPlaylistFilter}
        setWatchlistFriendFilter={setWatchlistFriendFilter}
        setReadlistFriendFilter={setReadlistFriendFilter}
        setPlaylistFriendFilter={setPlaylistFriendFilter}
        setWatchlistSort={setWatchlistSort}
        setReadlistSort={setReadlistSort}
        setPlaylistSort={setPlaylistSort}
        loadWatchlistPageForStatus={loadWatchlistPageForStatus}
        loadReadlistPageForStatus={loadReadlistPageForStatus}
        loadPlaylistPageForStatus={loadPlaylistPageForStatus}
        handleUpdateMedia={handleUpdateMedia}
        handleDeleteMedia={handleDeleteMedia}
        handleVideoItemClick={handleVideoItemClick}
        handleMangaItemClick={handleMangaItemClick}
        handleAddMedia={handleAddMedia}
        handleOpenMedia={handleOpenMedia as any}
        handleOpenManga={handleOpenManga}
        friends={friends}
        handleViewFriend={handleViewFriend}
        handleSearchUsers={handleSearchUsers}
        handleFollowUser={handleFollowUser}
        handleUnfollowUser={handleUnfollowUser}
        friendsLoading={friendsLoading}
        selectedFriend={selectedFriend}
        setCurrentView={setCurrentView}
        setFriendWatchlistGrouped={setFriendWatchlistGrouped}
        setFriendReadlistGrouped={setFriendReadlistGrouped}
        setFriendPlaylistGrouped={setFriendPlaylistGrouped}
        friendListLoading={friendListLoading}
        friendWatchlistGrouped={friendWatchlistGrouped}
        friendReadlistGrouped={friendReadlistGrouped}
        friendPlaylistGrouped={friendPlaylistGrouped}
        handleAddFromFriendList={handleAddFromFriendList}
        loadFriendWatchlistPageForStatus={loadFriendWatchlistPageForStatus}
        loadFriendReadlistPageForStatus={loadFriendReadlistPageForStatus}
        loadFriendPlaylistPageForStatus={loadFriendPlaylistPageForStatus}
        friendWatchlistLoadingStatuses={friendWatchlistLoadingStatuses}
        friendReadlistLoadingStatuses={friendReadlistLoadingStatuses}
        friendPlaylistLoadingStatuses={friendPlaylistLoadingStatuses}
        userWatchlistProgressMap={userWatchlistProgressMap}
        userReadlistProgressMap={userReadlistProgressMap}
        userPlaylistProgressMap={userPlaylistProgressMap}
        friendWatchlistSort={friendWatchlistSort}
        friendReadlistSort={friendReadlistSort}
        friendPlaylistSort={friendPlaylistSort}
        handleFriendWatchlistSortChange={handleFriendWatchlistSortChange}
        handleFriendReadlistSortChange={handleFriendReadlistSortChange}
        handleFriendPlaylistSortChange={handleFriendPlaylistSortChange}
        setPendingSuggestionsCount={setPendingSuggestionsCount}
        selectedCollectionId={selectedCollectionId}
        setSelectedCollectionId={setSelectedCollectionId}
        setShowCollectionForm={setShowCollectionForm}
        setEditingCollection={setEditingCollection}
      />
    </AppShell>
  );
};

// Root App component with routing
const App: React.FC = () => {
  return (
    <Routes>
      {/* Public profile route - accessible without auth */}
      <Route path="/u/:username" element={<PublicProfile />} />
      
      {/* Public collection route - accessible without auth */}
      <Route path="/c/:collectionId" element={<PublicCollectionView />} />
      
      {/* OAuth callback route */}
      <Route path="/auth/callback" element={<MainApp />} />
      
      {/* Main app - all other routes */}
      <Route path="/*" element={<MainApp />} />
    </Routes>
  );
};

export default App;
