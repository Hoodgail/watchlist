/**
 * Shared refId utilities for creating and parsing reference IDs
 * 
 * refId format: "source:id"
 * Examples: "tmdb:12345", "mangadex:abc-123", "consumet-anilist:xyz"
 */

// ============ Source Types ============

/**
 * Known sources for media items
 */
export const KNOWN_SOURCES = [
  // Video sources
  'tmdb',
  'consumet-anilist',
  'anilist',
  // Manga sources
  'mangadex',
  'mangahere',
  'mangapill',
  'comick',
  'mangareader',
  'asurascans',
  'anilist-manga',
  'mangaplus',
  // Book sources
  'libgen',
  'novelupdates',
  'getcomics'
] as const;

export type KnownSource = typeof KNOWN_SOURCES[number];

/**
 * Check if a source is a known source
 */
export function isKnownSource(source: string): source is KnownSource {
  return KNOWN_SOURCES.includes(source as KnownSource);
}

// ============ Validation ============

/**
 * Regex pattern for valid refId format
 * Format: source:id where source is lowercase letters/hyphens and id is alphanumeric with _ and -
 */
export const REF_ID_PATTERN = /^[a-z][a-z-]*:[a-zA-Z0-9_/-]+$/;

/**
 * Check if a string is a valid refId format
 */
export function isValidRefId(refId: string): boolean {
  if (!refId || typeof refId !== 'string') return false;
  return REF_ID_PATTERN.test(refId);
}

/**
 * Get the validation error message for refId
 */
export function getRefIdValidationError(): string {
  return 'refId must be in format "source:id" (e.g., "tmdb:12345")';
}

// ============ Creation ============

/**
 * Create a refId from source and id
 * 
 * @param source - The source/provider name (e.g., "tmdb", "mangadex")
 * @param id - The unique identifier within that source
 * @returns The formatted refId (e.g., "tmdb:12345")
 */
export function createRefId(source: string, id: string | number): string {
  return `${source}:${id}`;
}

// ============ Parsing ============

export interface ParsedRefId {
  source: string;
  id: string;
}

/**
 * Parse a refId into its source and id components
 * 
 * @param refId - The refId to parse (e.g., "tmdb:12345")
 * @returns Parsed object with source and id, or null if invalid format
 */
export function parseRefId(refId: string): ParsedRefId | null {
  if (!refId || typeof refId !== 'string') return null;
  
  const colonIndex = refId.indexOf(':');
  if (colonIndex === -1) return null;
  
  const source = refId.substring(0, colonIndex);
  const id = refId.substring(colonIndex + 1);
  
  // Source must not be empty
  if (!source) return null;
  
  // ID can contain colons (e.g., manga IDs), so we use everything after the first colon
  // ID must not be empty
  if (!id) return null;
  
  return { source, id };
}

/**
 * Parse a refId and validate it matches a specific source
 * 
 * @param refId - The refId to parse
 * @param expectedSource - The source to validate against
 * @returns The id portion if source matches, null otherwise
 */
export function parseRefIdForSource(refId: string, expectedSource: string): string | null {
  const parsed = parseRefId(refId);
  if (!parsed) return null;
  if (parsed.source !== expectedSource) return null;
  return parsed.id;
}

// ============ Source Checking ============

/**
 * Check if a refId is from a specific source
 * 
 * @param refId - The refId to check
 * @param source - The source to check for
 * @returns true if the refId starts with the given source
 */
export function isSourceRefId(refId: string, source: string): boolean {
  return refId.startsWith(`${source}:`);
}

/**
 * Get the source from a refId without full parsing
 * 
 * @param refId - The refId to extract source from
 * @returns The source portion, or null if invalid
 */
export function getSource(refId: string): string | null {
  if (!refId || typeof refId !== 'string') return null;
  const colonIndex = refId.indexOf(':');
  if (colonIndex === -1) return null;
  return refId.substring(0, colonIndex) || null;
}

/**
 * Check if a refId is a local (non-external) reference
 */
export function isLocalRefId(refId: string): boolean {
  return isSourceRefId(refId, 'local');
}
