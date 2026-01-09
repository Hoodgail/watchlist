/**
 * MegaCloud Source Extractor
 * 
 * Custom source extraction for HiAnime's MegaCloud video player.
 * This bypasses the Consumet library which has issues with the current API.
 * 
 * ## How it works:
 * 1. Get server list from HiAnime API
 * 2. Select HD-1/HD-2 server to get MegaCloud embed URL
 * 3. Fetch embed page to extract 48-char nonce
 * 4. Call MegaCloud API with nonce to get sources
 * 5. Decrypt sources if encrypted (AES-256-CBC)
 * 
 * ## References:
 * - https://github.com/ZeroSkillSamus/rabbit/blob/main/src/megacloud.js
 * - https://github.com/yogesh-hacker/MediaVanced/blob/main/sites/megacloud.py
 */

import crypto from 'crypto';
import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  SourceExtractor,
  ExtractorContext,
  ExtractorResult,
  MegaCloudResponse,
  MegaCloudSource,
  DecryptionKeys,
  ServerInfo,
  EmbedInfo,
} from './types.js';
import { UnifiedSourceResult } from '../types.js';

// ============ Constants ============

const HIANIME_BASE_URL = 'https://hianime.to';
const KEY_URL = 'https://raw.githubusercontent.com/yogesh-hacker/MegacloudKeys/refs/heads/main/keys.json';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
  'Referer': HIANIME_BASE_URL,
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
};

// ============ Crypto Utilities ============

/**
 * OpenSSL EVP_BytesToKey implementation for AES-256-CBC decryption
 */
function evpBytesToKey(password: string, salt: Buffer, keyLen = 32, ivLen = 16) {
  let data = Buffer.alloc(0);
  let prev = Buffer.alloc(0);
  
  while (data.length < keyLen + ivLen) {
    const md5 = crypto.createHash('md5');
    md5.update(Buffer.concat([prev, Buffer.from(password), salt]));
    prev = md5.digest();
    data = Buffer.concat([data, prev]);
  }
  
  return {
    key: data.subarray(0, keyLen),
    iv: data.subarray(keyLen, keyLen + ivLen),
  };
}

/**
 * Decrypts an OpenSSL-compatible base64 string encrypted with AES-256-CBC
 */
function decryptOpenSSL(encryptedB64: string, password: string): string {
  const encrypted = Buffer.from(encryptedB64, 'base64');
  
  if (!encrypted.subarray(0, 8).equals(Buffer.from('Salted__'))) {
    throw new Error("Invalid OpenSSL format - missing 'Salted__' prefix");
  }
  
  const salt = encrypted.subarray(8, 16);
  const { key, iv } = evpBytesToKey(password, salt);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  
  let decrypted = decipher.update(encrypted.subarray(16));
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}

// ============ HiAnime API Helpers ============

/**
 * Parse episode ID to extract movie ID and episode number
 * Format: "movie-slug-12345$episode$67890"
 */
function parseEpisodeId(episodeId: string): { movieId: string; episodeNum: string } | null {
  // Format: jujutsu-kaisen-tv-534$episode$10789
  const match = episodeId.match(/^(.+?)\$episode\$(\d+)$/);
  if (match) {
    // Extract movie ID (numeric part) from slug
    const slugMatch = match[1].match(/-(\d+)$/);
    return {
      movieId: slugMatch ? slugMatch[1] : match[1],
      episodeNum: match[2],
    };
  }
  
  // Fallback: try to extract just the episode number
  const numMatch = episodeId.match(/(\d+)$/);
  return numMatch ? { movieId: '', episodeNum: numMatch[1] } : null;
}

/**
 * Get available servers for an episode
 */
async function getServers(episodeId: string): Promise<ServerInfo[]> {
  const parsed = parseEpisodeId(episodeId);
  if (!parsed) {
    throw new Error(`Invalid episode ID format: ${episodeId}`);
  }
  
  const endpoint = `${HIANIME_BASE_URL}/ajax/v2/episode/servers?episodeId=${parsed.episodeNum}`;
  console.log(`[MegaCloud] Fetching servers from: ${endpoint}`);
  
  const response = await axios.get(endpoint, { headers: HEADERS });
  const $ = cheerio.load(response.data.html);
  
  const servers: ServerInfo[] = [];
  $('.server-item').each((_, element) => {
    servers.push({
      id: $(element).attr('data-id') || '',
      name: $(element).text().trim(),
      type: $(element).attr('data-type') as 'sub' | 'dub' | 'raw' | undefined,
    });
  });
  
  console.log(`[MegaCloud] Found ${servers.length} servers:`, servers.map(s => s.name).join(', '));
  return servers;
}

