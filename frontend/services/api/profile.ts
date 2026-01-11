/**
 * Profile & Privacy API
 */

import { PublicProfile } from '../../types';
import { fetchWithAuth } from './client';

export async function getPublicProfile(username: string): Promise<PublicProfile> {
  const response = await fetchWithAuth(`/profile/${encodeURIComponent(username)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch profile');
  }

  return await response.json();
}

export async function updatePrivacySettings(isPublic: boolean): Promise<{ isPublic: boolean }> {
  const response = await fetchWithAuth('/profile/settings/privacy', {
    method: 'PATCH',
    body: JSON.stringify({ isPublic }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update privacy settings');
  }

  return await response.json();
}

export async function getPrivacySettings(): Promise<{ isPublic: boolean }> {
  const response = await fetchWithAuth('/profile/settings/privacy');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch privacy settings');
  }

  return await response.json();
}
