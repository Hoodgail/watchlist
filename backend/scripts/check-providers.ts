/** Live upstream checks are opt-in; deterministic tests never depend on providers. */
import { fork } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { buildMangaPlusApiUrl, parseMangaPlusResponse } from '../../shared/mangaplus.js';
import { ANIME, MOVIES, MANGA, META, BOOKS, LIGHT_NOVELS, COMICS } from '@consumet/extensions';

const factories: Record<string, () => any> = {
  hianime: () => new ANIME.Hianime(),
  animepahe: () => new ANIME.AnimePahe(),
  animekai: () => new ANIME.AnimeKai(),
  kickassanime: () => new ANIME.KickAssAnime(),
  flixhq: () => new MOVIES.FlixHQ(),
  goku: () => new MOVIES.Goku(),
  sflix: () => new MOVIES.SFlix(),
  himovies: () => new MOVIES.FlixHQ(),
  dramacool: () => new MOVIES.DramaCool(),
  mangadex: () => new MANGA.MangaDex(),
  comick: () => new MANGA.ComicK(),
  mangapill: () => new MANGA.MangaPill(),
  mangahere: () => new MANGA.MangaHere(),
  mangareader: () => new MANGA.MangaReader(),
  asurascans: () => new MANGA.AsuraScans(),
  anilist: () => new META.Anilist(),
  'anilist-manga': () => new META.Anilist.Manga(),
  myanimelist: () => new META.Myanimelist(),
  tmdb: () => new META.TMDB(process.env.TMDB_API_KEY),
  libgen: () => new BOOKS.Libgen(),
  novelupdates: () => new LIGHT_NOVELS.NovelUpdates(),
  getcomics: () => new COMICS.GetComics(),
};
const anime = new Set(['hianime', 'animepahe', 'animekai', 'kickassanime']);
const movies = new Set(['flixhq', 'goku', 'sflix', 'himovies', 'dramacool']);
const manga = new Set([
  'mangadex',
  'comick',
  'mangapill',
  'mangahere',
  'mangareader',
  'asurascans',
]);
type Check = { stage: string; status: string; detail: string };

