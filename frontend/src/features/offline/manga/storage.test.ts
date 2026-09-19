// @vitest-environment node
import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import {
  clearAllOfflineData,
  saveChapterOffline,
  savePageOffline,
  isChapterDownloaded,
  deleteOfflineChapter,
  getOfflinePagesForChapter,
} from './storage';
import type { ChapterInfo } from '../../../services/mangadexTypes';
beforeEach(clearAllOfflineData);
it('only marks a complete chapter as downloaded and removes all its pages', async () => {
  const chapter = { id: 'mangadex:title/chapter', title: 'Fixture', pages: 2 } as ChapterInfo;
  await saveChapterOffline('mangadex:title', chapter);
  await savePageOffline('mangadex:title', chapter.id, 1, new Blob(['page1']));
  expect(await isChapterDownloaded(chapter.id)).toBe(false);
  await savePageOffline('mangadex:title', chapter.id, 2, new Blob(['page2']));
  expect(await isChapterDownloaded(chapter.id)).toBe(true);
  await expect(saveChapterOffline('other:title', chapter)).rejects.toThrow('another title');
  await deleteOfflineChapter(chapter.id);
  expect(await getOfflinePagesForChapter(chapter.id)).toEqual([]);
});
