import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

const layoutMock = vi.fn();

vi.mock('@/app/layout/Layout', () => ({
  Layout: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    layoutMock(props);
    return <div data-testid="layout">{children}</div>;
  },
}));

vi.mock('@/app/components/AccountSecurityBanner', () => ({
  AccountSecurityBanner: ({ onSetupRecovery }: { onSetupRecovery: () => void }) => (
    <button onClick={onSetupRecovery}>setup recovery</button>
  ),
}));

describe('AppShell', () => {
  it('renders layout content and passes shell props through', () => {
    const onLogout = vi.fn();
    const onViewChange = vi.fn();

    render(
      <AppShell
        currentView="WATCHLIST"
        onViewChange={onViewChange}
        user={{
          id: 'user-1',
          username: 'tester',
          email: 'tester@example.com',
          hasPassword: true,
          recoveryEmailVerified: true,
          oauthProviders: [],
        }}
        onLogout={onLogout}
        pendingSuggestionsCount={3}
        isOnline={true}
        isOfflineAuthenticated={false}
        onSetupRecovery={vi.fn()}
        modalLayer={<div>modal layer</div>}
      >
        <div>main content</div>
      </AppShell>,
    );

    expect(screen.getByTestId('layout')).toBeInTheDocument();
    expect(screen.getByText('main content')).toBeInTheDocument();
    expect(screen.getByText('modal layer')).toBeInTheDocument();
    expect(layoutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        currentView: 'WATCHLIST',
        onViewChange,
        onLogout,
        pendingSuggestionsCount: 3,
        isOnline: true,
        isOfflineAuthenticated: false,
      }),
    );
  });

  it('wires recovery setup through the banner', () => {
    const onSetupRecovery = vi.fn();

    render(
      <AppShell
        currentView="WATCHLIST"
        onViewChange={vi.fn()}
        user={{
          id: 'user-1',
          username: 'tester',
          email: 'tester@example.com',
          hasPassword: false,
          recoveryEmailVerified: false,
          oauthProviders: ['discord'],
        }}
        onLogout={vi.fn()}
        pendingSuggestionsCount={0}
        isOnline={true}
        isOfflineAuthenticated={false}
        onSetupRecovery={onSetupRecovery}
      >
        <div>main content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByText('setup recovery'));
    expect(onSetupRecovery).toHaveBeenCalledTimes(1);
  });
});
