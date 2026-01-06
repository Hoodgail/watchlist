import React from 'react';
import { View, AuthUser } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: View;
  onViewChange: (view: View) => void;
  user: AuthUser | null;
  onLogout?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentView,
  onViewChange,
  user,
  onLogout,
}) => {
  const navItems: { id: View; label: string }[] = [
    { id: 'WATCHLIST', label: 'WATCH' },
    { id: 'READLIST', label: 'READ' },
    { id: 'SEARCH', label: 'ADD' },
    { id: 'FRIENDS', label: 'SOCIAL' },
  ];

  const isAuthView = currentView === 'LOGIN' || currentView === 'REGISTER';

  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col max-w-2xl mx-auto border-x border-neutral-900 shadow-2xl shadow-neutral-900">
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-neutral-800">
        <div className="p-4 border-b border-neutral-800 flex justify-between items-center">
          <h1 className="text-xl font-bold tracking-widest uppercase">Watchlist</h1>
          <div className="flex items-center gap-4">
            {user && (
              <>
                <span className="text-xs text-neutral-500 uppercase tracking-wider hidden sm:block">
                  {user.username}
                </span>
                <button
                  onClick={onLogout}
                  className="text-xs text-neutral-500 hover:text-white uppercase tracking-wider transition-colors"
                >
                  LOGOUT
                </button>
              </>
            )}
            <div
              className={`w-2 h-2 ${user ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}
              title={user ? 'Online' : 'Not logged in'}
            ></div>
          </div>
        </div>

        {/* Only show nav when logged in */}
        {user && !isAuthView && (
          <nav className="grid grid-cols-4 divide-x divide-neutral-800">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`py-4 text-xs sm:text-sm font-bold tracking-wider hover:bg-neutral-900 transition-colors uppercase
                ${currentView === item.id ||
                    (currentView === 'FRIEND_VIEW' && item.id === 'FRIENDS')
                    ? 'bg-white text-black'
                    : 'text-neutral-500'
                  }`}
              >
                {item.label}
              </button>
            ))}
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
