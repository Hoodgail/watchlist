/**
 * Test script for Movies/TV API - Testing Consumet Service
 * 
 * This file tests the movie/TV provider functions including:
 * - searchMovies
 * - getMovieInfo
 * - getEpisodeServers
 * - getEpisodeSources
 * 
 * Run with: npx tsx src/tests/test-api.ts
 */

import {
  search,
  getInfo,
  getEpisodeServers,
  getEpisodeSources,
  getTrendingMovies,
  getTrendingTVShows,
} from '../services/consumetService.js';

import {
  searchMovies,
  getMovieInfo,
  getEpisodeSources as getMovieEpisodeSources,
  getEpisodeServers as getMovieEpisodeServers,
  getRecentMovies,
  getRecentTVShows,
  getSpotlight,
  getByGenre,
} from '../services/consumet/movieProviders.js';

import type { MovieProviderName } from '../services/consumet/types.js';

// ============ Helper Functions ============

function log(title: string, data: unknown) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
  console.log(JSON.stringify(data, null, 2));
}

function logError(title: string, error: unknown) {
  console.error('\n' + '!'.repeat(60));
  console.error(`ERROR: ${title}`);
  console.error('!'.repeat(60));
  console.error(error);
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ Test Functions ============

async function testSearchMovies(provider: MovieProviderName = 'flixhq') {
  console.log(`\n${'#'.repeat(60)}`);
  console.log(`Testing searchMovies with provider: ${provider}`);
  console.log('#'.repeat(60));

  try {
    const results = await searchMovies('breaking bad', provider);
    log(`Search Results for "breaking bad" (${provider})`, {
      currentPage: results.currentPage,
      hasNextPage: results.hasNextPage,
      totalResults: results.totalResults,
      resultCount: results.results.length,
      firstFewResults: results.results.slice(0, 3),
    });
    return results.results[0]; // Return first result for further testing
  } catch (error) {
    logError(`searchMovies (${provider})`, error);
    return null;
  }
}

async function testGetMovieInfo(id: string, provider: MovieProviderName = 'flixhq') {
  console.log(`\n${'#'.repeat(60)}`);
  console.log(`Testing getMovieInfo for ID: ${id}`);
  console.log('#'.repeat(60));

  try {
    const info = await getMovieInfo(id, provider);
    if (info) {
      log(`Movie/TV Info for "${info.title}"`, {
        id: info.id,
        title: info.title,
        type: info.type,
        status: info.status,
        releaseDate: info.releaseDate,
        rating: info.rating,
        genres: info.genres,
        description: info.description?.substring(0, 200) + '...',
        totalEpisodes: info.totalEpisodes,
        totalSeasons: info.totalSeasons,
        episodeCount: info.episodes?.length ?? 0,
        seasonCount: info.seasons?.length ?? 0,
        firstEpisode: info.episodes?.[0] || info.seasons?.[0]?.episodes?.[0],
      });
      return info;
    } else {
      console.log('No info returned');
      return null;
    }
  } catch (error) {
    logError(`getMovieInfo for ${id}`, error);
    return null;
  }
}

async function testGetEpisodeServers(
  episodeId: string,
  mediaId: string,
  provider: MovieProviderName = 'flixhq'
) {
  console.log(`\n${'#'.repeat(60)}`);
  console.log(`Testing getEpisodeServers`);
  console.log(`  Episode ID: ${episodeId}`);
  console.log(`  Media ID: ${mediaId}`);
  console.log('#'.repeat(60));

  try {
    // Test using movie providers directly
    const servers = await getMovieEpisodeServers(episodeId, mediaId, provider);
    log(`Episode Servers (${provider})`, servers);
    return servers;
  } catch (error) {
    logError(`getEpisodeServers`, error);
    return [];
  }
}

async function testGetEpisodeSources(
  episodeId: string,
  mediaId: string,
  provider: MovieProviderName = 'flixhq'
) {
  console.log(`\n${'#'.repeat(60)}`);
  console.log(`Testing getEpisodeSources`);
  console.log(`  Episode ID: ${episodeId}`);
  console.log(`  Media ID: ${mediaId}`);
  console.log('#'.repeat(60));

  try {
    // Test using movie providers directly
    const sources = await getMovieEpisodeSources(episodeId, mediaId, provider);
    log(`Episode Sources (${provider})`, {
      headers: sources?.headers,
      sourceCount: sources?.sources?.length ?? 0,
      sources: sources?.sources?.slice(0, 3), // First 3 sources
      subtitleCount: sources?.subtitles?.length ?? 0,
      subtitles: sources?.subtitles?.slice(0, 3), // First 3 subtitles
      intro: sources?.intro,
      outro: sources?.outro,
    });
    return sources;
  } catch (error) {
    logError(`getEpisodeSources`, error);
    return null;
  }
}

async function testUnifiedAPI() {
  console.log(`\n${'#'.repeat(60)}`);
  console.log(`Testing Unified API (consumetService.ts)`);
  console.log('#'.repeat(60));

  try {
    // Test unified search
    const searchResults = await search('inception', 'flixhq');
    log('Unified Search Results', {
      currentPage: searchResults.currentPage,
      hasNextPage: searchResults.hasNextPage,
      resultCount: searchResults.results.length,
      firstResult: searchResults.results[0],
    });

    // If we have results, test getInfo
    if (searchResults.results.length > 0) {
      const firstResult = searchResults.results[0];
      const info = await getInfo(firstResult.id, 'flixhq');
      log('Unified getInfo Result', {
        id: info?.id,
        title: info?.title,
        type: info?.type,
        episodeCount: info?.episodes?.length ?? info?.seasons?.reduce((acc, s) => acc + s.episodes.length, 0) ?? 0,
      });

      // Get first episode for server/source testing
      const firstEpisode = info?.episodes?.[0] || info?.seasons?.[0]?.episodes?.[0];
      if (firstEpisode && info) {
        // Test unified getEpisodeServers
        const servers = await getEpisodeServers(firstEpisode.id, 'flixhq', info.id);
        log('Unified getEpisodeServers Result', servers);

        // Test unified getEpisodeSources
        const sources = await getEpisodeSources(firstEpisode.id, 'flixhq', info.id);
        log('Unified getEpisodeSources Result', {
          sourceCount: sources?.sources?.length ?? 0,
          subtitleCount: sources?.subtitles?.length ?? 0,
        });
      }
    }
  } catch (error) {
    logError('Unified API', error);
  }
}

async function testTrendingContent() {
  console.log(`\n${'#'.repeat(60)}`);
  console.log(`Testing Trending Content`);
  console.log('#'.repeat(60));

  try {
    const [trendingMovies, trendingTV, recentMovies, recentTV, spotlight] = await Promise.all([
      getTrendingMovies(),
      getTrendingTVShows(),
      getRecentMovies(),
      getRecentTVShows(),
      getSpotlight(),
    ]);

    log('Trending Movies', {
      count: trendingMovies.length,
      firstFew: trendingMovies.slice(0, 3),
    });

    log('Trending TV Shows', {
      count: trendingTV.length,
      firstFew: trendingTV.slice(0, 3),
    });

    log('Recent Movies', {
      count: recentMovies.length,
      firstFew: recentMovies.slice(0, 3),
    });

    log('Recent TV Shows', {
      count: recentTV.length,
      firstFew: recentTV.slice(0, 3),
    });

    log('Spotlight', {
      count: spotlight.length,
      firstFew: spotlight.slice(0, 3),
    });
  } catch (error) {
    logError('Trending Content', error);
  }
}

async function testByGenre() {
  console.log(`\n${'#'.repeat(60)}`);
  console.log(`Testing getByGenre`);
  console.log('#'.repeat(60));

  try {
    const actionResults = await getByGenre('action', 1);
    log('Action Genre Results', {
      currentPage: actionResults.currentPage,
      hasNextPage: actionResults.hasNextPage,
      resultCount: actionResults.results.length,
      firstFew: actionResults.results.slice(0, 3),
    });
  } catch (error) {
    logError('getByGenre', error);
  }
}

async function testMultipleProviders() {
  console.log(`\n${'#'.repeat(60)}`);
  console.log(`Testing Multiple Movie Providers`);
  console.log('#'.repeat(60));

  const providers: MovieProviderName[] = ['flixhq', 'goku', 'dramacool'];

  for (const provider of providers) {
    try {
      console.log(`\n--- Testing provider: ${provider} ---`);
      const results = await searchMovies('batman', provider);
      log(`${provider} Search Results`, {
        currentPage: results.currentPage,
        hasNextPage: results.hasNextPage,
        resultCount: results.results.length,
        firstResult: results.results[0],
      });
      await delay(1000); // Rate limiting
    } catch (error) {
      logError(`Provider ${provider}`, error);
    }
  }
}

// ============ Full Integration Test ============

async function runFullIntegrationTest() {
  console.log('\n' + '*'.repeat(60));
  console.log('FULL INTEGRATION TEST: Movie/TV API');
  console.log('*'.repeat(60));

  // Step 1: Search for a TV show
  console.log('\n>>> Step 1: Search for a TV show');
  const searchResult = await testSearchMovies('flixhq');

  if (!searchResult) {
    console.log('No search results found. Exiting integration test.');
    return;
  }

  await delay(1000);

  // Step 2: Get detailed info for the first result
  console.log('\n>>> Step 2: Get detailed info');
  const mediaInfo = await testGetMovieInfo(searchResult.id, 'flixhq');

  if (!mediaInfo) {
    console.log('No media info found. Exiting integration test.');
    return;
  }

  await delay(1000);

  // Step 3: Get episode (if TV show) or movie source
  const firstEpisode = mediaInfo.episodes?.[0] || mediaInfo.seasons?.[0]?.episodes?.[0];

  if (firstEpisode) {
    console.log('\n>>> Step 3: Get episode servers');
    const servers = await testGetEpisodeServers(firstEpisode.id, mediaInfo.id, 'flixhq');

    await delay(1000);

    console.log('\n>>> Step 4: Get episode sources');
    await testGetEpisodeSources(firstEpisode.id, mediaInfo.id, 'flixhq');
  } else {
    console.log('\n>>> No episodes found. This might be a movie or still loading.');
    // For movies, the mediaId itself might be the episodeId
    console.log('\n>>> Step 3: Trying to get servers with mediaId as episodeId');
    await testGetEpisodeServers(mediaInfo.id, mediaInfo.id, 'flixhq');

    await delay(1000);

    console.log('\n>>> Step 4: Trying to get sources with mediaId as episodeId');
    await testGetEpisodeSources(mediaInfo.id, mediaInfo.id, 'flixhq');
  }

  console.log('\n' + '*'.repeat(60));
  console.log('INTEGRATION TEST COMPLETE');
  console.log('*'.repeat(60));
}

// ============ Main Execution ============

async function main() {
  console.log('='.repeat(60));
  console.log('Movie/TV API Test Suite');
  console.log('Testing Consumet Service Functions');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);

  const args = process.argv.slice(2);
  const testType = args[0] || 'all';

  try {
    switch (testType) {
      case 'search':
        await testSearchMovies();
        break;

      case 'info':
        // Pass a specific ID if available, otherwise search first
        if (args[1]) {
          await testGetMovieInfo(args[1], (args[2] as MovieProviderName) || 'flixhq');
        } else {
          const result = await testSearchMovies();
          if (result) {
            await delay(1000);
            await testGetMovieInfo(result.id);
          }
        }
        break;

      case 'servers':
        if (args[1] && args[2]) {
          await testGetEpisodeServers(args[1], args[2], (args[3] as MovieProviderName) || 'flixhq');
        } else {
          console.log('Usage: npx tsx test-api.ts servers <episodeId> <mediaId> [provider]');
        }
        break;

      case 'sources':
        if (args[1] && args[2]) {
          await testGetEpisodeSources(args[1], args[2], (args[3] as MovieProviderName) || 'flixhq');
        } else {
          console.log('Usage: npx tsx test-api.ts sources <episodeId> <mediaId> [provider]');
        }
        break;

      case 'trending':
        await testTrendingContent();
        break;

      case 'genre':
        await testByGenre();
        break;

      case 'providers':
        await testMultipleProviders();
        break;

      case 'unified':
        await testUnifiedAPI();
        break;

      case 'integration':
        await runFullIntegrationTest();
        break;

      case 'all':
      default:
        // Run all tests
        await testSearchMovies();
        await delay(1000);

        await testTrendingContent();
        await delay(1000);

        await testByGenre();
        await delay(1000);

        await testUnifiedAPI();
        await delay(1000);

        await runFullIntegrationTest();
        break;
    }
  } catch (error) {
    logError('Main execution', error);
    process.exit(1);
  }

  console.log(`\nCompleted at: ${new Date().toISOString()}`);
}

// Run the tests
main().catch(console.error);
