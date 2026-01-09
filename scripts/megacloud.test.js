/**
 * MegaCloud Video Source Extraction Test
 * 
 * This test demonstrates how to extract video sources from MegaCloud/HiAnime.
 * 
 * ## Key Findings (from reverse engineering):
 * 
 * 1. **Embed URL Format**: https://megacloud.blog/embed-2/v3/e-1/{VIDEO_ID}?k=1
 * 
 * 2. **API Endpoint**: /embed-2/v3/{embedType}/getSources?id={videoId}&_k={nonce}
 *    - Note: Uses `_k` parameter (NOT `t`)
 *    - Path uses `/v3/` (NOT `/ajax/`)
 * 
 * 3. **Nonce Extraction**: 48-character alphanumeric token from embed page HTML
 *    - Pattern: /\b[a-zA-Z0-9]{48}\b/
 *    - Or 3x16-char: x:"...", y:"...", z:"..." concatenated
 * 
 * 4. **Response Format**:
 *    - `sources`: Array of {file, type} or encrypted string
 *    - `tracks`: Array of subtitle tracks
 *    - `intro`/`outro`: Timestamp objects
 * 
 * 5. **Decryption** (when sources is a string):
 *    - Algorithm: OpenSSL AES-256-CBC with salted prefix
 *    - Key: Fetched from GitHub (changes periodically)
 *    - URL: https://raw.githubusercontent.com/yogesh-hacker/MegacloudKeys/refs/heads/main/keys.json
 * 
 * ## References:
 * - https://github.com/ZeroSkillSamus/rabbit/blob/main/src/megacloud.js
 * - https://github.com/GraveEaterMadison/megacloudpy/blob/main/megacloud.py
 * - https://github.com/yogesh-hacker/MediaVanced/blob/main/sites/megacloud.py
 */

import { describe, it, expect, beforeAll, test } from 'bun:test';
import crypto from 'crypto';
const axios = require('axios');
const cheerio = require('cheerio');

// CONFIGURATION
const BASE_URL = 'https://hianime.to';
const TARGET_URL = 'https://hianime.to/watch/jujutsu-kaisen-tv-534?ep=10789';

// Key URL for decryption (hosted on GitHub, updated by maintainers)
const KEY_URL = "https://raw.githubusercontent.com/yogesh-hacker/MegacloudKeys/refs/heads/main/keys.json";

// Browser Headers
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
    'Referer': BASE_URL,
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
};

// Global Data
let movieId;
let episodeId;
let serverList = [];
let validMegaCloudUrl;

/**
 * OpenSSL EVP_BytesToKey implementation for AES-256-CBC decryption
 */
function evpBytesToKey(password, salt, keyLen = 32, ivLen = 16) {
    let data = Buffer.alloc(0);
    let prev = Buffer.alloc(0);
    while (data.length < keyLen + ivLen) {
        const md5 = crypto.createHash("md5");
        md5.update(Buffer.concat([prev, Buffer.from(password), salt]));
        prev = md5.digest();
        data = Buffer.concat([data, prev]);
    }
    return {
        key: data.slice(0, keyLen),
        iv: data.slice(keyLen, keyLen + ivLen),
    };
}

/**
 * Decrypts an OpenSSL-compatible base64 string encrypted with AES-256-CBC
 */
function decryptOpenSSL(encryptedB64, password) {
    const encrypted = Buffer.from(encryptedB64, "base64");
    if (!encrypted.slice(0, 8).equals(Buffer.from("Salted__"))) {
        throw new Error("Invalid OpenSSL format - missing 'Salted__' prefix");
    }
    const salt = encrypted.slice(8, 16);
    const { key, iv } = evpBytesToKey(password, salt);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encrypted.slice(16));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString("utf8");
}

