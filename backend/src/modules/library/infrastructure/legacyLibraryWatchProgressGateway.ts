import type { LibraryWatchProgressGateway } from '../application/ports/LibraryWatchProgressGateway.js';
import { createPrismaLibraryWatchProgressGateway } from './prismaLibraryWatchProgressGateway.js';

export function createLegacyLibraryWatchProgressGateway(): LibraryWatchProgressGateway {
  return createPrismaLibraryWatchProgressGateway();
}
