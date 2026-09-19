// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadHLSStream, parseM3U8 } from './downloader';

afterEach(() => vi.unstubAllGlobals());
function playlist(body: string) {
  return `#EXTM3U\n#EXT-X-TARGETDURATION:5\n${body}\n#EXT-X-ENDLIST`;
}
function mockFetch(manifest: string, data = new Uint8Array([1, 2, 3])) {
  const mock = vi.fn(async (url: string, init?: RequestInit) => {
    init?.signal?.throwIfAborted();
    if (url.endsWith('.m3u8')) return new Response(manifest);
    if (init?.method === 'HEAD')
      return new Response(null, { headers: { 'content-length': String(data.length) } });
    return new Response(data);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}
describe('offline HLS downloads', () => {
  it('resolves relative variants against the playlist URL', async () => {
    mockFetch('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000,RESOLUTION=1280x720\n720/main.m3u8');
    expect((await parseM3U8('https://example.com/show/master.m3u8')).qualities?.[0].url).toBe(
      'https://example.com/show/720/main.m3u8',
    );
  });
  it('uses media sequence for implicit AES IVs and resets encryption for METHOD=NONE', async () => {
    mockFetch(
      playlist(
        '#EXT-X-MEDIA-SEQUENCE:42\n#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXTINF:5,\na.ts\n#EXT-X-KEY:METHOD=NONE\n#EXTINF:5,\nb.ts',
      ),
    );
    const info = await parseM3U8('https://example.com/main.m3u8');
    expect(info.segments?.[0].sequence).toBe(42);
    expect(info.segments?.[1].key).toBeUndefined();
  });
  it('decrypts actual AES-CBC bytes with a nonzero sequence', async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-CBC', length: 128 }, true, [
      'encrypt',
      'decrypt',
    ]);
    const raw = await crypto.subtle.exportKey('raw', key);
    const iv = new Uint8Array(16);
    new DataView(iv.buffer).setUint32(12, 42);
    const plain = new TextEncoder().encode('an actual encrypted fixture');
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, plain);
    const manifest = playlist(
      '#EXT-X-MEDIA-SEQUENCE:42\n#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXTINF:5,\na.ts',
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (url: string, init?: RequestInit) =>
          new Response(url.endsWith('.m3u8') ? manifest : url.endsWith('/key') ? raw : encrypted, {
            headers: { 'content-length': '32' },
          }),
      ),
    );
    const save = vi.fn();
    await downloadHLSStream('https://example.com/main.m3u8', { onSegmentDownloaded: save });
    expect(new TextDecoder().decode(save.mock.calls[0][1])).toBe('an actual encrypted fixture');
  });
  it('parses explicit IV words in big-endian order', async () => {
    mockFetch(
      playlist(
        '#EXT-X-KEY:METHOD=AES-128,URI="key",IV=0x0000000000000000000000000000002A\n#EXTINF:5,\na.ts',
      ),
    );
    expect((await parseM3U8('https://example.com/main.m3u8')).segments?.[0].key?.iv?.[15]).toBe(42);
  });
  it('resumes without fetching saved segment bytes', async () => {
    const fetch = mockFetch(playlist('#EXTINF:5,\na.ts\n#EXTINF:5,\nb.ts'));
    const save = vi.fn();
    const result = await downloadHLSStream('https://example.com/main.m3u8', {
      downloadedSegments: new Set([0]),
      onSegmentDownloaded: save,
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toBe(1);
    expect(result.percentage).toBe(100);
    expect(
      fetch.mock.calls.filter(([url, init]) => url.endsWith('/a.ts') && init?.method !== 'HEAD'),
    ).toHaveLength(0);
  });
  it.each([
    '#EXTM3U\n#EXTINF:5,\na.ts',
    playlist('#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key"\n#EXTINF:5,\na.ts'),
    '<html>Error</html>',
  ])('rejects unsupported or invalid playlists', async (manifest) => {
    mockFetch(manifest);
    await expect(parseM3U8('https://example.com/main.m3u8')).rejects.toThrow();
  });
  it('aborts before downloading any bytes', async () => {
    const fetch = mockFetch(playlist('#EXTINF:5,\na.ts'));
    const controller = new AbortController();
    controller.abort();
    await expect(
      downloadHLSStream('https://example.com/main.m3u8', { signal: controller.signal }),
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects a server that ignores a byte range', async () => {
    mockFetch(playlist('#EXT-X-BYTERANGE:10@0\n#EXTINF:5,\na.ts'));
    await expect(downloadHLSStream('https://example.com/main.m3u8')).rejects.toThrow('byte range');
  });
});
