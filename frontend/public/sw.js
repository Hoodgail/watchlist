// Service Worker for Watchlist App
// Provides offline support, caching, and background sync

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `watchlist-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `watchlist-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `watchlist-images-${CACHE_VERSION}`;
const MANGADEX_CACHE = `watchlist-mangadex-${CACHE_VERSION}`;

// Static assets to precache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/logo.png',
  '/assets/icon.png',
];

// Cache TTL settings (in milliseconds)
const CACHE_TTL = {
  API: 60 * 60 * 1000, // 1 hour
  COVERS: 7 * 24 * 60 * 60 * 1000, // 7 days
  IMAGES: 24 * 60 * 60 * 1000, // 1 day
};

// ============ Install Event ============

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Precaching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Service worker installed');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to precache:', error);
      })
  );
});

// ============ Activate Event ============

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Delete old caches
              return name.startsWith('watchlist-') && 
                     name !== STATIC_CACHE && 
                     name !== DYNAMIC_CACHE && 
                     name !== IMAGE_CACHE &&
                     name !== MANGADEX_CACHE;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// ============ Fetch Event ============

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip Chrome extension requests and dev tools
  if (url.protocol === 'chrome-extension:' || url.hostname === 'localhost') {
    return;
  }
  
  // Handle different request types
  if (isMangaDexApiRequest(url)) {
    event.respondWith(handleMangaDexApiRequest(event.request));
  } else if (isMangaDexCoverRequest(url)) {
    event.respondWith(handleMangaDexCoverRequest(event.request));
  } else if (isMangaDexImageRequest(url)) {
    event.respondWith(handleMangaDexImageRequest(event.request));
  } else if (isStaticAsset(url)) {
    event.respondWith(handleStaticAssetRequest(event.request));
  } else if (isApiRequest(url)) {
    event.respondWith(handleApiRequest(event.request));
  } else {
    event.respondWith(handleNavigationRequest(event.request));
  }
});

// ============ Request Type Checkers ============

function isMangaDexApiRequest(url) {
  return url.pathname.startsWith('/api/mangadex/');
}

function isMangaDexCoverRequest(url) {
  return url.pathname.startsWith('/api/mangadex/covers/');
}

function isMangaDexImageRequest(url) {
  return url.hostname.includes('.mangadex.network') || 
         (url.hostname === 'uploads.mangadex.org' && !url.pathname.includes('/covers/'));
}

function isStaticAsset(url) {
  return url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i);
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

// ============ Request Handlers ============

// Cache-first strategy for static assets
async function handleStaticAssetRequest(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Failed to fetch static asset:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network-first strategy for navigation requests
async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Return cached index.html for SPA navigation
    const indexCached = await caches.match('/index.html');
    if (indexCached) {
      return indexCached;
    }
    
    return new Response('Offline', { status: 503 });
  }
}

// Network-first with short cache for API requests
async function handleApiRequest(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    // Don't cache API requests - they're handled by the app
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Network-first with cache for MangaDex API
async function handleMangaDexApiRequest(request) {
  const url = new URL(request.url);
  
  // Don't cache at-home server requests (they're time-sensitive)
  if (url.pathname.includes('/at-home/')) {
    try {
      return await fetch(request);
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(MANGADEX_CACHE);
      const responseClone = response.clone();
      
      // Add timestamp header for cache invalidation
      const headers = new Headers(responseClone.headers);
      headers.set('sw-cache-time', Date.now().toString());
      
      cache.put(request, new Response(await responseClone.blob(), {
        status: responseClone.status,
        statusText: responseClone.statusText,
        headers,
      }));
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      // Check if cache is still valid
      const cacheTime = cached.headers.get('sw-cache-time');
      if (cacheTime && Date.now() - parseInt(cacheTime) < CACHE_TTL.API) {
        return cached;
      }
    }
    
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Cache-first with long TTL for MangaDex covers
async function handleMangaDexCoverRequest(request) {
  const cached = await caches.match(request);
  if (cached) {
    const cacheTime = cached.headers.get('sw-cache-time');
    if (cacheTime && Date.now() - parseInt(cacheTime) < CACHE_TTL.COVERS) {
      return cached;
    }
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(IMAGE_CACHE);
      const headers = new Headers(response.headers);
      headers.set('sw-cache-time', Date.now().toString());
      
      cache.put(request, new Response(await response.clone().blob(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      }));
    }
    return response;
  } catch (error) {
    if (cached) {
      return cached;
    }
    return new Response('Image not available', { status: 503 });
  }
}

// Cache-first for MangaDex chapter images (these are typically downloaded offline)
async function handleMangaDexImageRequest(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(IMAGE_CACHE);
      const headers = new Headers(response.headers);
      headers.set('sw-cache-time', Date.now().toString());
      
      cache.put(request, new Response(await response.clone().blob(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      }));
    }
    return response;
  } catch (error) {
    return new Response('Image not available', { status: 503 });
  }
}

// ============ Background Sync ============

self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);
  
  if (event.tag === 'sync-reading-progress') {
    event.waitUntil(syncReadingProgress());
  }
});

async function syncReadingProgress() {
  // This will be called when the app comes back online
  // The actual sync logic is handled by the OfflineContext in the app
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_READING_PROGRESS',
    });
  });
}

// ============ Messages from App ============

self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_IMAGE') {
    cacheImage(event.data.url);
  }
  
  if (event.data.type === 'CLEAR_IMAGE_CACHE') {
    clearImageCache();
  }
});

async function cacheImage(url) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const cache = await caches.open(IMAGE_CACHE);
      cache.put(url, response);
    }
  } catch (error) {
    console.error('[SW] Failed to cache image:', error);
  }
}

async function clearImageCache() {
  try {
    await caches.delete(IMAGE_CACHE);
    console.log('[SW] Image cache cleared');
  } catch (error) {
    console.error('[SW] Failed to clear image cache:', error);
  }
}

// ============ Periodic Background Sync (for auto-downloading) ============

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-new-chapters') {
    event.waitUntil(checkNewChapters());
  }
});

async function checkNewChapters() {
  // Notify the app to check for new chapters
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'CHECK_NEW_CHAPTERS',
    });
  });
}
