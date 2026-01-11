import React, { useState, useRef, useEffect } from 'react';
import { View, AuthUser } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: View;
  onViewChange: (view: View) => void;
  user: AuthUser | null;
  onLogout?: () => void;
  pendingSuggestionsCount?: number;
  isOnline?: boolean;
  isOfflineAuthenticated?: boolean;
}

// Avatar component with fallback to initials
const UserAvatar: React.FC<{ 
  user: AuthUser; 
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}> = ({ user, size = 'md', onClick, className = '' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-lg',
  };

  const initials = (user.displayName || user.username)
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const baseClasses = `${sizeClasses[size]} rounded-full flex items-center justify-center font-bold uppercase ${className}`;

  if (user.avatarUrl) {
    return (
      <button 
        onClick={onClick}
        className={`${baseClasses} overflow-hidden`}
        type="button"
      >
        <img 
          src={user.avatarUrl} 
          alt={user.username}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to initials on image load error
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement!.innerHTML = initials;
          }}
        />
      </button>
    );
  }

  return (
    <button 
      onClick={onClick}
      className={`${baseClasses} bg-neutral-800 text-white border border-neutral-700`}
      type="button"
    >
      {initials}
    </button>
  );
};

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentView,
  onViewChange,
  user,
  onLogout,
  pendingSuggestionsCount = 0,
  isOnline = true,
  isOfflineAuthenticated = false,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Views that require network access
  const networkRequiredViews: View[] = ['TRENDING', 'SEARCH', 'FRIENDS', 'SUGGESTIONS'];

  const navItems: { id: View; label: string; requiresNetwork?: boolean }[] = [
    { id: 'WATCHLIST', label: 'WATCH' },
    { id: 'READLIST', label: 'READ' },
    { id: 'PLAYLIST', label: 'PLAY' },
    { id: 'TRENDING', label: 'HOT', requiresNetwork: true },
    { id: 'SEARCH', label: 'ADD', requiresNetwork: true },
    { id: 'FRIENDS', label: 'SOCIAL', requiresNetwork: true },
  ];

  const isAuthView = currentView === 'LOGIN' || currentView === 'REGISTER';
  
  // Check if navigation should be disabled for a view
  const isNavDisabled = (item: { id: View; requiresNetwork?: boolean }) => {
    return isOfflineAuthenticated && item.requiresNetwork;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDropdownAction = (action: 'settings' | 'logout') => {
    setShowDropdown(false);
    if (action === 'settings') {
      onViewChange('SETTINGS');
    } else if (action === 'logout' && onLogout) {
      onLogout();
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col max-w-2xl mx-auto border-x border-neutral-900 shadow-2xl shadow-neutral-900">
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-neutral-800">
        <div className="p-4 border-b border-neutral-800 flex justify-between items-center">
          <h1 className="text-xl font-bold tracking-widest uppercase">Watchlist</h1>
          <div className="flex items-center gap-3">
            {user && (
              <>
            {/* Downloads Icon */}
                <button
                  onClick={() => onViewChange('DOWNLOADS')}
                  className={`relative p-1 transition-colors ${
                    currentView === 'DOWNLOADS'
                      ? 'text-white'
                      : 'text-neutral-500 hover:text-white'
                  }`}
                  title="Downloads"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                </button>
                {/* Suggestions Bell Icon */}
                <button
                  onClick={() => !isOfflineAuthenticated && onViewChange('SUGGESTIONS')}
                  disabled={isOfflineAuthenticated}
                  className={`relative p-1 transition-colors ${
                    isOfflineAuthenticated
                      ? 'text-neutral-700 cursor-not-allowed'
                      : currentView === 'SUGGESTIONS'
                        ? 'text-white'
                        : 'text-neutral-500 hover:text-white'
                  }`}
                  title={isOfflineAuthenticated ? 'Requires internet connection' : 'Suggestions'}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  {pendingSuggestionsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-white text-black text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {pendingSuggestionsCount > 99 ? '99+' : pendingSuggestionsCount}
                    </span>
                  )}
                </button>
                <div className="relative" ref={dropdownRef}>
                <UserAvatar 
                  user={user} 
                  size="md" 
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="cursor-pointer hover:ring-2 hover:ring-neutral-600 transition-all"
                />
                
                {/* Dropdown Menu */}
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-black border border-neutral-800 shadow-xl z-50">
                    <div className="p-3 border-b border-neutral-800">
                      <p className="text-sm font-bold uppercase truncate">{user.username}</p>
                      <p className="text-xs text-neutral-500 truncate">{user.email}</p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => handleDropdownAction('settings')}
                        className="w-full px-4 py-3 text-left text-xs uppercase tracking-wider text-neutral-400 hover:bg-neutral-900 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </button>
                      <button
                        onClick={() => handleDropdownAction('logout')}
                        className="w-full px-4 py-3 text-left text-xs uppercase tracking-wider text-neutral-400 hover:bg-neutral-900 hover:text-red-500 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </>
            )}
            <div
              className={`w-2 h-2 ${user ? (isOnline ? 'bg-green-500' : 'bg-red-500') : 'bg-yellow-500'} animate-pulse`}
              title={user ? (isOnline ? 'Online' : 'Offline') : 'Not logged in'}
            ></div>
            {!isOnline && user && (
              <span className="text-xs text-red-500 uppercase tracking-wider hidden sm:inline">
                Offline
              </span>
            )}
          </div>
        </div>

        {/* Only show nav when logged in */}
        {user && !isAuthView && (
          <nav className="grid grid-cols-6 divide-x divide-neutral-800">
            {navItems.map((item) => {
              const disabled = isNavDisabled(item);
              return (
                <button
                  key={item.id}
                  onClick={() => !disabled && onViewChange(item.id)}
                  disabled={disabled}
                  className={`py-4 text-xs sm:text-sm font-bold tracking-wider transition-colors uppercase
                  ${disabled 
                    ? 'text-neutral-700 cursor-not-allowed' 
                    : 'hover:bg-neutral-900'
                  }
                  ${!disabled && (currentView === item.id ||
                      (currentView === 'FRIEND_VIEW' && item.id === 'FRIENDS') ||
                      (currentView === 'SUGGESTIONS' && item.id === 'FRIENDS'))
                      ? 'bg-white text-black'
                      : disabled ? '' : 'text-neutral-500'
                    }`}
                  title={disabled ? 'Requires internet connection' : undefined}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      <main className="flex-grow p-4 sm:p-6">{children}</main>

      <footer className="p-6 border-t border-neutral-800 text-center text-xs text-neutral-600 uppercase tracking-widest">
        <p>idk what to put here</p>
      </footer>
    </div>
  );
};

// Export UserAvatar for use in other components
export { UserAvatar };
