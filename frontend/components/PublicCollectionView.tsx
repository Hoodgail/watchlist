import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  CollectionWithDetails,
  CollectionItem,
  CollectionRole,
} from '../types';
import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'https://watchlist.hoodgail.me';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w200';

function getImageUrl(imageUrl: string | null): string | undefined {
  if (!imageUrl) return undefined;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${TMDB_IMAGE_BASE}${imageUrl}`;
}

// Format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'JUST NOW';
  if (diffMins < 60) return `${diffMins}M AGO`;
  if (diffHours < 24) return `${diffHours}H AGO`;
  if (diffDays < 7) return `${diffDays}D AGO`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
};

// User avatar component
const UserAvatar: React.FC<{ user: { username: string; displayName: string | null; avatarUrl: string | null }; size?: 'sm' | 'md' | 'lg' }> = ({ user, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-5 h-5 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-12 h-12 text-base',
  };

  const initials = (user.displayName || user.username)
    .split(/[\s_]/)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.username}
        className={`${sizeClasses[size]} rounded-full object-cover flex-shrink-0`}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 flex items-center justify-center flex-shrink-0 font-bold`}>
      {initials}
    </div>
  );
};

// Role badge component
const RoleBadge: React.FC<{ role: CollectionRole }> = ({ role }) => {
  const colors = {
    OWNER: 'bg-amber-950 border-amber-800 text-amber-400',
    EDITOR: 'bg-blue-950 border-blue-800 text-blue-400',
    VIEWER: 'bg-neutral-900 border-neutral-700 text-neutral-400',
  };

  return (
    <span className={`px-2 py-0.5 text-xs uppercase border ${colors[role]}`}>
      {role}
    </span>
  );
};

// Star icons
const StarFilledIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const StarOutlineIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

