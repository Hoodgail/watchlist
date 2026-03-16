import type { CollectionCatalogGateway } from '../application/ports/CollectionCatalogGateway.js';
import type { CollectionsGateway } from '../application/ports/CollectionsGateway.js';
import {
  createCreateCollectionUseCase,
  createDeleteCollectionUseCase,
  createGetCollectionUseCase,
  createGetMyCollectionsUseCase,
  createGetPublicCollectionsUseCase,
  createGetStarredCollectionsUseCase,
  createUpdateCollectionUseCase,
} from '../application/useCases/collections.js';
import {
  createAddCollectionCommentUseCase,
  createDeleteCollectionCommentUseCase,
  createGetCollectionCommentsUseCase,
  createUpdateCollectionCommentUseCase,
} from '../application/useCases/comments.js';
import {
  createCreateCollectionInviteUseCase,
  createGetCollectionInvitesUseCase,
  createJoinCollectionByInviteUseCase,
  createRevokeCollectionInviteUseCase,
} from '../application/useCases/invites.js';
import {
  createAddCollectionItemUseCase,
  createRemoveCollectionItemUseCase,
  createReorderCollectionItemsUseCase,
  createUpdateCollectionItemUseCase,
} from '../application/useCases/items.js';
import {
  createAddCollectionMemberUseCase,
  createGetCollectionMembersUseCase,
  createLeaveCollectionUseCase,
  createRemoveCollectionMemberUseCase,
  createUpdateMemberRoleUseCase,
} from '../application/useCases/members.js';
import { createStarCollectionUseCase, createUnstarCollectionUseCase } from '../application/useCases/stars.js';
import { createCatalogCollectionsGateway } from '../infrastructure/catalogCollectionsGateway.js';
import { createPrismaCollectionsGateway } from '../infrastructure/prismaCollectionsGateway.js';

export interface CollectionsApplicationDependencies {
  collectionsGateway: CollectionsGateway;
  collectionCatalogGateway: CollectionCatalogGateway;
}

export function createCollectionsApplication(dependencies?: Partial<CollectionsApplicationDependencies>) {
  const collectionsGateway = dependencies?.collectionsGateway ?? createPrismaCollectionsGateway();
  const collectionCatalogGateway = dependencies?.collectionCatalogGateway ?? createCatalogCollectionsGateway();

  return {
    createCollection: createCreateCollectionUseCase({ collectionsGateway }),
    getMyCollections: createGetMyCollectionsUseCase({ collectionsGateway }),
    getPublicCollections: createGetPublicCollectionsUseCase({ collectionsGateway }),
    getStarredCollections: createGetStarredCollectionsUseCase({ collectionsGateway }),
    getCollection: createGetCollectionUseCase({ collectionsGateway }),
    updateCollection: createUpdateCollectionUseCase({ collectionsGateway }),
    deleteCollection: createDeleteCollectionUseCase({ collectionsGateway }),
    addCollectionItem: createAddCollectionItemUseCase({ collectionsGateway, collectionCatalogGateway }),
    updateCollectionItem: createUpdateCollectionItemUseCase({ collectionsGateway }),
    removeCollectionItem: createRemoveCollectionItemUseCase({ collectionsGateway }),
    reorderCollectionItems: createReorderCollectionItemsUseCase({ collectionsGateway }),
    getCollectionMembers: createGetCollectionMembersUseCase({ collectionsGateway }),
    addCollectionMember: createAddCollectionMemberUseCase({ collectionsGateway }),
    updateMemberRole: createUpdateMemberRoleUseCase({ collectionsGateway }),
    removeCollectionMember: createRemoveCollectionMemberUseCase({ collectionsGateway }),
    leaveCollection: createLeaveCollectionUseCase({ collectionsGateway }),
    createCollectionInvite: createCreateCollectionInviteUseCase({ collectionsGateway }),
    getCollectionInvites: createGetCollectionInvitesUseCase({ collectionsGateway }),
    revokeCollectionInvite: createRevokeCollectionInviteUseCase({ collectionsGateway }),
    joinCollectionByInvite: createJoinCollectionByInviteUseCase({ collectionsGateway }),
    starCollection: createStarCollectionUseCase({ collectionsGateway }),
    unstarCollection: createUnstarCollectionUseCase({ collectionsGateway }),
    getCollectionComments: createGetCollectionCommentsUseCase({ collectionsGateway }),
    addCollectionComment: createAddCollectionCommentUseCase({ collectionsGateway }),
    updateCollectionComment: createUpdateCollectionCommentUseCase({ collectionsGateway }),
    deleteCollectionComment: createDeleteCollectionCommentUseCase({ collectionsGateway }),
  };
}

export const collectionsApplication = createCollectionsApplication();
