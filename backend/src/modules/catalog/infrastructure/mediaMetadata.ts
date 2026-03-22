import { parseRefId } from '@shared/refId.js';
import { getAnilistAnimeInfo, getAnilistMangaInfo, getTMDBInfo } from '../../../services/consumet/metaProviders.js';
import * as rawgService from '../../../services/rawgService.js';
import { BadRequestError } from '../../../utils/errors.js';
import type { MediaType } from '@prisma/client';

const SUPPORTED_META_SOURCES = ['tmdb', 'anilist', 'anilist-manga', 'rawg'] as const;
const COMING_SOON_TYPES: MediaType[] = ['BOOK', 'LIGHT_NOVEL', 'COMIC'];

type MetaSource = typeof SUPPORTED_META_SOURCES[number];

export interface MediaMetadata {
  title: string;
  imageUrl: string | null;
  total: number | null;
  year: number | null;
  releaseDate: string | null;
  description: string | null;
  genres: string[];
  platforms: string[];
  playtimeHours: number | null;
}

function isMetaSource(source: string): source is MetaSource {
  return SUPPORTED_META_SOURCES.includes(source as MetaSource);
}

function getTMDBMediaType(type: MediaType): 'movie' | 'tv' {
  return type === 'MOVIE' ? 'movie' : 'tv';
}

export async function fetchMediaMetadata(refId: string, type: MediaType): Promise<MediaMetadata> {
  if (COMING_SOON_TYPES.includes(type)) {
    throw new BadRequestError(`${type.replace('_', ' ')} support coming soon`);
  }

  const parsed = parseRefId(refId);
  if (!parsed) {
    throw new BadRequestError(`Invalid refId format: ${refId}`);
  }

  const { source, id } = parsed;
  if (!isMetaSource(source)) {
    throw new BadRequestError(
      `Provider "${source}" is not supported for automatic metadata. Supported: tmdb (movies/TV), anilist (anime), anilist-manga (manga), rawg (games).`,
    );
  }

  let info;
  switch (source) {
    case 'tmdb':
      info = await getTMDBInfo(id, getTMDBMediaType(type));
      break;
    case 'anilist':
      info = await getAnilistAnimeInfo(id);
      break;
    case 'anilist-manga':
      info = await getAnilistMangaInfo(id);
      break;
    case 'rawg': {
      const gameDetails = await rawgService.getGameDetails(id);
      if (gameDetails) {
        return {
          title: gameDetails.name,
          imageUrl: rawgService.getImageUrl(gameDetails.background_image, 'medium') || null,
          total: null,
          year: rawgService.extractYear(gameDetails.released) || null,
          releaseDate: gameDetails.released || null,
          description: gameDetails.description_raw || null,
          genres: rawgService.getGenreNames(gameDetails.genres),
          platforms: rawgService.getPlatformNames(gameDetails.platforms),
          playtimeHours: gameDetails.playtime || null,
        };
      }
      break;
    }
  }

  if (!info) {
    throw new BadRequestError(`Failed to fetch metadata for ${refId}. The provider may be unavailable.`);
  }

  let year: number | null = null;
  if (typeof info.year === 'number') {
    year = info.year;
  } else if (typeof info.releaseDate === 'number') {
    year = info.releaseDate;
  } else if (typeof info.releaseDate === 'string') {
    const parsedYear = parseInt(info.releaseDate, 10);
    if (!isNaN(parsedYear)) {
      year = parsedYear;
    }
  }

  let releaseDate: string | null = null;
  if (info.releaseDate !== undefined && info.releaseDate !== null) {
    releaseDate = String(info.releaseDate);
  }

  return {
    title: info.title || 'Unknown',
    imageUrl: info.image || null,
    total: info.totalEpisodes ?? info.totalChapters ?? null,
    year,
    releaseDate,
    description: info.description || null,
    genres: info.genres || [],
    platforms: [],
    playtimeHours: null,
  };
}
