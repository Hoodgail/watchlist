import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

/** Bind the shell cache to the actual build, including lazy-loaded bundles. */
export function offlineShell(): Plugin {
  return {
    name: 'offline-shell',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter((name) => !name.endsWith('.map'));
      const version = createHash('sha256')
        .update(JSON.stringify(bundle))
        .digest('hex')
        .slice(0, 12);
      const template = readFileSync(new URL('./service-worker.js', import.meta.url), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace('__BUILD_VERSION__', version)
          .replace(
            "['__BUILD_ASSETS__']",
            JSON.stringify([
              '/',
              '/index.html',
              '/manifest.json',
              '/assets/icon.png',
              '/assets/logo.png',
              ...assets.map((name) => `/${name}`),
            ]),
          ),
      });
    },
  };
}
