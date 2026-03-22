import { createRefId, isSourceRefId, parseRefId } from '@shared/refId';
import { ALL_MANGA_PROVIDERS, ALL_VIDEO_PROVIDERS, type MangaProviderName } from './providerMetadata';
import type { ProviderName, VideoProviderName } from '../../../types';

export function extractProviderFromRefId(refId: string): ProviderName | null {
  return parseRefId(refId)?.source as ProviderName | null;
}

export function extractIdFromRefId(refId: string): string {
  return parseRefId(refId)?.id ?? refId;
}

export function createVideoRefId(mediaId: string, provider: VideoProviderName): string {
  return createRefId(provider, mediaId);
}

export function createMangaRefId(mangaId: string, provider: MangaProviderName): string {
  return createRefId(provider, mangaId);
}

export function parseVideoRefId(refId: string): { mediaId: string; provider: VideoProviderName } | null {
  const parsed = parseRefId(refId);
  if (!parsed || !ALL_VIDEO_PROVIDERS.includes(parsed.source as VideoProviderName)) {
    return null;
  }

  return {
    provider: parsed.source as VideoProviderName,
    mediaId: parsed.id,
  };
}

export function parseMangaRefId(refId: string): { provider: MangaProviderName; mangaId: string } | null {
  const parsed = parseRefId(refId);
  if (!parsed || !ALL_MANGA_PROVIDERS.includes(parsed.source as MangaProviderName)) {
    return null;
  }

  return {
    provider: parsed.source as MangaProviderName,
    mangaId: parsed.id,
  };
}

export function isVideoProviderRefId(refId: string): boolean {
  return parseVideoRefId(refId) !== null;
}

export function isMangaProviderRefId(refId: string, provider: MangaProviderName): boolean {
  return isSourceRefId(refId, provider);
}
