import React, { useState } from 'react';
import { User } from '../types';
import { FriendActivityFeed } from './FriendActivityFeed';

// Friend Avatar component with fallback to initials
export const FriendAvatar: React.FC<{ 
  user: User | { username: string; avatarUrl?: string | null }; 
  size?: 'sm' | 'md' | 'lg';
}> = ({ user, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-lg',
  };

  const initials = user.username
    .split(/[_\s]/)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const baseClasses = `${sizeClasses[size]} rounded-full flex items-center justify-center font-bold uppercase flex-shrink-0`;

  if (user.avatarUrl) {
    return (
      <div className={`${baseClasses} overflow-hidden`}>
        <img 
          src={user.avatarUrl} 
          alt={user.username}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to initials on image load error
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement!.innerHTML = `<span class="w-full h-full bg-neutral-800 text-white border border-neutral-700 rounded-full flex items-center justify-center">${initials}</span>`;
          }}
        />
      </div>
    );
  }

  return (
    <div className={`${baseClasses} bg-neutral-800 text-white border border-neutral-700`}>
      {initials}
    </div>
  );
};

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
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-4">
        <button
          className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'following'
              ? 'bg-yellow-500 text-black'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
          }`}
          onClick={() => setActiveTab('following')}
        >
          Following
        </button>
        <button
          className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'activity'
              ? 'bg-yellow-500 text-black'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
          }`}
          onClick={() => setActiveTab('activity')}
        >
          Activity
        </button>
      </div>

      {activeTab === 'following' ? (
        <>
          <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-900 pb-2">
            FOLLOWING
          </h2>

          {friends.length === 0 ? (
            <div className="py-8 text-center text-neutral-600 border border-neutral-800 border-dashed">
              <p className="text-sm uppercase">No friends yet</p>
              <p className="text-xs mt-2">Search for users below</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {friends.map((friend) => {
                const totalItems = friend.list.length;
                const watching = friend.list.filter(
                  (i) => i.status === 'WATCHING' || i.status === 'READING'
                ).length;

                return (
                  <div
                    key={friend.id}
                    className="w-full p-6 border border-neutral-800 bg-black hover:bg-neutral-900 hover:border-neutral-600 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <button
                        onClick={() => onViewFriend(friend)}
                        className="text-left flex-grow flex items-center gap-3"
                      >
                        <FriendAvatar user={friend} size="md" />
                        <h3 className="text-2xl font-bold text-white uppercase tracking-tighter group-hover:underline decoration-1 underline-offset-4">
                          {friend.username}
                        </h3>
                      </button>
                      <button
                        onClick={() => onUnfollowUser(friend.id)}
                        className="text-xs border border-neutral-800 px-2 py-1 text-neutral-500 hover:border-red-900 hover:text-red-500 transition-colors"
                      >
                        UNFOLLOW
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs font-mono uppercase text-neutral-500">
                      <div className="border-l border-neutral-800 pl-3">
                        <div className="text-neutral-700 mb-1">List Size</div>
                        <div className="text-white text-lg">{totalItems}</div>
                      </div>
                      <div className="border-l border-neutral-800 pl-3">
                        <div className="text-neutral-700 mb-1">Active</div>
                        <div className="text-white text-lg">{watching}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Search Users */}
          <div className="mt-8 p-4 border border-dashed border-neutral-800">
            <p className="text-neutral-600 text-xs uppercase mb-4 text-center">
              Find users to follow
            </p>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="USERNAME"
                className="w-full bg-neutral-900 border border-neutral-800 p-2 text-xs uppercase text-white placeholder-neutral-700 focus:border-white outline-none"
              />
              <button
                type="submit"
                disabled={searching}
                className="bg-neutral-800 text-neutral-300 px-4 text-xs font-bold uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-50"
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
                    className="flex items-center justify-between p-3 bg-neutral-900 border border-neutral-800"
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
                      className="text-xs border border-neutral-700 text-neutral-400 px-3 py-1 hover:bg-white hover:text-black hover:border-white transition-colors disabled:opacity-50"
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
