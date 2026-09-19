// @vitest-environment node
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import * as storage from './storage';
import { mediaPartKey } from '@shared/mediaIdentity';

beforeEach(async () => {
  await storage.clearAllVideoData();
});
describe('durable offline video storage', () => {
  it('keeps identical upstream episode IDs isolated by provider and parent', async () => {
    const first = mediaPartKey('a', 'title1', '1');
    const second = mediaPartKey('b', 'title1', '1');
    await storage.saveEpisodeOffline(
      'a:title1',
      { id: first, episodeNumber: 1 },
      new Blob(['first']),
    );
    await storage.saveEpisodeOffline(
      'b:title1',
      { id: second, episodeNumber: 1 },
      new Blob(['second']),
    );
    for (const [id, expected] of [
      [first, 'first'],
      [second, 'second'],
    ]) {
      const url = await storage.getOfflineVideoUrl(id);
      expect(await (await fetch(url!)).text()).toBe(expected);
      URL.revokeObjectURL(url!);
    }
    await expect(
      storage.saveEpisodeOffline('other', { id: first, episodeNumber: 1 }, new Blob(['wrong'])),
    ).rejects.toThrow('another title');
  });
  it('roundtrips a multi-chunk MP4 and deletes its stored bytes', async () => {
    const bytes = new Uint8Array(6 * 1024 * 1024).fill(42);
    await storage.saveEpisodeOffline(
      'a:title',
      { id: 'a:title/1', episodeNumber: 1 },
      new Blob([bytes], { type: 'video/mp4' }),
    );
    const url = await storage.getOfflineVideoUrl('a:title/1');
    const actual = new Uint8Array(await (await fetch(url!)).arrayBuffer());
    expect(actual.length).toBe(bytes.length);
    expect(actual.every((value) => value === 42)).toBe(true);
    URL.revokeObjectURL(url!);
    await storage.deleteOfflineEpisode('a:title/1');
    expect(await storage.getOfflineVideoUrl('a:title/1')).toBeNull();
    expect((await storage.getVideoStorageInfo()).totalBlobSize).toBe(0);
  });
  it('does not count initialization bytes as downloaded media and refuses incomplete HLS', async () => {
    await storage.saveHLSInitSegment('a:title/1', new Uint8Array([7, 8, 9]).subarray(1));
    expect(Array.from((await storage.getHLSInitSegment('a:title/1'))!)).toEqual([8, 9]);
    expect((await storage.getDownloadedSegmentIndices('a:title/1')).size).toBe(0);
    await storage.saveHLSSegment('a:title/1', 0, new Uint8Array([1, 2, 3]).subarray(1), 5);
    expect(Array.from((await storage.getHLSSegment('a:title/1', 0))!)).toEqual([2, 3]);
    await expect(
      storage.saveHLSEpisodeOffline(
        'a:title',
        { id: 'a:title/1', episodeNumber: 1 },
        2,
        10,
        4,
        undefined,
        true,
      ),
    ).rejects.toThrow('incomplete');
    await storage.saveHLSSegment('a:title/1', 1, new Uint8Array([4, 5]), 5);
    await storage.saveHLSEpisodeOffline(
      'a:title',
      { id: 'a:title/1', episodeNumber: 1 },
      2,
      10,
      6,
      undefined,
      true,
    );
    await storage.deleteOfflineEpisode('a:title/1');
    expect(await storage.getHLSInitSegment('a:title/1')).toBeNull();
    expect((await storage.getDownloadedSegmentIndices('a:title/1')).size).toBe(0);
  });
});
