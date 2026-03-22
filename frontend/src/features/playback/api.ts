import { fetchWithAuth, API_BASE_URL } from '@/shared/api/client';
import { SourceAlias } from '../../../types';

export interface WatchProgressData {
  id: string;
  mediaId: string;
  episodeId: string;
  episodeNumber: number | null;
  seasonNumber: number | null;
  currentTime: number;
  duration: number;
  provider: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateWatchProgressPayload {
  mediaId: string;
  episodeId?: string;
  episodeNumber?: number;
  seasonNumber?: number;
  currentTime: number;
  duration: number;
  provider: string;
  currentEpisode?: number;
  totalEpisodes?: number;
}

export async function updateWatchProgress(payload: UpdateWatchProgressPayload): Promise<WatchProgressData> {
  const response = await fetchWithAuth('/watch-progress', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update watch progress');
  }

  return await response.json();
}

export async function getAllWatchProgress(): Promise<WatchProgressData[]> {
  const response = await fetchWithAuth('/watch-progress');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch watch progress');
  }

  return await response.json();
}

export async function getWatchProgressForMedia(mediaId: string): Promise<WatchProgressData[]> {
  const response = await fetchWithAuth(`/watch-progress/${encodeURIComponent(mediaId)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch watch progress');
  }

  return await response.json();
}

export async function getWatchProgressForEpisode(mediaId: string, episodeId: string): Promise<WatchProgressData | null> {
  const response = await fetchWithAuth(
    `/watch-progress/${encodeURIComponent(mediaId)}/${encodeURIComponent(episodeId)}`,
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch watch progress');
  }

  return await response.json();
}

export async function deleteWatchProgressForMedia(mediaId: string): Promise<void> {
  const response = await fetchWithAuth(`/watch-progress/${encodeURIComponent(mediaId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete watch progress');
  }
}

export async function deleteWatchProgressForEpisode(mediaId: string, episodeId: string): Promise<void> {
  const response = await fetchWithAuth(
    `/watch-progress/${encodeURIComponent(mediaId)}/${encodeURIComponent(episodeId)}`,
    { method: 'DELETE' },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete watch progress');
  }
}

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

export async function getMediaSourceWithAliases(sourceId: string): Promise<MediaSourceWithAliases> {
  const response = await fetch(`${API_BASE_URL}/media/source/${encodeURIComponent(sourceId)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch media source');
  }

  return await response.json();
}

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

export async function unlinkMediaSource(aliasId: string): Promise<void> {
  const response = await fetchWithAuth(`/media/alias/${encodeURIComponent(aliasId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to unlink media source');
  }
}
