import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface AuthFormProps {
  onToggleMode: () => void;
  isLogin: boolean;
}

// Discord icon component
const DiscordIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

export const AuthForm: React.FC<AuthFormProps> = ({ onToggleMode, isLogin }) => {
  const { login, register, initiateOAuthLogin } = useAuth();
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isLogin && password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        await login({ email, password });
        showToast('Welcome back!', 'success');
      } else {
        await register({ username, email, password });
        showToast('Account created successfully!', 'success');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscordLogin = async () => {
    setOauthLoading(true);
    setError('');
    try {
      await initiateOAuthLogin('discord');
      // Will redirect to Discord, so loading state will persist
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to Discord';
      setError(message);
      showToast(message, 'error');
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex flex-col justify-center">
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold uppercase tracking-tighter mb-2">
            {isLogin ? 'LOGIN' : 'REGISTER'}
          </h2>
          <p className="text-neutral-500 text-sm uppercase tracking-wider">
            {isLogin ? 'Access your lists' : 'Create your account'}
          </p>
        </div>

        {/* OAuth Buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleDiscordLogin}
            disabled={oauthLoading || loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            style={{ 
              backgroundColor: '#5865F2',
              color: 'white',
            }}
            onMouseEnter={(e) => {
              if (!oauthLoading && !loading) {
                e.currentTarget.style.backgroundColor = '#4752C4';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#5865F2';
            }}
          >
            <DiscordIcon className="w-5 h-5" />
            {oauthLoading ? 'CONNECTING...' : 'CONTINUE WITH DISCORD'}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 border-t border-neutral-800"></div>
          <span className="text-neutral-600 text-xs uppercase tracking-wider">or</span>
          <div className="flex-1 border-t border-neutral-800"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="YOUR_USERNAME"
                required
                minLength={3}
                className="w-full bg-black border border-neutral-700 p-4 text-white placeholder-neutral-700 uppercase focus:border-white outline-none font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="YOUR@EMAIL.COM"
              required
              className="w-full bg-black border border-neutral-700 p-4 text-white placeholder-neutral-700 uppercase focus:border-white outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              className="w-full bg-black border border-neutral-700 p-4 text-white placeholder-neutral-700 focus:border-white outline-none font-mono"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full bg-black border border-neutral-700 p-4 text-white placeholder-neutral-700 focus:border-white outline-none font-mono"
              />
            </div>
          )}

          {error && (
            <div className="p-4 border border-red-900/50 text-red-500 uppercase text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || oauthLoading}
            className="w-full bg-white text-black font-bold uppercase px-6 py-4 hover:bg-neutral-300 disabled:opacity-50 transition-colors"
          >
            {loading ? 'LOADING...' : isLogin ? 'LOGIN' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <div className="text-center border-t border-neutral-800 pt-6">
          <p className="text-neutral-500 text-sm">
            {isLogin ? "DON'T HAVE AN ACCOUNT?" : 'ALREADY HAVE AN ACCOUNT?'}
          </p>
          <button
            onClick={onToggleMode}
            className="text-white uppercase tracking-wider text-sm mt-2 hover:underline underline-offset-4"
          >
            {isLogin ? 'REGISTER' : 'LOGIN'}
          </button>
        </div>
      </div>
    </div>
  );
};
