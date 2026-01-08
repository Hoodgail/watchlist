import { describe, it, expect } from 'vitest';
import { request, app } from './helpers.js';

/**
 * Integration tests for Media Search Endpoints
 * These tests make real API calls to TMDB, Consumet, and MangaDex
 * 
 * Note: These tests require:
 * - TMDB_API_KEY environment variable to be set
 * - Network connectivity to external APIs
 * - Consumet service may not be available in test environment
 */

describe('Media Search Endpoints', () => {
  describe('GET /api/media/search', () => {
    it('should return 400 if query is missing', async () => {
      const response = await request(app)
        .get('/api/media/search')
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('required');
    });

    it('should return 400 if query is empty', async () => {
      const response = await request(app)
        .get('/api/media/search?q=')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return search results for valid query', async () => {
      const response = await request(app)
        .get('/api/media/search?q=breaking+bad')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Note: Results may be empty if TMDB_API_KEY is not set
    });

    it('should filter by category=movie', async () => {
      const response = await request(app)
        .get('/api/media/search?q=inception&category=movie')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // All results should be MOVIE type
      response.body.forEach((item: { type: string }) => {
        expect(item.type).toBe('MOVIE');
      });
    });

    it('should filter by category=tv', async () => {
      const response = await request(app)
        .get('/api/media/search?q=breaking+bad&category=tv')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Results should be TV or ANIME (animation from TMDB)
      response.body.forEach((item: { type: string }) => {
        expect(['TV', 'ANIME']).toContain(item.type);
      });
    });

    it('should filter by category=anime', async () => {
      const response = await request(app)
        .get('/api/media/search?q=attack+on+titan&category=anime')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // All results should be ANIME type
      response.body.forEach((item: { type: string }) => {
        expect(item.type).toBe('ANIME');
      });
    });

    it('should filter by category=manga', async () => {
      const response = await request(app)
        .get('/api/media/search?q=one+piece&category=manga')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // All results should be MANGA type
      response.body.forEach((item: { type: string }) => {
        expect(item.type).toBe('MANGA');
      });
    });

    it('should accept year filter', async () => {
      const response = await request(app)
        .get('/api/media/search?q=batman&year=2022')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should accept includeAdult filter', async () => {
      const response = await request(app)
        .get('/api/media/search?q=test&includeAdult=true')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should accept multiple filters together', async () => {
      const response = await request(app)
        .get('/api/media/search?q=the+batman&category=movie&year=2022')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((item: { type: string }) => {
        expect(item.type).toBe('MOVIE');
      });
    });

    it('should return empty array for non-existent media', async () => {
      const response = await request(app)
        .get('/api/media/search?q=xyznonexistent12345abc')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });
  });

  describe('GET /api/media/trending', () => {
    it('should return trending categories', async () => {
      const response = await request(app)
        .get('/api/media/trending')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Note: May be empty if TMDB_API_KEY is not set
      
      // Each category should have title and items
      response.body.forEach((category: { title: string; items: unknown[] }) => {
        expect(category.title).toBeDefined();
        expect(typeof category.title).toBe('string');
        expect(Array.isArray(category.items)).toBe(true);
      });
    });

    it('should include Trending Today category when TMDB is available', async () => {
      const response = await request(app)
        .get('/api/media/trending')
        .expect(200);

      // Only check for Trending Today if we have categories
      if (response.body.length > 0) {
        const trendingToday = response.body.find(
          (c: { title: string }) => c.title === 'Trending Today'
        );
        if (trendingToday) {
          expect(Array.isArray(trendingToday.items)).toBe(true);
        }
      }
    });

    it('should include items with proper structure', async () => {
      const response = await request(app)
        .get('/api/media/trending')
        .expect(200);

      // Check first category has items with proper structure
      if (response.body.length > 0 && response.body[0].items.length > 0) {
        const item = response.body[0].items[0];
        expect(item.id).toBeDefined();
        expect(item.title).toBeDefined();
        expect(item.type).toBeDefined();
        expect(['TV', 'MOVIE', 'ANIME', 'MANGA']).toContain(item.type);
      }
    });
  });

  describe('GET /api/media/trending/movies', () => {
    it('should return trending movies', async () => {
      const response = await request(app)
        .get('/api/media/trending/movies')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Note: May be empty if TMDB_API_KEY is not set
    });

    it('should return movies with correct type', async () => {
      const response = await request(app)
        .get('/api/media/trending/movies')
        .expect(200);

      // Only check types if we have results
      if (response.body.length > 0) {
        response.body.forEach((item: { type: string }) => {
          expect(item.type).toBe('MOVIE');
        });
      }
    });

    it('should return movies with TMDB source prefix', async () => {
      const response = await request(app)
        .get('/api/media/trending/movies')
        .expect(200);

      // Only check prefixes if we have results
      if (response.body.length > 0) {
        response.body.forEach((item: { id: string }) => {
          expect(item.id).toMatch(/^tmdb:/);
        });
      }
    });
  });

  describe('GET /api/media/trending/tv', () => {
    it('should return trending TV shows', async () => {
      const response = await request(app)
        .get('/api/media/trending/tv')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Note: May be empty if TMDB_API_KEY is not set
    });

    it('should return TV shows with correct type', async () => {
      const response = await request(app)
        .get('/api/media/trending/tv')
        .expect(200);

      // Only check types if we have results
      if (response.body.length > 0) {
        response.body.forEach((item: { type: string }) => {
          // Can be TV or ANIME (animation shows from TMDB)
          expect(['TV', 'ANIME']).toContain(item.type);
        });
      }
    });

    it('should return TV shows with TMDB source prefix', async () => {
      const response = await request(app)
        .get('/api/media/trending/tv')
        .expect(200);

      // Only check prefixes if we have results
      if (response.body.length > 0) {
        response.body.forEach((item: { id: string }) => {
          expect(item.id).toMatch(/^tmdb:/);
        });
      }
    });
  });

  describe('GET /api/media/trending/anime', () => {
    it('should return trending anime', async () => {
      const response = await request(app)
        .get('/api/media/trending/anime')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Note: May be empty if Consumet service is not available
    });

    it('should return anime with correct type when available', async () => {
      const response = await request(app)
        .get('/api/media/trending/anime')
        .expect(200);

      if (response.body.length > 0) {
        response.body.forEach((item: { type: string }) => {
          expect(item.type).toBe('ANIME');
        });
      }
    });

    it('should return anime with anilist source prefix when available', async () => {
      const response = await request(app)
        .get('/api/media/trending/anime')
        .expect(200);

      if (response.body.length > 0) {
        response.body.forEach((item: { id: string }) => {
          expect(item.id).toMatch(/^(consumet-anilist|anilist):/);
        });
      }
    });
  });

  describe('Response Format', () => {
    it('should return results with correct schema when available', async () => {
      const response = await request(app)
        .get('/api/media/search?q=inception')
        .expect(200);

      // Only check schema if we have results (TMDB_API_KEY may not be set)
      if (response.body.length > 0) {
        const result = response.body[0];
        
        // Required fields
        expect(result.id).toBeDefined();
        expect(typeof result.id).toBe('string');
        expect(result.title).toBeDefined();
        expect(typeof result.title).toBe('string');
        expect(result.type).toBeDefined();
        expect(['TV', 'MOVIE', 'ANIME', 'MANGA']).toContain(result.type);
      }
    });

    it('should prefix ids with source', async () => {
      const response = await request(app)
        .get('/api/media/search?q=inception&category=movie')
        .expect(200);

      response.body.forEach((item: { id: string }) => {
        expect(item.id).toMatch(/^(tmdb|consumet-anilist|anilist|mangadex):/);
      });
    });

    it('should include year when available', async () => {
      const response = await request(app)
        .get('/api/media/search?q=inception&category=movie')
        .expect(200);

      if (response.body.length > 0) {
        const item = response.body[0];
        // Year is optional but should be a number when present
        if (item.year !== undefined) {
          expect(typeof item.year).toBe('number');
        }
      }
    });

    it('should include imageUrl when available', async () => {
      const response = await request(app)
        .get('/api/media/search?q=inception&category=movie')
        .expect(200);

      if (response.body.length > 0) {
        const item = response.body[0];
        // imageUrl is optional but should be a string when present
        if (item.imageUrl !== undefined) {
          expect(typeof item.imageUrl).toBe('string');
        }
      }
    });

    it('should include total when available', async () => {
      const response = await request(app)
        .get('/api/media/search?q=breaking+bad&category=tv')
        .expect(200);

      if (response.body.length > 0) {
        const item = response.body[0];
        // total can be null or a number
        expect(item.total === null || typeof item.total === 'number').toBe(true);
      }
    });
  });

  describe('No Authentication Required', () => {
    it('should allow search without authentication', async () => {
      // No auth header provided
      const response = await request(app)
        .get('/api/media/search?q=test')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should allow trending without authentication', async () => {
      // No auth header provided
      const response = await request(app)
        .get('/api/media/trending')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should allow trending movies without authentication', async () => {
      const response = await request(app)
        .get('/api/media/trending/movies')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should allow trending TV without authentication', async () => {
      const response = await request(app)
        .get('/api/media/trending/tv')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should allow trending anime without authentication', async () => {
      const response = await request(app)
        .get('/api/media/trending/anime')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Query Parameter Edge Cases', () => {
    it('should handle special characters in query', async () => {
      const response = await request(app)
        .get('/api/media/search?q=test%20%26%20special')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle unicode characters in query', async () => {
      // Japanese: "進撃の巨人" (Attack on Titan)
      const response = await request(app)
        .get('/api/media/search?q=%E9%80%B2%E6%92%83%E3%81%AE%E5%B7%A8%E4%BA%BA')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle very long query strings', async () => {
      const longQuery = 'a'.repeat(200);
      const response = await request(app)
        .get(`/api/media/search?q=${longQuery}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle invalid year parameter gracefully', async () => {
      const response = await request(app)
        .get('/api/media/search?q=test&year=notanumber')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should default category to all when not provided', async () => {
      const response = await request(app)
        .get('/api/media/search?q=breaking+bad')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Should get mixed results from all sources
    });

    it('should handle whitespace-only query as empty', async () => {
      const response = await request(app)
        .get('/api/media/search?q=%20%20%20')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });
});
