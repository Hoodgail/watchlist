import { describe, expect, it, vi } from 'vitest';
vi.mock('../services/mangadexService.js', () => ({
  getMangaById: vi.fn(async () => ({ id: 'title-id', title: 'Fixture', totalChapters: 125 })),
  getMangaChapters: vi.fn(async () => ({
    total: 125,
    chapters: [
      {
        id: 'chapter-id',
        chapter: '12',
        title: 'Chapter',
        volume: '2',
        pages: 3,
        publishAt: '2026-01-01',
      },
    ],
  })),
  getChapterPages: vi.fn(async () => ({
    baseUrl: 'https://uploads.example',
    hash: 'hash',
    data: ['1.jpg', '2.jpg'],
  })),
}));
import {
  getMangaInfo,
  getChaptersPaginated,
  getChapterPages,
} from '../services/consumet/mangaProviders.js';
import * as mangadex from '../services/mangadexService.js';
describe('MangaDex direct API adapter', () => {
  it('retains metadata and paginates beyond the first page', async () => {
    expect(await getMangaInfo('title-id', 'mangadex')).toMatchObject({
      title: 'Fixture',
      totalChapters: 125,
    });
    expect(await getChaptersPaginated('title-id', 'mangadex', 2, 60)).toMatchObject({
      currentPage: 2,
      hasNextPage: true,
      chapters: [{ id: 'chapter-id', number: '12', volume: '2' }],
    });
    expect(mangadex.getMangaChapters).toHaveBeenCalledWith('title-id', 'en', 60, 60);
  });
  it('builds page URLs from the at-home response', async () => {
    expect(await getChapterPages('chapter-id', 'mangadex')).toEqual({
      chapterId: 'chapter-id',
      pages: [
        { page: 1, img: 'https://uploads.example/data/hash/1.jpg' },
        { page: 2, img: 'https://uploads.example/data/hash/2.jpg' },
      ],
    });
  });
});
