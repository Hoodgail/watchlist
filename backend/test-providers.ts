/**
 * Provider Testing Script
 * Tests all anime and movie/TV providers to determine reliability
 */

import { ANIME, MOVIES } from '@consumet/extensions';

interface ProviderTestResult {
  provider: string;
  type: 'anime' | 'movie';
  searchWorking: boolean;
  searchTime: number;
  searchResults: number;
  infoWorking: boolean;
  infoTime: number;
  episodesFound: number;
  sourcesWorking: boolean;
  sourcesTime: number;
  sourcesCount: number;
  hasM3U8: boolean;
  error?: string;
  score: number; // 0-100
}

const ANIME_PROVIDERS = ['hianime', 'animepahe', 'animekai', 'kickassanime'] as const;
const MOVIE_PROVIDERS = ['flixhq', 'goku', 'sflix', 'dramacool'] as const;

// Test queries
const ANIME_QUERY = 'jujutsu kaisen';
const MOVIE_QUERY = 'breaking bad';

async function testAnimeProvider(providerName: string): Promise<ProviderTestResult> {
  const result: ProviderTestResult = {
    provider: providerName,
    type: 'anime',
    searchWorking: false,
    searchTime: 0,
    searchResults: 0,
    infoWorking: false,
    infoTime: 0,
    episodesFound: 0,
    sourcesWorking: false,
    sourcesTime: 0,
    sourcesCount: 0,
    hasM3U8: false,
    score: 0,
  };

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Testing Anime Provider: ${providerName.toUpperCase()}`);
  console.log('='.repeat(50));

  let provider: any;
  try {
    switch (providerName) {
      case 'hianime':
        provider = new ANIME.Hianime();
        break;
      case 'animepahe':
        provider = new ANIME.AnimePahe();
        break;
      case 'animekai':
        provider = new ANIME.AnimeKai();
        break;
      case 'kickassanime':
        provider = new ANIME.KickAssAnime();
        break;
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  } catch (e) {
    result.error = `Failed to initialize: ${e}`;
    console.log(`  ❌ Failed to initialize provider: ${e}`);
    return result;
  }

  // Test Search
  let searchId = '';
  try {
    console.log(`  Searching for: "${ANIME_QUERY}"...`);
    const searchStart = Date.now();
    const searchResult = await provider.search(ANIME_QUERY);
    result.searchTime = Date.now() - searchStart;
    
    if (searchResult?.results?.length > 0) {
      result.searchWorking = true;
      result.searchResults = searchResult.results.length;
      searchId = searchResult.results[0].id;
      console.log(`  ✅ Search: ${result.searchResults} results in ${result.searchTime}ms`);
      console.log(`     First result ID: ${searchId}`);
      console.log(`     First result title: ${typeof searchResult.results[0].title === 'string' ? searchResult.results[0].title : searchResult.results[0].title?.english || searchResult.results[0].title?.romaji}`);
    } else {
      console.log(`  ❌ Search: No results`);
    }
  } catch (e: any) {
    result.error = `Search failed: ${e.message}`;
    console.log(`  ❌ Search failed: ${e.message}`);
  }

  // Test Info
  let episodeId = '';
  if (searchId) {
    try {
      console.log(`  Fetching info for: ${searchId}...`);
      const infoStart = Date.now();
      const info = await provider.fetchAnimeInfo(searchId);
      result.infoTime = Date.now() - infoStart;
      
      if (info) {
        result.infoWorking = true;
        result.episodesFound = info.episodes?.length || 0;
        if (info.episodes?.length > 0) {
          episodeId = info.episodes[0].id;
        }
        console.log(`  ✅ Info: ${result.episodesFound} episodes in ${result.infoTime}ms`);
        if (episodeId) {
          console.log(`     First episode ID: ${episodeId}`);
        }
      } else {
        console.log(`  ❌ Info: No data returned`);
      }
    } catch (e: any) {
      result.error = (result.error ? result.error + '; ' : '') + `Info failed: ${e.message}`;
      console.log(`  ❌ Info failed: ${e.message}`);
    }
  }

  // Test Sources
  if (episodeId) {
    try {
      console.log(`  Fetching sources for: ${episodeId}...`);
      const sourcesStart = Date.now();
      const sources = await provider.fetchEpisodeSources(episodeId);
      result.sourcesTime = Date.now() - sourcesStart;
      
      if (sources?.sources?.length > 0) {
        result.sourcesWorking = true;
        result.sourcesCount = sources.sources.length;
        result.hasM3U8 = sources.sources.some((s: any) => s.isM3U8 || s.url?.includes('.m3u8'));
        console.log(`  ✅ Sources: ${result.sourcesCount} sources in ${result.sourcesTime}ms`);
        console.log(`     Has M3U8: ${result.hasM3U8}`);
        console.log(`     First source: ${sources.sources[0].url?.substring(0, 80)}...`);
        if (sources.subtitles?.length) {
          console.log(`     Subtitles: ${sources.subtitles.length} tracks`);
        }
      } else {
        console.log(`  ❌ Sources: No sources found`);
      }
    } catch (e: any) {
      result.error = (result.error ? result.error + '; ' : '') + `Sources failed: ${e.message}`;
      console.log(`  ❌ Sources failed: ${e.message}`);
    }
  }

  // Calculate score
  let score = 0;
  if (result.searchWorking) score += 25;
  if (result.infoWorking) score += 25;
  if (result.sourcesWorking) score += 40;
  if (result.hasM3U8) score += 10;
  // Bonus for speed
  if (result.searchTime < 2000) score += 2;
  if (result.infoTime < 2000) score += 2;
  if (result.sourcesTime < 3000) score += 2;
  // Penalty for slow
  if (result.searchTime > 5000) score -= 5;
  if (result.infoTime > 5000) score -= 5;
  if (result.sourcesTime > 10000) score -= 5;
  
  result.score = Math.max(0, Math.min(100, score));
  console.log(`  📊 Score: ${result.score}/100`);

  return result;
}

async function testMovieProvider(providerName: string): Promise<ProviderTestResult> {
  const result: ProviderTestResult = {
    provider: providerName,
    type: 'movie',
    searchWorking: false,
    searchTime: 0,
    searchResults: 0,
    infoWorking: false,
    infoTime: 0,
    episodesFound: 0,
    sourcesWorking: false,
    sourcesTime: 0,
    sourcesCount: 0,
    hasM3U8: false,
    score: 0,
  };

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Testing Movie/TV Provider: ${providerName.toUpperCase()}`);
  console.log('='.repeat(50));

  let provider: any;
  try {
    switch (providerName) {
      case 'flixhq':
        provider = new MOVIES.FlixHQ();
        break;
      case 'goku':
        provider = new MOVIES.Goku();
        break;
      case 'sflix':
        provider = new MOVIES.SFlix();
        break;
      case 'dramacool':
        provider = new MOVIES.DramaCool();
        break;
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  } catch (e) {
    result.error = `Failed to initialize: ${e}`;
    console.log(`  ❌ Failed to initialize provider: ${e}`);
    return result;
  }

  // Test Search
  let searchId = '';
  try {
    console.log(`  Searching for: "${MOVIE_QUERY}"...`);
    const searchStart = Date.now();
    const searchResult = await provider.search(MOVIE_QUERY);
    result.searchTime = Date.now() - searchStart;
    
    if (searchResult?.results?.length > 0) {
      result.searchWorking = true;
      result.searchResults = searchResult.results.length;
      searchId = searchResult.results[0].id;
      console.log(`  ✅ Search: ${result.searchResults} results in ${result.searchTime}ms`);
      console.log(`     First result ID: ${searchId}`);
      console.log(`     First result title: ${searchResult.results[0].title}`);
      console.log(`     First result type: ${searchResult.results[0].type}`);
    } else {
      console.log(`  ❌ Search: No results`);
    }
  } catch (e: any) {
    result.error = `Search failed: ${e.message}`;
    console.log(`  ❌ Search failed: ${e.message}`);
  }

  // Test Info
  let episodeId = '';
  let mediaId = '';
  if (searchId) {
    try {
      console.log(`  Fetching info for: ${searchId}...`);
      const infoStart = Date.now();
      const info = await provider.fetchMediaInfo(searchId);
      result.infoTime = Date.now() - infoStart;
      
      if (info) {
        result.infoWorking = true;
        result.episodesFound = info.episodes?.length || 0;
        mediaId = info.id;
        if (info.episodes?.length > 0) {
          episodeId = info.episodes[0].id;
        }
        console.log(`  ✅ Info: ${result.episodesFound} episodes in ${result.infoTime}ms`);
        console.log(`     Media ID: ${mediaId}`);
        if (episodeId) {
          console.log(`     First episode ID: ${episodeId}`);
        }
      } else {
        console.log(`  ❌ Info: No data returned`);
      }
    } catch (e: any) {
      result.error = (result.error ? result.error + '; ' : '') + `Info failed: ${e.message}`;
      console.log(`  ❌ Info failed: ${e.message}`);
    }
  }

  // Test Sources
  if (episodeId && mediaId) {
    try {
      console.log(`  Fetching sources for: ${episodeId} (media: ${mediaId})...`);
      const sourcesStart = Date.now();
      const sources = await provider.fetchEpisodeSources(episodeId, mediaId);
      result.sourcesTime = Date.now() - sourcesStart;
      
      if (sources?.sources?.length > 0) {
        result.sourcesWorking = true;
        result.sourcesCount = sources.sources.length;
        result.hasM3U8 = sources.sources.some((s: any) => s.isM3U8 || s.url?.includes('.m3u8'));
        console.log(`  ✅ Sources: ${result.sourcesCount} sources in ${result.sourcesTime}ms`);
        console.log(`     Has M3U8: ${result.hasM3U8}`);
        console.log(`     First source: ${sources.sources[0].url?.substring(0, 80)}...`);
        if (sources.subtitles?.length) {
          console.log(`     Subtitles: ${sources.subtitles.length} tracks`);
        }
      } else {
        console.log(`  ❌ Sources: No sources found`);
      }
    } catch (e: any) {
      result.error = (result.error ? result.error + '; ' : '') + `Sources failed: ${e.message}`;
      console.log(`  ❌ Sources failed: ${e.message}`);
    }
  }

  // Calculate score
  let score = 0;
  if (result.searchWorking) score += 25;
  if (result.infoWorking) score += 25;
  if (result.sourcesWorking) score += 40;
  if (result.hasM3U8) score += 10;
  // Bonus for speed
  if (result.searchTime < 2000) score += 2;
  if (result.infoTime < 2000) score += 2;
  if (result.sourcesTime < 3000) score += 2;
  // Penalty for slow
  if (result.searchTime > 5000) score -= 5;
  if (result.infoTime > 5000) score -= 5;
  if (result.sourcesTime > 10000) score -= 5;
  
  result.score = Math.max(0, Math.min(100, score));
  console.log(`  📊 Score: ${result.score}/100`);

  return result;
}

