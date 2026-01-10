import React, { useState } from 'react';
import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface AccountRecoveryProps {
  onSuccess: () => void;
  onBack: () => void;
}

export const AccountRecovery: React.FC<AccountRecoveryProps> = ({ onSuccess, onBack }) => {
  const { refreshUser } = useAuth();
  const [step, setStep] = useState<'email' | 'token'>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleInitiateRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await api.initiateAccountRecovery(email.trim());
      setSuccess('If a recovery email exists for this address, you will receive a recovery link shortly.');
      setStep('token');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initiate recovery';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await api.completeAccountRecovery(token.trim(), newPassword);
      // Refresh user context with new tokens
      await refreshUser();
      setSuccess('Account recovered successfully! You are now logged in.');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete recovery';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase tracking-tighter">Account Recovery</h2>
          <p className="text-sm text-neutral-500 mt-2">
            {step === 'email' 
              ? 'Enter your recovery email to regain access to your account.'
              : 'Enter the recovery token and set a new password.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 p-3 text-xs text-red-500">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-900/30 border border-green-700/50 p-3 text-xs text-green-500">
            {success}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleInitiateRecovery} className="space-y-4">
            <div>
              <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
                Recovery Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black border border-neutral-700 px-4 py-3 text-sm focus:border-white focus:outline-none"
                placeholder="Enter your recovery email"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-white text-black py-3 font-bold uppercase tracking-wider text-sm hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Recovery Email'}
            </button>

            <button
              type="button"
              onClick={() => setStep('token')}
              className="w-full text-xs text-neutral-500 hover:text-white uppercase tracking-wider transition-colors"
            >
              I already have a recovery token
            </button>
          </form>
        ) : (
          <form onSubmit={handleCompleteRecovery} className="space-y-4">
            <div>
              <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
                Recovery Token
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full bg-black border border-neutral-700 px-4 py-3 text-sm font-mono focus:border-white focus:outline-none"
                placeholder="Paste token from email"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-black border border-neutral-700 px-4 py-3 text-sm focus:border-white focus:outline-none"
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-black border border-neutral-700 px-4 py-3 text-sm focus:border-white focus:outline-none"
                placeholder="Repeat password"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading || !token.trim() || !newPassword || !confirmPassword}
              className="w-full bg-white text-black py-3 font-bold uppercase tracking-wider text-sm hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Recovering...' : 'Recover Account'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('email');
                setToken('');
                setNewPassword('');
                setConfirmPassword('');
                setError(null);
              }}
              className="w-full text-xs text-neutral-500 hover:text-white uppercase tracking-wider transition-colors"
            >
              Request new recovery email
            </button>
          </form>
        )}

        <div className="text-center pt-4 border-t border-neutral-800">
          <button
            onClick={onBack}
            className="text-xs text-neutral-500 hover:text-white uppercase tracking-wider transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};
