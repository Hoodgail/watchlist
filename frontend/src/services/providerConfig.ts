import {
  ANIME_PROVIDERS as anime,
  MOVIE_PROVIDERS as movies,
  PROVIDER_INFO,
  isProviderEnabled,
} from '@shared/providers';
import type { VideoProviderName } from '@/types';
export { VIDEO_PROVIDER_BASE_URLS } from '@/shared/media';
export type ProviderStatus = 'working' | 'partial' | 'broken' | 'unverified';
export type ProviderInfo = {
  name: VideoProviderName;
  displayName: string;
  status: ProviderStatus;
  sourcesWork: boolean;
  notes: string;
};
const describe = (name: VideoProviderName): ProviderInfo => ({
  name,
  displayName: PROVIDER_INFO[name].displayName,
  status: 'unverified',
  sourcesWork: isProviderEnabled(name),
  notes: PROVIDER_INFO[name].reason,
});
export const ANIME_PROVIDERS = anime.map(describe);
export const MOVIE_PROVIDERS = movies.map(describe);
export const ALL_VIDEO_PROVIDERS: VideoProviderName[] = [...anime, ...movies];
export const getAnimeProviderRanking = (): VideoProviderName[] => anime.filter(isProviderEnabled);
export const getMovieProviderRanking = (): VideoProviderName[] => movies.filter(isProviderEnabled);
export const getWorkingProviders = (type: 'anime' | 'movie' | 'tv') =>
  type === 'anime' ? getAnimeProviderRanking() : getMovieProviderRanking();
export function getPrimaryProvider(type: 'anime' | 'movie' | 'tv'): VideoProviderName {
  const provider = getWorkingProviders(type)[0];
  if (!provider) throw new Error('No playback provider is enabled. See provider availability.');
  return provider;
}
export const getFallbackProviders = (type: 'anime' | 'movie' | 'tv') =>
  getWorkingProviders(type).slice(1);
export const getProviderInfo = (name: VideoProviderName) => describe(name);
export const isProviderWorking = isProviderEnabled;
export const getProviderDisplayName = (name: VideoProviderName) => PROVIDER_INFO[name].displayName;
export const getProviderBaseUrl = (name: VideoProviderName) => PROVIDER_INFO[name].baseUrl!;
export const DEFAULT_ANIME_PROVIDERS = getAnimeProviderRanking();
export const DEFAULT_MOVIE_PROVIDERS = getMovieProviderRanking();
