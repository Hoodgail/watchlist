import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface AuthFormProps {
  onToggleMode: () => void;
  isLogin: boolean;
}

export const AuthForm: React.FC<AuthFormProps> = ({ onToggleMode, isLogin }) => {
  const { login, register } = useAuth();
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
            disabled={loading}
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
