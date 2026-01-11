/**
 * Media Source API
 */

import { SourceAlias } from '../../types';
import { API_BASE_URL, fetchWithAuth } from './client';

export interface MediaSourceWithAliases {
  id: string;
  refId: string;
  title: string;
  imageUrl: string | null;
  total: number | null;
  type: string;
  createdAt: string;
  updatedAt: string;
  aliases: SourceAlias[];
}

/**
 * Get a MediaSource with all its aliases
 * @param sourceId The MediaSource ID
 */
export async function getMediaSourceWithAliases(sourceId: string): Promise<MediaSourceWithAliases> {
  const response = await fetch(`${API_BASE_URL}/media/source/${encodeURIComponent(sourceId)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch media source');
  }

  return await response.json();
}

/**
 * Find a MediaSource by refId (checks both primary and aliases)
 * @param refId The refId to search for
 */
export async function findMediaSourceByRefId(refId: string): Promise<MediaSourceWithAliases | null> {
  const response = await fetch(`${API_BASE_URL}/media/source/by-ref/${encodeURIComponent(refId)}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to find media source');
  }

  return await response.json();
}

/**
 * Link a new refId as an alias to an existing MediaSource
 * @param sourceId The MediaSource ID to link to
 * @param newRefId The new refId to add as an alias
 */
export async function linkMediaSource(sourceId: string, newRefId: string): Promise<SourceAlias> {
  const response = await fetchWithAuth('/media/link', {
    method: 'POST',
    body: JSON.stringify({ sourceId, newRefId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to link media source');
  }

  return await response.json();
}

/**
 * Remove an alias from a MediaSource
 * @param aliasId The alias ID to remove
 */
export async function unlinkMediaSource(aliasId: string): Promise<void> {
  const response = await fetchWithAuth(`/media/alias/${encodeURIComponent(aliasId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to unlink media source');
  }
}
