import type { CatalogMediaGateway } from '../ports/CatalogMediaGateway.js';

export interface GetEpisodeSourcesQuery {
  provider: string;
  episodeId: string;
  mediaId?: string;
}

export function createGetEpisodeSourcesUseCase(dependencies: { mediaGateway: CatalogMediaGateway }) {
  return async function getEpisodeSources(query: GetEpisodeSourcesQuery): Promise<unknown> {
    return dependencies.mediaGateway.getEpisodeSources(query.episodeId, query.provider, query.mediaId);
  };
}
