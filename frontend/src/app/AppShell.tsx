import React from 'react';
import { AccountSecurityBanner } from '@/app/components/AccountSecurityBanner';
import { Layout } from '@/app/layout/Layout';
import type { AuthUser, View } from '@/types';

export interface AppShellProps {
  currentView: View;
  onViewChange: (view: View) => void;
  user: AuthUser;
  onLogout: () => void;
  pendingSuggestionsCount: number;
  isOnline: boolean;
  isOfflineAuthenticated: boolean;
  onSetupRecovery: () => void;
  children: React.ReactNode;
  modalLayer?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentView,
  onViewChange,
  user,
  onLogout,
  pendingSuggestionsCount,
  isOnline,
  isOfflineAuthenticated,
  onSetupRecovery,
  children,
  modalLayer,
}) => {
  return (
    <Layout
      currentView={currentView}
      onViewChange={onViewChange}
      user={user}
      onLogout={onLogout}
      pendingSuggestionsCount={pendingSuggestionsCount}
      isOnline={isOnline}
      isOfflineAuthenticated={isOfflineAuthenticated}
    >
      <AccountSecurityBanner onSetupRecovery={onSetupRecovery} />
      {children}
      {modalLayer}
    </Layout>
  );
};

export default AppShell;