async function main() {
  console.log('\n' + '🎬'.repeat(25));
  console.log('VIDEO PROVIDER RELIABILITY TEST');
  console.log('🎬'.repeat(25));
  console.log(`\nTest started at: ${new Date().toISOString()}`);
  console.log(`Anime query: "${ANIME_QUERY}"`);
  console.log(`Movie/TV query: "${MOVIE_QUERY}"`);

  const results: ProviderTestResult[] = [];

  // Test Anime Providers
  console.log('\n\n📺 TESTING ANIME PROVIDERS...');
  for (const provider of ANIME_PROVIDERS) {
    try {
      const res = await testAnimeProvider(provider);
      results.push(res);
    } catch (e: any) {
      console.log(`  ❌ ${provider} completely failed: ${e.message}`);
      results.push({
        provider,
        type: 'anime',
        searchWorking: false,
        searchTime: 0,
        searchResults: 0,
        infoWorking: false,
        infoTime: 0,
        episodesFound: 0,
        sourcesWorking: false,
        sourcesTime: 0,
        sourcesCount: 0,
        hasM3U8: false,
        error: e.message,
        score: 0,
      });
    }
  }

  // Test Movie/TV Providers
  console.log('\n\n🎥 TESTING MOVIE/TV PROVIDERS...');
  for (const provider of MOVIE_PROVIDERS) {
    try {
      const res = await testMovieProvider(provider);
      results.push(res);
    } catch (e: any) {
      console.log(`  ❌ ${provider} completely failed: ${e.message}`);
      results.push({
        provider,
        type: 'movie',
        searchWorking: false,
        searchTime: 0,
        searchResults: 0,
        infoWorking: false,
        infoTime: 0,
        episodesFound: 0,
        sourcesWorking: false,
        sourcesTime: 0,
        sourcesCount: 0,
        hasM3U8: false,
        error: e.message,
        score: 0,
      });
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 SUMMARY - PROVIDER RANKINGS');
  console.log('='.repeat(60));

  const animeResults = results.filter(r => r.type === 'anime').sort((a, b) => b.score - a.score);
  const movieResults = results.filter(r => r.type === 'movie').sort((a, b) => b.score - a.score);

  console.log('\n🎯 ANIME PROVIDERS (Ranked by Score):');
  console.log('-'.repeat(60));
  console.log('Rank | Provider      | Score | Search | Info | Sources | M3U8');
  console.log('-'.repeat(60));
  animeResults.forEach((r, i) => {
    const search = r.searchWorking ? '✅' : '❌';
    const info = r.infoWorking ? '✅' : '❌';
    const sources = r.sourcesWorking ? '✅' : '❌';
    const m3u8 = r.hasM3U8 ? '✅' : '❌';
    console.log(`  ${i + 1}  | ${r.provider.padEnd(13)} | ${String(r.score).padStart(3)}   |   ${search}   |  ${info}  |   ${sources}    |  ${m3u8}`);
  });

  console.log('\n🎯 MOVIE/TV PROVIDERS (Ranked by Score):');
  console.log('-'.repeat(60));
  console.log('Rank | Provider      | Score | Search | Info | Sources | M3U8');
  console.log('-'.repeat(60));
  movieResults.forEach((r, i) => {
    const search = r.searchWorking ? '✅' : '❌';
    const info = r.infoWorking ? '✅' : '❌';
    const sources = r.sourcesWorking ? '✅' : '❌';
    const m3u8 = r.hasM3U8 ? '✅' : '❌';
    console.log(`  ${i + 1}  | ${r.provider.padEnd(13)} | ${String(r.score).padStart(3)}   |   ${search}   |  ${info}  |   ${sources}    |  ${m3u8}`);
  });

  // Recommended order
  console.log('\n\n📋 RECOMMENDED PROVIDER ORDER:');
  console.log('='.repeat(60));
  
  const workingAnime = animeResults.filter(r => r.sourcesWorking);
  const workingMovies = movieResults.filter(r => r.sourcesWorking);
  
  console.log('\n🎌 Anime Provider Priority:');
  if (workingAnime.length > 0) {
    console.log(`   ${workingAnime.map(r => r.provider).join(' → ')}`);
  } else {
    console.log('   ⚠️ No fully working anime providers found!');
    const partialAnime = animeResults.filter(r => r.searchWorking || r.infoWorking);
    if (partialAnime.length > 0) {
      console.log(`   Partial (search/info only): ${partialAnime.map(r => r.provider).join(', ')}`);
    }
  }

  console.log('\n🎬 Movie/TV Provider Priority:');
  if (workingMovies.length > 0) {
    console.log(`   ${workingMovies.map(r => r.provider).join(' → ')}`);
  } else {
    console.log('   ⚠️ No fully working movie/TV providers found!');
    const partialMovies = movieResults.filter(r => r.searchWorking || r.infoWorking);
    if (partialMovies.length > 0) {
      console.log(`   Partial (search/info only): ${partialMovies.map(r => r.provider).join(', ')}`);
    }
  }

  // Output JSON for programmatic use
  console.log('\n\n📦 JSON OUTPUT:');
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    animeProviders: animeResults,
    movieProviders: movieResults,
    recommendations: {
      anime: workingAnime.map(r => r.provider),
      movie: workingMovies.map(r => r.provider),
    },
  }, null, 2));
}

main().catch(console.error);
