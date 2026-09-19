import { createRefId } from '@shared/refId';
import { describe, expect, it } from 'vitest';
import { canonicalMediaRefId, mediaPartKey } from '@shared/mediaIdentity';
describe('media identity', () => {
  it('rejects relabeling an existing reference as another provider', () => {
    expect(createRefId('hianime', 'hianime:42')).toBe('hianime:42');
    expect(() => createRefId('hianime', 'tmdb:42')).toThrow('different provider');
  });
  it('separates TMDB movie and TV namespaces', () => {
    expect(canonicalMediaRefId('tmdb:42', 'MOVIE')).toBe('tmdb:movie/42');
    expect(canonicalMediaRefId('tmdb:42', 'TV')).toBe('tmdb:tv/42');
    expect(canonicalMediaRefId('tmdb:tv/42', 'ANIME')).toBe('tmdb:tv/42');
    expect(() => canonicalMediaRefId('tmdb:movie/42', 'TV')).toThrow();
  });
  it('does not conflate providers or parents with identical episode IDs', () => {
    expect(
      new Set([
        mediaPartKey('hianime', 'show1', '1'),
        mediaPartKey('animekai', 'show1', '1'),
        mediaPartKey('hianime', 'show2', '1'),
      ]).size,
    ).toBe(3);
    expect(mediaPartKey('hianime', 'a/b', 'c')).not.toBe(mediaPartKey('hianime', 'a', 'b/c'));
  });
});
