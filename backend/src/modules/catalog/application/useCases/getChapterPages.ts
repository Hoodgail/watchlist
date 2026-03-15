import type { CatalogMediaGateway } from '../ports/CatalogMediaGateway.js';

export interface GetChapterPagesQuery {
  provider: string;
  chapterId: string;
}

export function createGetChapterPagesUseCase(dependencies: { mediaGateway: CatalogMediaGateway }) {
  return async function getChapterPages(query: GetChapterPagesQuery): Promise<unknown> {
    return dependencies.mediaGateway.getChapterPages(query.chapterId, query.provider);
  };
}
