import type { CatalogMediaGateway } from '../ports/CatalogMediaGateway.js';

export interface GetEpisodeServersQuery {
  provider: string;
  episodeId: string;
  mediaId?: string;
}

export function createGetEpisodeServersUseCase(dependencies: { mediaGateway: CatalogMediaGateway }) {
  return async function getEpisodeServers(query: GetEpisodeServersQuery): Promise<unknown> {
    return dependencies.mediaGateway.getEpisodeServers(query.episodeId, query.provider, query.mediaId);
  };
}
