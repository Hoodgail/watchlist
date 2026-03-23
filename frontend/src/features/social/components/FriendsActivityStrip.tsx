import React, { useEffect, useState } from 'react';
import { UserAvatar } from '@/shared/ui';
import { getRefIdImageUrl } from '@/shared/media/mediaUrl';
import { getFriendsActivity, type FriendActivityEntry } from '@/features/social/api';

interface FriendsActivityStripProps {
  onFriendClick?: (friendId: string) => void;
}

const STATUS_VERB: Record<string, string> = {
  WATCHING: 'Watching',
  READING: 'Reading',
  PLAYING: 'Playing',
};

export const FriendsActivityStrip: React.FC<FriendsActivityStripProps> = ({ onFriendClick }) => {
  const [entries, setEntries] = useState<FriendActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getFriendsActivity()
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch(() => { })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto hidden-scrollbar py-2 px-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 w-[72px] flex-shrink-0 animate-pulse">
            <div className="w-11 h-11 rounded-full bg-neutral-800" />
            <div className="w-10 h-2 bg-neutral-800 rounded" />
            <div className="w-14 h-2 bg-neutral-900 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) return null;

  return (
    <div  >
      <div
        className="flex gap-3 overflow-x-auto hidden-scrollbar py-2 px-1"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {entries.map((entry) => {
          const item = entry.latestItem;
          const imageUrl = item ? getRefIdImageUrl(item.imageUrl, item.refId) : null;
          const verb = item ? (STATUS_VERB[item.status] || item.status) : null;

          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onFriendClick?.(entry.id)}
              className="flex flex-col items-center gap-1 w-[72px] flex-shrink-0 group"
              style={{ scrollSnapAlign: 'start' }}
            >
              {/* Avatar with activity ring */}
              <div className={`relative ${item ? 'ring-2 ring-yellow-500/60' : 'ring-1 ring-neutral-800'} rounded-full p-[2px]`}>
                <UserAvatar
                  username={entry.username}
                  displayName={entry.displayName}
                  avatarUrl={entry.avatarUrl}
                  size="lg"
                  fallbackClassName="bg-neutral-800 text-white border border-neutral-700"
                />
                {/* Tiny poster badge */}
                {imageUrl && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-7 rounded-sm overflow-hidden border border-neutral-900 shadow-lg">
                    <img
                      src={imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
              </div>

              {/* Username */}
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider truncate w-full text-center group-hover:text-white transition-colors">
                {entry.displayName || entry.username}
              </span>

              {/* Currently watching label */}
              {item ? (
                <span className="text-[9px] text-neutral-600 truncate w-full text-center leading-tight">
                  {verb}
                </span>
              ) : (
                <span className="text-[9px] text-neutral-700 truncate w-full text-center leading-tight">
                  Idle
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
