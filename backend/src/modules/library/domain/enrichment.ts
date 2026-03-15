import type { Prisma } from '@prisma/client';
import type {
  ActiveProgress,
  FriendStatus,
  GroupedListResponse,
  MediaItemWithSource,
  MediaItemResponse,
} from './listTypes.js';
import { parseEpisodeNumber } from './parseEpisodeNumber.js';

export const mediaItemSelect = {
  id: true,
  title: true,
  type: true,
  status: true,
  current: true,
  total: true,
  notes: true,
  rating: true,
  imageUrl: true,
  refId: true,
  createdAt: true,
  updatedAt: true,
  platforms: true,
  metacritic: true,
  genres: true,
  playtimeHours: true,
  source: {
    select: {
      title: true,
      imageUrl: true,
      total: true,
      year: true,
      releaseDate: true,
      description: true,
      genres: true,
      platforms: true,
      playtimeHours: true,
      aliases: {
        select: {
          refId: true,
          provider: true,
        },
      },
    },
  },
} as const;

export function resolveMediaItemResponse(item: MediaItemWithSource): MediaItemResponse {
  return {
    id: item.id,
    title: item.source?.title ?? item.title ?? 'Unknown',
    type: item.type,
    status: item.status,
    current: item.current,
    total: item.source?.total ?? item.total,
    notes: item.notes,
    rating: item.rating,
    imageUrl: item.source?.imageUrl ?? item.imageUrl,
    refId: item.refId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    aliases: item.source?.aliases,
    year: item.source?.year,
    releaseDate: item.source?.releaseDate,
    description: item.source?.description,
    genres: item.source?.genres ?? item.genres,
    platforms: item.source?.platforms ?? item.platforms,
    metacritic: item.metacritic,
    playtimeHours: item.source?.playtimeHours ?? item.playtimeHours,
  };
}

function buildFriendStatusMaps(friendsItems: Array<{
  title: string | null;
  refId: string | null;
  status: any;
  current: number;
  rating: number | null;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}>): {
  friendsMapByRefId: Map<string, FriendStatus[]>;
  friendsMapByTitle: Map<string, FriendStatus[]>;
} {
  const friendsMapByRefId = new Map<string, FriendStatus[]>();
  const friendsMapByTitle = new Map<string, FriendStatus[]>();

  for (const friendItem of friendsItems) {
    const friendStatus: FriendStatus = {
      id: friendItem.user.id,
      username: friendItem.user.username,
      displayName: friendItem.user.displayName,
      avatarUrl: friendItem.user.avatarUrl,
      status: friendItem.status,
      current: friendItem.current,
      rating: friendItem.rating,
    };

    if (friendItem.refId) {
      const existing = friendsMapByRefId.get(friendItem.refId) || [];
      existing.push(friendStatus);
      friendsMapByRefId.set(friendItem.refId, existing);
    }

    if (friendItem.title) {
      const titleKey = friendItem.title.toLowerCase();
      const existingByTitle = friendsMapByTitle.get(titleKey) || [];
      existingByTitle.push(friendStatus);
      friendsMapByTitle.set(titleKey, existingByTitle);
    }
  }

  return { friendsMapByRefId, friendsMapByTitle };
}

