/**
 * Shared matching and similarity utilities for title comparison.
 * Used by both frontend and backend for consistent matching logic.
 */

// ============ Interfaces ============

/**
 * An item that can be matched against other items
 */
export interface MatchableItem {
  title: string;
  year?: number | null;
  alternativeTitles?: string[];
}

/**
 * Result of a similarity calculation
 */
export interface SimilarityResult {
  /** Similarity score between 0 and 1 */
  score: number;
  /** Whether the items are related (score > 0.7 or season mismatch) */
  isRelated: boolean;
  /** Whether titles match but appear to be different seasons */
  seasonMismatch: boolean;
}

/**
 * A resolved match with its similarity result
 */
export interface ResolvedMatch<T extends MatchableItem> {
  item: T;
  similarity: SimilarityResult;
}

/**
 * Extracted season information from a title
 */
export interface SeasonInfo {
  /** The base title without season indicators */
  baseTitle: string;
  /** The detected season number, or null if not found */
  season: number | null;
}

// ============ Constants ============

/** Default similarity threshold for a match to be considered valid */
const DEFAULT_THRESHOLD = 0.7;

/** Default number of results to return */
const DEFAULT_LIMIT = 5;

/** Year difference penalty applied to score */
const YEAR_PENALTY = 0.3;

/** Map of Roman numerals to numbers (up to 10) */
const ROMAN_NUMERALS: Record<string, number> = {
  'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
  'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10,
};

/** Ordinal suffixes */
const ORDINAL_PATTERN = /(\d+)(?:st|nd|rd|th)/gi;

// ============ Core Functions ============

/**
 * Calculate Levenshtein distance between two strings.
 * Returns the minimum number of single-character edits needed to transform one string into the other.
 * 
 * @param a - First string
 * @param b - Second string
 * @returns The edit distance between the strings
 */
export function levenshteinDistance(a: string, b: string): number {
  // Early exit for identical strings
  if (a === b) return 0;
  
  // Early exit for empty strings
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  // Create distance matrix
  const matrix: number[][] = [];
  
  // Initialize first column
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  
  // Initialize first row
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill in the rest of the matrix
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[a.length][b.length];
}

/**
 * Normalize a title for comparison.
 * Converts to lowercase, removes special characters, and unifies whitespace.
 * Also handles common season format variations.
 * 
 * @param title - The title to normalize
 * @returns The normalized title string
 */
