import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { MediaList } from './components/MediaList';
import { SearchMedia } from './components/SearchMedia';
import { TrendingPage } from './components/TrendingPage';
import { FriendList } from './components/FriendList';
import { AuthForm } from './components/AuthForm';
import { SuggestionList } from './components/SuggestionList';
import { OAuthCallback } from './components/OAuthCallback';
import { Settings } from './components/Settings';
import { PublicProfile } from './components/PublicProfile';
import { MangaDetail } from './components/MangaDetail';
import { ChapterReader } from './components/ChapterReader';
import { UnifiedDownloadManager } from './components/UnifiedDownloadManager';
import { AccountSecurityBanner } from './components/AccountSecurityBanner';
import { AccountRecovery } from './components/AccountRecovery';
import MediaDetail from './components/MediaDetail';
import VideoPlayer from './components/VideoPlayer';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import { useOffline } from './context/OfflineContext';
import { OfflineVideoProvider, useOfflineVideo } from './context/OfflineVideoContext';
import { View, User, MediaItem, MediaStatus, SortBy, FriendActivityFilter, VideoProviderName, VideoEpisode, ProviderName } from './types';
import { ChapterInfo } from './services/mangadexTypes';
import * as api from './services/api';
import * as manga from './services/manga';
import { parseMangaRefId, MangaProviderName } from './services/manga';
import { parseVideoRefId, DEFAULT_ANIME_PROVIDER, DEFAULT_MOVIE_PROVIDER } from './services/video';

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

  // Friend's grouped lists (for FRIEND_VIEW)
  const [friendWatchlistGrouped, setFriendWatchlistGrouped] = useState<api.GroupedFriendListResponse | null>(null);
  const [friendReadlistGrouped, setFriendReadlistGrouped] = useState<api.GroupedFriendListResponse | null>(null);
  const [friendListLoading, setFriendListLoading] = useState(false);
  const [friendWatchlistLoadingStatuses, setFriendWatchlistLoadingStatuses] = useState<Set<MediaStatus>>(new Set());
  const [friendReadlistLoadingStatuses, setFriendReadlistLoadingStatuses] = useState<Set<MediaStatus>>(new Set());

  // User's own lists - separate state for watchlist (video) and readlist (manga)
  const [watchlistGrouped, setWatchlistGrouped] = useState<api.GroupedListResponse | null>(null);
  const [readlistGrouped, setReadlistGrouped] = useState<api.GroupedListResponse | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [watchlistLoadingStatuses, setWatchlistLoadingStatuses] = useState<Set<MediaStatus>>(new Set());
  const [readlistLoadingStatuses, setReadlistLoadingStatuses] = useState<Set<MediaStatus>>(new Set());

  // Filter and sort state
  const [watchlistFilter, setWatchlistFilter] = useState<MediaStatus | ''>('');
  const [watchlistSort, setWatchlistSort] = useState<SortBy>('status');
  const [watchlistFriendFilter, setWatchlistFriendFilter] = useState<FriendActivityFilter>('');
  const [readlistFilter, setReadlistFilter] = useState<MediaStatus | ''>('');
  const [readlistSort, setReadlistSort] = useState<SortBy>('status');
  const [readlistFriendFilter, setReadlistFriendFilter] = useState<FriendActivityFilter>('');

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

  // Combined list for backward compatibility (friend view, etc.)
  const myList = useMemo(() => {
    return [...watchlistItems, ...readlistItems];
  }, [watchlistItems, readlistItems]);

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
      setFriends([]);
      setPendingSuggestionsCount(0);
    }
  }, [user, isOfflineAuthenticated]);

  const loadMyList = useCallback(async () => {
    setListLoading(true);
    try {
      // Load watchlist (video) and readlist (manga) in parallel
      const [watchlistResult, readlistResult] = await Promise.all([
        api.getMyGroupedList({ limit: 50, mediaTypeFilter: 'video' }),
        api.getMyGroupedList({ limit: 50, mediaTypeFilter: 'manga' }),
      ]);
      setWatchlistGrouped(watchlistResult);
      setReadlistGrouped(readlistResult);
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
      
      const result = await api.getMyGroupedList({ limit: 50, statusPages, mediaTypeFilter: 'video' });
      
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
      
      const result = await api.getMyGroupedList({ limit: 50, statusPages, mediaTypeFilter: 'manga' });
      
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
      
      const result = await api.getFriendGroupedList(selectedFriend.id, { limit: 50, statusPages, mediaTypeFilter: 'video' });
      
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
  }, [friendWatchlistGrouped, friendWatchlistLoadingStatuses, selectedFriend]);

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
      
      const result = await api.getFriendGroupedList(selectedFriend.id, { limit: 50, statusPages, mediaTypeFilter: 'manga' });
      
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
  }, [friendReadlistGrouped, friendReadlistLoadingStatuses, selectedFriend]);

  const loadFriends = useCallback(async () => {
    setFriendsLoading(true);
    try {
      const following = await api.getFollowing();
      setFriends(following);
    } catch (error) {
      console.error('Failed to load friends:', error);
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  const loadPendingSuggestionsCount = useCallback(async () => {
    try {
      const suggestions = await api.getReceivedSuggestions('PENDING');
      setPendingSuggestionsCount(suggestions.length);
    } catch (error) {
      console.error('Failed to load suggestions count:', error);
    }
  }, []);

  const handleAddMedia = async (newItem: Omit<MediaItem, 'id'>) => {
    try {
      const created = await api.addToList(newItem);
      const status = created.status;
      const isManga = created.type === 'MANGA';
      
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
      const message = error?.response?.data?.error || 'Failed to add item to your list';
      showToast(message, 'error');
    }
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
      const created = await api.addToList(newItem);
      const isManga = created.type === 'MANGA';
      const setGrouped = isManga ? setReadlistGrouped : setWatchlistGrouped;
      
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
    // Find the item and its current status in both lists
    let oldStatus: MediaStatus | null = null;
    let foundItem: MediaItem | null = null;
    let isManga = false;
    
    // Check watchlist first
    if (watchlistGrouped) {
      for (const status of Object.keys(watchlistGrouped.groups) as MediaStatus[]) {
        const item = watchlistGrouped.groups[status].items.find(i => i.id === id);
        if (item) {
          oldStatus = status;
          foundItem = item;
          isManga = false;
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
          isManga = true;
          break;
        }
      }
    }
    
    if (!foundItem || !oldStatus) return;
    
    const newStatus = updates.status || oldStatus;
    const updatedItem = { ...foundItem, ...updates };
    const setGrouped = isManga ? setReadlistGrouped : setWatchlistGrouped;
    
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
      await api.updateListItem(id, updates);
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
    let isManga = false;
    
    // Check watchlist first
    if (watchlistGrouped) {
      for (const status of Object.keys(watchlistGrouped.groups) as MediaStatus[]) {
        if (watchlistGrouped.groups[status].items.some(i => i.id === id)) {
          itemStatus = status;
          isManga = false;
          break;
        }
      }
    }
    
    // Check readlist if not found
    if (!itemStatus && readlistGrouped) {
      for (const status of Object.keys(readlistGrouped.groups) as MediaStatus[]) {
        if (readlistGrouped.groups[status].items.some(i => i.id === id)) {
          itemStatus = status;
          isManga = true;
          break;
        }
      }
    }
    
    const setGrouped = isManga ? setReadlistGrouped : setWatchlistGrouped;
    
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
      await api.deleteListItem(id);
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
      // Load friend's grouped lists for video and manga in parallel
      const [watchlistResult, readlistResult] = await Promise.all([
        api.getFriendGroupedList(friend.id, { limit: 50, mediaTypeFilter: 'video' }),
        api.getFriendGroupedList(friend.id, { limit: 50, mediaTypeFilter: 'manga' }),
      ]);
      setFriendWatchlistGrouped(watchlistResult);
      setFriendReadlistGrouped(readlistResult);
    } catch (error) {
      console.error('Failed to load friend list:', error);
    } finally {
      setFriendListLoading(false);
    }
  };

  const handleSearchUsers = async (query: string): Promise<User[]> => {
    return await api.searchUsers(query);
  };

  const handleFollowUser = async (userId: string) => {
    try {
      await api.followUser(userId);
      await loadFriends(); // Reload friends list
      showToast('User followed successfully', 'success');
    } catch (error) {
      console.error('Failed to follow user:', error);
      showToast('Failed to follow user', 'error');
    }
  };

  const handleUnfollowUser = async (userId: string) => {
    try {
      await api.unfollowUser(userId);
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

  const renderContent = () => {
    if (listLoading && watchlistItems.length === 0 && readlistItems.length === 0) {
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
        return (
          <MediaList
            title="MY WATCHLIST"
            items={watchlistItems}
            groupedData={watchlistGrouped}
            mediaTypeFilter="video"
            onUpdate={handleUpdateMedia}
            onDelete={handleDeleteMedia}
            onItemClick={handleVideoItemClick}
            readonly={false}
            filterStatus={watchlistFilter}
            friendActivityFilter={watchlistFriendFilter}
            sortBy={watchlistSort}
            onFilterChange={setWatchlistFilter}
            onFriendActivityFilterChange={setWatchlistFriendFilter}
            onSortChange={(sort) => {
              setWatchlistSort(sort);
            }}
            showSuggestButton={true}
            onPageChange={loadWatchlistPageForStatus}
            loadingStatuses={watchlistLoadingStatuses}
          />
        );
      case 'READLIST':
        return (
          <MediaList
            title="MY READLIST"
            items={readlistItems}
            groupedData={readlistGrouped}
            mediaTypeFilter="manga"
            onUpdate={handleUpdateMedia}
            onDelete={handleDeleteMedia}
            onItemClick={handleMangaItemClick}
            readonly={false}
            filterStatus={readlistFilter}
            friendActivityFilter={readlistFriendFilter}
            sortBy={readlistSort}
            onFilterChange={setReadlistFilter}
            onFriendActivityFilterChange={setReadlistFriendFilter}
            onSortChange={(sort) => {
              setReadlistSort(sort);
            }}
            showSuggestButton={true}
            onPageChange={loadReadlistPageForStatus}
            loadingStatuses={readlistLoadingStatuses}
          />
        );
      case 'SEARCH':
        return <SearchMedia onAdd={handleAddMedia} onOpenMedia={handleOpenMedia} />;
      case 'TRENDING':
        return (
          <TrendingPage
            onAdd={handleAddMedia}
            onViewMedia={(refId, mediaType) => {
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
                handleOpenMedia(parsed.mediaId, parsed.provider, undefined, lowerType);
              } else {
                // External ID (tmdb, anilist, etc.) - use default provider
                const defaultProvider = mediaType === 'ANIME' ? DEFAULT_ANIME_PROVIDER : DEFAULT_MOVIE_PROVIDER;
                handleOpenMedia(refId, defaultProvider, undefined, lowerType);
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
            onViewMedia={(refId, mediaType) => {
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
                handleOpenMedia(parsed.mediaId, parsed.provider, undefined, lowerType);
              } else {
                // External ID (tmdb, anilist, etc.) - use default provider
                const defaultProvider = mediaType === 'ANIME' ? DEFAULT_ANIME_PROVIDER : DEFAULT_MOVIE_PROVIDER;
                handleOpenMedia(refId, defaultProvider, undefined, lowerType);
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
        
        // Convert GroupedFriendListResponse to GroupedListResponse format for MediaList
        const friendWatchlistForMediaList = friendWatchlistGrouped ? {
          groups: friendWatchlistGrouped.groups,
          grandTotal: friendWatchlistGrouped.grandTotal,
        } : null;
        const friendReadlistForMediaList = friendReadlistGrouped ? {
          groups: friendReadlistGrouped.groups,
          grandTotal: friendReadlistGrouped.grandTotal,
        } : null;
        
        return (
          <div className="space-y-8">
            <div className="border-b border-white pb-4 mb-4">
              <button
                onClick={() => {
                  setCurrentView('FRIENDS');
                  setFriendWatchlistGrouped(null);
                  setFriendReadlistGrouped(null);
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
      default:
        return null;
    }
  };

  // Render chapter reader overlay (check this FIRST since it's opened from MangaDetail)
  if (readerState) {
    return (
      <ChapterReader
        mangaId={readerState.mangaId}
        chapterId={readerState.chapterId}
        chapters={readerState.chapters}
        onClose={handleCloseReader}
        onChapterChange={handleChapterChange}
        provider={readerState.provider}
      />
    );
  }

  // Render video player overlay (check before MediaDetail since it's opened from MediaDetail)
  if (playerState) {
    return (
      <OfflineVideoProvider>
        <VideoPlayer
          mediaId={playerState.mediaId}
          episodeId={playerState.episodeId}
          episodes={playerState.episodes}
          onClose={handleClosePlayer}
          onEpisodeChange={handleEpisodeChange}
          provider={playerState.provider}
          mediaTitle={playerState.mediaTitle}
          episodeNumber={playerState.episodeNumber}
          seasonNumber={playerState.seasonNumber}
          onProviderChange={handleProviderChange}
          mediaType={playerState.mediaType}
        />
      </OfflineVideoProvider>
    );
  }

  // Render manga detail overlay
  if (selectedManga) {
    return (
      <MangaDetail
        mangaId={selectedManga.id}
        onClose={handleCloseManga}
        onReadChapter={handleReadChapter}
        provider={selectedManga.provider}
      />
    );
  }

  // Render video media detail overlay
  if (selectedMedia) {
    return (
      <OfflineVideoProvider>
        <MediaDetail
          mediaId={selectedMedia.id}
          provider={selectedMedia.provider}
          title={selectedMedia.title}
          mediaType={selectedMedia.mediaType}
          onClose={handleCloseMedia}
          onWatchEpisode={handleWatchEpisode}
        />
      </OfflineVideoProvider>
    );
  }

  return (
    <Layout
      currentView={currentView}
      onViewChange={setCurrentView}
      user={user}
      onLogout={handleLogout}
      pendingSuggestionsCount={pendingSuggestionsCount}
      isOnline={isOnline}
      isOfflineAuthenticated={isOfflineAuthenticated}
    >
      <AccountSecurityBanner onSetupRecovery={() => setCurrentView('SETTINGS')} />
      {renderContent()}
    </Layout>
  );
};

// Root App component with routing
const App: React.FC = () => {
  return (
    <Routes>
      {/* Public profile route - accessible without auth */}
      <Route path="/u/:username" element={<PublicProfile />} />
      
      {/* OAuth callback route */}
      <Route path="/auth/callback" element={<MainApp />} />
      
      {/* Main app - all other routes */}
      <Route path="/*" element={<MainApp />} />
    </Routes>
  );
};

export default App;
