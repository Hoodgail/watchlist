/**
 * Watch Progress API
 */

import { fetchWithAuth } from './client';

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
  currentEpisode?: number;  // Absolute episode position (e.g., 42 for S2E20 of House)
  totalEpisodes?: number;   // Total episodes across all seasons
}

/**
 * Update or create watch progress for a media/episode
 */
export async function updateWatchProgress(
  payload: UpdateWatchProgressPayload
): Promise<WatchProgressData> {
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

/**
 * Get all watch progress for the current user
 */
export async function getAllWatchProgress(): Promise<WatchProgressData[]> {
  const response = await fetchWithAuth('/watch-progress');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch watch progress');
  }

  return await response.json();
}

/**
 * Get watch progress for a specific media (all episodes)
 */
export async function getWatchProgressForMedia(
  mediaId: string
): Promise<WatchProgressData[]> {
  const response = await fetchWithAuth(
    `/watch-progress/${encodeURIComponent(mediaId)}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch watch progress');
  }

  return await response.json();
}

/**
 * Get watch progress for a specific episode
 */
export async function getWatchProgressForEpisode(
  mediaId: string,
  episodeId: string
): Promise<WatchProgressData | null> {
  const response = await fetchWithAuth(
    `/watch-progress/${encodeURIComponent(mediaId)}/${encodeURIComponent(episodeId)}`
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

/**
 * Delete watch progress for a media (all episodes)
 */
export async function deleteWatchProgressForMedia(mediaId: string): Promise<void> {
  const response = await fetchWithAuth(
    `/watch-progress/${encodeURIComponent(mediaId)}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete watch progress');
  }
}

/**
 * Delete watch progress for a specific episode
 */
export async function deleteWatchProgressForEpisode(
  mediaId: string,
  episodeId: string
): Promise<void> {
  const response = await fetchWithAuth(
    `/watch-progress/${encodeURIComponent(mediaId)}/${encodeURIComponent(episodeId)}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete watch progress');
  }
}
