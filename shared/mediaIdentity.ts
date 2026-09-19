import { parseRefId } from './refId.js';

export class InvalidMediaReferenceError extends Error {}

/** TMDB movie and TV IDs are separate namespaces. Never merge them by numeric ID. */
export function canonicalMediaRefId(refId: string, type: string): string {
  const parsed = parseRefId(refId);
  if (!parsed) throw new InvalidMediaReferenceError('Invalid media reference');
  if (parsed.source === 'consumet-anilist') return `anilist:${parsed.id}`;
  if (parsed.source !== 'tmdb') return refId;
  if (!['MOVIE', 'TV', 'ANIME'].includes(type))
    throw new InvalidMediaReferenceError('TMDB only identifies movies and TV');
  const kind = type === 'MOVIE' ? 'movie' : 'tv';
  const existing = /^(movie|tv)\/(\d+)$/.exec(parsed.id);
  if (existing && existing[1] !== kind)
    throw new InvalidMediaReferenceError('TMDB reference conflicts with media type');
  const id = existing ? existing[2] : parsed.id;
  if (!/^\d+$/.test(id)) throw new InvalidMediaReferenceError('Invalid TMDB ID');
  return `tmdb:${kind}/${id}`;
}

/** Scope opaque episode/chapter IDs to their provider and parent title. */
export function mediaPartKey(provider: string, mediaId: string, partId: string): string {
  return `${provider}:${encodeURIComponent(mediaId)}/${encodeURIComponent(partId)}`;
}

export function rawMediaPartId(provider: string, partId: string): string {
  if (!partId.startsWith(`${provider}:`)) return partId;
  const separator = partId.indexOf('/');
  if (separator < 0) throw new InvalidMediaReferenceError('Invalid media part reference');
  return decodeURIComponent(partId.slice(separator + 1));
}
