import { PublicProfile } from '../../../types';
import { API_BASE_URL, fetchWithAuth } from '@/shared/api/client';

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

export interface ProviderMapping {
  id: string;
  refId: string;
  provider: string;
  providerId: string;
  providerTitle: string;
  confidence: number;
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getProviderMapping(refId: string, provider: string): Promise<ProviderMapping | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/provider-mappings/${encodeURIComponent(refId)}/${encodeURIComponent(provider)}`,
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch provider mapping');
    }

    return await response.json();
  } catch (error) {
    console.error('[getProviderMapping] Error:', error);
    return null;
  }
}

export async function getProviderMappings(refId: string): Promise<ProviderMapping[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/provider-mappings/${encodeURIComponent(refId)}`);

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('[getProviderMappings] Error:', error);
    return [];
  }
}

export async function saveProviderMapping(
  refId: string,
  provider: string,
  providerId: string,
  providerTitle: string,
): Promise<ProviderMapping> {
  const response = await fetchWithAuth('/provider-mappings', {
    method: 'POST',
    body: JSON.stringify({ refId, provider, providerId, providerTitle }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save provider mapping');
  }

  return await response.json();
}

export async function saveAutoMapping(
  refId: string,
  provider: string,
  providerId: string,
  providerTitle: string,
  confidence: number,
): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/provider-mappings/auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refId, provider, providerId, providerTitle, confidence }),
    });
  } catch (error) {
    console.error('[saveAutoMapping] Error:', error);
  }
}

export async function deleteProviderMapping(refId: string, provider: string): Promise<void> {
  const response = await fetchWithAuth(
    `/provider-mappings/${encodeURIComponent(refId)}/${encodeURIComponent(provider)}`,
    { method: 'DELETE' },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete provider mapping');
  }
}
