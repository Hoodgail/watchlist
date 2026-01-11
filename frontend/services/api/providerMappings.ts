/**
 * Provider Mapping API
 */

import { API_BASE_URL, fetchWithAuth } from './client';

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

/**
 * Get a stored mapping for a refId and provider
 * Returns null if no mapping exists
 */
export async function getProviderMapping(
  refId: string,
  provider: string
): Promise<ProviderMapping | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/provider-mappings/${encodeURIComponent(refId)}/${encodeURIComponent(provider)}`
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

/**
 * Get all mappings for a refId
 */
export async function getProviderMappings(refId: string): Promise<ProviderMapping[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/provider-mappings/${encodeURIComponent(refId)}`
    );

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('[getProviderMappings] Error:', error);
    return [];
  }
}

/**
 * Create or update a user-verified provider mapping
 * This is called when a user manually links a source
 */
export async function saveProviderMapping(
  refId: string,
  provider: string,
  providerId: string,
  providerTitle: string
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

/**
 * Save an auto-matched mapping (lower confidence)
 * Called by videoResolver when it finds a match via fuzzy search
 */
export async function saveAutoMapping(
  refId: string,
  provider: string,
  providerId: string,
  providerTitle: string,
  confidence: number
): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/provider-mappings/auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refId, provider, providerId, providerTitle, confidence }),
    });
  } catch (error) {
    // Non-critical, just log
    console.error('[saveAutoMapping] Error:', error);
  }
}

/**
 * Delete a provider mapping
 */
export async function deleteProviderMapping(
  refId: string,
  provider: string
): Promise<void> {
  const response = await fetchWithAuth(
    `/provider-mappings/${encodeURIComponent(refId)}/${encodeURIComponent(provider)}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete provider mapping');
  }
}
