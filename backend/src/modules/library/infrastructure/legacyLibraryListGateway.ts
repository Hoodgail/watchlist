import type { LibraryListGateway } from '../application/ports/LibraryListGateway.js';
import { createPrismaLibraryListGateway } from './prismaLibraryListGateway.js';

export function createLegacyLibraryListGateway(): LibraryListGateway {
  return createPrismaLibraryListGateway();
}
