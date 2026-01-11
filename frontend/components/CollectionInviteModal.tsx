import React, { useState, useEffect } from 'react';
import { CollectionInvite, CollectionRole } from '../types';
import { createCollectionInvite, getCollectionInvites, revokeCollectionInvite } from '../services/api';
import { useToast } from '../context/ToastContext';

// Format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMs < 0) return 'EXPIRED';
  if (diffMins < 60) return `${diffMins}M LEFT`;
  if (diffHours < 24) return `${diffHours}H LEFT`;
  if (diffDays < 7) return `${diffDays}D LEFT`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
};

// Copy icon
const CopyIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

// Check icon
const CheckIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ROLE_OPTIONS: { value: 'EDITOR' | 'VIEWER'; label: string; description: string }[] = [
  { value: 'VIEWER', label: 'VIEWER', description: 'Can view items and comments' },
  { value: 'EDITOR', label: 'EDITOR', description: 'Can add, edit, and remove items' },
];

const EXPIRY_OPTIONS: { value: number | null; label: string }[] = [
  { value: 1, label: '1 DAY' },
  { value: 7, label: '7 DAYS' },
  { value: 30, label: '30 DAYS' },
  { value: null, label: 'NEVER' },
];

const MAX_USES_OPTIONS: { value: number | null; label: string }[] = [
  { value: 1, label: '1 USE' },
  { value: 5, label: '5 USES' },
  { value: 10, label: '10 USES' },
  { value: null, label: 'UNLIMITED' },
];

interface CollectionInviteModalProps {
  collectionId: string;
  collectionTitle: string;
  onClose: () => void;
}

