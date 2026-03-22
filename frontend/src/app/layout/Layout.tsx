import React, { useState, useRef, useEffect } from 'react';
import { View, AuthUser } from '@/types';
import { UserAvatar } from '@/shared/ui';

export interface LayoutProps {
  children: React.ReactNode;
  currentView: View;
  onViewChange: (view: View) => void;
  user: AuthUser | null;
  onLogout?: () => void;
  pendingSuggestionsCount?: number;
  isOnline?: boolean;
  isOfflineAuthenticated?: boolean;
}

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

  const topNavItems: { id: View; label: string; requiresNetwork?: boolean }[] = [
    { id: 'WATCHLIST', label: 'Watch' },
    { id: 'READLIST', label: 'Read' },
    { id: 'PLAYLIST', label: 'Play' },
    { id: 'TRENDING', label: 'Trending', requiresNetwork: true },
    { id: 'DOWNLOADS', label: 'Offline' },
  ];

  const bottomNavItems: Array<{
    id: View;
    label: string;
    requiresNetwork?: boolean;
    icon: React.ReactNode;
  }> = [
    {
      id: 'WATCHLIST',
      label: 'Watch',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m10 9 5 3-5 3V9Z" />
        </svg>
      ),
    },
    {
      id: 'FRIENDS',
      label: 'Friends',
      requiresNetwork: true,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: 'COLLECTIONS',
      label: 'Lists',
      requiresNetwork: true,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h13" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 18h13" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h.01" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h.01" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 18h.01" />
        </svg>
      ),
    },
    {
      id: 'SETTINGS',
      label: 'Profile',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 21a8 8 0 1 0-16 0" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  // Views that require network access
  const networkRequiredViews: View[] = ['TRENDING', 'SEARCH', 'FRIENDS', 'SUGGESTIONS', 'COLLECTIONS'];

  const isAuthView = currentView === 'LOGIN' || currentView === 'REGISTER';

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

  const viewMeta: Partial<Record<View, { eyebrow: string; title: React.ReactNode; subtitle: string }>> = {
    WATCHLIST: {
      eyebrow: greeting,
      title: <>Your <span className="app-title-accent">Reelz</span></>,
      subtitle: 'Track the next episode, revisit favorites, and keep the queue moving.',
    },
    READLIST: {
      eyebrow: 'Reading room',
      title: <>Your <span className="app-title-accent">Chapters</span></>,
      subtitle: 'Follow manga progress, bookmark arcs, and keep your reading streak intact.',
    },
    PLAYLIST: {
      eyebrow: 'Controller ready',
      title: <>Your <span className="app-title-accent">Backlog</span></>,
      subtitle: 'Keep games, sessions, and finish rates in one place.',
    },
    SEARCH: {
      eyebrow: 'Add something new',
      title: <>Find your <span className="app-title-accent">next pick</span></>,
      subtitle: 'Search across movies, shows, anime, manga, and games without leaving the app shell.',
    },
    TRENDING: {
      eyebrow: 'Fresh picks',
      title: <>What&apos;s <span className="app-title-accent">trending</span></>,
      subtitle: 'Browse the loudest releases and quick-add what deserves a slot.',
    },
    FRIENDS: {
      eyebrow: 'Social reel',
      title: <>Friend <span className="app-title-accent">activity</span></>,
      subtitle: 'See what your circle is watching, reading, rating, and recommending.',
    },
    FRIEND_VIEW: {
      eyebrow: 'Shared taste',
      title: <>Friend <span className="app-title-accent">lists</span></>,
      subtitle: 'Browse another shelf and pull standout picks into your own watchlist.',
    },
    SUGGESTIONS: {
      eyebrow: 'Inbox',
      title: <>Incoming <span className="app-title-accent">suggestions</span></>,
      subtitle: 'Review what friends think deserves your time next.',
    },
    SETTINGS: {
      eyebrow: 'Profile controls',
      title: <>Account <span className="app-title-accent">details</span></>,
      subtitle: 'Tighten recovery options, privacy, and connection settings.',
    },
    DOWNLOADS: {
      eyebrow: 'Offline vault',
      title: <>Saved for <span className="app-title-accent">later</span></>,
      subtitle: 'Keep downloaded chapters and episodes ready when the connection disappears.',
    },
    COLLECTIONS: {
      eyebrow: 'Curated shelves',
      title: <>Custom <span className="app-title-accent">lists</span></>,
      subtitle: 'Build themed collections, share picks, and keep favorites grouped together.',
    },
    COLLECTION_VIEW: {
      eyebrow: 'Curated shelf',
      title: <>Collection <span className="app-title-accent">view</span></>,
      subtitle: 'Edit, browse, and expand a focused set of recommendations.',
    },
  };

  const activeMeta = viewMeta[currentView] ?? viewMeta.WATCHLIST!;
  
  // Check if navigation should be disabled for a view
  const isNavDisabled = (item: { id: View; requiresNetwork?: boolean }) => {
    return isOfflineAuthenticated && item.requiresNetwork;
  };

  const isNavActive = (itemId: View) => {
    if (itemId === 'FRIENDS' && (currentView === 'FRIEND_VIEW' || currentView === 'SUGGESTIONS')) return true;
    if (itemId === 'COLLECTIONS' && currentView === 'COLLECTION_VIEW') return true;
    return currentView === itemId;
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
    <div className="app-theme">
      <div className="app-device">
        <div className="app-statusbar">
          <span className="app-statusbar-time">9:41</span>
          <div className="app-dynamic-island" />
          <div className="app-statusbar-right">
            <span
              className={`app-status-dot ${user ? (isOnline ? 'online' : 'offline') : 'online'}`}
              title={user ? (isOnline ? 'Online' : 'Offline') : 'Ready'}
            />
          </div>
        </div>

        <header className="app-header">
          <div className="app-header-top">
            <div>
              <div className="app-eyebrow">{activeMeta.eyebrow}</div>
              <h1 className="app-title">{activeMeta.title}</h1>
              <p className="app-subtitle">{activeMeta.subtitle}</p>
            </div>

            {user && (
              <div className="app-header-actions">
                <button
                  onClick={() => onViewChange('DOWNLOADS')}
                  className={`app-icon-button ${currentView === 'DOWNLOADS' ? 'active' : ''}`}
                  title="Downloads"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 21h14" />
                  </svg>
                </button>

                <button
                  onClick={() => !isOfflineAuthenticated && onViewChange('SUGGESTIONS')}
                  disabled={isOfflineAuthenticated}
                  className={`app-icon-button ${currentView === 'SUGGESTIONS' ? 'active' : ''}`}
                  title={isOfflineAuthenticated ? 'Requires internet connection' : 'Suggestions'}
                >
                  <div className="app-action-wrap">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 17a2 2 0 0 0 4 0" />
                    </svg>
                    {pendingSuggestionsCount > 0 && (
                      <span className="app-icon-badge">{pendingSuggestionsCount > 99 ? '99+' : pendingSuggestionsCount}</span>
                    )}
                  </div>
                </button>

                <div className="relative" ref={dropdownRef}>
                  <UserAvatar
                    username={user.username}
                    displayName={user.displayName}
                    avatarUrl={user.avatarUrl}
                    size="md"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="app-avatar-button"
                    fallbackClassName="bg-neutral-800 text-white border border-neutral-700"
                  />

                  {showDropdown && (
                    <div className="app-dropdown">
                      <div className="app-dropdown-head">
                        <div className="app-dropdown-name">{user.displayName || user.username}</div>
                        <div className="app-dropdown-email">{user.email}</div>
                      </div>
                      <button onClick={() => handleDropdownAction('settings')} className="app-dropdown-action">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="3" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c0 .7.4 1.3 1 1.5h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
                        </svg>
                        Settings
                      </button>
                      <button onClick={() => handleDropdownAction('logout')} className="app-dropdown-action danger">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16 17 5-5-5-5" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12H9" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
                        </svg>
                        Log out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {user && !isAuthView && (
            <div className="app-toolbar">
              <button
                type="button"
                onClick={() => !isOfflineAuthenticated && onViewChange('SEARCH')}
                disabled={isOfflineAuthenticated}
                className="app-search-cta"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m20 20-3.5-3.5" />
                </svg>
                <span>{isOfflineAuthenticated ? 'Search requires connection' : 'Search shows, movies, manga, games...'}</span>
              </button>

              <div className="app-pill-row">
                {topNavItems.map((item) => {
                  const disabled = isNavDisabled(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => !disabled && onViewChange(item.id)}
                      disabled={disabled}
                      className={`app-pill ${isNavActive(item.id) ? 'active' : ''} ${disabled ? 'dimmed' : ''}`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </header>

        <main className="app-main">
          <div className="app-main-inner">{children}</div>
        </main>

        {user && !isAuthView && (
          <nav className="app-bottom-nav">
            {bottomNavItems.slice(0, 2).map((item) => {
              const disabled = isNavDisabled(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => !disabled && onViewChange(item.id)}
                  disabled={disabled}
                  className={`app-nav-btn ${isNavActive(item.id) ? 'active' : ''}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => !isOfflineAuthenticated && onViewChange('SEARCH')}
              disabled={isOfflineAuthenticated}
              className="app-nav-fab"
              title={isOfflineAuthenticated ? 'Requires internet connection' : 'Add media'}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
              </svg>
            </button>

            {bottomNavItems.slice(2).map((item) => {
              const disabled = isNavDisabled(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => !disabled && onViewChange(item.id)}
                  disabled={disabled}
                  className={`app-nav-btn ${isNavActive(item.id) ? 'active' : ''}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
};

export { UserAvatar };
