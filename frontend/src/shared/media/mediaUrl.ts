import type { ProviderName } from '../../../types';
import { getProxiedImageUrl, resolveTmdbImageUrl } from './imageProxy';
import { getProviderBaseUrl, type MangaProviderName } from './providerMetadata';
import { extractProviderFromRefId } from './refId';

export function resolveMediaImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) {
    return null;
  }

  if (imageUrl.startsWith('/')) {
    return resolveTmdbImageUrl(imageUrl);
  }

  return imageUrl;
}

export function getProviderImageUrl(
  imageUrl: string | null | undefined,
  provider?: ProviderName | MangaProviderName,
): string | null {
  const resolvedImageUrl = resolveMediaImageUrl(imageUrl);

  if (!resolvedImageUrl) {
    return null;
  }

  return getProxiedImageUrl(
    resolvedImageUrl,
    provider ? getProviderBaseUrl(provider) : undefined,
  );
}

export function getRefIdImageUrl(
  imageUrl: string | null | undefined,
  refId?: string | null,
): string | null {
  const provider = refId ? extractProviderFromRefId(refId) : null;
  return getProviderImageUrl(imageUrl, provider ?? undefined);
}
