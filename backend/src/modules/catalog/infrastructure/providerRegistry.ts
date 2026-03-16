import type { ProviderInfo, ProviderName, MediaCategory as ConsumetMediaCategory } from '../../../services/consumet/types.js';
import {
  ANIME_PROVIDERS,
  GAME_PROVIDERS,
  MANGA_PROVIDERS,
  getAllProviders,
  getProviderInfo,
  getProvidersByCategory,
  isValidProvider,
} from '../../../services/consumet/providerRegistry.js';

export { ANIME_PROVIDERS, GAME_PROVIDERS, MANGA_PROVIDERS, getProviderInfo, isValidProvider };
export type { ProviderInfo, ProviderName, ConsumetMediaCategory };

export function getCatalogProviders(category?: ConsumetMediaCategory): ProviderInfo[] {
  if (!category) {
    return getAllProviders();
  }
  return getProvidersByCategory(category);
}
