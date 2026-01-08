import { Router } from 'express';
import * as mediaSearchController from '../controllers/mediaSearchController.js';

const router = Router();

// Search routes
router.get('/search', mediaSearchController.search);
router.get('/search/:provider', mediaSearchController.searchProvider);

// Provider routes
router.get('/providers', mediaSearchController.getProviders);

// Info routes
router.get('/info/:provider/:id', mediaSearchController.getInfo);

// Source routes (for streaming)
router.get('/sources/:provider/:episodeId', mediaSearchController.getEpisodeSources);
router.get('/servers/:provider/:episodeId', mediaSearchController.getEpisodeServers);

// Chapter pages routes (for manga reading)
router.get('/pages/:provider/:chapterId', mediaSearchController.getChapterPages);

// Trending routes
router.get('/trending', mediaSearchController.getAllTrending);
router.get('/trending/movies', mediaSearchController.getTrendingMovies);
router.get('/trending/tv', mediaSearchController.getTrendingTV);
router.get('/trending/anime', mediaSearchController.getTrendingAnime);
router.get('/trending/anime/popular', mediaSearchController.getPopularAnime);
router.get('/trending/manga', mediaSearchController.getPopularManga);

export default router;