export function normalizeTitle(title: string): string {
  let normalized = title.toLowerCase();
  
  // Convert ordinal numbers (1st, 2nd, 3rd, etc.) to regular numbers
  normalized = normalized.replace(ORDINAL_PATTERN, '$1');
  
  // Standardize season indicators before removing punctuation
  // "Season X" or "S X" or "SX" -> " season X "
  normalized = normalized.replace(/\bseason\s*(\d+)\b/gi, ' season $1 ');
  normalized = normalized.replace(/\bs(\d+)\b/gi, ' season $1 ');
  
  // "Part X" -> " part X "
  normalized = normalized.replace(/\bpart\s*(\d+)\b/gi, ' part $1 ');
  
  // Convert Roman numerals that appear to be seasons
  for (const [roman, num] of Object.entries(ROMAN_NUMERALS)) {
    // Match Roman numerals at the end of the title or followed by certain patterns
    const romanPattern = new RegExp(`\\b${roman}\\b(?:\\s*$|\\s*[-:]|\\s+(?:season|part))`, 'i');
    if (romanPattern.test(normalized)) {
      normalized = normalized.replace(new RegExp(`\\b${roman}\\b`, 'i'), `season ${num}`);
    }
  }
  
  // Remove punctuation (but keep alphanumeric and whitespace)
  normalized = normalized.replace(/[^\w\s]/g, '');
  
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Extract season information from a title.
 * Detects and extracts season number from various formats.
 * 
 * @param title - The title to extract season info from
 * @returns Object containing the base title and detected season number
 */
export function extractSeasonInfo(title: string): SeasonInfo {
  const normalized = normalizeTitle(title);
  
  let season: number | null = null;
  let baseTitle = normalized;
  
  // Pattern for "season X" at the end
  const seasonEndPattern = /\s+season\s+(\d+)\s*$/i;
  const seasonEndMatch = baseTitle.match(seasonEndPattern);
  if (seasonEndMatch) {
    season = parseInt(seasonEndMatch[1], 10);
    baseTitle = baseTitle.replace(seasonEndPattern, '').trim();
    return { baseTitle, season };
  }
  
  // Pattern for "part X" at the end (often used as season indicator)
  const partEndPattern = /\s+part\s+(\d+)\s*$/i;
  const partEndMatch = baseTitle.match(partEndPattern);
  if (partEndMatch) {
    season = parseInt(partEndMatch[1], 10);
    baseTitle = baseTitle.replace(partEndPattern, '').trim();
    return { baseTitle, season };
  }
  
  // Pattern for standalone number at the end (e.g., "My Anime 2")
  // Only match if it's likely a season number (small numbers)
  const numberEndPattern = /\s+(\d)$/;
  const numberEndMatch = baseTitle.match(numberEndPattern);
  if (numberEndMatch) {
    const num = parseInt(numberEndMatch[1], 10);
    if (num >= 2 && num <= 10) {
      season = num;
      baseTitle = baseTitle.replace(numberEndPattern, '').trim();
      return { baseTitle, season };
    }
  }
  
  return { baseTitle, season };
}

/**
 * Calculate similarity between two matchable items.
 * Uses a combination of Levenshtein distance, word matching, and metadata comparison.
 * 
 * @param itemA - First item to compare
 * @param itemB - Second item to compare
 * @returns Similarity result with score, isRelated flag, and seasonMismatch flag
 */
export function calculateSimilarity(itemA: MatchableItem, itemB: MatchableItem): SimilarityResult {
  const titleA = normalizeTitle(itemA.title);
  const titleB = normalizeTitle(itemB.title);
  
  // Exact match check
  if (titleA === titleB) {
    return { score: 1, isRelated: true, seasonMismatch: false };
  }
  
  // Extract season info for both titles
  const seasonInfoA = extractSeasonInfo(itemA.title);
  const seasonInfoB = extractSeasonInfo(itemB.title);
  
  // Check if base titles match but seasons differ
  let seasonMismatch = false;
  if (seasonInfoA.baseTitle === seasonInfoB.baseTitle) {
    if (seasonInfoA.season !== null && seasonInfoB.season !== null && 
        seasonInfoA.season !== seasonInfoB.season) {
      seasonMismatch = true;
    }
  }
  
  // Calculate title similarity score
  let score = calculateTitleScore(titleA, titleB);
  
  // Also compare base titles if seasons were extracted
  if (seasonInfoA.baseTitle !== titleA || seasonInfoB.baseTitle !== titleB) {
    const baseScore = calculateTitleScore(seasonInfoA.baseTitle, seasonInfoB.baseTitle);
    // Use the higher score but apply penalty if season mismatch
    if (baseScore > score) {
      score = seasonMismatch ? Math.max(0, baseScore - 0.2) : baseScore;
    }
  }
  
  // Check alternative titles
  const altTitlesA = itemA.alternativeTitles || [];
  const altTitlesB = itemB.alternativeTitles || [];
  
  // Check A's title against B's alternatives
  for (const alt of altTitlesB) {
    const altScore = calculateTitleScore(titleA, normalizeTitle(alt));
    score = Math.max(score, altScore);
  }
  
  // Check B's title against A's alternatives
  for (const alt of altTitlesA) {
    const altScore = calculateTitleScore(normalizeTitle(alt), titleB);
    score = Math.max(score, altScore);
  }
  
  // Check alternatives against each other
  for (const altA of altTitlesA) {
    for (const altB of altTitlesB) {
      const altScore = calculateTitleScore(normalizeTitle(altA), normalizeTitle(altB));
      score = Math.max(score, altScore);
    }
  }
  
  // Apply year penalty if both years exist and differ significantly
  if (itemA.year != null && itemB.year != null) {
    const yearDiff = Math.abs(itemA.year - itemB.year);
    if (yearDiff > 1) {
      score = Math.max(0, score - YEAR_PENALTY);
    }
  }
  
  const isRelated = score > DEFAULT_THRESHOLD || seasonMismatch;
  
  return { score, isRelated, seasonMismatch };
}

/**
 * Calculate a similarity score between two normalized titles.
 * Uses a combination of containment check, word overlap, and Levenshtein distance.
 * 
 * @param normA - First normalized title
 * @param normB - Second normalized title
 * @returns Similarity score between 0 and 1
 */
function calculateTitleScore(normA: string, normB: string): number {
  // Exact match
  if (normA === normB) return 1;
  
  // Containment check
  if (normA.includes(normB) || normB.includes(normA)) {
    const longerLen = Math.max(normA.length, normB.length);
    const shorterLen = Math.min(normA.length, normB.length);
    return shorterLen / longerLen;
  }
  
  // Word-based comparison
  const wordsA = new Set(normA.split(' ').filter(w => w.length > 1));
  const wordsB = new Set(normB.split(' ').filter(w => w.length > 1));
  
  if (wordsA.size === 0 || wordsB.size === 0) {
    // Fall back to Levenshtein for very short titles
    return levenshteinSimilarity(normA, normB);
  }
  
  let matchCount = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) matchCount++;
  }
  
  const wordOverlapScore = matchCount / Math.max(wordsA.size, wordsB.size);
  
  // Also calculate Levenshtein-based similarity
  const levScore = levenshteinSimilarity(normA, normB);
  
  // Return the higher of the two scores
  return Math.max(wordOverlapScore, levScore);
}

