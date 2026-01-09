import { describe, it, expect, beforeAll,test } from 'bun:test';
const axios = require('axios');
const cheerio = require('cheerio');

// CONFIGURATION
const BASE_URL = 'https://hianime.to';
const TARGET_URL = 'https://hianime.to/watch/jujutsu-kaisen-tv-534?ep=10789';

// Mimic a browser to avoid 403 Forbidden errors
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': TARGET_URL,
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json, text/javascript, */*; q=0.01'
};

// Global variables to pass data between test steps
let movieId;
let episodeId;
let serverList = []; // Will hold objects: { id, name, type }

describe('HiAnime API - Full Server Check', () => {

    /**
     * STEP 1: Get Movie ID from URL
     */
    test('Step 1: Extract Movie ID from URL', () => {
        const match = TARGET_URL.match(/watch\/[\w-]+\-(\d+)/);
        expect(match).not.toBeNull();
        movieId = match[1];
        console.log(`[1] Movie ID: ${movieId}`);
    });

    /**
     * STEP 2: Get Episode ID
     */
    test('Step 2: Fetch Episode List and Find Target ID', async () => {
        expect(movieId).toBeDefined();
        const endpoint = `${BASE_URL}/ajax/v2/episode/list/${movieId}`;
        const response = await axios.get(endpoint, { headers: HEADERS });

        expect(response.status).toBe(200);
        const $ = cheerio.load(response.data.html);

        // Attempt to find the specific episode ID from the URL (10789)
        // If not found, default to the first one available
        const targetEpParam = '10789';
        const epElement = $(`.ep-item[data-id="${targetEpParam}"]`);

        if (epElement.length > 0) {
            episodeId = epElement.attr('data-id');
        } else {
            episodeId = $('.ep-item').first().attr('data-id');
        }

        expect(episodeId).toBeDefined();
        console.log(`[2] Episode ID: ${episodeId}`);
    });

    /**
     * STEP 3: Get All Available Servers
     * Instead of picking one, we push ALL valid server items into an array.
     */
    test('Step 3: Fetch and Parse All Server Options', async () => {
        expect(episodeId).toBeDefined();
        const endpoint = `${BASE_URL}/ajax/v2/episode/servers?episodeId=${episodeId}`;
        const response = await axios.get(endpoint, { headers: HEADERS });

        expect(response.status).toBe(200);
        const $ = cheerio.load(response.data.html);

        // Loop through every server item element found in the response
        $('.server-item').each((index, element) => {
            const id = $(element).attr('data-id');
            const type = $(element).attr('data-type'); // e.g., "sub", "dub"
            const name = $(element).text().trim();     // e.g., "HD-1", "Vidstreaming"

            if (id) {
                serverList.push({ id, name, type });
            }
        });

        console.log(`[3] Found ${serverList.length} servers:`, serverList.map(s => s.name).join(', '));
        expect(serverList.length).toBeGreaterThan(0);
    });

    /**
     * STEP 4: Test Each Server Individually
     * We iterate through the list found in Step 3 and verify the source API works for each.
     */
    test('Step 4: Verify Source Link for EVERY Server', async () => {
        expect(serverList.length).toBeGreaterThan(0);

        // We use a loop with await to avoid hitting rate limits or blocking 
        // by firing all requests at once (Promise.all).
        for (const server of serverList) {
            const endpoint = `${BASE_URL}/ajax/v2/episode/sources?id=${server.id}`;
            
            console.log(`    Testing Server: ${server.name} (ID: ${server.id})...`);
            
            try {
                const response = await axios.get(endpoint, { headers: HEADERS });
                
                // Assertions
                expect(response.status).toBe(200);
                expect(response.data).toHaveProperty('link');
                
                // Ensure the link looks like a URL
                expect(response.data.link).toMatch(/^https?:\/\//);
                
                console.log(`    ✔ Success: ${server.name} -> ${response.data.link}`);
                
            } catch (error) {
                // If a specific server fails, we log it but fail the test
                console.error(`    ✘ Failed: ${server.name} (ID: ${server.id}) - ${error.message}`);
                throw new Error(`Server ${server.name} failed to return a valid source.`);
            }
        }
    }, 30000); // Increased timeout to 30s because we are making multiple requests
});

