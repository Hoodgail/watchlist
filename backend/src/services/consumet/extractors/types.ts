/**
 * Custom Source Extractor Types
 * 
 * Defines the interface for custom video source extraction.
 * Providers can implement custom extraction logic when the default
 * Consumet library fails or needs enhancement.
 */

import { UnifiedSourceResult, UnifiedSource, UnifiedSubtitle } from '../types.js';

// ============ Base Types ============

/**
 * Context passed to source extractors
 */
export interface ExtractorContext {
  /** Episode/video ID from the provider */
  episodeId: string;
  /** Optional media ID (some providers need this) */
  mediaId?: string;
  /** Server name (e.g., 'HD-1', 'HD-2') */
  server?: string;
  /** Sub or dub preference */
  subOrDub?: 'sub' | 'dub';
  /** Additional provider-specific data */
  extra?: Record<string, unknown>;
}

/**
 * Result from a source extractor
 */
export interface ExtractorResult {
  /** Whether extraction was successful */
  success: boolean;
  /** Unified source result if successful */
  sources?: UnifiedSourceResult;
  /** Error message if failed */
  error?: string;
  /** Whether to fall back to default extraction */
  shouldFallback?: boolean;
  /** Debug info for logging */
  debug?: Record<string, unknown>;
}

/**
 * Base interface for all source extractors
 */
export interface SourceExtractor {
  /** Unique name of the extractor */
  name: string;
  
  /** Providers this extractor handles */
  providers: string[];
  
  /** Priority (higher = tried first) */
  priority: number;
  
  /**
   * Check if this extractor can handle the given context
   */
  canHandle(context: ExtractorContext): boolean;
  
  /**
   * Extract video sources
   */
  extract(context: ExtractorContext): Promise<ExtractorResult>;
}

// ============ Server Types ============

/**
 * Server information from provider
 */
export interface ServerInfo {
  id: string;
  name: string;
  type?: 'sub' | 'dub' | 'raw';
  url?: string;
}

/**
 * Embed URL info extracted from server response
 */
export interface EmbedInfo {
  url: string;
  domain: string;
  videoId: string;
  embedType: string;
  referer?: string;
}

// ============ MegaCloud Specific Types ============

/**
 * MegaCloud API response structure
 */
export interface MegaCloudResponse {
  sources: MegaCloudSource[] | string; // Can be encrypted string
  tracks?: MegaCloudTrack[];
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  server?: number;
}

export interface MegaCloudSource {
  file: string;
  type?: string;
}

export interface MegaCloudTrack {
  file: string;
  label?: string;
  kind?: string;
  default?: boolean;
}

/**
 * Decryption keys from external source
 */
export interface DecryptionKeys {
  mega?: string;
  vidstr?: string;
  [key: string]: string | undefined;
}

// ============ Helper Types ============

/**
 * HTTP headers for requests
 */
export interface RequestHeaders {
  'User-Agent': string;
  'Referer'?: string;
  'Origin'?: string;
  'X-Requested-With'?: string;
  'Accept'?: string;
  [key: string]: string | undefined;
}

// ============ Extractor Registry Types ============

/**
 * Registry of all available source extractors
 */
export interface ExtractorRegistry {
  /**
   * Register an extractor
   */
  register(extractor: SourceExtractor): void;
  
  /**
   * Get extractors for a provider (sorted by priority)
   */
  getExtractors(provider: string): SourceExtractor[];
  
  /**
   * Try to extract sources using registered extractors
   */
  extract(provider: string, context: ExtractorContext): Promise<ExtractorResult>;
}
