import type { LibraryBulkStatusMap } from '../dto/library.js';
import type { LibraryListGateway } from '../ports/LibraryListGateway.js';

export interface GetStatusesByRefIdsQuery {
  userId: string;
  refIds: string[];
}

export function createGetStatusesByRefIdsUseCase(dependencies: { listGateway: LibraryListGateway }) {
  return async function getStatusesByRefIds(query: GetStatusesByRefIdsQuery): Promise<LibraryBulkStatusMap> {
    return dependencies.listGateway.getStatusesByRefIds(query.userId, query.refIds);
  };
}
