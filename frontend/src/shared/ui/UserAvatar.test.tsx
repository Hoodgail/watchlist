import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UserAvatar } from './UserAvatar';

describe('UserAvatar', () => {
  it('renders initials fallback', () => {
    render(<UserAvatar username="tester_user" displayName="Test User" />);
    expect(screen.getByText('TU')).toBeInTheDocument();
  });

  it('falls back after image error', () => {
    render(<UserAvatar username="tester" avatarUrl="https://example.com/avatar.png" />);
    fireEvent.error(screen.getByAltText('tester'));
    expect(screen.getByText('TE')).toBeInTheDocument();
  });
});
