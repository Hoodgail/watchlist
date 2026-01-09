import express, { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  parseMangaPlusResponse,
  decryptMangaPlusImage,
  isValidMangaPlusCdnUrl,
  isValidEncryptionKey,
  buildMangaPlusApiUrl,
} from '../shared/mangaplus';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3200;
const API_URL = process.env.VITE_API_URL || 'http://localhost:3201/api';
const FRONTEND_URL = process.env.VITE_FRONTEND_URL || 'http://localhost:3200';

interface ProfileData {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  isPublic: boolean;
  followerCount: number;
  followingCount: number;
  list?: Array<{ id: string; title: string; type: string }>;
}

// Escape HTML to prevent XSS in meta tags
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Fetch profile data from API
async function fetchProfile(username: string): Promise<ProfileData | null> {
  try {
    console.log(`[SSR] Fetching profile from: ${API_URL}/profile/${username}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${API_URL}/profile/${encodeURIComponent(username)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`[SSR] Profile response not ok: ${response.status}`);
      return null;
    }
    const data = await response.json();
    console.log(`[SSR] Profile fetched successfully for: ${data.username}`);
    return data;
  } catch (error) {
    console.error('[SSR] Failed to fetch profile:', error);
    return null;
  }
}

// Generate meta tags for profile page
function generateProfileMetaTags(profile: ProfileData, username: string): string {
  const displayName = escapeHtml(profile.displayName || profile.username);
  const pageTitle = `${displayName}'s Watchlist`;
  const pageUrl = `${FRONTEND_URL}/u/${encodeURIComponent(username)}`;
  
  let description: string;
  if (profile.list) {
    const itemCount = profile.list.length;
    description = `Check out what ${displayName} is watching. ${itemCount} items in their watchlist.`;
  } else {
    description = `${displayName}'s profile is private.`;
  }
  description = escapeHtml(description);
  
  const avatarUrl = profile.avatarUrl ? escapeHtml(profile.avatarUrl) : `${FRONTEND_URL}/assets/logo.png`;
  
  return `
    <title>${pageTitle}</title>
    <meta name="title" content="${pageTitle}" />
    <meta name="description" content="${description}" />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="profile" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:title" content="${pageTitle}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${avatarUrl}" />
    <meta property="og:site_name" content="Watchlist" />
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:url" content="${pageUrl}" />
    <meta name="twitter:title" content="${pageTitle}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${avatarUrl}" />
  `;
}

// Default meta tags for non-profile pages
function getDefaultMetaTags(): string {
  return `
    <title>Watchlist - Track Movies, TV Shows, Anime & Manga</title>
    <meta name="title" content="Watchlist - Track Movies, TV Shows, Anime & Manga" />
    <meta name="description" content="Track your movies, TV shows, anime, and manga. Share your progress with friends and discover what they're watching. Free and easy to use." />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${FRONTEND_URL}/" />
    <meta property="og:title" content="Watchlist - Track Movies, TV Shows, Anime & Manga" />
    <meta property="og:description" content="Track your movies, TV shows, anime, and manga. Share your progress with friends and discover what they're watching." />
    <meta property="og:image" content="${FRONTEND_URL}/assets/banner.png" />
    <meta property="og:site_name" content="Watchlist" />
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${FRONTEND_URL}/" />
    <meta name="twitter:title" content="Watchlist - Track Movies, TV Shows, Anime & Manga" />
    <meta name="twitter:description" content="Track your movies, TV shows, anime, and manga. Share your progress with friends and discover what they're watching." />
    <meta name="twitter:image" content="${FRONTEND_URL}/assets/banner.png" />
  `;
}

async function createServer() {
  const app = express();

  // Compression for production
  if (isProduction) {
    app.use(compression());
  }

  // ============ MangaDex Proxy Endpoints ============
  // These bypass CORS restrictions for MangaDex API
  
  const MANGADEX_API_BASE = 'https://api.mangadex.org';
  
  // Helper to build query string from Express query object (handles arrays)
  function buildQueryString(query: Record<string, any>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v));
      } else if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }
    return params.toString();
  }
  
  // Proxy search requests
  app.get('/api/mangadex/manga', async (req: Request, res: Response) => {
    try {
      const queryString = buildQueryString(req.query as Record<string, any>);
      const response = await fetch(`${MANGADEX_API_BASE}/manga?${queryString}`);
      
      if (!response.ok) {
        res.status(response.status).json({ error: 'Failed to fetch from MangaDex' });
        return;
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('[MangaDex] Search error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Proxy manga details
  app.get('/api/mangadex/manga/:mangaId', async (req: Request, res: Response) => {
    const { mangaId } = req.params;
    
    try {
      const queryString = buildQueryString(req.query as Record<string, any>);
      const response = await fetch(`${MANGADEX_API_BASE}/manga/${mangaId}?${queryString}`);
      
      if (!response.ok) {
        res.status(response.status).json({ error: 'Failed to fetch from MangaDex' });
        return;
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('[MangaDex] Manga fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Proxy manga aggregate (chapter list summary)
  app.get('/api/mangadex/manga/:mangaId/aggregate', async (req: Request, res: Response) => {
    const { mangaId } = req.params;
    
    try {
      const queryString = buildQueryString(req.query as Record<string, any>);
      const response = await fetch(`${MANGADEX_API_BASE}/manga/${mangaId}/aggregate?${queryString}`);
      
      if (!response.ok) {
        res.status(response.status).json({ error: 'Failed to fetch from MangaDex' });
        return;
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('[MangaDex] Aggregate fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Proxy chapter list
  app.get('/api/mangadex/chapter', async (req: Request, res: Response) => {
    try {
      const queryString = buildQueryString(req.query as Record<string, any>);
      const response = await fetch(`${MANGADEX_API_BASE}/chapter?${queryString}`);
      
      if (!response.ok) {
        res.status(response.status).json({ error: 'Failed to fetch from MangaDex' });
        return;
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('[MangaDex] Chapter list error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Proxy at-home server (for chapter pages)
  app.get('/api/mangadex/at-home/server/:chapterId', async (req: Request, res: Response) => {
    const { chapterId } = req.params;
    
    try {
      const response = await fetch(`${MANGADEX_API_BASE}/at-home/server/${chapterId}`);
      
      if (!response.ok) {
        res.status(response.status).json({ error: 'Failed to fetch from MangaDex' });
        return;
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('[MangaDex] At-home server error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Proxy manga feed (chapter list)
  app.get('/api/mangadex/manga/:mangaId/feed', async (req: Request, res: Response) => {
    const { mangaId } = req.params;
    
    try {
      const queryString = buildQueryString(req.query as Record<string, any>);
      const response = await fetch(`${MANGADEX_API_BASE}/manga/${mangaId}/feed?${queryString}`);
      
      if (!response.ok) {
        res.status(response.status).json({ error: 'Failed to fetch from MangaDex' });
        return;
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('[MangaDex] Feed fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Proxy statistics
  app.get('/api/mangadex/statistics/manga/:mangaId', async (req: Request, res: Response) => {
    const { mangaId } = req.params;
    
    try {
      const response = await fetch(`${MANGADEX_API_BASE}/statistics/manga/${mangaId}`);
      
      if (!response.ok) {
        res.status(response.status).json({ error: 'Failed to fetch from MangaDex' });
        return;
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('[MangaDex] Statistics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Proxy chapter details
  app.get('/api/mangadex/chapter/:chapterId', async (req: Request, res: Response) => {
    const { chapterId } = req.params;
    
    try {
      const queryString = buildQueryString(req.query as Record<string, any>);
      const response = await fetch(`${MANGADEX_API_BASE}/chapter/${chapterId}?${queryString}`);
      
      if (!response.ok) {
        res.status(response.status).json({ error: 'Failed to fetch from MangaDex' });
        return;
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('[MangaDex] Chapter details error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Proxy cover images with localhost referrer
  app.get('/api/mangadex/covers/:mangaId/:fileName', async (req: Request, res: Response) => {
    const { mangaId, fileName } = req.params;
    
    try {
      const coverUrl = `https://uploads.mangadex.org/covers/${mangaId}/${fileName}`;
      const response = await fetch(coverUrl, {
        headers: {
          'Referer': 'http://localhost/',
          'User-Agent': 'Mozilla/5.0 (compatible; Watchlist/1.0)',
        },
      });
      
      if (!response.ok) {
        res.status(response.status).json({ error: 'Failed to fetch cover' });
        return;
      }
      
      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('Content-Type') || 'image/jpeg';
      
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=604800'); // Cache for 7 days
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('[MangaDex] Cover fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ============ Generic Image Proxy Endpoint ============
  // Proxy images with browser-like headers to bypass hotlink protection
  
  app.get('/api/proxy/image', async (req: Request, res: Response) => {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Missing url parameter' });
      return;
    }
    
    try {
      // Parse URL to get origin for referer
      const parsedUrl = new URL(url);
      const origin = parsedUrl.origin;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Accept-Language': 'en-US,en;q=0.9',
          'Priority': 'i',
          'Referer': origin,
          'Sec-Ch-Ua': '"Microsoft Edge";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'same-origin',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        },
      });
      
      if (!response.ok) {
        res.status(response.status).json({ error: 'Failed to fetch image' });
        return;
      }
      
      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('Content-Type') || 'image/jpeg';
      
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('[Proxy] Image fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ============ MangaPlus Proxy Endpoints ============
  // These bypass CORS restrictions for MangaPlus API and images
  
  // Fetch chapter data (pages + encryption keys)
  app.get('/api/mangaplus/chapter/:chapterId', async (req: Request, res: Response) => {
    const { chapterId } = req.params;
    
    try {
      const mangaPlusUrl = buildMangaPlusApiUrl(chapterId);
      
      const response = await fetch(mangaPlusUrl);
      
      if (!response.ok) {
        res.status(response.status).json({ error: 'Failed to fetch from MangaPlus' });
        return;
      }
      
      const buffer = await response.arrayBuffer();
      const pages = parseMangaPlusResponse(buffer);
      
      if (pages.length === 0) {
        res.status(404).json({ error: 'No pages found in chapter' });
        return;
      }
      
      res.json({ pages });
    } catch (error) {
      console.error('[MangaPlus] Chapter fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Fetch and decrypt image
  app.get('/api/mangaplus/image', async (req: Request, res: Response) => {
    const { url, key } = req.query;
    
    if (!url || !key || typeof url !== 'string' || typeof key !== 'string') {
      res.status(400).json({ error: 'Missing url or key parameter' });
      return;
    }
    
    // Validate the URL is from MangaPlus CDN
    if (!isValidMangaPlusCdnUrl(url)) {
      res.status(400).json({ error: 'Invalid image URL' });
      return;
    }
    
    // Validate key is 128 hex characters
    if (!isValidEncryptionKey(key)) {
      res.status(400).json({ error: 'Invalid encryption key' });
      return;
    }
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        res.status(response.status).json({ error: 'Failed to fetch image' });
        return;
      }
      
      const buffer = await response.arrayBuffer();
      const encrypted = new Uint8Array(buffer);
      const decrypted = decryptMangaPlusImage(encrypted, key);
      
      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      res.send(Buffer.from(decrypted));
    } catch (error) {
      console.error('[MangaPlus] Image fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ============ Video Proxy Endpoints ============
  // These bypass CORS/Referer restrictions for video streaming (M3U8, TS segments)
  
  // Allowed referer domains - these are the video embed sources we trust
  // The actual video CDN domains (like sunburst93.live) change frequently,
  // so we validate the referer instead
  const ALLOWED_REFERER_DOMAINS = [
    'megacloud.blog',
    'megacloud.tv',
    'rapid-cloud.co',
    'rabbitstream.net',
    'vidstream.pro',
    'vidcloud.co',
    'streameeeeee.site',
  ];
  
  function isAllowedReferer(referer: string | undefined): boolean {
    if (!referer) return false;
    // try {
    //   const parsed = new URL(referer);
    //   return ALLOWED_REFERER_DOMAINS.some(domain => 
    //     parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
    //   );
    // } catch {
    //   return false;
    // }
    return true;
  }
  
  // Proxy M3U8 playlist - rewrites segment URLs to go through proxy
  // Use ?raw=1 to get the original M3U8 content without URL rewriting (for downloads)
  app.get('/api/video/m3u8', async (req: Request, res: Response) => {
    const { url, referer, raw } = req.query;
    
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Missing url parameter' });
      return;
    }
    
    const refererStr = typeof referer === 'string' ? referer : undefined;
    const returnRaw = raw === '1' || raw === 'true';
    
    // Validate referer is from a trusted video platform
    if (!isAllowedReferer(refererStr)) {
      console.warn('[Video] Blocked - invalid or missing referer:', refererStr);
      res.status(403).json({ error: 'Invalid referer' });
      return;
    }
    
    try {
      const parsedUrl = new URL(url);
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      // Strip referer to just origin with trailing slash - CDNs expect this format
      const refererOrigin = new URL(refererStr!).origin + '/';
      
      console.log(`[Video] Proxying M3U8${returnRaw ? ' (raw)' : ''}: ${url.substring(0, 80)}...`);
      
      const response = await fetch(url, {
        headers: {
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': refererOrigin,
          'Origin': new URL(refererStr!).origin,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        },
      });
      
      if (!response.ok) {
        console.error(`[Video] M3U8 fetch failed: ${response.status}`);
        res.status(response.status).json({ error: 'Failed to fetch M3U8' });
        return;
      }
      
      let m3u8Content = await response.text();
      
      // If raw mode, return the original content without URL rewriting
      // The client (HLS downloader) will handle URL resolution itself
      if (returnRaw) {
        res.set('Content-Type', 'application/vnd.apple.mpegurl');
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cache-Control', 'no-cache');
        res.send(m3u8Content);
        return;
      }
      
      // Rewrite URLs in M3U8 to go through our proxy
      // Handle both relative and absolute URLs
      const lines = m3u8Content.split('\n');
      const rewrittenLines = lines.map(line => {
        const trimmedLine = line.trim();
        
        // Skip comments and empty lines
        if (trimmedLine.startsWith('#') || trimmedLine === '') {
          // But check for URI= in EXT-X-KEY and EXT-X-MAP tags
          if (trimmedLine.includes('URI="')) {
            return line.replace(/URI="([^"]+)"/g, (match, uri) => {
              const absoluteUri = uri.startsWith('http') ? uri : new URL(uri, baseUrl).href;
              const proxyUri = `/api/video/segment?url=${encodeURIComponent(absoluteUri)}&referer=${encodeURIComponent(refererOrigin)}`;
              return `URI="${proxyUri}"`;
            });
          }
          return line;
        }
        
        // If it's a URL line (segment or sub-playlist)
        if (trimmedLine.startsWith('http')) {
          // Absolute URL
          if (trimmedLine.endsWith('.m3u8')) {
            return `/api/video/m3u8?url=${encodeURIComponent(trimmedLine)}&referer=${encodeURIComponent(refererOrigin)}`;
          }
          return `/api/video/segment?url=${encodeURIComponent(trimmedLine)}&referer=${encodeURIComponent(refererOrigin)}`;
        } else if (!trimmedLine.startsWith('#')) {
          // Relative URL - convert to absolute then proxy
          const absoluteUrl = new URL(trimmedLine, baseUrl).href;
          if (trimmedLine.endsWith('.m3u8')) {
            return `/api/video/m3u8?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(refererOrigin)}`;
          }
          return `/api/video/segment?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(refererOrigin)}`;
        }
        
        return line;
      });
      
      const rewrittenContent = rewrittenLines.join('\n');
      
      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cache-Control', 'no-cache');
      res.send(rewrittenContent);
    } catch (error) {
      console.error('[Video] M3U8 proxy error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Proxy video segments (TS files, encryption keys, etc.)
  // Support both GET and HEAD methods for size estimation
  const handleSegmentProxy = async (req: Request, res: Response) => {
    const { url, referer } = req.query;
    const isHead = req.method === 'HEAD';
    
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Missing url parameter' });
      return;
    }
    
    const refererStr = typeof referer === 'string' ? referer : undefined;
    
    // Validate referer is from a trusted video platform
    if (!isAllowedReferer(refererStr)) {
      console.warn('[Video] Segment blocked - invalid referer:', refererStr);
      res.status(403).json({ error: 'Invalid referer' });
      return;
    }
    
    try {
      // Strip referer to just origin with trailing slash - CDNs expect this format
      const refererOrigin = new URL(refererStr!).origin + '/';
      
      const response = await fetch(url, {
        method: isHead ? 'HEAD' : 'GET',
        headers: {
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': refererOrigin,
          'Origin': new URL(refererStr!).origin,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        },
      });
      
      if (!response.ok) {
        console.error(`[Video] Segment fetch failed: ${response.status} for ${url.substring(0, 60)}...`);
        res.status(response.status).json({ error: 'Failed to fetch segment' });
        return;
      }
      
      const contentType = response.headers.get('Content-Type') || 'video/mp2t';
      const contentLength = response.headers.get('Content-Length');
      
      res.set('Content-Type', contentType);
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cache-Control', 'public, max-age=3600'); // Cache segments for 1 hour
      if (contentLength) {
        res.set('Content-Length', contentLength);
      }
      
      if (isHead) {
        res.end();
      } else {
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
      }
    } catch (error) {
      console.error('[Video] Segment proxy error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
  app.get('/api/video/segment', handleSegmentProxy);
  app.head('/api/video/segment', handleSegmentProxy);
 
  
  // Proxy subtitles/VTT files
  app.get('/api/video/subtitle', async (req: Request, res: Response) => {
    const { url, referer } = req.query;
    
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Missing url parameter' });
      return;
    }
    
    const refererStr = typeof referer === 'string' ? referer : undefined;
    
    // Validate referer is from a trusted video platform
    if (!isAllowedReferer(refererStr)) {
      console.warn('[Video] Subtitle blocked - invalid referer:', refererStr);
      res.status(403).json({ error: 'Invalid referer' });
      return;
    }
    
    try {
      // Strip referer to just origin with trailing slash - CDNs expect this format
      const refererOrigin = new URL(refererStr!).origin + '/';
      
      const response = await fetch(url, {
        headers: {
          'Accept': '*/*',
          'Referer': refererOrigin,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        },
      });
      
      if (!response.ok) {
        res.status(response.status).json({ error: 'Failed to fetch subtitle' });
        return;
      }
      
      const content = await response.text();
      const contentType = response.headers.get('Content-Type') || 'text/vtt';
      
      res.set('Content-Type', contentType);
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      res.send(content);
    } catch (error) {
      console.error('[Video] Subtitle proxy error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  let vite: any;
  let template: string;

  if (!isProduction) {
    // Development: use Vite dev server middleware
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom', // Use 'custom' instead of 'spa' to prevent Vite from handling HTML
    });
    template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
    
    // Handle profile pages with dynamic meta tags BEFORE Vite middleware
    app.get('/u/:username', async (req: Request, res: Response) => {
      const { username } = req.params;
      console.log(`[SSR] Profile request for: ${username}`);
      
      try {
        // Fetch profile data first (can happen in parallel with transform)
        const profile = await fetchProfile(username);
        console.log(`[SSR] Profile fetched:`, profile ? 'found' : 'not found');
        
        // Generate appropriate meta tags
        const metaTags = profile 
          ? generateProfileMetaTags(profile, username)
          : getDefaultMetaTags();
        
        // Replace the entire SSR_META block with our dynamic tags
        let modifiedTemplate = template.replace(
          /<!--SSR_META_START-->[\s\S]*?<!--SSR_META_END-->/,
          metaTags
        );
        
        console.log(`[SSR] Transforming HTML...`);
        let html = await vite.transformIndexHtml(req.originalUrl, modifiedTemplate);
        console.log(`[SSR] HTML transformed, length: ${html.length}`);
        
        console.log(`[SSR] Sending response...`);
        res.status(200).type('html').send(html);
        console.log(`[SSR] Response sent`);
      } catch (e) {
        console.error('SSR Error:', e);
        res.status(200).type('html').send(template);
      }
    });
    
    // Then add Vite middleware for everything else (JS, CSS, HMR, etc.)
    app.use(vite.middlewares);
    
    // SPA fallback for non-asset routes
    app.use((req: Request, res: Response, next: NextFunction) => {
      // Skip if it's a file request (has extension)
      if (req.originalUrl.includes('.')) {
        return next();
      }
      
      (async () => {
        try {
          let html = await vite.transformIndexHtml(req.originalUrl, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
        } catch (e) {
          console.error('Error serving page:', e);
          res.status(500).end('Internal Server Error');
        }
      })();
    });
  } else {
    // Production: serve static files from dist
    // In production, server.js is in the same directory as index.html and assets
    const distPath = __dirname;
    template = fs.readFileSync(path.resolve(distPath, 'index.html'), 'utf-8');
    
    // Handle profile pages with dynamic meta tags
    app.get('/u/:username', async (req: Request, res: Response) => {
      const { username } = req.params;
      
      try {
        // Fetch profile data
        const profile = await fetchProfile(username);
        
        // Generate appropriate meta tags
        const metaTags = profile 
          ? generateProfileMetaTags(profile, username)
          : getDefaultMetaTags();
        
        // Replace the entire SSR_META block with our dynamic tags
        const html = template.replace(
          /<!--SSR_META_START-->[\s\S]*?<!--SSR_META_END-->/,
          metaTags
        );
        
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        console.error('SSR Error:', e);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      }
    });
    
    // Serve static assets with caching
    app.use('/assets', express.static(path.resolve(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true,
    }));
    app.use(express.static(distPath, {
      index: false, // Don't serve index.html automatically
    }));
    
    // SPA fallback for all other routes
    app.use((req: Request, res: Response, next: NextFunction) => {
      // Skip file requests
      if (req.originalUrl.includes('.')) {
        return next();
      }
      
      try {
        // Serve original template with default meta tags intact
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        console.error('Error serving page:', e);
        res.status(500).end('Internal Server Error');
      }
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Mode: ${isProduction ? 'production' : 'development'}`);
    console.log(`API URL: ${API_URL}`);
  });
}

createServer();
