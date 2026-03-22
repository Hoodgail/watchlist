import { describe, expect, it } from 'vitest';
import {
  getMangaPlusImageProxyUrl,
  getProxiedImageUrl,
  resolveTmdbImageUrl,
  shouldBypassImageProxy,
} from './imageProxy';

describe('image proxy helpers', () => {
  it('proxies remote images and preserves referer', () => {
    expect(getProxiedImageUrl('https://cdn.example.com/poster.jpg', 'https://provider.example')).toBe(
      'http://localhost:3001/api/proxy/image?url=https%3A%2F%2Fcdn.example.com%2Fposter.jpg&referer=https%3A%2F%2Fprovider.example',
    );
  });

  it('bypasses proxying for tmdb, blob, and api urls', () => {
    expect(shouldBypassImageProxy('blob:abc')).toBe(true);
    expect(shouldBypassImageProxy('/api/proxy/image?x=1')).toBe(true);
    expect(shouldBypassImageProxy('https://image.tmdb.org/t/p/w200/x.jpg')).toBe(true);
  });

  it('builds mangaplus proxy urls through the shared api boundary', () => {
    expect(getMangaPlusImageProxyUrl('https://img.example/page.jpg', 'secret-key')).toBe(
      'http://localhost:3001/api/manga/external/mangaplus/image?url=https%3A%2F%2Fimg.example%2Fpage.jpg&key=secret-key',
    );
  });

  it('resolves tmdb image paths consistently', () => {
    expect(resolveTmdbImageUrl('/poster.jpg')).toBe('https://image.tmdb.org/t/p/w200/poster.jpg');
    expect(resolveTmdbImageUrl('poster.jpg', 'w300')).toBe('https://image.tmdb.org/t/p/w300/poster.jpg');
  });
});
