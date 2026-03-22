import React, { useState } from 'react';
import { User } from '@/types';
import { UserAvatar } from '@/shared/ui';
import { FriendActivityFeed } from '@/features/social/components/FriendActivityFeed';

export const FriendAvatar: React.FC<{
  user: User | { username: string; displayName?: string | null; avatarUrl?: string | null };
  size?: 'sm' | 'md' | 'lg';
}> = ({ user, size = 'md' }) => (
  <UserAvatar
    username={user.username}
    displayName={'displayName' in user ? user.displayName : undefined}
    avatarUrl={user.avatarUrl}
    size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'}
    sizeClassName={size === 'md' ? 'w-10 h-10 text-sm' : size === 'lg' ? 'w-12 h-12 text-lg' : 'w-6 h-6 text-xs'}
    fallbackClassName="bg-neutral-800 text-white border border-neutral-700"
  />
);

interface FriendListProps {
  friends: User[];
  onViewFriend: (friend: User) => void;
  onSearchUsers: (query: string) => Promise<User[]>;
  onFollowUser: (userId: string) => Promise<void>;
  onUnfollowUser: (userId: string) => Promise<void>;
  onViewMedia?: (refId: string, mediaType: string, title?: string) => void;
  isLoading?: boolean;
}

export const FriendList: React.FC<FriendListProps> = ({
  friends,
  onViewFriend,
  onSearchUsers,
  onFollowUser,
  onUnfollowUser,
  onViewMedia,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'following' | 'activity'>('following');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [followingId, setFollowingId] = useState<string | null>(null);

  const handleViewProfile = (username: string) => {
    // Find the friend by username and call onViewFriend
    const friend = friends.find(f => f.username === username);
    if (friend) {
      onViewFriend(friend);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const results = await onSearchUsers(searchQuery);
      // Filter out users you're already following
      const filteredResults = results.filter(
        (user) => !friends.some((f) => f.id === user.id)
      );
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleFollow = async (userId: string) => {
    setFollowingId(userId);
    try {
      await onFollowUser(userId);
      // Remove from search results after following
      setSearchResults((prev) => prev.filter((u) => u.id !== userId));
    } catch (error) {
      console.error('Follow failed:', error);
    } finally {
      setFollowingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center text-neutral-500 uppercase tracking-wider">
        Loading friends...
      </div>
    );
  }

  return (
    <div className="screen-stack">
      <div className="screen-head-block">
        <span className="screen-kicker">Social circle</span>
        <h2 className="screen-title">Friends</h2>
        <p className="screen-note">Follow people with good taste, scan their recent activity, and borrow the next obsession.</p>
      </div>

      {/* Tab Navigation */}
      <div className="chip-tabs">
        <button
          className={`chip-tab ${
            activeTab === 'following'
              ? 'active'
              : ''
          }`}
          onClick={() => setActiveTab('following')}
        >
          Following
        </button>
        <button
          className={`chip-tab ${
            activeTab === 'activity'
              ? 'active'
              : ''
          }`}
          onClick={() => setActiveTab('activity')}
        >
          Activity
        </button>
      </div>

      {activeTab === 'following' ? (
        <>
          <div className="section-label-row">
            <h2>Following</h2>
          </div>

          {friends.length === 0 ? (
            <div className="empty-state">
              <p className="text-sm uppercase">No friends yet</p>
              <p className="text-xs mt-2">Search for users below</p>
            </div>
          ) : (
            <div className="editorial-grid">
              {friends.map((friend) => {
                const totalItems = friend.list.length;
                const watching = friend.list.filter(
                  (i) => i.status === 'WATCHING' || i.status === 'READING'
                ).length;

                return (
                  <div
                    key={friend.id}
                    className="list-card pad w-full group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <button
                        onClick={() => onViewFriend(friend)}
                          className="text-left flex-grow flex items-center gap-3"
                        >
                          <FriendAvatar user={friend} size="md" />
                          <div>
                            <div className="screen-kicker">Friend profile</div>
                            <h3 className="text-2xl font-bold text-white uppercase tracking-tighter group-hover:underline decoration-1 underline-offset-4">
                          {friend.username}
                            </h3>
                          </div>
                        </button>
                      <button
                        onClick={() => onUnfollowUser(friend.id)}
                        className="action-btn-danger !min-h-0 px-3 py-2"
                      >
                        UNFOLLOW
                      </button>
                    </div>

                    <div className="stats-grid text-xs font-mono uppercase text-neutral-500">
                      <div className="stats-card">
                        <strong>{totalItems}</strong>
                        <span>List Size</span>
                      </div>
                      <div className="stats-card">
                        <strong>{watching}</strong>
                        <span>Active</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Search Users */}
          <div className="screen-panel pad soft">
            <p className="text-neutral-600 text-xs uppercase mb-4 text-center tracking-[0.2em]">
              Find users to follow
            </p>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="USERNAME"
                className="inline-field w-full text-xs uppercase"
              />
              <button
                type="submit"
                disabled={searching}
                className="action-btn-ghost px-4 text-xs disabled:opacity-50"
              >
                {searching ? '...' : 'FIND'}
              </button>
            </form>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="list-card pad flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <FriendAvatar user={user} size="sm" />
                      <span className="text-sm uppercase text-white font-bold">
                        {user.username}
                      </span>
                    </div>
                      <button
                        onClick={() => handleFollow(user.id)}
                        disabled={followingId === user.id}
                        className="action-btn-ghost px-3 py-2 disabled:opacity-50"
                      >
                        {followingId === user.id ? '...' : '+ FOLLOW'}
                      </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <FriendActivityFeed
          onViewMedia={onViewMedia}
          onViewProfile={handleViewProfile}
        />
      )}
    </div>
  );
};
