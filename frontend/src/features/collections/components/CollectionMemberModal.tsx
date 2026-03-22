import React, { useState, useEffect } from 'react';
import {
  addCollectionMember,
  getCollectionMembers,
  removeCollectionMember,
  updateMemberRole,
} from '@/features/collections/api';
import { ModalFrame, UserAvatar } from '@/shared/ui';
import { formatRelativeTime } from '@/shared/utils/time';
import { CollectionMember, CollectionRole } from '@/types';
import { useToast } from '@/context/ToastContext';

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


interface CollectionMemberModalProps {
  collectionId: string;
  collectionTitle: string;
  owner: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  initialMembers: CollectionMember[];
  onClose: () => void;
  onMembersChange?: () => void;
}

export const CollectionMemberModal: React.FC<CollectionMemberModalProps> = ({
  collectionId,
  collectionTitle,
  owner,
  initialMembers,
  onClose,
  onMembersChange,
}) => {
  const { showToast } = useToast();
  const [members, setMembers] = useState<CollectionMember[]>(initialMembers);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Add member form
  const [showAddForm, setShowAddForm] = useState(false);
  const [username, setUsername] = useState('');
  const [newRole, setNewRole] = useState<'EDITOR' | 'VIEWER'>('VIEWER');
  const [addingMember, setAddingMember] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setAddingMember(true);
    setAddError(null);

    try {
      const newMember = await addCollectionMember(collectionId, username.trim(), newRole);
      setMembers([...members, newMember]);
      setUsername('');
      setShowAddForm(false);
      showToast(`Added ${username} as ${newRole.toLowerCase()}`, 'success');
      onMembersChange?.();
    } catch (err: any) {
      console.error('Failed to add member:', err);
      const errorMessage = err.message || 'Failed to add member';
      setAddError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setAddingMember(false);
    }
  };

  const handleUpdateRole = async (userId: string, role: 'EDITOR' | 'VIEWER') => {
    setActionLoading(`role-${userId}`);
    try {
      const updated = await updateMemberRole(collectionId, userId, role);
      setMembers(members.map(m => m.user.id === userId ? { ...m, role: updated.role } : m));
      showToast(`Updated role to ${role.toLowerCase()}`, 'success');
      onMembersChange?.();
    } catch (err: any) {
      console.error('Failed to update role:', err);
      showToast(err.message || 'Failed to update role', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMember = async (userId: string, username: string) => {
    setActionLoading(`remove-${userId}`);
    try {
      await removeCollectionMember(collectionId, userId);
      setMembers(members.filter(m => m.user.id !== userId));
      showToast(`Removed ${username}`, 'info');
      onMembersChange?.();
    } catch (err: any) {
      console.error('Failed to remove member:', err);
      showToast(err.message || 'Failed to remove member', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <ModalFrame onClose={onClose}>
      <div className="modal-shell max-w-lg">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest">
              MANAGE MEMBERS
            </h3>
            <p className="text-xs text-neutral-500 mt-1 uppercase truncate">
              {collectionTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="modal-content space-y-4">
          {/* Add Member Button/Form */}
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="action-btn w-full"
            >
              ADD MEMBER BY USERNAME
            </button>
          ) : (
            <form onSubmit={handleAddMember} className="screen-panel pad space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                ADD NEW MEMBER
              </h4>

              {/* Username Input */}
              <div className="space-y-2">
                <label className="text-xs text-neutral-600 uppercase tracking-wider block">
                  USERNAME
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username..."
                  className="search-field w-full text-sm uppercase"
                  autoFocus
                />
              </div>

              {/* Role Selection */}
              <div className="space-y-2">
                <label className="text-xs text-neutral-600 uppercase tracking-wider block">
                  ROLE
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRole('VIEWER')}
                    className={`option-card flex-1 text-left ${newRole === 'VIEWER' ? 'selected' : ''}`}
                  >
                    <div className="text-xs font-bold text-white uppercase">VIEWER</div>
                    <div className="text-xs text-neutral-500 mt-0.5">Can view items and comments</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRole('EDITOR')}
                    className={`option-card flex-1 text-left ${newRole === 'EDITOR' ? 'selected' : ''}`}
                  >
                    <div className="text-xs font-bold text-white uppercase">EDITOR</div>
                    <div className="text-xs text-neutral-500 mt-0.5">Can add, edit, and remove items</div>
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {addError && (
                <div className="text-xs text-red-500 bg-red-950/50 border border-red-900 p-2">
                  {addError}
                </div>
              )}

              {/* Form Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddError(null);
                    setUsername('');
                  }}
                  className="action-btn-ghost flex-1"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={addingMember || !username.trim()}
                  className="action-btn flex-1 disabled:opacity-50"
                >
                  {addingMember ? 'ADDING...' : 'ADD'}
                </button>
              </div>
            </form>
          )}

          {/* Owner */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              OWNER
            </h4>
            <div className="screen-panel pad soft">
              <div className="flex items-center gap-3">
                <UserAvatar username={owner.username} displayName={owner.displayName} avatarUrl={owner.avatarUrl} sizeClassName="w-10 h-10 text-xs" fallbackClassName="bg-neutral-800 text-neutral-400 border border-neutral-700" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">
                    {owner.displayName || owner.username}
                  </div>
                  <div className="text-xs text-neutral-500">@{owner.username}</div>
                </div>
                <RoleBadge role="OWNER" />
              </div>
            </div>
          </div>

          {/* Members List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              MEMBERS ({members.length})
            </h4>
            {members.length === 0 ? (
               <div className="empty-state py-6">
                <p className="text-sm uppercase">NO MEMBERS YET</p>
                <p className="text-xs mt-2 text-neutral-700">
                  Add members by username or create an invite link
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="border border-neutral-800 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar username={member.user.username} displayName={member.user.displayName} avatarUrl={member.user.avatarUrl} sizeClassName="w-10 h-10 text-xs" fallbackClassName="bg-neutral-800 text-neutral-400 border border-neutral-700" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">
                          {member.user.displayName || member.user.username}
                        </div>
                        <div className="text-xs text-neutral-500">
                          @{member.user.username} · {formatRelativeTime(member.createdAt)}
                        </div>
                      </div>
                    </div>

                    {/* Member Actions */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-900">
                      {/* Role Toggle */}
                      <div className="flex-1 flex gap-1">
                        <button
                          onClick={() => handleUpdateRole(member.user.id, 'VIEWER')}
                          disabled={member.role === 'VIEWER' || actionLoading === `role-${member.user.id}`}
                          className={`px-2 py-1 text-xs uppercase tracking-wider border transition-colors ${
                            member.role === 'VIEWER'
                              ? 'bg-neutral-900 border-neutral-700 text-neutral-400'
                              : 'border-neutral-800 text-neutral-600 hover:border-neutral-600 hover:text-neutral-400'
                          } disabled:opacity-50`}
                        >
                          VIEWER
                        </button>
                        <button
                          onClick={() => handleUpdateRole(member.user.id, 'EDITOR')}
                          disabled={member.role === 'EDITOR' || actionLoading === `role-${member.user.id}`}
                          className={`px-2 py-1 text-xs uppercase tracking-wider border transition-colors ${
                            member.role === 'EDITOR'
                              ? 'bg-blue-950 border-blue-800 text-blue-400'
                              : 'border-neutral-800 text-neutral-600 hover:border-blue-900 hover:text-blue-400'
                          } disabled:opacity-50`}
                        >
                          EDITOR
                        </button>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemoveMember(member.user.id, member.user.username)}
                        disabled={actionLoading === `remove-${member.user.id}`}
                        className="px-3 py-1 text-xs uppercase tracking-wider border border-neutral-800 text-neutral-500 hover:border-red-900 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === `remove-${member.user.id}` ? '...' : 'REMOVE'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 text-xs font-bold uppercase tracking-wider border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors"
          >
            DONE
          </button>
        </div>
      </div>
    </ModalFrame>
  );
};

export default CollectionMemberModal;
