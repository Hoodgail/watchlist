import {
  ANIME_PROVIDERS,
  MOVIE_PROVIDERS,
  MANGA_PROVIDERS,
  PROVIDER_INFO,
} from '@shared/providers';
import type { ProviderName, VideoProviderName } from '../../types';

export type MangaProviderName =
  | 'mangadex'
  | 'mangahere'
  | 'mangapill'
  | 'comick'
  | 'mangareader'
  | 'asurascans'
  | 'anilist-manga';

export const ALL_VIDEO_PROVIDERS: VideoProviderName[] = [...ANIME_PROVIDERS, ...MOVIE_PROVIDERS];
export const ALL_MANGA_PROVIDERS: MangaProviderName[] = [...MANGA_PROVIDERS, 'anilist-manga'];
function metadata<K extends keyof typeof PROVIDER_INFO>(
  names: readonly K[],
  field: 'displayName' | 'baseUrl',
): Record<K, string> {
  return Object.fromEntries(
    names.map((name) => [name, PROVIDER_INFO[name][field] || '']),
  ) as Record<K, string>;
}
export const VIDEO_PROVIDER_DISPLAY_NAMES = metadata(ALL_VIDEO_PROVIDERS, 'displayName');
export const VIDEO_PROVIDER_BASE_URLS = metadata(ALL_VIDEO_PROVIDERS, 'baseUrl');
export const MANGA_PROVIDER_DISPLAY_NAMES = metadata(ALL_MANGA_PROVIDERS, 'displayName');
export const MANGA_PROVIDER_BASE_URLS = metadata(ALL_MANGA_PROVIDERS, 'baseUrl');
export const GENERIC_PROVIDER_DISPLAY_NAMES: Partial<Record<ProviderName, string>> = metadata(
  Object.keys(PROVIDER_INFO) as (keyof typeof PROVIDER_INFO)[],
  'displayName',
);
export const GENERIC_PROVIDER_BASE_URLS: Partial<Record<ProviderName, string>> = metadata(
  Object.keys(PROVIDER_INFO) as (keyof typeof PROVIDER_INFO)[],
  'baseUrl',
);

export function isVideoProviderName(provider: string): provider is VideoProviderName {
  return Object.hasOwn(VIDEO_PROVIDER_DISPLAY_NAMES, provider);
}

export function isMangaProviderName(provider: string): provider is MangaProviderName {
  return Object.hasOwn(MANGA_PROVIDER_DISPLAY_NAMES, provider);
}

export function getVideoProviderDisplayName(provider: VideoProviderName): string {
  return VIDEO_PROVIDER_DISPLAY_NAMES[provider] ?? provider;
}

export function getMangaProviderDisplayName(provider: MangaProviderName): string {
  return MANGA_PROVIDER_DISPLAY_NAMES[provider] ?? provider;
}

export function getProviderDisplayName(provider: ProviderName | MangaProviderName): string {
  if (isVideoProviderName(provider)) {
    return getVideoProviderDisplayName(provider);
  }

  if (isMangaProviderName(provider)) {
    return getMangaProviderDisplayName(provider);
  }

  return GENERIC_PROVIDER_DISPLAY_NAMES[provider as ProviderName] ?? provider;
}

export function getProviderBaseUrl(provider: ProviderName | MangaProviderName): string | undefined {
  if (isVideoProviderName(provider)) {
    return VIDEO_PROVIDER_BASE_URLS[provider];
  }

  if (isMangaProviderName(provider)) {
    return MANGA_PROVIDER_BASE_URLS[provider];
  }

  return GENERIC_PROVIDER_BASE_URLS[provider as ProviderName];
}
