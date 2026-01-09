/**
 * Test Custom Source Extractors
 * 
 * Tests the MegaCloud extractor for HiAnime
 */

import { extractorRegistry, extractWithCustom } from './src/services/consumet/extractors/index.js';

async function testHiAnimeExtractor() {
  console.log('='.repeat(60));
  console.log('TESTING HIANIME CUSTOM EXTRACTOR');
  console.log('='.repeat(60));
  
  // Test episode ID format: movieSlug-movieId$episode$episodeNum
  const testEpisodeId = 'jujutsu-kaisen-tv-534$episode$10789';
  
  console.log(`\nTest Episode ID: ${testEpisodeId}`);
  console.log('\nStarting extraction...\n');
  
  try {
    const result = await extractWithCustom('hianime', {
      episodeId: testEpisodeId,
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('RESULT');
    console.log('='.repeat(60));
    
    console.log(`Success: ${result.success}`);
    
    if (result.success && result.sources) {
      console.log(`\nSources: ${result.sources.sources.length}`);
      for (const source of result.sources.sources) {
        console.log(`  - ${source.quality}: ${source.url.substring(0, 80)}...`);
        console.log(`    M3U8: ${source.isM3U8}`);
      }
      
      if (result.sources.subtitles && result.sources.subtitles.length > 0) {
        console.log(`\nSubtitles: ${result.sources.subtitles.length}`);
        for (const sub of result.sources.subtitles.slice(0, 5)) {
          console.log(`  - ${sub.lang}: ${sub.url.substring(0, 60)}...`);
        }
      }
      
      if (result.sources.intro) {
        console.log(`\nIntro: ${result.sources.intro.start}s - ${result.sources.intro.end}s`);
      }
      
      if (result.sources.outro) {
        console.log(`Outro: ${result.sources.outro.start}s - ${result.sources.outro.end}s`);
      }
      
      console.log('\n✅ EXTRACTOR WORKING!');
    } else {
      console.log(`\nError: ${result.error}`);
      console.log(`Should Fallback: ${result.shouldFallback}`);
      
      if (result.debug) {
        console.log('\nDebug Info:');
        console.log(JSON.stringify(result.debug, null, 2));
      }
      
      console.log('\n❌ EXTRACTOR FAILED');
    }
    
  } catch (error: any) {
    console.error('\n❌ TEST THREW ERROR:', error.message);
    console.error(error.stack);
  }
}

// Test via API endpoint
async function testViaAPI() {
  console.log('\n\n' + '='.repeat(60));
  console.log('TESTING VIA API ENDPOINT');
  console.log('='.repeat(60));
  
  const episodeId = 'jujutsu-kaisen-tv-534$episode$10789';
  const url = `http://localhost:3201/api/media/sources/hianime/${encodeURIComponent(episodeId)}`;
  
  console.log(`\nURL: ${url}`);
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`\nStatus: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2).substring(0, 1000));
    
    if (data.sources && data.sources.length > 0) {
      console.log('\n✅ API WORKING!');
    } else {
      console.log('\n❌ API RETURNED NO SOURCES');
    }
  } catch (error: any) {
    console.error('\n❌ API REQUEST FAILED:', error.message);
  }
}

async function main() {
  // Direct test
  await testHiAnimeExtractor();
  
  // API test (only if server is running)
  // await testViaAPI();
}

main().catch(console.error);