// Collection item card
function CollectionItemCard({ item }: { item: CollectionItem }) {
  const imageUrl = getImageUrl(item.imageUrl || item.source?.imageUrl || null);
  const title = item.title || item.source?.title || 'Unknown';

  return (
    <div className="group relative bg-black border border-neutral-800 hover:border-neutral-600 transition-colors overflow-hidden">
      <div className="flex p-3">
        {imageUrl && (
          <div className="w-12 h-18 flex-shrink-0 mr-3">
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover border border-neutral-800"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm uppercase tracking-tight truncate text-white">{title}</h4>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="bg-neutral-900 text-neutral-400 px-1.5 py-0.5 text-xs uppercase border border-neutral-800">
              {item.type}
            </span>
            {item.year && (
              <span className="text-xs text-neutral-500">{item.year}</span>
            )}
          </div>
          {item.note && (
            <p className="text-xs text-neutral-600 mt-2 line-clamp-2 italic">[{item.note}]</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Private collection message
function PrivateCollectionMessage() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <div className="w-20 h-20 bg-neutral-900 border border-neutral-700 flex items-center justify-center mx-auto">
        <svg className="w-10 h-10 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold uppercase tracking-tighter text-white mt-4">
        Private Collection
      </h1>

      <div className="mt-6 p-6 bg-black border border-neutral-800">
        <p className="text-neutral-500 text-sm">
          {user
            ? "This collection is private."
            : "Sign in to view this collection if you're a member."}
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

export function PublicCollectionView() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [collection, setCollection] = useState<CollectionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [starLoading, setStarLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'items' | 'members'>('items');

  useEffect(() => {
    if (!collectionId) return;

    const fetchCollection = async () => {
      setLoading(true);
      setError(null);
      setIsPrivate(false);

      try {
        const data = await api.getPublicCollection(collectionId);
        setCollection(data);
      } catch (err: any) {
        const message = err.message || 'Failed to load collection';
        if (message.includes('private') || message.includes('permission') || message.includes('access')) {
          setIsPrivate(true);
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCollection();
  }, [collectionId]);

  const handleStar = async () => {
    if (!collection || !user) {
      showToast('Sign in to star collections', 'info');
      return;
    }

    setStarLoading(true);
    try {
      if (collection.isStarred) {
        await api.unstarCollection(collection.id);
        setCollection({ ...collection, isStarred: false, starCount: collection.starCount - 1 });
        showToast('Collection unstarred', 'info');
      } else {
        await api.starCollection(collection.id);
        setCollection({ ...collection, isStarred: true, starCount: collection.starCount + 1 });
        showToast('Collection starred', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update star', 'error');
    } finally {
      setStarLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-neutral-500 uppercase tracking-wider text-sm animate-pulse">
            Loading collection...
          </div>
        </div>
      </div>
    );
  }

  if (isPrivate) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Helmet>
          <title>Private Collection - Watchlist</title>
        </Helmet>
        <PrivateCollectionMessage />
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Helmet>
          <title>Collection Not Found - Watchlist</title>
        </Helmet>
        <div className="text-center py-12 border border-neutral-800 border-dashed">
          <h1 className="text-xl font-bold uppercase text-white mb-2">Collection Not Found</h1>
          <p className="text-neutral-500 text-sm">{error || 'This collection does not exist.'}</p>
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
  const pageTitle = `${collection.title} - Collection`;
  const pageDescription = collection.description
    ? `${collection.description.slice(0, 150)}${collection.description.length > 150 ? '...' : ''}`
    : `A collection by ${collection.owner.displayName || collection.owner.username} with ${collection.itemCount} items.`;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${FRONTEND_URL}/c/${collection.id}`} />
        {collection.coverUrl && <meta property="og:image" content={collection.coverUrl} />}
        <meta name="twitter:card" content={collection.coverUrl ? "summary_large_image" : "summary"} />
      </Helmet>

      {/* Header Section */}
      <div className="border border-neutral-800 bg-black mb-6">
        {/* Cover Image */}
        {collection.coverUrl ? (
          <div className="w-full h-48 overflow-hidden">
            <img
              src={collection.coverUrl}
              alt={collection.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-full h-32 bg-neutral-900 flex items-center justify-center">
            <span className="text-neutral-700 text-4xl font-bold uppercase">
              {collection.title.charAt(0)}
            </span>
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* Title and Badges */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold uppercase tracking-tight text-white">
                {collection.title}
              </h1>
              {collection.description && (
                <p className="mt-1 text-sm text-neutral-400">
                  {collection.description}
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <span className="px-2 py-0.5 text-xs uppercase bg-green-950 border border-green-900 text-green-400">
                PUBLIC
              </span>
            </div>
          </div>

          {/* Owner Info */}
          <div className="flex items-center gap-2 text-sm">
            <UserAvatar user={collection.owner} size="sm" />
            <span className="text-neutral-400">by</span>
            <Link
              to={`/u/${collection.owner.username}`}
              className="text-white font-bold hover:underline"
            >
              {collection.owner.displayName || collection.owner.username}
            </Link>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-4 text-xs uppercase">
            <div className="flex items-center gap-1">
              <span className="text-neutral-500">ITEMS:</span>
              <span className="text-white font-bold">{collection.itemCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <StarFilledIcon className="w-3 h-3 text-amber-500" />
              <span className="text-white font-bold">{collection.starCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-neutral-500">MEMBERS:</span>
              <span className="text-white font-bold">{collection.members.length + 1}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* Star/Unstar Button */}
        <button
          onClick={handleStar}
          disabled={starLoading}
          className={`flex items-center gap-2 text-xs px-4 py-2 font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${collection.isStarred
            ? 'bg-amber-950 border border-amber-800 text-amber-400 hover:bg-amber-900'
            : 'border border-neutral-700 text-neutral-400 hover:border-amber-700 hover:text-amber-400'
            }`}
        >
          {collection.isStarred ? (
            <>
              <StarFilledIcon className="w-4 h-4" />
              {starLoading ? '...' : 'STARRED'}
            </>
          ) : (
            <>
              <StarOutlineIcon className="w-4 h-4" />
              {starLoading ? '...' : 'STAR'}
            </>
          )}
        </button>

        {/* Copy Link Button */}
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            showToast('Collection link copied!', 'success');
          }}
          className="text-xs px-4 py-2 border border-neutral-700 text-neutral-400 font-bold uppercase tracking-wider hover:border-neutral-500 hover:text-white transition-colors"
        >
          COPY LINK
        </button>

        {/* Sign in prompt for non-authenticated users */}
        {!user && (
          <Link
            to="/"
            className="text-xs px-4 py-2 bg-white text-black font-bold uppercase tracking-wider hover:bg-neutral-200 transition-colors"
          >
            SIGN IN
          </Link>
        )}
      </div>

      {/* Tab Sections */}
      <div className="flex border border-neutral-800 mb-6">
        <button
          onClick={() => setActiveSection('items')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeSection === 'items'
            ? 'bg-white text-black'
            : 'text-neutral-500 hover:bg-neutral-900'
            }`}
        >
          ITEMS ({collection.items.length})
        </button>
        <button
          onClick={() => setActiveSection('members')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-l border-neutral-800 ${activeSection === 'members'
            ? 'bg-white text-black'
            : 'text-neutral-500 hover:bg-neutral-900'
            }`}
        >
          MEMBERS ({collection.members.length + 1})
        </button>
      </div>

      {/* Tab Content */}
      {activeSection === 'items' && (
        <div>
          {collection.items.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {collection.items.map(item => (
                <CollectionItemCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-neutral-600 border border-neutral-800 border-dashed">
              <p className="text-sm uppercase">NO ITEMS IN THIS COLLECTION</p>
            </div>
          )}
        </div>
      )}

      {activeSection === 'members' && (
        <div className="space-y-3">
          {/* Owner */}
          <div className="border border-neutral-800 bg-black p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserAvatar user={collection.owner} size="md" />
                <div>
                  <Link
                    to={`/u/${collection.owner.username}`}
                    className="text-sm font-bold text-white hover:underline"
                  >
                    {collection.owner.displayName || collection.owner.username}
                  </Link>
                  <div className="text-xs text-neutral-500">@{collection.owner.username}</div>
                </div>
              </div>
              <RoleBadge role="OWNER" />
            </div>
          </div>

          {/* Members */}
          {collection.members.map((member) => (
            <div key={member.id} className="border border-neutral-800 bg-black p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserAvatar user={member.user} size="md" />
                  <div>
                    <Link
                      to={`/u/${member.user.username}`}
                      className="text-sm font-bold text-white hover:underline"
                    >
                      {member.user.displayName || member.user.username}
                    </Link>
                    <div className="text-xs text-neutral-500">
                      @{member.user.username} · {formatRelativeTime(member.createdAt)}
                    </div>
                  </div>
                </div>
                <RoleBadge role={member.role} />
              </div>
            </div>
          ))}

          {collection.members.length === 0 && (
            <div className="py-8 text-center text-neutral-600 border border-neutral-800 border-dashed">
              <p className="text-sm uppercase">NO OTHER MEMBERS</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PublicCollectionView;
