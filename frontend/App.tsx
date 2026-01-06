import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/Layout';
import { MediaList } from './components/MediaList';
import { SearchMedia } from './components/SearchMedia';
import { FriendList } from './components/FriendList';
import { AuthForm } from './components/AuthForm';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import { View, User, MediaItem, MediaStatus, SortBy, FriendActivityFilter } from './types';
import * as api from './services/api';

const App: React.FC = () => {
  const { user, isLoading: authLoading, logout } = useAuth();
  const { showToast } = useToast();
  const [currentView, setCurrentView] = useState<View>('WATCHLIST');
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);
  const [isLoginMode, setIsLoginMode] = useState(true);

  // User's own list
  const [myList, setMyList] = useState<MediaItem[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // Filter and sort state
  const [watchlistFilter, setWatchlistFilter] = useState<MediaStatus | ''>('');
  const [watchlistSort, setWatchlistSort] = useState<SortBy>('status');
  const [watchlistFriendFilter, setWatchlistFriendFilter] = useState<FriendActivityFilter>('');
  const [readlistFilter, setReadlistFilter] = useState<MediaStatus | ''>('');
  const [readlistSort, setReadlistSort] = useState<SortBy>('status');
  const [readlistFriendFilter, setReadlistFriendFilter] = useState<FriendActivityFilter>('');

  // Followed friends
  const [friends, setFriends] = useState<User[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  // Load user's list when authenticated
  useEffect(() => {
    if (user) {
      loadMyList();
      loadFriends();
    } else {
      setMyList([]);
      setFriends([]);
    }
  }, [user]);

  const loadMyList = useCallback(async (sortBy: SortBy = 'status') => {
    setListLoading(true);
    try {
      const items = await api.getMyList({ sortBy });
      setMyList(items);
    } catch (error) {
      console.error('Failed to load list:', error);
    } finally {
      setListLoading(false);
    }
  }, []);

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

  const handleAddMedia = async (newItem: Omit<MediaItem, 'id'>) => {
    try {
      const created = await api.addToList(newItem);
      setMyList((prev) => [...prev, created]);
      setCurrentView(newItem.type === 'MANGA' ? 'READLIST' : 'WATCHLIST');
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
      setMyList((prev) => [...prev, created]);
      showToast(`Added "${item.title}" to your list`, 'success');
    } catch (error: any) {
      console.error('Failed to add item:', error);
      const message = error?.response?.data?.error || 'Failed to add item to your list';
      showToast(message, 'error');
    }
  };

  const handleUpdateMedia = async (id: string, updates: Partial<MediaItem>) => {
    // Optimistic update
    setMyList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );

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
    // Optimistic update
    setMyList((prev) => prev.filter((item) => item.id !== id));

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
    // Load friend's full list if not already loaded
    if (friend.list.length === 0) {
      try {
        // getUserList returns full User object with list populated
        const userWithList = await api.getUserList(friend.id);
        setSelectedFriend(userWithList);
        // Update in friends list too
        setFriends((prev) =>
          prev.map((f) => (f.id === friend.id ? userWithList : f))
        );
      } catch (error) {
        console.error('Failed to load friend list:', error);
        setSelectedFriend(friend);
      }
    } else {
      setSelectedFriend(friend);
    }
    setCurrentView('FRIEND_VIEW');
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
    return (
      <Layout currentView={currentView} onViewChange={setCurrentView} user={null}>
        <AuthForm isLogin={isLoginMode} onToggleMode={() => setIsLoginMode(!isLoginMode)} />
      </Layout>
    );
  }

  const renderContent = () => {
    if (listLoading && myList.length === 0) {
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
            items={myList.filter((i) => i.type !== 'MANGA')}
            onUpdate={handleUpdateMedia}
            onDelete={handleDeleteMedia}
            readonly={false}
            filterStatus={watchlistFilter}
            friendActivityFilter={watchlistFriendFilter}
            sortBy={watchlistSort}
            onFilterChange={setWatchlistFilter}
            onFriendActivityFilterChange={setWatchlistFriendFilter}
            onSortChange={(sort) => {
              setWatchlistSort(sort);
              loadMyList(sort);
            }}
          />
        );
      case 'READLIST':
        return (
          <MediaList
            title="MY READLIST"
            items={myList.filter((i) => i.type === 'MANGA')}
            onUpdate={handleUpdateMedia}
            onDelete={handleDeleteMedia}
            readonly={false}
            filterStatus={readlistFilter}
            friendActivityFilter={readlistFriendFilter}
            sortBy={readlistSort}
            onFilterChange={setReadlistFilter}
            onFriendActivityFilterChange={setReadlistFriendFilter}
            onSortChange={(sort) => {
              setReadlistSort(sort);
              loadMyList(sort);
            }}
          />
        );
      case 'SEARCH':
        return <SearchMedia onAdd={handleAddMedia} />;
      case 'FRIENDS':
        return (
          <FriendList
            friends={friends}
            onViewFriend={handleViewFriend}
            onSearchUsers={handleSearchUsers}
            onFollowUser={handleFollowUser}
            onUnfollowUser={handleUnfollowUser}
            isLoading={friendsLoading}
          />
        );
      case 'FRIEND_VIEW':
        if (!selectedFriend) return null;
        return (
          <div className="space-y-8">
            <div className="border-b border-white pb-4 mb-4">
              <button
                onClick={() => setCurrentView('FRIENDS')}
                className="text-gray-500 hover:text-white mb-2 text-sm uppercase tracking-wider"
              >
                &larr; Back to Friends
              </button>
              <h2 className="text-2xl font-bold uppercase tracking-tighter">
                {selectedFriend.username}'s LISTS
              </h2>
            </div>
            <MediaList
              title="WATCHLIST"
              items={selectedFriend.list.filter((i) => i.type !== 'MANGA')}
              onAddToMyList={handleAddFromFriendList}
              readonly={true}
            />
            <MediaList
              title="READLIST"
              items={selectedFriend.list.filter((i) => i.type === 'MANGA')}
              onAddToMyList={handleAddFromFriendList}
              readonly={true}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Layout
      currentView={currentView}
      onViewChange={setCurrentView}
      user={user}
      onLogout={handleLogout}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
