import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSpoilerProtection } from '../context/SpoilerContext';
import * as api from '../services/api';
import { UserAvatar } from './Layout';

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'https://watchlist.hoodgail.me';

// Discord icon component
const DiscordIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

// Warning icon component
const WarningIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

// Check icon component
const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

interface SettingsProps {
  onBack: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const { user, refreshUser, initiateOAuthLogin } = useAuth();
  const { showToast } = useToast();
  const { spoilerProtectionEnabled, setSpoilerProtectionEnabled } = useSpoilerProtection();
  
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState<boolean>(user?.isPublic ?? false);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  
  // Recovery email state
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryEmailLoading, setRecoveryEmailLoading] = useState(false);
  const [showRecoveryEmailForm, setShowRecoveryEmailForm] = useState(false);
  
  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Load linked providers
  useEffect(() => {
    const loadProviders = async () => {
      try {
        // Use providers from user object if available, otherwise fetch
        if (user?.oauthProviders) {
          setLinkedProviders(user.oauthProviders);
        } else {
          const providers = await api.getLinkedProviders();
          setLinkedProviders(providers);
        }
      } catch (error) {
        console.error('Failed to load providers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProviders();
  }, [user?.oauthProviders]);

  // Sync privacy state with user
  useEffect(() => {
    if (user?.isPublic !== undefined) {
      setIsPublic(user.isPublic);
    }
  }, [user?.isPublic]);

  // Calculate account security status
  const hasPassword = user?.hasPassword ?? false;
  const hasRecoveryEmail = !!user?.recoveryEmail;
  const recoveryEmailVerified = user?.recoveryEmailVerified ?? false;
  const hasOAuth = linkedProviders.length > 0;
  const authMethodCount = (hasPassword ? 1 : 0) + linkedProviders.length;
  const hasRecoveryOption = hasPassword || (hasRecoveryEmail && recoveryEmailVerified);
  
  // Account is at risk if: OAuth only + no password + no verified recovery email
  const accountAtRisk = hasOAuth && !hasPassword && !recoveryEmailVerified;

  const handlePrivacyToggle = async () => {
    setPrivacyLoading(true);
    const newValue = !isPublic;
    
    try {
      await api.updatePrivacySettings(newValue);
      setIsPublic(newValue);
      await refreshUser();
      showToast(newValue ? 'Your profile is now public' : 'Your profile is now private', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update privacy settings';
      showToast(message, 'error');
    } finally {
      setPrivacyLoading(false);
    }
  };

  const handleLinkDiscord = async () => {
    setLinkingProvider('discord');
    try {
      // Get OAuth URL and redirect - when user returns, the callback will handle linking
      // For account linking, we need a different flow
      const authUrl = await api.getOAuthUrl('discord');
      // Add state parameter to indicate this is a link operation
      const url = new URL(authUrl);
      url.searchParams.set('state', 'link');
      window.location.href = url.toString();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect Discord';
      showToast(message, 'error');
      setLinkingProvider(null);
    }
  };

  const handleUnlinkProvider = async (provider: string) => {
    // Check if this would leave the user without any auth method
    const otherProviders = linkedProviders.filter(p => p !== provider);
    
    // Can unlink if: has password OR has other OAuth providers OR has verified recovery email
    const canUnlink = hasPassword || otherProviders.length > 0;
    
    if (!canUnlink) {
      showToast('Cannot unlink - you need at least one way to sign in. Set a password or recovery email first.', 'error');
      return;
    }

    setUnlinkingProvider(provider);
    try {
      await api.unlinkOAuthAccount(provider);
      setLinkedProviders(prev => prev.filter(p => p !== provider));
      await refreshUser();
      showToast(`${provider.charAt(0).toUpperCase() + provider.slice(1)} account unlinked`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unlink account';
      showToast(message, 'error');
    } finally {
      setUnlinkingProvider(null);
    }
  };

  const handleSetRecoveryEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) return;
    
    setRecoveryEmailLoading(true);
    try {
      await api.setRecoveryEmail(recoveryEmail.trim());
      await refreshUser();
      showToast('Recovery email set. Please check your inbox to verify.', 'success');
      setRecoveryEmail('');
      setShowRecoveryEmailForm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set recovery email';
      showToast(message, 'error');
    } finally {
      setRecoveryEmailLoading(false);
    }
  };

  const handleRemoveRecoveryEmail = async () => {
    if (!hasPassword && linkedProviders.length === 0) {
      showToast('Cannot remove recovery email - it is your only recovery method', 'error');
      return;
    }
    
    setRecoveryEmailLoading(true);
    try {
      await api.removeRecoveryEmail();
      await refreshUser();
      showToast('Recovery email removed', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove recovery email';
      showToast(message, 'error');
    } finally {
      setRecoveryEmailLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 8) {
      showToast('Password must be at least 8 characters', 'error');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    
    setPasswordLoading(true);
    try {
      if (hasPassword) {
        // Change password
        await api.changePassword(currentPassword, newPassword);
        showToast('Password changed successfully', 'success');
      } else {
        // Set new password
        await api.setPassword(newPassword);
        showToast('Password set successfully', 'success');
      }
      await refreshUser();
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
      setShowPasswordForm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update password';
      showToast(message, 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  const isDiscordLinked = linkedProviders.includes('discord');
  const canUnlinkDiscord = hasPassword || linkedProviders.length > 1;

  if (loading) {
    return (
      <div className="py-12 text-center text-neutral-500 uppercase tracking-wider animate-pulse">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-neutral-800 pb-4">
        <button
          onClick={onBack}
          className="text-neutral-500 hover:text-white mb-4 text-sm uppercase tracking-wider flex items-center gap-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h2 className="text-2xl font-bold uppercase tracking-tighter">Settings</h2>
      </div>

      {/* Account Security Warning Banner */}
      {accountAtRisk && (
        <div className="bg-yellow-900/30 border border-yellow-700/50 p-4">
          <div className="flex items-start gap-3">
            <WarningIcon className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-yellow-500 uppercase tracking-wider">
                Account at Risk
              </h3>
              <p className="text-xs text-yellow-600 mt-1">
                You're signed in with Discord only. If you lose access to your Discord account, 
                you won't be able to recover this account. Set up a password or recovery email below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Profile Section */}
      {user && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-900 pb-2">
            Profile
          </h3>
          <div className="flex items-center gap-4 p-4 border border-neutral-800 bg-neutral-900/50">
            <UserAvatar user={user} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="font-bold uppercase truncate">{user.displayName || user.username}</p>
              <p className="text-sm text-neutral-500 truncate">@{user.username}</p>
              <p className="text-xs text-neutral-600 truncate">{user.email}</p>
            </div>
          </div>
          
          {/* Profile Link */}
          <div className="p-4 border border-neutral-800 bg-neutral-900/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold uppercase text-sm">Public Profile</p>
                <p className="text-xs text-neutral-500">
                  {FRONTEND_URL.replace(/^https?:\/\//, '')}/u/{user.username}
                </p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${FRONTEND_URL}/u/${user.username}`);
                  showToast('Profile link copied!', 'success');
                }}
                className="text-xs border border-neutral-700 px-3 py-2 text-neutral-400 hover:border-neutral-600 hover:text-white uppercase tracking-wider transition-colors"
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-900 pb-2">
          Privacy
        </h3>
        
        <div className="p-4 border border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-bold uppercase text-sm">Public Profile</p>
              <p className="text-xs text-neutral-500 mt-1">
                {isPublic 
                  ? 'Anyone can view your watchlist without logging in.'
                  : 'Only your followers can view your watchlist.'}
              </p>
            </div>
            
            <button
              onClick={handlePrivacyToggle}
              disabled={privacyLoading}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                isPublic ? 'bg-green-600' : 'bg-neutral-700'
              } ${privacyLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              aria-label={isPublic ? 'Make profile private' : 'Make profile public'}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
                  isPublic ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          
          <div className="mt-3 pt-3 border-t border-neutral-800">
            <p className="text-xs text-neutral-600">
              {isPublic ? (
                <>
                  <span className="text-green-500 font-semibold">Public:</span> Your profile is visible to everyone. 
                  Anyone can see your watchlist, ratings, and notes via your profile link.
                </>
              ) : (
                <>
                  <span className="text-neutral-400 font-semibold">Private:</span> Only users who follow you can see your watchlist.
                  Others will see a "private profile" message.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Spoiler Protection */}
        <div className="p-4 border border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold uppercase text-sm">Spoiler Protection</p>
                <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {spoilerProtectionEnabled 
                  ? 'Friend activity that may contain spoilers is blurred.'
                  : 'All friend activity is shown without blur.'}
              </p>
            </div>
            
            <button
              onClick={() => {
                setSpoilerProtectionEnabled(!spoilerProtectionEnabled);
                showToast(
                  !spoilerProtectionEnabled 
                    ? 'Spoiler protection enabled' 
                    : 'Spoiler protection disabled',
                  'success'
                );
              }}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none cursor-pointer ${
                spoilerProtectionEnabled ? 'bg-green-600' : 'bg-neutral-700'
              }`}
              aria-label={spoilerProtectionEnabled ? 'Disable spoiler protection' : 'Enable spoiler protection'}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
                  spoilerProtectionEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          
          <div className="mt-3 pt-3 border-t border-neutral-800">
            <p className="text-xs text-neutral-600">
              {spoilerProtectionEnabled ? (
                <>
                  <span className="text-green-500 font-semibold">Protected:</span> Episode titles and thumbnails from friends who are ahead of you on a show will be blurred. 
                  Tap "Reveal" to temporarily unblur spoiler content.
                </>
              ) : (
                <>
                  <span className="text-neutral-400 font-semibold">Unprotected:</span> All friend activity is visible.
                  You may see episode titles and thumbnails that spoil shows you're watching.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Connected Accounts Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-900 pb-2">
          Connected Accounts
        </h3>
        
        {/* Discord */}
        <div className="p-4 border border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#5865F2' }}
              >
                <DiscordIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold uppercase text-sm">Discord</p>
                <p className="text-xs text-neutral-500">
                  {isDiscordLinked ? 'Connected' : 'Not connected'}
                </p>
              </div>
            </div>
            
            {isDiscordLinked ? (
              <button
                onClick={() => handleUnlinkProvider('discord')}
                disabled={!canUnlinkDiscord || unlinkingProvider === 'discord'}
                className={`text-xs border px-3 py-2 uppercase tracking-wider transition-colors ${
                  canUnlinkDiscord 
                    ? 'border-neutral-700 text-neutral-400 hover:border-red-900 hover:text-red-500' 
                    : 'border-neutral-800 text-neutral-700 cursor-not-allowed'
                }`}
                title={!canUnlinkDiscord ? 'Set a password before unlinking' : undefined}
              >
                {unlinkingProvider === 'discord' ? '...' : 'Disconnect'}
              </button>
            ) : (
              <button
                onClick={handleLinkDiscord}
                disabled={linkingProvider === 'discord'}
                className="text-xs px-3 py-2 uppercase tracking-wider transition-colors text-white"
                style={{ backgroundColor: '#5865F2' }}
                onMouseEnter={(e) => {
                  if (linkingProvider !== 'discord') {
                    e.currentTarget.style.backgroundColor = '#4752C4';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#5865F2';
                }}
              >
                {linkingProvider === 'discord' ? 'Connecting...' : 'Connect'}
              </button>
            )}
          </div>
          
          {!canUnlinkDiscord && isDiscordLinked && (
            <p className="text-xs text-yellow-600 mt-3 border-t border-neutral-800 pt-3">
              You cannot disconnect Discord without setting a password first, as it's your only sign-in method.
            </p>
          )}
        </div>
      </div>

      {/* Security Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-900 pb-2">
          Security
        </h3>
        
        {/* Password */}
        <div className="p-4 border border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hasPassword ? (
                <CheckIcon className="w-4 h-4 text-green-500" />
              ) : (
                <WarningIcon className="w-4 h-4 text-yellow-500" />
              )}
              <div>
                <p className="font-bold uppercase text-sm">Password</p>
                <p className="text-xs text-neutral-500">
                  {hasPassword ? 'Password is set' : 'No password set (OAuth only)'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="text-xs border border-neutral-700 px-3 py-2 text-neutral-400 hover:border-neutral-600 hover:text-white uppercase tracking-wider transition-colors"
            >
              {hasPassword ? 'Change' : 'Set Password'}
            </button>
          </div>
          
          {showPasswordForm && (
            <form onSubmit={handleSetPassword} className="mt-4 pt-4 border-t border-neutral-800 space-y-3">
              {hasPassword && (
                <div>
                  <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-black border border-neutral-700 px-3 py-2 text-sm focus:border-white focus:outline-none"
                    required={hasPassword}
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-black border border-neutral-700 px-3 py-2 text-sm focus:border-white focus:outline-none"
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-black border border-neutral-700 px-3 py-2 text-sm focus:border-white focus:outline-none"
                  placeholder="Repeat password"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="text-xs bg-white text-black px-4 py-2 uppercase tracking-wider font-bold hover:bg-neutral-200 transition-colors disabled:opacity-50"
                >
                  {passwordLoading ? 'Saving...' : (hasPassword ? 'Change Password' : 'Set Password')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setNewPassword('');
                    setConfirmPassword('');
                    setCurrentPassword('');
                  }}
                  className="text-xs border border-neutral-700 px-4 py-2 text-neutral-400 uppercase tracking-wider hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          
          {!hasPassword && !showPasswordForm && (
            <p className="text-xs text-neutral-600 mt-3 border-t border-neutral-800 pt-3">
              Setting a password allows you to sign in with email and provides a backup if you lose OAuth access.
            </p>
          )}
        </div>

        {/* Recovery Email */}
        <div className="p-4 border border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {recoveryEmailVerified ? (
                <CheckIcon className="w-4 h-4 text-green-500" />
              ) : hasRecoveryEmail ? (
                <WarningIcon className="w-4 h-4 text-yellow-500" />
              ) : (
                <WarningIcon className="w-4 h-4 text-neutral-600" />
              )}
              <div>
                <p className="font-bold uppercase text-sm">Recovery Email</p>
                <p className="text-xs text-neutral-500">
                  {hasRecoveryEmail 
                    ? (recoveryEmailVerified 
                        ? `${user?.recoveryEmail} (verified)` 
                        : `${user?.recoveryEmail} (pending verification)`)
                    : 'Not set'}
                </p>
              </div>
            </div>
            {hasRecoveryEmail ? (
              <button
                onClick={handleRemoveRecoveryEmail}
                disabled={recoveryEmailLoading}
                className="text-xs border border-neutral-700 px-3 py-2 text-neutral-400 hover:border-red-900 hover:text-red-500 uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {recoveryEmailLoading ? '...' : 'Remove'}
              </button>
            ) : (
              <button
                onClick={() => setShowRecoveryEmailForm(!showRecoveryEmailForm)}
                className="text-xs border border-neutral-700 px-3 py-2 text-neutral-400 hover:border-neutral-600 hover:text-white uppercase tracking-wider transition-colors"
              >
                Add
              </button>
            )}
          </div>
          
          {showRecoveryEmailForm && !hasRecoveryEmail && (
            <form onSubmit={handleSetRecoveryEmail} className="mt-4 pt-4 border-t border-neutral-800 space-y-3">
              <div>
                <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-1">
                  Recovery Email Address
                </label>
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  className="w-full bg-black border border-neutral-700 px-3 py-2 text-sm focus:border-white focus:outline-none"
                  placeholder="backup@example.com"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={recoveryEmailLoading || !recoveryEmail.trim()}
                  className="text-xs bg-white text-black px-4 py-2 uppercase tracking-wider font-bold hover:bg-neutral-200 transition-colors disabled:opacity-50"
                >
                  {recoveryEmailLoading ? 'Saving...' : 'Set Recovery Email'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRecoveryEmailForm(false);
                    setRecoveryEmail('');
                  }}
                  className="text-xs border border-neutral-700 px-4 py-2 text-neutral-400 uppercase tracking-wider hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          
          {hasRecoveryEmail && !recoveryEmailVerified && (
            <p className="text-xs text-yellow-600 mt-3 border-t border-neutral-800 pt-3">
              Please check your email inbox and verify your recovery email address to complete setup.
            </p>
          )}
          
          {!hasRecoveryEmail && !showRecoveryEmailForm && (
            <p className="text-xs text-neutral-600 mt-3 border-t border-neutral-800 pt-3">
              A recovery email allows you to regain access if you lose your password and OAuth access.
            </p>
          )}
        </div>
      </div>

      {/* Account Info */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-900 pb-2">
          Account Info
        </h3>
        <div className="p-4 border border-neutral-800 bg-neutral-900/50 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-neutral-500 uppercase">User ID</span>
            <span className="text-neutral-400 font-mono">{user?.id?.slice(0, 8)}...</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500 uppercase">Auth Methods</span>
            <span className="text-neutral-400">
              {[
                hasPassword && 'Password',
                ...linkedProviders.map(p => p.charAt(0).toUpperCase() + p.slice(1))
              ].filter(Boolean).join(', ') || 'None'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500 uppercase">Recovery Options</span>
            <span className={recoveryEmailVerified ? 'text-green-500' : 'text-yellow-500'}>
              {recoveryEmailVerified 
                ? 'Email verified' 
                : hasRecoveryEmail 
                  ? 'Email pending' 
                  : hasPassword 
                    ? 'Password set'
                    : 'None set'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500 uppercase">Account Status</span>
            <span className={accountAtRisk ? 'text-yellow-500' : 'text-green-500'}>
              {accountAtRisk ? 'At Risk' : 'Secure'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
