import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface AccountSecurityBannerProps {
  onSetupRecovery: () => void;
}

export const AccountSecurityBanner: React.FC<AccountSecurityBannerProps> = ({ onSetupRecovery }) => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Don't show banner if:
  // - User is not logged in
  // - User has a password set
  // - User has a verified recovery email
  // - Banner was dismissed this session
  if (!user || user.hasPassword || user.recoveryEmailVerified || dismissed) {
    return null;
  }

  // Check if user only has OAuth and no verified recovery options
  const hasOAuth = user.oauthProviders && user.oauthProviders.length > 0;
  const isAtRisk = hasOAuth && !user.hasPassword && !user.recoveryEmailVerified;
  
  if (!isAtRisk) {
    return null;
  }

  return (
    <div className="bg-yellow-900/30 border border-yellow-700/50 p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg 
            className="w-5 h-5 text-yellow-500" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-yellow-500 uppercase tracking-wider">
            Secure Your Account
          </h3>
          <p className="text-xs text-yellow-600 mt-1">
            You're signed in with Discord only. If you lose access to your Discord account, 
            you won't be able to recover this account. Set up a recovery email or password 
            to prevent lockout.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={onSetupRecovery}
              className="text-xs bg-yellow-600 hover:bg-yellow-500 text-black px-3 py-1.5 uppercase tracking-wider font-bold transition-colors"
            >
              Set Up Recovery
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-xs text-yellow-600 hover:text-yellow-500 px-3 py-1.5 uppercase tracking-wider transition-colors"
            >
              Remind Me Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
