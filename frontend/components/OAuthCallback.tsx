import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';

interface OAuthCallbackProps {
  onComplete: () => void;
  onError: (error: string) => void;
}

export const OAuthCallback: React.FC<OAuthCallbackProps> = ({ onComplete, onError }) => {
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Parse URL parameters
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get('accessToken');
        const refreshToken = params.get('refreshToken');
        const error = params.get('error');
        const isNewUser = params.get('isNewUser');

        // Clear URL params for security
        window.history.replaceState({}, document.title, window.location.pathname);

        if (error) {
          setStatus('error');
          setErrorMessage(error);
          onError(error);
          return;
        }

        if (!accessToken || !refreshToken) {
          setStatus('error');
          setErrorMessage('Missing authentication tokens');
          onError('Missing authentication tokens');
          return;
        }

        // Store tokens
        api.storeTokens(accessToken, refreshToken);
        
        // Refresh user data
        await refreshUser();
        
        setStatus('success');
        
        // Small delay to show success state, then redirect
        setTimeout(() => {
          onComplete();
        }, 500);
      } catch (err) {
        console.error('OAuth callback error:', err);
        const message = err instanceof Error ? err.message : 'Authentication failed';
        setStatus('error');
        setErrorMessage(message);
        onError(message);
      }
    };

    handleCallback();
  }, [onComplete, onError, refreshUser]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      {status === 'processing' && (
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-neutral-500 uppercase tracking-wider text-sm">
            Completing sign in...
          </p>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-green-500 uppercase tracking-wider text-sm">
            Success! Redirecting...
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-red-500 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-red-500 uppercase tracking-wider text-sm">
            {errorMessage}
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="text-neutral-500 hover:text-white text-xs uppercase tracking-wider transition-colors"
          >
            Return to login
          </button>
        </div>
      )}
    </div>
  );
};
