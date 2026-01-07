import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { PublicProfile as PublicProfileType, PublicProfileMediaItem, MediaStatus } from '../types';
import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const STATUS_ORDER: MediaStatus[] = ['WATCHING', 'READING', 'PAUSED', 'PLAN_TO_WATCH', 'COMPLETED', 'DROPPED'];

const STATUS_CONFIG: Record<string, { label: string; color: string; borderColor: string }> = {
  WATCHING: { label: 'WATCHING', color: 'text-green-400', borderColor: 'border-l-green-500' },
  READING: { label: 'READING', color: 'text-green-400', borderColor: 'border-l-green-500' },
  PAUSED: { label: 'PAUSED', color: 'text-yellow-500', borderColor: 'border-l-yellow-500' },
  PLAN_TO_WATCH: { label: 'PLANNED', color: 'text-blue-400', borderColor: 'border-l-blue-500' },
  COMPLETED: { label: 'COMPLETED', color: 'text-neutral-500', borderColor: 'border-l-neutral-600' },
  DROPPED: { label: 'DROPPED', color: 'text-red-400', borderColor: 'border-l-red-500' },
};

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w200';
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'https://watchlist.hoodgail.me';

function getImageUrl(imageUrl: string | null): string | undefined {
  if (!imageUrl) return undefined;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${TMDB_IMAGE_BASE}${imageUrl}`;
}

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null || rating === undefined) return null;
  
  return (
    <div className="flex items-center gap-1">
      <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <span className="text-xs text-neutral-400">{rating}/10</span>
    </div>
  );
}

function MediaCard({ item }: { item: PublicProfileMediaItem }) {
  const imageUrl = getImageUrl(item.imageUrl);
  const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.WATCHING;
  const progressPercentage = item.total ? Math.min(100, (item.current / item.total) * 100) : 0;
  
  return (
    <div className={`group relative bg-black border border-neutral-800 hover:border-neutral-600 transition-colors ${config.borderColor} border-l-2 overflow-hidden`}>
      {/* Progress bar at bottom */}
      {item.total && (
        <div className="absolute bottom-0 left-0 h-1 bg-neutral-900 w-full">
          <div
            className={`h-full transition-all duration-500 ${progressPercentage === 100 ? 'bg-green-500' : 'bg-white'}`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      )}
      
      <div className="flex p-3 pb-4">
        {imageUrl && (
          <div className="w-12 h-18 flex-shrink-0 mr-3">
            <img
              src={imageUrl}
              alt={item.title}
              className="w-full h-full object-cover border border-neutral-800"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm uppercase tracking-tight truncate text-white">{item.title}</h4>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="bg-neutral-900 text-neutral-400 px-1.5 py-0.5 text-xs uppercase border border-neutral-800">
              {item.type}
            </span>
            {item.total ? (
              <span className="text-xs text-neutral-500 font-mono">
                {item.current}/{item.total}
              </span>
            ) : (
              <span className="text-xs text-neutral-600 font-mono">
                {item.current}
              </span>
            )}
            <StarRating rating={item.rating} />
          </div>
          {item.notes && (
            <p className="text-xs text-neutral-600 mt-2 line-clamp-2 italic">[{item.notes}]</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProfileHeaderProps {
  profile: PublicProfileType;
  onFollow: () => void;
  onUnfollow: () => void;
  isFollowLoading: boolean;
}

function ProfileHeader({ profile, onFollow, onUnfollow, isFollowLoading }: ProfileHeaderProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const initials = (profile.displayName || profile.username).slice(0, 2).toUpperCase();
  
  return (
    <div className="border-b border-neutral-900 pb-6 mb-6">
      <div className="flex items-start gap-4 p-4 border border-neutral-800 bg-neutral-950">
        {/* Avatar */}
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={profile.username}
            className="w-16 h-16 sm:w-20 sm:h-20 object-cover border border-neutral-700"
          />
        ) : (
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-neutral-900 border border-neutral-700 flex items-center justify-center">
            <span className="text-xl sm:text-2xl font-bold text-neutral-400">{initials}</span>
          </div>
        )}
        
        {/* Profile Info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tighter text-white truncate">
            {profile.displayName || profile.username}
          </h1>
          <p className="text-neutral-500 text-sm">@{profile.username}</p>
          
          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs uppercase">
            <span className="px-2 py-1 border border-neutral-800 text-neutral-400">
              <span className="font-bold text-white">{profile.followerCount}</span> FOLLOWERS
            </span>
            <span className="px-2 py-1 border border-neutral-800 text-neutral-400">
              <span className="font-bold text-white">{profile.followingCount}</span> FOLLOWING
            </span>
            {profile.list && (
              <span className="px-2 py-1 border border-neutral-800 text-neutral-400">
                <span className="font-bold text-white">{profile.list.length}</span> ITEMS
              </span>
            )}
          </div>
        </div>
        
        {/* Actions */}
        {user && !profile.isOwnProfile && (
          <div className="flex-shrink-0">
            {profile.isFollowing ? (
              <button
                onClick={onUnfollow}
                disabled={isFollowLoading}
                className="px-4 py-2 text-xs uppercase tracking-wider border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors disabled:opacity-50"
              >
                {isFollowLoading ? '...' : 'UNFOLLOW'}
              </button>
            ) : (
              <button
                onClick={onFollow}
                disabled={isFollowLoading}
                className="px-4 py-2 text-xs uppercase tracking-wider bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-50"
              >
                {isFollowLoading ? '...' : 'FOLLOW'}
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Share link */}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            showToast('Profile link copied!', 'success');
          }}
          className="text-xs border border-neutral-800 px-3 py-1.5 text-neutral-500 hover:border-neutral-600 hover:text-white uppercase tracking-wider transition-colors"
        >
          Copy Profile Link
        </button>
      </div>
    </div>
  );
}

function PrivateProfileMessage({ profile }: { profile: PublicProfileType }) {
  const { user } = useAuth();
  const initials = (profile.displayName || profile.username).slice(0, 2).toUpperCase();
  
  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      {/* Avatar */}
      {profile.avatarUrl ? (
        <img
          src={profile.avatarUrl}
          alt={profile.username}
          className="w-20 h-20 object-cover border border-neutral-700 mx-auto"
        />
      ) : (
        <div className="w-20 h-20 bg-neutral-900 border border-neutral-700 flex items-center justify-center mx-auto">
          <span className="text-2xl font-bold text-neutral-400">{initials}</span>
        </div>
      )}
      
      <h1 className="text-2xl font-bold uppercase tracking-tighter text-white mt-4">
        {profile.displayName || profile.username}
      </h1>
      <p className="text-neutral-500 text-sm">@{profile.username}</p>
      
      <div className="mt-6 p-6 bg-black border border-neutral-800">
        <svg className="w-12 h-12 mx-auto text-neutral-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h2 className="text-lg font-bold uppercase text-white mb-2">Private Profile</h2>
        <p className="text-neutral-500 text-sm">
          {user 
            ? "Follow this user to see their watchlist."
            : "Sign in and follow this user to see their watchlist."}
        </p>
        
        {!user && (
          <Link
            to="/"
            className="inline-block mt-4 px-6 py-2 text-xs uppercase tracking-wider bg-white text-black hover:bg-neutral-200 transition-colors"
          >
            Sign In
          </Link>
        )}
      </div>
    </div>
  );
}

function MediaListSection({ title, items }: { title: string; items: PublicProfileMediaItem[] }) {
  if (items.length === 0) return null;
  
  // Group by status
  const groupedItems = STATUS_ORDER.reduce((acc, status) => {
    const statusItems = items.filter(item => item.status === status);
    if (statusItems.length > 0) {
      acc.push({ status, items: statusItems });
    }
    return acc;
  }, [] as { status: string; items: PublicProfileMediaItem[] }[]);
  
  return (
    <div className="mb-8">
      <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4 border-b border-neutral-900 pb-2">
        {title}
      </h2>
      
      {groupedItems.map(({ status, items: statusItems }) => {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.WATCHING;
        return (
          <div key={status} className="mb-6">
            <div className={`flex items-center gap-2 mb-3 px-3 py-2 bg-neutral-950 border border-neutral-800 ${config.borderColor} border-l-2`}>
              <span className={`text-xs font-bold uppercase tracking-wider ${config.color}`}>
                {config.label}
              </span>
              <span className="text-neutral-600 text-xs">({statusItems.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pl-0 sm:pl-2">
              {statusItems.map(item => (
                <MediaCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PublicProfile() {
  const { username } = useParams<{ username: string }>();
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  
  const [profile, setProfile] = useState<PublicProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  
  useEffect(() => {
    if (!username) return;
    
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await api.getPublicProfile(username);
        setProfile(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [username]);
  
  const handleFollow = async () => {
    if (!profile) return;
    setIsFollowLoading(true);
    
    try {
      await api.followUser(profile.id);
      setProfile(prev => prev ? { ...prev, isFollowing: true, followerCount: prev.followerCount + 1 } : null);
      showToast('User followed successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to follow user', 'error');
    } finally {
      setIsFollowLoading(false);
    }
  };
  
  const handleUnfollow = async () => {
    if (!profile) return;
    setIsFollowLoading(true);
    
    try {
      await api.unfollowUser(profile.id);
      setProfile(prev => prev ? { ...prev, isFollowing: false, followerCount: prev.followerCount - 1 } : null);
      showToast('User unfollowed', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to unfollow user', 'error');
    } finally {
      setIsFollowLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-neutral-500 uppercase tracking-wider text-sm animate-pulse">
            Loading profile...
          </div>
        </div>
      </div>
    );
  }
  
  if (error || !profile) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Helmet>
          <title>User Not Found - Watchlist</title>
        </Helmet>
        <div className="text-center py-12 border border-neutral-800 border-dashed">
          <h1 className="text-xl font-bold uppercase text-white mb-2">User Not Found</h1>
          <p className="text-neutral-500 text-sm">{error || 'This user does not exist.'}</p>
          <Link
            to="/"
            className="inline-block mt-4 px-4 py-2 text-xs uppercase tracking-wider border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }
  
  // SEO meta tags
  const pageTitle = `${profile.displayName || profile.username}'s Watchlist`;
  const pageDescription = profile.list 
    ? `Check out what ${profile.username} is watching. ${profile.list.length} items in their watchlist.`
    : `${profile.username}'s watchlist on Watchlist`;
  
  // Check if profile is private and user can't view it
  if (!profile.list) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Helmet>
          <title>{pageTitle}</title>
          <meta name="description" content={`${profile.username}'s profile is private.`} />
          <meta property="og:title" content={pageTitle} />
          <meta property="og:description" content={`${profile.username}'s profile is private.`} />
          <meta property="og:type" content="profile" />
          <meta property="og:url" content={`${FRONTEND_URL}/u/${profile.username}`} />
          {profile.avatarUrl && <meta property="og:image" content={profile.avatarUrl} />}
          <meta name="twitter:card" content="summary" />
        </Helmet>
        <PrivateProfileMessage profile={profile} />
      </div>
    );
  }
  
  // Split list into watchlist and readlist
  const watchlist = profile.list.filter(item => item.type !== 'MANGA');
  const readlist = profile.list.filter(item => item.type === 'MANGA');
  
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={`${FRONTEND_URL}/u/${profile.username}`} />
        {profile.avatarUrl && <meta property="og:image" content={profile.avatarUrl} />}
        <meta name="twitter:card" content="summary" />
      </Helmet>
      
      <ProfileHeader
        profile={profile}
        onFollow={handleFollow}
        onUnfollow={handleUnfollow}
        isFollowLoading={isFollowLoading}
      />
      
      {watchlist.length > 0 && (
        <MediaListSection title="Watchlist" items={watchlist} />
      )}
      
      {readlist.length > 0 && (
        <MediaListSection title="Readlist" items={readlist} />
      )}
      
      {profile.list.length === 0 && (
        <div className="text-center py-12 border border-neutral-800 border-dashed">
          <p className="text-neutral-600 text-sm uppercase">This user hasn't added anything to their list yet.</p>
        </div>
      )}
    </div>
  );
}