describe('HiAnime & MegaCloud API Test Suite', () => {

    test('Step 1: Extract Movie ID from URL', () => {
        const match = TARGET_URL.match(/watch\/[\w-]+\-(\d+)/);
        expect(match).not.toBeNull();
        movieId = match[1];
        console.log(`[1] Movie ID: ${movieId}`);
    });

    test('Step 2: Fetch Episode List and Find Target ID', async () => {
        const endpoint = `${BASE_URL}/ajax/v2/episode/list/${movieId}`;
        const response = await axios.get(endpoint, { headers: HEADERS });
        const $ = cheerio.load(response.data.html);

        const targetEpParam = '10789';
        const epElement = $(`.ep-item[data-id="${targetEpParam}"]`);
        episodeId = epElement.length > 0 ? epElement.attr('data-id') : $('.ep-item').first().attr('data-id');

        expect(episodeId).toBeDefined();
        console.log(`[2] Episode ID: ${episodeId}`);
    });

    test('Step 3: Fetch All Server Options', async () => {
        const endpoint = `${BASE_URL}/ajax/v2/episode/servers?episodeId=${episodeId}`;
        const response = await axios.get(endpoint, { headers: HEADERS });
        const $ = cheerio.load(response.data.html);

        $('.server-item').each((index, element) => {
            serverList.push({
                id: $(element).attr('data-id'),
                name: $(element).text().trim(),
                type: $(element).attr('data-type')
            });
        });

        console.log(`[3] Servers Found: ${serverList.length}`);
        expect(serverList.length).toBeGreaterThan(0);
    });

    test('Step 4: Get MegaCloud Iframe URL', async () => {
        const targetServer = serverList.find(s => s.name === 'HD-1' || s.name === 'HD-2') || serverList[0];
        
        console.log(`    Selecting server: ${targetServer.name}`);
        const endpoint = `${BASE_URL}/ajax/v2/episode/sources?id=${targetServer.id}`;
        
        const response = await axios.get(endpoint, { headers: HEADERS });
        expect(response.status).toBe(200);
        
        validMegaCloudUrl = response.data.link;
        console.log(`[4] Iframe URL: ${validMegaCloudUrl}`);
        expect(validMegaCloudUrl).toContain('http');
    }, 10000);

    /**
     * STEP 5: Fetch MegaCloud Video Sources
     * 
     * Based on analysis of multiple working implementations:
     * 1. Fetch the embed page to extract the 48-character nonce/client key
     * 2. Call the getSources API with `_k` parameter (not `t`)
     * 3. If sources are encrypted, decrypt using AES-256-CBC with key from GitHub
     */
    test('Step 5: Fetch Internal MegaCloud Video Sources', async () => {
        expect(validMegaCloudUrl).toBeDefined();

        // 1. Parse the URL
        const urlParts = new URL(validMegaCloudUrl);
        const pathSegments = urlParts.pathname.split('/').filter(Boolean);
        const videoId = pathSegments[pathSegments.length - 1];
        const domain = urlParts.origin;
        const embedType = pathSegments.find(seg => /^e-\d+$/.test(seg)) || 'e-1';

        console.log(`    MegaCloud Domain: ${domain}`);
        console.log(`    Embed Type: ${embedType}`);
        console.log(`    Video ID: ${videoId}`);

        // 2. Fetch the embed page HTML to extract the nonce (48-char or 3x16-char token)
        const embedHeaders = {
            'User-Agent': HEADERS['User-Agent'],
            'Referer': 'https://hianime.to/',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        };

        console.log(`    Fetching embed page...`);
        const embedResponse = await axios.get(validMegaCloudUrl, { headers: embedHeaders });
        const embedHtml = embedResponse.data;
        
        console.log(`    Embed Response Status: ${embedResponse.status}`);
        console.log(`    Response Length: ${embedHtml.length} chars`);

        // Extract nonce - try 48-char pattern first, then 3x16-char pattern
        let nonce = null;
        
        // Pattern 1: Single 48-character alphanumeric token
        const match48 = embedHtml.match(/\b[a-zA-Z0-9]{48}\b/);
        if (match48) {
            nonce = match48[0];
            console.log(`    Found 48-char nonce: ${nonce.substring(0, 20)}...`);
        }
        
        // Pattern 2: Three 16-character tokens (x, y, z pattern)
        if (!nonce) {
            const match3x16 = embedHtml.match(/x:\s*"([a-zA-Z0-9]{16})".*?y:\s*"([a-zA-Z0-9]{16})".*?z:\s*"([a-zA-Z0-9]{16})"/s);
            if (match3x16) {
                nonce = match3x16[1] + match3x16[2] + match3x16[3];
                console.log(`    Found 3x16-char nonce: ${nonce.substring(0, 20)}...`);
            }
        }
        
        // Pattern 3: data-id attribute on player element
        if (!nonce) {
            const $embed = cheerio.load(embedHtml);
            const dataId = $embed('#megacloud-player').attr('data-id');
            if (dataId) {
                console.log(`    Found data-id: ${dataId}`);
            }
        }
        
        if (!nonce) {
            console.error("    ✘ Could not find nonce in embed page");
            // Log some debug info about what patterns exist
            const alphanumPatterns = embedHtml.match(/\b[a-zA-Z0-9]{40,50}\b/g);
            console.log(`    Long alphanumeric patterns found:`, alphanumPatterns?.slice(0, 5) || 'none');
            throw new Error("Nonce not found in embed page");
        }

        // 3. Construct the API URL with `_k` parameter (key insight from working implementations)
        // Note: Different implementations use different paths:
        // - /embed-2/ajax/e-1/getSources (HiAnime-API style)
        // - /embed-2/v3/e-1/getSources (megacloudpy style)
        // Try the v3 path which seems more current
        const ajaxUrl = `${domain}/embed-2/v3/${embedType}/getSources?id=${videoId}&_k=${nonce}`;
        console.log(`    API URL: ${ajaxUrl.substring(0, 80)}...`);

        // 4. Headers for the AJAX call
        const megaCloudHeaders = {
            'User-Agent': HEADERS['User-Agent'],
            'Referer': validMegaCloudUrl,
            'Origin': domain,
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': '*/*'
        };

        try {
            const response = await axios.get(ajaxUrl, { headers: megaCloudHeaders });
            console.log(`[5] MegaCloud API Status: ${response.status}`);
            
            const data = response.data;
            console.log(`    Response keys:`, Object.keys(data));
            
            // Check if sources are encrypted (string) or plain (array)
            if (typeof data.sources === 'string') {
                console.log("    ⚠ Sources are ENCRYPTED");
                console.log(`    Encrypted string length: ${data.sources.length}`);
                console.log(`    Encrypted preview: ${data.sources.substring(0, 60)}...`);
                
                // 5. Fetch decryption key from GitHub
                console.log(`    Fetching decryption key from GitHub...`);
                const keyResponse = await axios.get(KEY_URL);
                const keys = keyResponse.data;
                console.log(`    Available keys: ${Object.keys(keys).join(', ')}`);
                
                // Use 'mega' or 'vidstr' key for megacloud.blog
                const password = keys.mega || keys.vidstr;
                console.log(`    Using password: ${password.substring(0, 15)}...`);
                
                // 6. Decrypt the sources
                try {
                    const decrypted = decryptOpenSSL(data.sources, password);
                    const sources = JSON.parse(decrypted);
                    console.log("    ✔ Decryption SUCCESSFUL!");
                    console.log(`    Sources count: ${sources.length}`);
                    if (sources.length > 0) {
                        console.log(`    First source: ${sources[0].file}`);
                        console.log(`    Type: ${sources[0].type}`);
                    }
                    
                    // Replace encrypted sources with decrypted
                    data.sources = sources;
                } catch (decryptError) {
                    console.error(`    ✘ Decryption failed: ${decryptError.message}`);
                    // This might mean the encryption method changed
                    throw decryptError;
                }
            } else if (Array.isArray(data.sources)) {
                console.log("    ✔ Sources are PLAIN JSON (no decryption needed)");
                console.log(`    Sources count: ${data.sources.length}`);
                if (data.sources.length > 0) {
                    console.log(`    First source: ${data.sources[0].file}`);
                }
            }

            // Log tracks (subtitles)
            if (data.tracks && data.tracks.length > 0) {
                console.log(`    Tracks (subtitles): ${data.tracks.length}`);
                const englishTrack = data.tracks.find(t => t.label?.toLowerCase().includes('english'));
                if (englishTrack) {
                    console.log(`    English subtitle: ${englishTrack.file}`);
                }
            }

            expect(data).toHaveProperty('sources');

        } catch (error) {
            console.error("    ✘ Failed to fetch MegaCloud sources:", error.message);
            if (error.response) {
                console.error("    Status:", error.response.status);
                console.error("    Response:", typeof error.response.data === 'string' 
                    ? error.response.data.substring(0, 200) 
                    : JSON.stringify(error.response.data));
            }
            throw error;
        }

    }, 30000);

});
