import { describe, expect, it } from 'vitest';
import {
  createMangaRefId,
  createVideoRefId,
  extractIdFromRefId,
  extractProviderFromRefId,
  parseMangaRefId,
  parseVideoRefId,
} from './refId';

describe('media refId helpers', () => {
  it('creates provider refIds for video and manga', () => {
    expect(createVideoRefId('abc123', 'hianime')).toBe('hianime:abc123');
    expect(createMangaRefId('chapter-1', 'mangadex')).toBe('mangadex:chapter-1');
  });

  it('extracts provider and id portions from refIds', () => {
    expect(extractProviderFromRefId('tmdb:123')).toBe('tmdb');
    expect(extractIdFromRefId('mangadex:abc:def')).toBe('abc:def');
  });

  it('parses video and manga provider refIds safely', () => {
    expect(parseVideoRefId('animekai:show-7')).toEqual({ provider: 'animekai', mediaId: 'show-7' });
    expect(parseMangaRefId('mangapill:series-4')).toEqual({ provider: 'mangapill', mangaId: 'series-4' });
    expect(parseVideoRefId('tmdb:55')).toBeNull();
  });
});
