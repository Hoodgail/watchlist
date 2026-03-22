import React, { useState, useEffect } from 'react';
import {
  deleteCollection,
  getCollection,
  leaveCollection,
  removeCollectionMember,
  starCollection,
  unstarCollection,
} from '@/features/collections/api';
import { UserAvatar } from '@/shared/ui';
import { formatRelativeTime } from '@/shared/utils/time';
import {
  Collection,
  CollectionWithDetails,
  CollectionRole,
} from '@/types';
import { useToast } from '@/context/ToastContext';
import CollectionItemList from '@/features/collections/components/CollectionItemList';
import CollectionComments from '@/features/comments/components/CollectionComments';
import { CollectionAddItemModal } from '@/features/collections/components/CollectionAddItemModal';
import { CollectionInviteModal } from '@/features/collections/components/CollectionInviteModal';
import { CollectionMemberModal } from '@/features/collections/components/CollectionMemberModal';

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

// Link icon
const LinkIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
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
  const [showPrivateLinkWarning, setShowPrivateLinkWarning] = useState(false);

  useEffect(() => {
    loadCollection();
  }, [collectionId]);

  const loadCollection = async () => {
    setLoading(true);
    try {
      const data = await getCollection(collectionId);
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
        await unstarCollection(collectionId);
        setCollection({ ...collection, isStarred: false, starCount: collection.starCount - 1 });
        showToast('Collection unstarred', 'info');
      } else {
        await starCollection(collectionId);
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
      await deleteCollection(collectionId);
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
      await leaveCollection(collectionId);
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
      await removeCollectionMember(collectionId, userId);
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

  const handleCopyLink = async () => {
    if (!collection) return;
    
    // If collection is private and we haven't shown the warning yet, show it first
    if (!collection.isPublic && !showPrivateLinkWarning) {
      setShowPrivateLinkWarning(true);
      return;
    }
    
    const publicUrl = `${window.location.origin}/c/${collectionId}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      showToast('Link copied to clipboard', 'success');
      setShowPrivateLinkWarning(false);
    } catch (error) {
      console.error('Failed to copy link:', error);
      showToast('Failed to copy link', 'error');
    }
  };


  if (loading) {
    return (
      <div className="py-12 text-center text-neutral-500 uppercase tracking-wider animate-pulse">
        Loading...
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="empty-state">
        <p className="text-sm uppercase">COLLECTION NOT FOUND</p>
        <button
          onClick={onBack}
          className="mt-4 action-btn-ghost px-4"
        >
          GO BACK
        </button>
      </div>
    );
  }

  return (
    <div className="screen-stack">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors text-sm uppercase tracking-wider"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        BACK
      </button>

      {/* Header Section */}
      <div className="screen-panel overflow-hidden">
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
              <h1 className="screen-title text-xl">
                {collection.title}
              </h1>
              {collection.description && (
                <p className="mt-1 text-sm text-neutral-400">
                  {collection.description}
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <span className={`px-2 py-0.5 text-xs uppercase rounded-xl ${collection.isPublic ? 'bg-green-950 border border-green-900 text-green-400' : 'bg-neutral-900 border border-neutral-800 text-neutral-500'}`}>
                {collection.isPublic ? 'PUBLIC' : 'PRIVATE'}
              </span>
              {collection.myRole && <RoleBadge role={collection.myRole} />}
            </div>
          </div>

          {/* Owner Info */}
          <div className="flex items-center gap-2 text-sm">
            <UserAvatar username={collection.owner.username} displayName={collection.owner.displayName} avatarUrl={collection.owner.avatarUrl} sizeClassName="w-5 h-5 text-[10px]" fallbackClassName="bg-neutral-800 text-neutral-400 border border-neutral-700" />
            <span className="text-neutral-400">by</span>
            <span className="text-white font-bold">
              {collection.owner.displayName || collection.owner.username}
            </span>
          </div>

          {/* Stats */}
          <div className="stats-grid text-xs uppercase">
            <div className="stats-card"><strong>{collection.itemCount}</strong><span>Items</span></div>
            <div className="stats-card"><strong>{collection.starCount}</strong><span>Stars</span></div>
            <div className="stats-card"><strong>{collection.members.length + 1}</strong><span>Members</span></div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="split-actions">
        {/* Star/Unstar Button */}
        <button
          onClick={handleStar}
          disabled={actionLoading === 'star'}
          className={`flex items-center gap-2 text-xs px-4 py-2 font-bold uppercase tracking-wider transition-colors disabled:opacity-50 rounded-xl ${collection.isStarred
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

        {/* Copy Link Button */}
        {!showPrivateLinkWarning ? (
          <button
            onClick={handleCopyLink}
            className="action-btn-ghost flex items-center gap-2"
          >
            <LinkIcon className="w-4 h-4" />
            COPY LINK
          </button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-900 bg-amber-950/50">
            <span className="text-xs text-amber-400 uppercase">Private - only members can view</span>
            <button
              onClick={handleCopyLink}
              className="action-btn-ghost px-3 py-1 !min-h-0"
            >
              COPY ANYWAY
            </button>
            <button
              onClick={() => setShowPrivateLinkWarning(false)}
              className="action-btn-ghost px-3 py-1 !min-h-0"
            >
              CANCEL
            </button>
          </div>
        )}

        {/* Edit Button (owner/editor) */}
        {canEdit && (
          <button
            onClick={() => onEdit(collection)}
            className="action-btn-ghost"
          >
            EDIT
          </button>
        )}

        {/* Add Item Button (owner/editor) */}
        {canEdit && (
          <button
            onClick={() => onAddItem ? onAddItem() : setShowAddItemModal(true)}
            className="action-btn"
          >
            ADD ITEM
          </button>
        )}

        {/* Manage Members Button (owner only) */}
        {isOwner && (
          <button
            onClick={() => setShowMemberModal(true)}
            className="action-btn-ghost"
          >
            MANAGE MEMBERS
          </button>
        )}

        {/* Create Invite Link Button (owner only) */}
        {isOwner && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="action-btn-ghost"
          >
            CREATE INVITE
          </button>
        )}

        {/* Leave Collection Button (members who aren't owner) */}
        {collection.myRole && collection.myRole !== 'OWNER' && (
          <button
            onClick={handleLeave}
            disabled={actionLoading === 'leave'}
            className="action-btn-danger disabled:opacity-50"
          >
            {actionLoading === 'leave' ? '...' : 'LEAVE'}
          </button>
        )}

        {/* Delete Collection Button (owner only) */}
        {isOwner && !deleteConfirm && (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="action-btn-danger"
          >
            DELETE
          </button>
        )}

        {/* Delete Confirmation */}
        {isOwner && deleteConfirm && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-900 bg-red-950/50">
            <span className="text-xs text-red-400 uppercase">Are you sure?</span>
            <button
              onClick={handleDelete}
              disabled={actionLoading === 'delete'}
              className="action-btn-danger px-3 py-1 !min-h-0 disabled:opacity-50"
            >
              {actionLoading === 'delete' ? '...' : 'YES'}
            </button>
            <button
              onClick={() => setDeleteConfirm(false)}
              className="action-btn-ghost px-3 py-1 !min-h-0"
            >
              CANCEL
            </button>
          </div>
        )}
      </div>

      {/* Tab Sections */}
      <div className="chip-tabs">
        <button
          onClick={() => setActiveSection('items')}
          className={`chip-tab ${activeSection === 'items' ? 'active' : ''}`}
        >
          ITEMS ({collection.items.length})
        </button>
        <button
          onClick={() => setActiveSection('members')}
          className={`chip-tab ${activeSection === 'members' ? 'active' : ''}`}
        >
          MEMBERS ({collection.members.length + 1})
        </button>
        <button
          onClick={() => setActiveSection('comments')}
          className={`chip-tab ${activeSection === 'comments' ? 'active' : ''}`}
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
        <div className="editorial-grid">
          {/* Owner */}
          <div className="list-card pad">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserAvatar username={collection.owner.username} displayName={collection.owner.displayName} avatarUrl={collection.owner.avatarUrl} sizeClassName="w-8 h-8 text-xs" fallbackClassName="bg-neutral-800 text-neutral-400 border border-neutral-700" />
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
            <div key={member.id} className="list-card pad">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserAvatar username={member.user.username} displayName={member.user.displayName} avatarUrl={member.user.avatarUrl} sizeClassName="w-8 h-8 text-xs" fallbackClassName="bg-neutral-800 text-neutral-400 border border-neutral-700" />
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
                      className="action-btn-danger px-3 py-2 disabled:opacity-50"
                    >
                      {actionLoading === `remove-${member.user.id}` ? '...' : 'REMOVE'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {collection.members.length === 0 && (
            <div className="empty-state">
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
