import type { ProviderName, VideoProviderName } from '../../../types';

export type MangaProviderName =
  | 'mangadex'
  | 'mangahere'
  | 'mangapill'
  | 'comick'
  | 'mangareader'
  | 'asurascans'
  | 'anilist-manga';

export const VIDEO_PROVIDER_DISPLAY_NAMES: Record<VideoProviderName, string> = {
  hianime: 'HiAnime',
  animepahe: 'AnimePahe',
  animekai: 'AnimeKai',
  kickassanime: 'KickAssAnime',
  flixhq: 'FlixHQ',
  goku: 'Goku',
  sflix: 'SFlix',
  himovies: 'HiMovies',
  dramacool: 'DramaCool',
};

export const VIDEO_PROVIDER_BASE_URLS: Record<VideoProviderName, string> = {
  hianime: 'https://hianime.to',
  animepahe: 'https://animepahe.com',
  animekai: 'https://animekai.to',
  kickassanime: 'https://kickassanime.am',
  flixhq: 'https://flixhq.to',
  goku: 'https://goku.sx',
  sflix: 'https://sflix.to',
  himovies: 'https://himovies.to',
  dramacool: 'https://dramacool.ee',
};

export const MANGA_PROVIDER_DISPLAY_NAMES: Record<MangaProviderName, string> = {
  mangadex: 'MangaDex',
  mangahere: 'MangaHere',
  mangapill: 'MangaPill',
  comick: 'ComicK',
  mangareader: 'MangaReader',
  asurascans: 'AsuraScans',
  'anilist-manga': 'AniList',
};

export const GENERIC_PROVIDER_DISPLAY_NAMES: Partial<Record<ProviderName, string>> = {
  anilist: 'AniList',
  tmdb: 'TMDB',
  libgen: 'Libgen',
  readlightnovels: 'ReadLightNovels',
  getcomics: 'GetComics',
  rawg: 'RAWG',
  mangakakalot: 'MangaKakalot',
};

export const MANGA_PROVIDER_BASE_URLS: Record<MangaProviderName, string> = {
  mangadex: 'https://mangadex.org',
  mangahere: 'https://mangahere.cc',
  mangapill: 'https://mangapill.com',
  comick: 'https://comick.io',
  mangareader: 'https://mangareader.to',
  asurascans: 'https://asuracomic.net',
  'anilist-manga': 'https://anilist.co',
};

export const GENERIC_PROVIDER_BASE_URLS: Partial<Record<ProviderName, string>> = {
  anilist: 'https://anilist.co',
  tmdb: 'https://www.themoviedb.org',
  libgen: 'https://libgen.is',
  readlightnovels: 'https://readlightnovels.net',
  getcomics: 'https://getcomics.info',
  rawg: 'https://rawg.io',
  mangakakalot: 'https://mangakakalot.com',
};

export const ALL_VIDEO_PROVIDERS = Object.keys(VIDEO_PROVIDER_DISPLAY_NAMES) as VideoProviderName[];
export const ALL_MANGA_PROVIDERS = Object.keys(MANGA_PROVIDER_DISPLAY_NAMES) as MangaProviderName[];

export function isVideoProviderName(provider: string): provider is VideoProviderName {
  return provider in VIDEO_PROVIDER_DISPLAY_NAMES;
}

export function isMangaProviderName(provider: string): provider is MangaProviderName {
  return provider in MANGA_PROVIDER_DISPLAY_NAMES;
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
