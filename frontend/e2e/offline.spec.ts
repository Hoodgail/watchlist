import { expect, test } from '@playwright/test';
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    console.log('Browser failure page:', await page.locator('body').innerText());
  }
});
test('production shell and its styles survive an offline reload', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open(names.find((name) => name.startsWith('watchlist-shell-'))!);
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  });
  expect(cached.some((path) => path.endsWith('.js'))).toBe(true);
  expect(cached.some((path) => path.endsWith('.css'))).toBe(true);
  expect(cached.some((path) => path.startsWith('/api/'))).toBe(false);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#root')).not.toBeEmpty();
  expect(
    await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor),
  ).not.toBe('rgb(255, 255, 255)');
  expect(errors).toEqual([]);
});
test('manifest is installable and missing assets do not masquerade as HTML', async ({
  request,
}) => {
  const manifest = await (await request.get('/manifest.json')).json();
  expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  expect((await request.get('/assets/does-not-exist.js')).status()).toBe(404);
});
test('proxy rejects internal destinations', async ({ request }) => {
  const response = await request.get('/api/proxy/image?url=http%3A%2F%2F127.0.0.1%3A5432');
  expect(response.ok()).toBe(false);
});

test('downloaded video opens and plays after an offline reload', async ({ page, context }) => {
  page.on('console', message => console.log('[browser]', message.type(), message.text()));
  page.on('pageerror', error => console.log('[browser error]', error.message));
  const { videoBase64 } = await import('./fixtures/video');
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.evaluate(async (data) => {
    localStorage.setItem('accessToken', 'offline-session-fixture');
    localStorage.setItem(
      'watchlist_cached_user',
      JSON.stringify({
        id: 'offline-user',
        username: 'offline_user',
        email: 'offline@example.com',
      }),
    );
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('watchlist-video', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const blob = new Blob([Uint8Array.from(atob(data), (char) => char.charCodeAt(0))], {
      type: 'video/webm',
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['media', 'episodes', 'blobs'], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore('media').put({
        id: 'hianime:fixture',
        title: 'Offline fixture',
        episodeCount: 1,
        downloadedAt: new Date(),
        lastAccessedAt: new Date(),
      });
      tx.objectStore('episodes').put({
        id: 'hianime:fixture/one',
        mediaId: 'hianime:fixture',
        episodeNumber: 1,
        title: 'Fixture episode',
        videoBlobId: 'fixture-video',
        downloadedAt: new Date(),
        fileSize: blob.size,
      });
      tx.objectStore('blobs').put({ id: 'fixture-video', blob, type: 'video', size: blob.size });
    });
    db.close();
  }, videoBase64);
  await context.setOffline(true);
  await page.reload();
  await page.getByText('Offline fixture', { exact: true }).click();
  await page.screenshot({ path: test.info().outputPath('offline-details.png') });
  await page.getByRole('button', { name: 'E1 - Fixture episode', exact: true }).click();
  const video = page.locator('video');
  await expect(video).toBeVisible();
  await video.evaluate(async (element: HTMLVideoElement) => {
    element.muted = true;
    await element.play();
  });
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
    .toBeGreaterThan(0);
});