export const CollectionInviteModal: React.FC<CollectionInviteModalProps> = ({
  collectionId,
  collectionTitle,
  onClose,
}) => {
  const { showToast } = useToast();
  const [invites, setInvites] = useState<CollectionInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // New invite form
  const [showForm, setShowForm] = useState(false);
  const [role, setRole] = useState<'EDITOR' | 'VIEWER'>('VIEWER');
  const [expiresInDays, setExpiresInDays] = useState<number | null>(7);
  const [maxUses, setMaxUses] = useState<number | null>(null);

  // Load existing invites
  useEffect(() => {
    loadInvites();
  }, [collectionId]);

  const loadInvites = async () => {
    setLoading(true);
    try {
      const data = await getCollectionInvites(collectionId);
      // Filter out expired invites
      const validInvites = data.filter(invite => new Date(invite.expiresAt) > new Date());
      setInvites(validInvites);
    } catch (err: any) {
      console.error('Failed to load invites:', err);
      showToast(err.message || 'Failed to load invites', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const invite = await createCollectionInvite(collectionId, {
        role,
        maxUses: maxUses || undefined,
        expiresInDays: expiresInDays || undefined,
      });
      setInvites([invite, ...invites]);
      setShowForm(false);
      showToast('Invite link created', 'success');
      // Auto-copy the new invite
      copyInviteLink(invite);
    } catch (err: any) {
      console.error('Failed to create invite:', err);
      showToast(err.message || 'Failed to create invite', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    setRevoking(inviteId);
    try {
      await revokeCollectionInvite(collectionId, inviteId);
      setInvites(invites.filter(i => i.id !== inviteId));
      showToast('Invite revoked', 'info');
    } catch (err: any) {
      console.error('Failed to revoke invite:', err);
      showToast(err.message || 'Failed to revoke invite', 'error');
    } finally {
      setRevoking(null);
    }
  };

  const getInviteLink = (invite: CollectionInvite): string => {
    return `${window.location.origin}/collections/join/${invite.token}`;
  };

  const copyInviteLink = async (invite: CollectionInvite) => {
    try {
      await navigator.clipboard.writeText(getInviteLink(invite));
      setCopiedId(invite.id);
      showToast('Link copied to clipboard', 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      showToast('Failed to copy link', 'error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-black border border-neutral-700 w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest">
              INVITE LINKS
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Create New Invite */}
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-3 text-xs font-bold uppercase tracking-wider bg-white text-black hover:bg-neutral-200 transition-colors"
            >
              CREATE NEW INVITE
            </button>
          ) : (
            <div className="border border-neutral-800 p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                NEW INVITE LINK
              </h4>

              {/* Role Selection */}
              <div className="space-y-2">
                <label className="text-xs text-neutral-600 uppercase tracking-wider block">
                  ROLE
                </label>
                <div className="flex gap-2">
                  {ROLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setRole(option.value)}
                      className={`flex-1 p-3 text-left border transition-colors ${
                        role === option.value
                          ? 'border-white bg-neutral-900'
                          : 'border-neutral-800 hover:border-neutral-600'
                      }`}
                    >
                      <div className="text-xs font-bold text-white uppercase">
                        {option.label}
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {option.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Expiry Selection */}
              <div className="space-y-2">
                <label className="text-xs text-neutral-600 uppercase tracking-wider block">
                  EXPIRES AFTER
                </label>
                <div className="flex gap-2 flex-wrap">
                  {EXPIRY_OPTIONS.map((option) => (
                    <button
                      key={option.value ?? 'never'}
                      onClick={() => setExpiresInDays(option.value)}
                      className={`px-3 py-2 text-xs uppercase tracking-wider border transition-colors ${
                        expiresInDays === option.value
                          ? 'bg-white text-black border-white'
                          : 'bg-transparent text-neutral-500 border-neutral-700 hover:border-neutral-500'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Uses Selection */}
              <div className="space-y-2">
                <label className="text-xs text-neutral-600 uppercase tracking-wider block">
                  MAX USES
                </label>
                <div className="flex gap-2 flex-wrap">
                  {MAX_USES_OPTIONS.map((option) => (
                    <button
                      key={option.value ?? 'unlimited'}
                      onClick={() => setMaxUses(option.value)}
                      className={`px-3 py-2 text-xs uppercase tracking-wider border transition-colors ${
                        maxUses === option.value
                          ? 'bg-white text-black border-white'
                          : 'bg-transparent text-neutral-500 border-neutral-700 hover:border-neutral-500'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 text-xs font-bold uppercase tracking-wider border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 py-2 text-xs font-bold uppercase tracking-wider bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-50"
                >
                  {creating ? 'CREATING...' : 'CREATE'}
                </button>
              </div>
            </div>
          )}

          {/* Existing Invites */}
          {loading ? (
            <div className="py-8 text-center text-neutral-500 uppercase tracking-wider animate-pulse">
              Loading invites...
            </div>
          ) : invites.length === 0 ? (
            <div className="py-8 text-center text-neutral-600 border border-neutral-800 border-dashed">
              <p className="text-sm uppercase">NO ACTIVE INVITES</p>
              <p className="text-xs mt-2 text-neutral-700">
                Create an invite link to share with others
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                ACTIVE INVITES ({invites.length})
              </h4>
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="border border-neutral-800 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs uppercase border ${
                        invite.role === 'EDITOR'
                          ? 'bg-blue-950 border-blue-800 text-blue-400'
                          : 'bg-neutral-900 border-neutral-700 text-neutral-400'
                      }`}>
                        {invite.role}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {formatRelativeTime(invite.expiresAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <span>
                        {invite.useCount}{invite.maxUses ? `/${invite.maxUses}` : ''} uses
                      </span>
                    </div>
                  </div>

                  {/* Invite Link */}
                  <div className="flex gap-2">
                    <div className="flex-1 bg-neutral-950 border border-neutral-800 p-2 text-xs text-neutral-400 font-mono truncate">
                      {getInviteLink(invite)}
                    </div>
                    <button
                      onClick={() => copyInviteLink(invite)}
                      className="px-3 border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors"
                      title="Copy link"
                    >
                      {copiedId === invite.id ? (
                        <CheckIcon className="w-4 h-4 text-green-500" />
                      ) : (
                        <CopyIcon className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleRevoke(invite.id)}
                      disabled={revoking === invite.id}
                      className="px-3 border border-neutral-800 text-neutral-500 uppercase text-xs tracking-wider hover:border-red-900 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      {revoking === invite.id ? '...' : 'REVOKE'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
    </div>
  );
};

export default CollectionInviteModal;
