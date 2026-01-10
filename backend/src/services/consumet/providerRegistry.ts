/**
 * Provider Registry - Factory pattern for all Consumet providers
 */

import { 
  ProviderName, 
  ProviderInfo, 
  MediaCategory,
  AnimeProviderName,
  MovieProviderName,
  MangaProviderName,
  MetaProviderName,
  BookProviderName,
  LightNovelProviderName,
  ComicProviderName,
} from './types.js';

// ============ Provider Metadata ============

export const PROVIDER_INFO: Record<ProviderName, ProviderInfo> = {
  // Anime providers
  hianime: {
    name: 'hianime',
    displayName: 'HiAnime',
    category: 'anime',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://hianime.to',
  },
  animepahe: {
    name: 'animepahe',
    displayName: 'AnimePahe',
    category: 'anime',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://animepahe.com',
  },
  animekai: {
    name: 'animekai',
    displayName: 'AnimeKai',
    category: 'anime',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://animekai.to',
  },
  kickassanime: {
    name: 'kickassanime',
    displayName: 'KickAssAnime',
    category: 'anime',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://kickassanime.am',
  },

  // Movie providers
  flixhq: {
    name: 'flixhq',
    displayName: 'FlixHQ',
    category: 'movie',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://flixhq.to',
    supportedTypes: ['movie', 'tv'],
  },
  goku: {
    name: 'goku',
    displayName: 'Goku',
    category: 'movie',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://goku.sx',
    supportedTypes: ['movie', 'tv'],
  },
  sflix: {
    name: 'sflix',
    displayName: 'SFlix',
    category: 'movie',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://sflix.to',
    supportedTypes: ['movie', 'tv'],
  },
  himovies: {
    name: 'himovies',
    displayName: 'HiMovies',
    category: 'movie',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://himovies.to',
    supportedTypes: ['movie', 'tv'],
  },
  dramacool: {
    name: 'dramacool',
    displayName: 'DramaCool',
    category: 'movie',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://dramacool.ee',
    supportedTypes: ['movie', 'tv'],
  },

  // Manga providers
  mangadex: {
    name: 'mangadex',
    displayName: 'MangaDex',
    category: 'manga',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://mangadex.org',
  },
  mangahere: {
    name: 'mangahere',
    displayName: 'MangaHere',
    category: 'manga',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://mangahere.cc',
  },
  mangapill: {
    name: 'mangapill',
    displayName: 'MangaPill',
    category: 'manga',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://mangapill.com',
  },
  comick: {
    name: 'comick',
    displayName: 'ComicK',
    category: 'manga',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://comick.io',
  },
  mangareader: {
    name: 'mangareader',
    displayName: 'MangaReader',
    category: 'manga',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://mangareader.to',
  },
  asurascans: {
    name: 'asurascans',
    displayName: 'AsuraScans',
    category: 'manga',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://asuracomic.net',
  },

  // Meta providers
  anilist: {
    name: 'anilist',
    displayName: 'AniList',
    category: 'anime',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://anilist.co',
  },
  'anilist-manga': {
    name: 'anilist-manga',
    displayName: 'AniList Manga',
    category: 'manga',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://anilist.co',
  },
  tmdb: {
    name: 'tmdb',
    displayName: 'TMDB',
    category: 'movie',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://www.themoviedb.org',
    supportedTypes: ['movie', 'tv'],
  },
  myanimelist: {
    name: 'myanimelist',
    displayName: 'MyAnimeList',
    category: 'anime',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://myanimelist.net',
  },

  // Book providers
  libgen: {
    name: 'libgen',
    displayName: 'Library Genesis',
    category: 'book',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://libgen.is',
  },

  // Light Novel providers
  novelupdates: {
    name: 'novelupdates',
    displayName: 'NovelUpdates',
    category: 'lightnovel',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://www.novelupdates.com',
  },

  // Comic providers
  getcomics: {
    name: 'getcomics',
    displayName: 'GetComics',
    category: 'comic',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://getcomics.info',
  },

  // News providers
  animenewsnetwork: {
    name: 'animenewsnetwork',
    displayName: 'Anime News Network',
    category: 'news',
    language: 'en',
    isWorking: true,
    baseUrl: 'https://animenewsnetwork.com',
  },
};

// ============ Provider Lists by Category ============

export const ANIME_PROVIDERS: AnimeProviderName[] = [
  'hianime',
  'animepahe',
  'animekai',
  'kickassanime',
];

export const MOVIE_PROVIDERS: MovieProviderName[] = [
  'flixhq',
  'goku',
  'sflix',
  'himovies',
  'dramacool',
];

export const MANGA_PROVIDERS: MangaProviderName[] = [
  'mangadex',
  'mangahere',
  'mangapill',
  'comick',
  'mangareader',
  'asurascans',
];

export const META_ANIME_PROVIDERS: MetaProviderName[] = ['anilist', 'myanimelist'];
export const META_MANGA_PROVIDERS: MetaProviderName[] = ['anilist-manga'];
export const META_MOVIE_PROVIDERS: MetaProviderName[] = ['tmdb'];

export const BOOK_PROVIDERS: BookProviderName[] = ['libgen'];
export const LIGHTNOVEL_PROVIDERS: LightNovelProviderName[] = ['novelupdates'];
export const COMIC_PROVIDERS: ComicProviderName[] = ['getcomics'];

// ============ Helper Functions ============

export function getProviderInfo(name: ProviderName): ProviderInfo | undefined {
  return PROVIDER_INFO[name];
}

export function getProvidersByCategory(category: MediaCategory): ProviderInfo[] {
  return Object.values(PROVIDER_INFO).filter(p => p.category === category);
}

export function getAllProviders(): ProviderInfo[] {
  return Object.values(PROVIDER_INFO);
}

export function isValidProvider(name: string): name is ProviderName {
  return name in PROVIDER_INFO;
}

export function getDefaultProvider(category: MediaCategory): ProviderName {
  switch (category) {
    case 'anime':
      return 'anilist';
    case 'movie':
    case 'tv':
      return 'flixhq';
    case 'manga':
      return 'mangadex';
    case 'book':
      return 'libgen';
    case 'lightnovel':
      return 'novelupdates';
    case 'comic':
      return 'getcomics';
    case 'news':
      return 'animenewsnetwork';
    default:
      return 'anilist';
  }
}
