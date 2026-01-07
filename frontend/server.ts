import express, { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
    const distPath = path.resolve(__dirname, 'dist');
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
