import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';

export interface ProviderMappingResponse {
  id: string;
  refId: string;
  provider: string;
  providerId: string;
  providerTitle: string;
  confidence: number;
  verifiedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMappingInput {
  refId: string;
  provider: string;
  providerId: string;
  providerTitle: string;
  confidence?: number;
}

const mappingSelect = {
  id: true,
  refId: true,
  provider: true,
  providerId: true,
  providerTitle: true,
  confidence: true,
  verifiedBy: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Get a mapping for a specific refId and provider
 */
export async function getMapping(
  refId: string,
  provider: string
): Promise<ProviderMappingResponse | null> {
  return prisma.providerMapping.findUnique({
    where: {
      refId_provider: {
        refId,
        provider,
      },
    },
    select: mappingSelect,
  });
}

/**
 * Get all mappings for a specific refId
 */
export async function getMappingsForRefId(
  refId: string
): Promise<ProviderMappingResponse[]> {
  return prisma.providerMapping.findMany({
    where: { refId },
    select: mappingSelect,
    orderBy: { confidence: 'desc' },
  });
}

/**
 * Create or update a provider mapping
 * When a user verifies a mapping, they set confidence to 1.0
 */
export async function upsertMapping(
  input: CreateMappingInput,
  userId?: string
): Promise<ProviderMappingResponse> {
  const { refId, provider, providerId, providerTitle, confidence = 1.0 } = input;

  return prisma.providerMapping.upsert({
    where: {
      refId_provider: {
        refId,
        provider,
      },
    },
    update: {
      providerId,
      providerTitle,
      confidence,
      verifiedBy: userId || null,
      updatedAt: new Date(),
    },
    create: {
      refId,
      provider,
      providerId,
      providerTitle,
      confidence,
      verifiedBy: userId || null,
    },
    select: mappingSelect,
  });
}

/**
 * Create an auto-matched mapping (lower confidence, no verifiedBy)
 * Only creates if no existing mapping with higher confidence exists
 */
export async function createAutoMapping(
  input: CreateMappingInput
): Promise<ProviderMappingResponse | null> {
  const { refId, provider, providerId, providerTitle, confidence = 0.5 } = input;

  // Check for existing mapping
  const existing = await prisma.providerMapping.findUnique({
    where: {
      refId_provider: {
        refId,
        provider,
      },
    },
  });

  // Don't overwrite verified or higher-confidence mappings
  if (existing && (existing.verifiedBy || existing.confidence >= confidence)) {
    return null;
  }

  return prisma.providerMapping.upsert({
    where: {
      refId_provider: {
        refId,
        provider,
      },
    },
    update: {
      providerId,
      providerTitle,
      confidence,
      updatedAt: new Date(),
    },
    create: {
      refId,
      provider,
      providerId,
      providerTitle,
      confidence,
      verifiedBy: null,
    },
    select: mappingSelect,
  });
}

/**
 * Delete a mapping
 */
export async function deleteMapping(
  refId: string,
  provider: string
): Promise<void> {
  const existing = await prisma.providerMapping.findUnique({
    where: {
      refId_provider: {
        refId,
        provider,
      },
    },
  });

  if (!existing) {
    throw new NotFoundError('Mapping not found');
  }

  await prisma.providerMapping.delete({
    where: {
      refId_provider: {
        refId,
        provider,
      },
    },
  });
}

/**
 * Get all mappings for a provider (admin/debug use)
 */
export async function getMappingsForProvider(
  provider: string,
  limit = 100,
  offset = 0
): Promise<{ mappings: ProviderMappingResponse[]; total: number }> {
  const [mappings, total] = await Promise.all([
    prisma.providerMapping.findMany({
      where: { provider },
      select: mappingSelect,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.providerMapping.count({ where: { provider } }),
  ]);

  return { mappings, total };
}
