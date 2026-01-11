import React, { useState, useEffect } from 'react';
import {
  Collection,
  CollectionWithDetails,
  CollectionMember,
  CollectionRole,
} from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';
import CollectionItemList from './CollectionItemList';
import CollectionComments from './CollectionComments';
import { CollectionAddItemModal } from './CollectionAddItemModal';
import { CollectionInviteModal } from './CollectionInviteModal';
import { CollectionMemberModal } from './CollectionMemberModal';

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

// Arrow left icon
const ArrowLeftIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

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

interface CollectionViewProps {
  collectionId: string;
  onBack: () => void;
  onEdit: (collection: Collection) => void;
  onAddItem?: () => void; // Optional - if not provided, internal modal is used
}

export const CollectionView: React.FC<CollectionViewProps> = ({
  collectionId,
  onBack,
  onEdit,
  onAddItem,
}) => {
  const { showToast } = useToast();
  const [collection, setCollection] = useState<CollectionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'items' | 'members' | 'comments'>('items');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  useEffect(() => {
    loadCollection();
  }, [collectionId]);

  const loadCollection = async () => {
    setLoading(true);
    try {
      const data = await api.getCollection(collectionId);
      setCollection(data);
    } catch (error: any) {
      console.error('Failed to load collection:', error);
      showToast(error.message || 'Failed to load collection', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStar = async () => {
    if (!collection) return;
    setActionLoading('star');
    try {
      if (collection.isStarred) {
        await api.unstarCollection(collectionId);
        setCollection({ ...collection, isStarred: false, starCount: collection.starCount - 1 });
        showToast('Collection unstarred', 'info');
      } else {
        await api.starCollection(collectionId);
        setCollection({ ...collection, isStarred: true, starCount: collection.starCount + 1 });
        showToast('Collection starred', 'success');
      }
    } catch (error: any) {
      console.error('Failed to toggle star:', error);
      showToast(error.message || 'Failed to update star', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!collection) return;
    setActionLoading('delete');
    try {
      await api.deleteCollection(collectionId);
      showToast('Collection deleted', 'success');
      onBack();
    } catch (error: any) {
      console.error('Failed to delete collection:', error);
      showToast(error.message || 'Failed to delete collection', 'error');
    } finally {
      setActionLoading(null);
      setDeleteConfirm(false);
    }
  };

  const handleLeave = async () => {
    if (!collection) return;
    setActionLoading('leave');
    try {
      await api.leaveCollection(collectionId);
      showToast('Left collection', 'info');
      onBack();
    } catch (error: any) {
      console.error('Failed to leave collection:', error);
      showToast(error.message || 'Failed to leave collection', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!collection) return;
    setActionLoading(`remove-${userId}`);
    try {
      await api.removeCollectionMember(collectionId, userId);
      setCollection({
        ...collection,
        members: collection.members.filter(m => m.user.id !== userId),
      });
      showToast('Member removed', 'success');
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      showToast(error.message || 'Failed to remove member', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const canEdit = collection?.myRole === 'OWNER' || collection?.myRole === 'EDITOR';
  const isOwner = collection?.myRole === 'OWNER';


  if (loading) {
    return (
      <div className="py-12 text-center text-neutral-500 uppercase tracking-wider animate-pulse">
        Loading...
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="py-12 text-center text-neutral-600 border border-neutral-800 border-dashed">
        <p className="text-sm uppercase">COLLECTION NOT FOUND</p>
        <button
          onClick={onBack}
          className="mt-4 text-xs px-4 py-2 border border-neutral-700 text-neutral-400 uppercase tracking-wider hover:border-neutral-500 hover:text-white transition-colors"
        >
          GO BACK
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors text-sm uppercase tracking-wider"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        BACK
      </button>

      {/* Header Section */}
      <div className="border border-neutral-800 bg-black">
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
              <span className={`px-2 py-0.5 text-xs uppercase ${collection.isPublic ? 'bg-green-950 border border-green-900 text-green-400' : 'bg-neutral-900 border border-neutral-800 text-neutral-500'}`}>
                {collection.isPublic ? 'PUBLIC' : 'PRIVATE'}
              </span>
              {collection.myRole && <RoleBadge role={collection.myRole} />}
            </div>
          </div>

          {/* Owner Info */}
          <div className="flex items-center gap-2 text-sm">
            <UserAvatar user={collection.owner} size="sm" />
            <span className="text-neutral-400">by</span>
            <span className="text-white font-bold">
              {collection.owner.displayName || collection.owner.username}
            </span>
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
      <div className="flex flex-wrap gap-2">
        {/* Star/Unstar Button */}
        <button
          onClick={handleStar}
          disabled={actionLoading === 'star'}
          className={`flex items-center gap-2 text-xs px-4 py-2 font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${collection.isStarred
            ? 'bg-amber-950 border border-amber-800 text-amber-400 hover:bg-amber-900'
            : 'border border-neutral-700 text-neutral-400 hover:border-amber-700 hover:text-amber-400'
            }`}
        >
          {collection.isStarred ? (
            <>
              <StarFilledIcon className="w-4 h-4" />
              {actionLoading === 'star' ? '...' : 'UNSTAR'}
            </>
          ) : (
            <>
              <StarOutlineIcon className="w-4 h-4" />
              {actionLoading === 'star' ? '...' : 'STAR'}
            </>
          )}
        </button>

        {/* Edit Button (owner/editor) */}
        {canEdit && (
          <button
            onClick={() => onEdit(collection)}
            className="text-xs px-4 py-2 border border-neutral-700 text-neutral-400 font-bold uppercase tracking-wider hover:border-neutral-500 hover:text-white transition-colors"
          >
            EDIT
          </button>
        )}

        {/* Add Item Button (owner/editor) */}
        {canEdit && (
          <button
            onClick={() => onAddItem ? onAddItem() : setShowAddItemModal(true)}
            className="text-xs px-4 py-2 bg-white text-black font-bold uppercase tracking-wider hover:bg-neutral-200 transition-colors"
          >
            ADD ITEM
          </button>
        )}

        {/* Manage Members Button (owner only) */}
        {isOwner && (
          <button
            onClick={() => setShowMemberModal(true)}
            className="text-xs px-4 py-2 border border-neutral-700 text-neutral-400 font-bold uppercase tracking-wider hover:border-neutral-500 hover:text-white transition-colors"
          >
            MANAGE MEMBERS
          </button>
        )}

        {/* Create Invite Link Button (owner only) */}
        {isOwner && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="text-xs px-4 py-2 border border-neutral-700 text-neutral-400 font-bold uppercase tracking-wider hover:border-neutral-500 hover:text-white transition-colors"
          >
            CREATE INVITE
          </button>
        )}

        {/* Leave Collection Button (members who aren't owner) */}
        {collection.myRole && collection.myRole !== 'OWNER' && (
          <button
            onClick={handleLeave}
            disabled={actionLoading === 'leave'}
            className="text-xs px-4 py-2 border border-neutral-800 text-neutral-500 font-bold uppercase tracking-wider hover:border-red-900 hover:text-red-500 transition-colors disabled:opacity-50"
          >
            {actionLoading === 'leave' ? '...' : 'LEAVE'}
          </button>
        )}

        {/* Delete Collection Button (owner only) */}
        {isOwner && !deleteConfirm && (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="text-xs px-4 py-2 border border-neutral-800 text-neutral-500 font-bold uppercase tracking-wider hover:border-red-900 hover:text-red-500 transition-colors"
          >
            DELETE
          </button>
        )}

        {/* Delete Confirmation */}
        {isOwner && deleteConfirm && (
          <div className="flex items-center gap-2 px-3 py-2 border border-red-900 bg-red-950/50">
            <span className="text-xs text-red-400 uppercase">Are you sure?</span>
            <button
              onClick={handleDelete}
              disabled={actionLoading === 'delete'}
              className="text-xs px-3 py-1 bg-red-900 text-red-100 font-bold uppercase tracking-wider hover:bg-red-800 transition-colors disabled:opacity-50"
            >
              {actionLoading === 'delete' ? '...' : 'YES'}
            </button>
            <button
              onClick={() => setDeleteConfirm(false)}
              className="text-xs px-3 py-1 border border-neutral-700 text-neutral-400 font-bold uppercase tracking-wider hover:border-neutral-500 hover:text-white transition-colors"
            >
              CANCEL
            </button>
          </div>
        )}
      </div>

      {/* Tab Sections */}
      <div className="flex border border-neutral-800">
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
        <button
          onClick={() => setActiveSection('comments')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-l border-neutral-800 ${activeSection === 'comments'
            ? 'bg-white text-black'
            : 'text-neutral-500 hover:bg-neutral-900'
            }`}
        >
          COMMENTS
        </button>
      </div>

      {/* Tab Content */}
      {activeSection === 'items' && (
        <CollectionItemList
          collectionId={collectionId}
          items={collection.items}
          canEdit={canEdit}
          onItemsChange={loadCollection}
          onAddItem={() => onAddItem ? onAddItem() : setShowAddItemModal(true)}
        />
      )}

      {activeSection === 'members' && (
        <div className="space-y-3">
          {/* Owner */}
          <div className="border border-neutral-800 bg-black p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserAvatar user={collection.owner} size="md" />
                <div>
                  <div className="text-sm font-bold text-white">
                    {collection.owner.displayName || collection.owner.username}
                  </div>
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
                    <div className="text-sm font-bold text-white">
                      {member.user.displayName || member.user.username}
                    </div>
                    <div className="text-xs text-neutral-500">
                      @{member.user.username} · {formatRelativeTime(member.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <RoleBadge role={member.role} />
                  {isOwner && (
                    <button
                      onClick={() => handleRemoveMember(member.user.id)}
                      disabled={actionLoading === `remove-${member.user.id}`}
                      className="text-xs px-2 py-1 border border-neutral-800 text-neutral-500 uppercase tracking-wider hover:border-red-900 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === `remove-${member.user.id}` ? '...' : 'REMOVE'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {collection.members.length === 0 && (
            <div className="py-8 text-center text-neutral-600 border border-neutral-800 border-dashed">
              <p className="text-sm uppercase">NO OTHER MEMBERS</p>
              {isOwner && (
                <p className="text-xs mt-2 text-neutral-700">
                  Create an invite link to add members
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {activeSection === 'comments' && (
        <CollectionComments
          collectionId={collectionId}
          canComment={!!collection.myRole}
        />
      )}

      {/* Invite Modal */}
      {showInviteModal && collection && (
        <CollectionInviteModal
          collectionId={collectionId}
          collectionTitle={collection.title}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {/* Member Modal */}
      {showMemberModal && collection && (
        <CollectionMemberModal
          collectionId={collectionId}
          collectionTitle={collection.title}
          owner={collection.owner}
          initialMembers={collection.members}
          onClose={() => setShowMemberModal(false)}
          onMembersChange={loadCollection}
        />
      )}

      {/* Add Item Modal */}
      {showAddItemModal && collection && (
        <CollectionAddItemModal
          collectionId={collectionId}
          collectionTitle={collection.title}
          onClose={() => setShowAddItemModal(false)}
          onSuccess={loadCollection}
        />
      )}
    </div>
  );
};

export default CollectionView;