/**
 * Convert Levenshtein distance to a similarity score (0-1).
 * 
 * @param a - First string
 * @param b - Second string
 * @returns Similarity score between 0 and 1
 */
function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1; // Both empty strings
  const distance = levenshteinDistance(a, b);
  return 1 - (distance / maxLen);
}

// ============ Resolution Functions ============

/**
 * Find and rank matches from a list of items against a target.
 * Returns matches sorted by score descending.
 * 
 * @param items - Array of items to search through
 * @param target - The target item to match against
 * @param limit - Maximum number of results to return (default: 5)
 * @returns Array of resolved matches sorted by score
 */
export function resolveWithAlternatives<T extends MatchableItem>(
  items: T[],
  target: MatchableItem,
  limit: number = DEFAULT_LIMIT
): ResolvedMatch<T>[] {
  const matches: ResolvedMatch<T>[] = [];
  
  for (const item of items) {
    const similarity = calculateSimilarity(item, target);
    matches.push({ item, similarity });
  }
  
  // Sort by score descending
  matches.sort((a, b) => b.similarity.score - a.similarity.score);
  
  // Return limited results
  return matches.slice(0, limit);
}

/**
 * Find the best matching item from a list that meets the threshold.
 * 
 * @param items - Array of items to search through
 * @param target - The target item to match against
 * @param threshold - Minimum score required for a match (default: 0.7)
 * @returns The best matching item, or null if no match meets the threshold
 */
export function findBestMatch<T extends MatchableItem>(
  items: T[],
  target: MatchableItem,
  threshold: number = DEFAULT_THRESHOLD
): T | null {
  let bestMatch: T | null = null;
  let bestScore = threshold;
  
  for (const item of items) {
    const similarity = calculateSimilarity(item, target);
    if (similarity.score > bestScore) {
      bestScore = similarity.score;
      bestMatch = item;
    }
  }
  
  return bestMatch;
}
