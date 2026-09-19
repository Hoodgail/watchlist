import { lookup } from 'node:dns';
import ipaddr from 'ipaddr.js';
import { Agent, fetch as fetchUpstream } from 'undici';

export function assertPublicAddress(address: string): void {
  const normalized = address.replace(/^\[|\]$/g, '');
  if (ipaddr.isValid(normalized) && ipaddr.process(normalized).range() !== 'unicast') {
    throw new Error('Private and reserved network addresses are not allowed');
  }
}
export function validatePublicUrl(input: string): URL {
  const url = new URL(input);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !['80', '443'].includes(url.port)) ||
    url.hostname === 'localhost' ||
    url.hostname.endsWith('.localhost')
  ) {
    throw new Error('Only public HTTP(S) media URLs are allowed');
  }
  assertPublicAddress(url.hostname);
  return url;
}

// Validate DNS results in the connection itself, so DNS rebinding cannot bypass a preflight check.
const dispatcher = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      lookup(hostname, { all: true }, (error, addresses) => {
        if (error) return callback(error, '', 4);
        try {
          if (!addresses.length) throw new Error('Host has no addresses');
          addresses.forEach((result) => assertPublicAddress(result.address));
          if (options.all) callback(null, addresses);
          else callback(null, addresses[0].address, addresses[0].family);
        } catch (error) {
          callback(error as NodeJS.ErrnoException, '', 4);
        }
      });
    },
  },
});

export async function fetchPublic(input: string, init: RequestInit = {}): Promise<Response> {
  let url = validatePublicUrl(input);
  const signal = init.signal
    ? AbortSignal.any([init.signal, AbortSignal.timeout(60000)])
    : AbortSignal.timeout(60000);
  for (let redirects = 0; redirects <= 5; redirects++) {
    const response = await fetchUpstream(url, {
      ...init,
      signal,
      redirect: 'manual',
      dispatcher,
    } as Parameters<typeof fetchUpstream>[1]);
    if (![301, 302, 303, 307, 308].includes(response.status))
      return response as unknown as Response;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) throw new Error('Redirect has no location');
    url = validatePublicUrl(new URL(location, url).href);
  }
  throw new Error('Too many upstream redirects');
}
