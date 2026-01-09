/**
 * Source Extractor Registry
 * 
 * Central registry for custom source extractors.
 * Manages extractor registration and dispatches extraction requests
 * to the appropriate extractors based on provider.
 */

import {
  SourceExtractor,
  ExtractorContext,
  ExtractorResult,
  ExtractorRegistry,
} from './types.js';
import { megaCloudExtractor } from './megacloud.js';

// ============ Registry Implementation ============

class SourceExtractorRegistry implements ExtractorRegistry {
  private extractors: Map<string, SourceExtractor[]> = new Map();
  private allExtractors: SourceExtractor[] = [];

  /**
   * Register an extractor
   */
  register(extractor: SourceExtractor): void {
    this.allExtractors.push(extractor);
    
    for (const provider of extractor.providers) {
      const existing = this.extractors.get(provider) || [];
      existing.push(extractor);
      // Sort by priority (highest first)
      existing.sort((a, b) => b.priority - a.priority);
      this.extractors.set(provider, existing);
    }
    
    console.log(`[ExtractorRegistry] Registered ${extractor.name} for providers: ${extractor.providers.join(', ')}`);
  }

  /**
   * Get extractors for a provider (sorted by priority)
   */
  getExtractors(provider: string): SourceExtractor[] {
    return this.extractors.get(provider) || [];
  }

  /**
   * Check if a provider has custom extractors
   */
  hasExtractors(provider: string): boolean {
    return this.extractors.has(provider) && this.extractors.get(provider)!.length > 0;
  }

  /**
   * Get all registered extractors
   */
  getAllExtractors(): SourceExtractor[] {
    return [...this.allExtractors];
  }

  /**
   * Try to extract sources using registered extractors
   * Returns the first successful result, or the last error
   */
  async extract(provider: string, context: ExtractorContext): Promise<ExtractorResult> {
    const extractors = this.getExtractors(provider);
    
    if (extractors.length === 0) {
      return {
        success: false,
        error: `No extractors registered for provider: ${provider}`,
        shouldFallback: true,
      };
    }
    
    console.log(`[ExtractorRegistry] Trying ${extractors.length} extractors for ${provider}`);
    
    let lastError: ExtractorResult = {
      success: false,
      error: 'No extractors could handle this request',
      shouldFallback: true,
    };
    
    for (const extractor of extractors) {
      // Check if extractor can handle this context
      if (!extractor.canHandle(context)) {
        console.log(`[ExtractorRegistry] ${extractor.name} cannot handle this context`);
        continue;
      }
      
      console.log(`[ExtractorRegistry] Trying extractor: ${extractor.name}`);
      
      try {
        const result = await extractor.extract(context);
        
        if (result.success) {
          console.log(`[ExtractorRegistry] ${extractor.name} succeeded`);
          return result;
        }
        
        console.log(`[ExtractorRegistry] ${extractor.name} failed: ${result.error}`);
        lastError = result;
        
        // If extractor says don't fallback, respect that
        if (result.shouldFallback === false) {
          return result;
        }
      } catch (error: any) {
        console.error(`[ExtractorRegistry] ${extractor.name} threw error:`, error.message);
        lastError = {
          success: false,
          error: error.message,
          shouldFallback: true,
        };
      }
    }
    
    return lastError;
  }
}

// ============ Singleton Instance ============

const registry = new SourceExtractorRegistry();

// Register built-in extractors
registry.register(megaCloudExtractor);

// ============ Exports ============

export { registry as extractorRegistry };
export type { SourceExtractorRegistry };

// Convenience functions
export function hasCustomExtractor(provider: string): boolean {
  return registry.hasExtractors(provider);
}

export function getCustomExtractors(provider: string): SourceExtractor[] {
  return registry.getExtractors(provider);
}

export async function extractWithCustom(
  provider: string,
  context: ExtractorContext
): Promise<ExtractorResult> {
  return registry.extract(provider, context);
}

// Re-export types
export * from './types.js';