/**
 * Get MegaCloud embed URL from server
 */
async function getEmbedUrl(serverId: string): Promise<string> {
  const endpoint = `${HIANIME_BASE_URL}/ajax/v2/episode/sources?id=${serverId}`;
  console.log(`[MegaCloud] Getting embed URL for server: ${serverId}`);
  
  const response = await axios.get(endpoint, { headers: HEADERS });
  const embedUrl = response.data.link;
  
  if (!embedUrl) {
    throw new Error('No embed URL in response');
  }
  
  console.log(`[MegaCloud] Embed URL: ${embedUrl}`);
  return embedUrl;
}

/**
 * Parse MegaCloud embed URL to extract components
 */
function parseEmbedUrl(url: string): EmbedInfo {
  const urlObj = new URL(url);
  const pathSegments = urlObj.pathname.split('/').filter(Boolean);
  const videoId = pathSegments[pathSegments.length - 1];
  const embedType = pathSegments.find(seg => /^e-\d+$/.test(seg)) || 'e-1';
  
  return {
    url,
    domain: urlObj.origin,
    videoId,
    embedType,
    referer: HIANIME_BASE_URL,
  };
}

/**
 * Extract nonce from embed page
 */
async function extractNonce(embedUrl: string): Promise<string> {
  const embedHeaders = {
    'User-Agent': HEADERS['User-Agent'],
    'Referer': 'https://hianime.to/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };
  
  console.log('[MegaCloud] Fetching embed page for nonce...');
  const response = await axios.get(embedUrl, { headers: embedHeaders });
  const html = response.data;
  
  // Pattern 1: Single 48-character alphanumeric token
  const match48 = html.match(/\b[a-zA-Z0-9]{48}\b/);
  if (match48) {
    console.log(`[MegaCloud] Found 48-char nonce`);
    return match48[0];
  }
  
  // Pattern 2: Three 16-character tokens (x, y, z pattern)
  const match3x16 = html.match(/x:\s*"([a-zA-Z0-9]{16})".*?y:\s*"([a-zA-Z0-9]{16})".*?z:\s*"([a-zA-Z0-9]{16})"/s);
  if (match3x16) {
    const nonce = match3x16[1] + match3x16[2] + match3x16[3];
    console.log(`[MegaCloud] Found 3x16-char nonce`);
    return nonce;
  }
  
  // Pattern 3: Look for data-id attribute
  const $ = cheerio.load(html);
  const dataId = $('#megacloud-player').attr('data-id');
  if (dataId && dataId.length >= 48) {
    console.log(`[MegaCloud] Found data-id nonce`);
    return dataId;
  }
  
  throw new Error('Could not find nonce in embed page');
}

/**
 * Fetch decryption keys from GitHub
 */
async function fetchDecryptionKeys(): Promise<DecryptionKeys> {
  console.log('[MegaCloud] Fetching decryption keys...');
  const response = await axios.get(KEY_URL);
  return response.data;
}

/**
 * Fetch and decrypt video sources from MegaCloud API
 */
async function fetchMegaCloudSources(embed: EmbedInfo, nonce: string): Promise<MegaCloudResponse> {
  const apiUrl = `${embed.domain}/embed-2/v3/${embed.embedType}/getSources?id=${embed.videoId}&_k=${nonce}`;
  console.log(`[MegaCloud] Fetching sources from API...`);
  
  const apiHeaders = {
    'User-Agent': HEADERS['User-Agent'],
    'Referer': embed.url,
    'Origin': embed.domain,
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': '*/*',
  };
  
  const response = await axios.get(apiUrl, { headers: apiHeaders });
  const data = response.data as MegaCloudResponse;
  
  // Check if sources are encrypted
  if (typeof data.sources === 'string') {
    console.log('[MegaCloud] Sources are encrypted, decrypting...');
    
    const keys = await fetchDecryptionKeys();
    const password = keys.mega || keys.vidstr;
    
    if (!password) {
      throw new Error('No decryption key available');
    }
    
    const decrypted = decryptOpenSSL(data.sources, password);
    data.sources = JSON.parse(decrypted) as MegaCloudSource[];
    console.log(`[MegaCloud] Decryption successful, got ${data.sources.length} sources`);
  }
  
  return data;
}

// ============ Main Extractor ============

/**
 * Convert MegaCloud response to unified format
 * @param response - MegaCloud API response
 * @param referer - Referer URL required for video playback
 */
function convertToUnified(response: MegaCloudResponse, referer: string): UnifiedSourceResult {
  const sources = Array.isArray(response.sources) ? response.sources : [];
  
  return {
    // Include headers needed for video playback
    headers: {
      'Referer': referer,
    },
    sources: sources.map(s => ({
      url: s.file,
      quality: 'auto',
      isM3U8: s.file.includes('.m3u8') || s.type === 'hls',
    })),
    subtitles: response.tracks
      ?.filter(t => t.kind === 'captions' || t.kind === 'subtitles' || !t.kind)
      .map(t => ({
        url: t.file,
        lang: t.label || 'Unknown',
      })),
    intro: response.intro,
    outro: response.outro,
  };
}

/**
 * MegaCloud Source Extractor for HiAnime
 */
export class MegaCloudExtractor implements SourceExtractor {
  name = 'megacloud';
  providers = ['hianime'];
  priority = 100; // High priority - use this before Consumet

  canHandle(context: ExtractorContext): boolean {
    // Can handle any HiAnime episode ID
    return context.episodeId.includes('$episode$') || /^\d+$/.test(context.episodeId);
  }

  async extract(context: ExtractorContext): Promise<ExtractorResult> {
    try {
      console.log(`[MegaCloud] Starting extraction for: ${context.episodeId}`);
      
      // Step 1: Get servers
      const servers = await getServers(context.episodeId);
      if (servers.length === 0) {
        return {
          success: false,
          error: 'No servers found',
          shouldFallback: true,
        };
      }
      
      // Step 2: Select server (prefer HD-1 or HD-2 for sub, filter by type if specified)
      let selectedServer = servers.find(s => {
        if (context.subOrDub) {
          return s.type === context.subOrDub && (s.name === 'HD-1' || s.name === 'HD-2');
        }
        return s.name === 'HD-1' || s.name === 'HD-2';
      });
      
      if (!selectedServer) {
        selectedServer = context.subOrDub
          ? servers.find(s => s.type === context.subOrDub)
          : servers[0];
      }
      
      if (!selectedServer) {
        return {
          success: false,
          error: 'No suitable server found',
          shouldFallback: true,
        };
      }
      
      console.log(`[MegaCloud] Using server: ${selectedServer.name} (${selectedServer.type})`);
      
      // Step 3: Get embed URL
      const embedUrl = await getEmbedUrl(selectedServer.id);
      const embed = parseEmbedUrl(embedUrl);
      
      // Step 4: Extract nonce
      const nonce = await extractNonce(embedUrl);
      
      // Step 5: Fetch and decrypt sources
      const megaCloudResponse = await fetchMegaCloudSources(embed, nonce);
      
      // Step 6: Convert to unified format (include referer for proxy)
      const referer = embed.domain || 'https://megacloud.blog/';
      const sources = convertToUnified(megaCloudResponse, referer);
      
      if (sources.sources.length === 0) {
        return {
          success: false,
          error: 'No sources in response',
          shouldFallback: true,
        };
      }
      
      console.log(`[MegaCloud] Successfully extracted ${sources.sources.length} sources`);
      
      return {
        success: true,
        sources,
        debug: {
          server: selectedServer.name,
          serverType: selectedServer.type,
          sourceCount: sources.sources.length,
          subtitleCount: sources.subtitles?.length || 0,
        },
      };
      
    } catch (error: any) {
      console.error('[MegaCloud] Extraction failed:', error.message);
      return {
        success: false,
        error: error.message,
        shouldFallback: true,
        debug: {
          errorType: error.name,
          stack: error.stack,
        },
      };
    }
  }
}

// Export singleton instance
export const megaCloudExtractor = new MegaCloudExtractor();
