/**
 * Suggestions API
 */

import {
  MediaType,
  Suggestion,
  SuggestionStatus,
} from '../../types';
import { fetchWithAuth } from './client';

export interface SendSuggestionPayload {
  refId: string;
  type: MediaType;
  message?: string;
}

export async function getReceivedSuggestions(status?: SuggestionStatus): Promise<Suggestion[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetchWithAuth(`/suggestions/received${query}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch received suggestions');
  }

  return await response.json();
}

export async function getSentSuggestions(): Promise<Suggestion[]> {
  const response = await fetchWithAuth('/suggestions/sent');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch sent suggestions');
  }

  return await response.json();
}

export async function sendSuggestion(userId: string, suggestion: SendSuggestionPayload): Promise<Suggestion> {
  const response = await fetchWithAuth(`/suggestions/${userId}`, {
    method: 'POST',
    body: JSON.stringify(suggestion),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send suggestion');
  }

  return await response.json();
}

export async function acceptSuggestion(id: string): Promise<Suggestion> {
  const response = await fetchWithAuth(`/suggestions/${id}/accept`, {
    method: 'PATCH',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to accept suggestion');
  }

  return await response.json();
}

export async function dismissSuggestion(id: string): Promise<Suggestion> {
  const response = await fetchWithAuth(`/suggestions/${id}/dismiss`, {
    method: 'PATCH',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to dismiss suggestion');
  }

  return await response.json();
}

export async function deleteSuggestion(id: string): Promise<void> {
  const response = await fetchWithAuth(`/suggestions/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete suggestion');
  }
}
