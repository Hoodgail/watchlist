import { describe, expect, it } from 'vitest';
import {
  getMangaProviderDisplayName,
  getProviderBaseUrl,
  getProviderDisplayName,
  getVideoProviderDisplayName,
} from './providerMetadata';

describe('provider metadata', () => {
  it('returns stable display names for video providers', () => {
    expect(getVideoProviderDisplayName('hianime')).toBe('HiAnime');
    expect(getVideoProviderDisplayName('flixhq')).toBe('FlixHQ');
  });

  it('returns stable display names for manga providers', () => {
    expect(getMangaProviderDisplayName('mangadex')).toBe('MangaDex');
    expect(getMangaProviderDisplayName('anilist-manga')).toBe('AniList');
  });

  it('resolves provider names and base urls across media domains', () => {
    expect(getProviderDisplayName('animekai')).toBe('AnimeKai');
    expect(getProviderDisplayName('mangapill')).toBe('MangaPill');
    expect(getProviderBaseUrl('goku')).toBe('https://goku.sx');
    expect(getProviderBaseUrl('comick')).toBe('https://comick.io');
  });
});