export async function loadActiveProgressMap(
  prisma: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  userId: string,
  items: MediaItemWithSource[],
): Promise<Map<string, ActiveProgress>> {
  const videoItems = items.filter((item) => item.type !== 'MANGA');
  const videoRefIds = videoItems.map((item) => item.refId);
  const watchProgressMap = new Map<string, ActiveProgress>();

  if (videoRefIds.length === 0) {
    return watchProgressMap;
  }

  const providerMappings = await prisma.providerMapping.findMany({
    where: { refId: { in: videoRefIds } },
    select: { refId: true, providerId: true },
  });

  const refIdToProviderIds = new Map<string, string[]>();
  for (const mapping of providerMappings) {
    const existing = refIdToProviderIds.get(mapping.refId) || [];
    existing.push(mapping.providerId);
    refIdToProviderIds.set(mapping.refId, existing);
  }

  const allPossibleMediaIds = new Set<string>(videoRefIds);
  for (const providerIds of refIdToProviderIds.values()) {
    for (const providerId of providerIds) {
      allPossibleMediaIds.add(providerId);
    }
  }

  const allProgress = await prisma.watchProgress.findMany({
    where: {
      userId,
      mediaId: { in: Array.from(allPossibleMediaIds) },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const providerIdToRefId = new Map<string, string>();
  for (const [refId, providerIds] of refIdToProviderIds) {
    for (const providerId of providerIds) {
      providerIdToRefId.set(providerId, refId);
    }
  }

  const progressByRefId = new Map<string, typeof allProgress>();
  for (const progress of allProgress) {
    const refId = providerIdToRefId.get(progress.mediaId) || progress.mediaId;
    const existing = progressByRefId.get(refId) || [];
    existing.push(progress);
    progressByRefId.set(refId, existing);
  }

  for (const [refId, progressEntries] of progressByRefId) {
    const item = videoItems.find((candidate) => candidate.refId === refId);
    if (!item) continue;

    const incompleteProgress = progressEntries.find((progress) => !progress.completed && progress.currentTime > 0);
    const activeEntry = incompleteProgress || progressEntries[0];

    if (!activeEntry) continue;

    const episodeNumber = activeEntry.episodeNumber ?? parseEpisodeNumber(activeEntry.episodeId);
    const percentComplete = activeEntry.duration > 0
      ? (activeEntry.currentTime / activeEntry.duration) * 100
      : 0;

    watchProgressMap.set(refId, {
      episodeId: activeEntry.episodeId,
      episodeNumber,
      seasonNumber: activeEntry.seasonNumber,
      currentTime: activeEntry.currentTime,
      duration: activeEntry.duration,
      percentComplete: Math.round(percentComplete * 10) / 10,
      completed: activeEntry.completed,
      updatedAt: activeEntry.updatedAt,
      provider: activeEntry.provider,
    });
  }

  return watchProgressMap;
}

export async function attachLibraryExtras(
  prisma: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  userId: string,
  items: MediaItemWithSource[],
): Promise<MediaItemResponse[]> {
  const watchProgressMap = await loadActiveProgressMap(prisma, userId, items);

  const friendships = await prisma.friendship.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  const friendIds = friendships.map((friendship) => friendship.followingId);

  if (friendIds.length === 0) {
    return items.map((item) => ({
      ...resolveMediaItemResponse(item),
      activeProgress: item.type !== 'MANGA' ? watchProgressMap.get(item.refId) || null : null,
    }));
  }

  const refIds = items.filter((item) => item.refId).map((item) => item.refId as string);
  const resolvedTitles = items
    .map((item) => item.source?.title ?? item.title)
    .filter((title): title is string => title !== null);

  const friendsItems = await prisma.mediaItem.findMany({
    where: {
      userId: { in: friendIds },
      OR: [
        ...(refIds.length > 0 ? [{ refId: { in: refIds } }] : []),
        ...(resolvedTitles.length > 0 ? [{ title: { in: resolvedTitles, mode: 'insensitive' as const } }] : []),
      ],
    },
    select: {
      title: true,
      refId: true,
      status: true,
      current: true,
      rating: true,
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  const { friendsMapByRefId, friendsMapByTitle } = buildFriendStatusMaps(friendsItems);

  return items.map((item) => {
    const resolved = resolveMediaItemResponse(item);
    let friendsStatuses = item.refId ? friendsMapByRefId.get(item.refId) : undefined;
    if (!friendsStatuses || friendsStatuses.length === 0) {
      friendsStatuses = friendsMapByTitle.get(resolved.title.toLowerCase());
    }

    return {
      ...resolved,
      friendsStatuses: friendsStatuses || [],
      activeProgress: item.type !== 'MANGA' ? watchProgressMap.get(item.refId) || null : null,
    };
  });
}

export async function attachGroupedLibraryExtras(
  prisma: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  userId: string,
  groups: Array<{
    status: keyof GroupedListResponse['groups'];
    data: {
      items: MediaItemWithSource[];
      total: number;
      hasMore: boolean;
      page: number;
    };
  }>,
): Promise<GroupedListResponse> {
  const allItems = groups.flatMap((group) => group.data.items);
  const enrichedItems = await attachLibraryExtras(prisma, userId, allItems);
  const itemById = new Map(enrichedItems.map((item) => [item.id, item]));

  const mappedGroups = {} as GroupedListResponse['groups'];
  let grandTotal = 0;

  for (const group of groups) {
    mappedGroups[group.status] = {
      items: group.data.items.map((item) => itemById.get(item.id)!).filter(Boolean),
      total: group.data.total,
      hasMore: group.data.hasMore,
      page: group.data.page,
    };
    grandTotal += group.data.total;
  }

  return {
    groups: mappedGroups,
    grandTotal,
  };
}