async function check(name: string) {
  const checks: Check[] = [];
  let stage = 'search';
  try {
    if (name === 'rawg') {
      if (!process.env.RAWG_API_KEY)
        return [{ stage, status: 'unconfigured', detail: 'RAWG_API_KEY absent' }];
      const response = await fetch(
        `https://api.rawg.io/api/games?search=Portal&key=${encodeURIComponent(process.env.RAWG_API_KEY)}`,
        { signal: AbortSignal.timeout(15000) },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { results?: unknown[] };
      if (!data.results?.length) throw new Error('Empty search results');
      return [
        { stage, status: 'passed', detail: `${data.results.length} results; detail not verified` },
      ];
    }
    if (name === 'mangaplus') {
      stage = 'pages';
      const response = await fetch(buildMangaPlusApiUrl('1000001'), {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const pages = parseMangaPlusResponse(await response.arrayBuffer());
      if (!pages.length) throw new Error('Fixture chapter returned no pages');
      return [
        {
          stage,
          status: 'passed',
          detail: `${pages.length} pages; decrypted image bytes not verified`,
        },
      ];
    }
    if (name === 'hianime-comments') {
      stage = 'comments';
      const response = await fetch('https://hianime.to/ajax/comment/list/2142?sort=newest', {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      return [
        {
          stage,
          status: 'unverified',
          detail: `HTTP 200, ${body.length} characters; comments extraction not verified`,
        },
      ];
    }
    if (name === 'tmdb' && !process.env.TMDB_API_KEY)
      return [{ stage, status: 'unconfigured', detail: 'TMDB_API_KEY absent' }];
    const provider = factories[name]();
    if (name === 'himovies')
      return [
        {
          stage: 'adapter',
          status: 'disabled',
          detail: 'Incorrect adapter: instantiates FlixHQ instead of HiMovies',
        },
      ];
    const found = await provider.search(
      movies.has(name)
        ? 'Breaking Bad'
        : manga.has(name) || anime.has(name) || name.includes('anilist')
          ? 'One Piece'
          : 'Batman',
    );
    if (!found?.results?.length)
      throw new Error('Search returned no results for the fixture query');
    checks.push({ stage, status: 'passed', detail: `${found.results.length} results` });
    const id = found.results[0].id;
    stage = 'info';
    const getInfo =
      provider.fetchAnimeInfo ||
      provider.fetchMangaInfo ||
      provider.fetchMediaInfo ||
      provider.fetchBookInfo ||
      provider.fetchLightNovelInfo ||
      provider.fetchComicInfo;
    if (!getInfo) return [...checks, { stage, status: 'unsupported', detail: 'No detail adapter' }];
    const info = await getInfo.call(provider, id);
    if (!info?.title) throw new Error('Missing title');
    checks.push({ stage, status: 'passed', detail: 'Detail returned a title' });
    if (anime.has(name) || movies.has(name)) {
      stage = 'sources';
      const episode = info.episodes?.[0];
      if (!episode) throw new Error('No episodes');
      const sources = movies.has(name)
        ? await provider.fetchEpisodeSources(episode.id, id)
        : await provider.fetchEpisodeSources(episode.id);
      if (!sources?.sources?.length) throw new Error('No playback sources');
      checks.push({
        stage,
        status: 'passed',
        detail: `${sources.sources.length} sources; playback bytes not verified`,
      });
    } else if (manga.has(name)) {
      stage = 'pages';
      if (!info.chapters?.length) throw new Error('No chapters');
      const pages = await provider.fetchChapterPages(info.chapters[0].id);
      if (!pages?.length) throw new Error('No pages');
      checks.push({
        stage,
        status: 'passed',
        detail: `${pages.length} pages; image bytes not verified`,
      });
    }
  } catch (error: any) {
    const status = error.response?.status;
    checks.push({
      stage,
      status: [403, 429].includes(status) ? 'blocked' : 'failed',
      detail: status ? `HTTP ${status}` : String(error.message).slice(0, 220),
    });
  }
  return checks;
}

if (process.argv[2] === '--worker') {
  const checks = await check(process.argv[3]);
  process.send?.(checks);
  process.exit(0);
} else {
  const results: Record<string, Check[]> = {};
  const names = [...Object.keys(factories), 'rawg', 'mangaplus', 'hianime-comments'];
  const only = process.argv
    .find((arg) => arg.startsWith('--only='))
    ?.slice(7)
    .split(',');
  for (const name of names.filter((name) => !only || only.includes(name))) {
    results[name] = await new Promise((resolve) => {
      const child = fork(new URL(import.meta.url), ['--worker', name], { silent: true });
      const timer = setTimeout(() => {
        child.kill();
        resolve([{ stage: 'probe', status: 'timeout', detail: '45 second budget exceeded' }]);
      }, 45000);
      child.on('message', (result) => {
        clearTimeout(timer);
        resolve(result as Check[]);
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        resolve([{ stage: 'probe', status: 'failed', detail: error.message }]);
      });
      child.on('exit', (code) => {
        if (code) {
          clearTimeout(timer);
          resolve([{ stage: 'probe', status: 'failed', detail: `Worker exited ${code}` }]);
        }
      });
      child.stdout?.resume();
      child.stderr?.resume();
    });
    console.log(name, JSON.stringify(results[name]));
  }
  for (const name of ['reddit-comments', 'mal-comments', 'anilist-comments', 'letterboxd-comments'])
    results[name] = [
      {
        stage: 'adapter',
        status: 'disabled',
        detail: 'Removed stub: returned empty results without making a request',
      },
    ];
  for (const name of ['mangakakalot', 'readlightnovels'])
    results[name] = [
      {
        stage: 'adapter',
        status: 'disabled',
        detail: 'Stale frontend identifier with no backend adapter; removed from selectors',
      },
    ];
  results.animenewsnetwork = [
    {
      stage: 'adapter',
      status: 'disabled',
      detail: 'Advertised in registry but no callable adapter',
    },
  ];
  await writeFile(
    process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ||
      '../docs/provider-checks.json',
    JSON.stringify(
      { checkedAt: new Date().toISOString(), sdk: '@consumet/extensions', results },
      null,
      2,
    ) + '\n',
  );
}
