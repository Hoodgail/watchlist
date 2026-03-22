import type { LibraryListGateway } from '../ports/LibraryListGateway.js';
import type { LibraryListFilters, LibraryPaginatedList } from '../dto/library.js';

export interface GetUserListQuery {
  userId: string;
  filters?: LibraryListFilters;
}

export function createGetUserListUseCase(dependencies: { listGateway: LibraryListGateway }) {
  return async function getUserList(query: GetUserListQuery): Promise<LibraryPaginatedList> {
    return dependencies.listGateway.getUserList(query.userId, query.filters);
  };
}
