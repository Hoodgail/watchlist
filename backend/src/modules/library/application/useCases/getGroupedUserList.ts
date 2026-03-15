import type { LibraryGroupedList, LibraryGroupedListFilters } from '../dto/library.js';
import type { LibraryListGateway } from '../ports/LibraryListGateway.js';

export interface GetGroupedUserListQuery {
  userId: string;
  filters?: LibraryGroupedListFilters;
}

export function createGetGroupedUserListUseCase(dependencies: { listGateway: LibraryListGateway }) {
  return async function getGroupedUserList(query: GetGroupedUserListQuery): Promise<LibraryGroupedList> {
    return dependencies.listGateway.getGroupedUserList(query.userId, query.filters);
  };
}
