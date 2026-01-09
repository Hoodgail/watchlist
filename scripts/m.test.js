import { describe, it, expect, beforeAll,test } from 'bun:test';
const axios = require('axios');
const cheerio = require('cheerio');

// CONFIGURATION
const BASE_URL = 'https://hianime.to';
const TARGET_URL = 'https://hianime.to/watch/jujutsu-kaisen-tv-534?ep=10789';

// Browser Headers - Critical for bypassing basic bot checks
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': TARGET_URL,
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json, text/javascript, */*; q=0.01'
};

// Global Data
let movieId;
let episodeId;
let serverList = [];
let validMegaCloudUrl; 

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
        // Find HD-1 or HD-2 (RabbitStream/MegaCloud)
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
     * STEP 5: Reverse Engineer MegaCloud Source Fetching
     * Logic: 
     * 1. Extract ID, Embed Type, and Version (e.g. v3) from the URL.
     * 2. Construct potential AJAX endpoints.
     * 3. Probe endpoints until data is returned.
     */
    test('Step 5: Fetch Internal MegaCloud Video Sources', async () => {
        expect(validMegaCloudUrl).toBeDefined();

        // 1. Parse URL components
        const urlObj = new URL(validMegaCloudUrl);
        const pathSegments = urlObj.pathname.split('/').filter(p => p.length > 0);
        
        const domain = urlObj.origin;
        const videoId = pathSegments[pathSegments.length - 1]; // Last segment is ID
        
        // Extract "e-1" or "e-4" type
        const embedType = pathSegments.find(s => /^e-\d+$/.test(s)) || 'e-1';
        
        // Extract version "v3", "v2" if present
        const version = pathSegments.find(s => /^v\d+$/.test(s));

        console.log(`    Domain: ${domain}`);
        console.log(`    Type: ${embedType}`);
        console.log(`    Version: ${version || 'None'}`);
        console.log(`    Video ID: ${videoId}`);

        // 2. Build candidate endpoints
        // MegaCloud structure varies. We try the most common patterns.
        const candidates = [];

        // Pattern A: /embed-2/ajax/e-1/getSources?id=... (Standard)
        candidates.push(`${domain}/embed-2/ajax/${embedType}/getSources?id=${videoId}`);
        
        // Pattern B: /embed-2/ajax/v3/getSources?id=... (Versioned root)
        if (version) {
            candidates.push(`${domain}/embed-2/ajax/${version}/getSources?id=${videoId}`);
            // Pattern C: /embed-2/ajax/v3/e-1/getSources?id=... (Nested version)
            candidates.push(`${domain}/embed-2/ajax/${version}/${embedType}/getSources?id=${videoId}`);
        }

        // 3. Headers for MegaCloud (Referer is critical)
        const megaHeaders = {
            'User-Agent': HEADERS['User-Agent'],
            'Referer': validMegaCloudUrl,
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': '*/*'
        };

        let success = false;
        let responseData = null;

        // 4. Probe candidates
        for (const url of candidates) {
            console.log(`    Probing: ${url}`);
            try {
                const res = await axios.get(url, { headers: megaHeaders });
                if (res.status === 200 && res.data) {
                    console.log("    ✔ Endpoint Found!");
                    responseData = res.data;
                    success = true;
                    break; 
                }
            } catch (err) {
                // Ignore 404s during probing
                if (err.response && err.response.status !== 404) {
                    console.log(`      Error: ${err.message}`);
                }
            }
        }

        if (!success) {
            throw new Error("Could not find a valid AJAX endpoint for MegaCloud. Anti-scraping might be active.");
        }

        // 5. Analyze Data
        if (responseData.encrypted) {
            console.log("    ⚠ RESPONSE IS ENCRYPTED");
            console.log("    This confirms the test works. Decryption requires extracting the key from embed-1.min.js.");
            console.log("    Encrypted Blob (partial):", responseData.sources.substring(0, 50) + "...");
            
            // Note: The 'embed-1.min.js' file contains a decryption function (often named 'R' or hidden in 'f[number]').
            // Reverse engineering that specific function is required to turn this string into JSON.
        } else {
            console.log("    ✔ Response is Plain JSON");
            console.log("    Stream:", responseData.sources[0].file);
        }

        expect(responseData).toHaveProperty('sources');
        expect(responseData).toHaveProperty('tracks');

    }, 20000);
});