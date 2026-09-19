// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { assertPublicAddress, validatePublicUrl } from './publicFetch';
describe('media proxy destinations', () => {
  it.each([
    'http://127.0.0.1',
    'http://2130706433',
    'http://169.254.169.254',
    'http://10.0.0.1',
    'http://[::1]',
    'http://[::ffff:127.0.0.1]',
    'file:///etc/passwd',
    'https://user:pass@example.com',
    'http://localhost',
    'https://example.com:5432',
  ])('rejects %s', (url) => expect(() => validatePublicUrl(url)).toThrow());
  it.each(['192.168.1.1', '172.16.0.1', '100.64.0.1', '0.0.0.0', 'fd00::1', 'fe80::1'])(
    'rejects private DNS result %s',
    (address) => expect(() => assertPublicAddress(address)).toThrow(),
  );
  it('permits a public media URL', () =>
    expect(validatePublicUrl('https://example.com/a.m3u8').hostname).toBe('example.com'));
});
