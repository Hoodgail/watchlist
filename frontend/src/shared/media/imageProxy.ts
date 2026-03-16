import { buildApiUrl } from '@/shared/api/client';

export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export function resolveTmdbImageUrl(path: string | null | undefined, size: string = 'w200'): string | null {
  if (!path) {
    return null;
  }

  if (/^https?:\/\//.test(path)) {
    return path;
  }

  if (!path.startsWith('/')) {
    return `${TMDB_IMAGE_BASE_URL}/${size}/${path}`;
  }

  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

export function shouldBypassImageProxy(url: string, skipProxy?: boolean): boolean {
  if (skipProxy) {
    return true;
  }

  return url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('/api/') || url.includes('image.tmdb.org');
}

export function getProxiedImageUrl(
  url: string | null | undefined,
  referer?: string,
  skipProxy?: boolean,
): string | null {
  if (!url) {
    return null;
  }

  if (shouldBypassImageProxy(url, skipProxy)) {
    return url;
  }

  const params = new URLSearchParams({ url });
  if (referer) {
    params.set('referer', referer);
  }

  return `${buildApiUrl('/proxy/image')}?${params.toString()}`;
}

export function getMangaPlusImageProxyUrl(url: string, key: string): string {
  const params = new URLSearchParams({ url, key });
  return `${buildApiUrl('/manga/external/mangaplus/image')}?${params.toString()}`;
}
