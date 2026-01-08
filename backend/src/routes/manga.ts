import { Router } from 'express';
import * as mangaController from '../controllers/mangaController.js';

const router = Router();

// Get list of available providers
// GET /api/manga/providers
router.get('/providers', mangaController.getProviders);

// Get popular manga
// GET /api/manga/popular?page=1&perPage=20
router.get('/popular', mangaController.getPopularManga);

// Get latest updated manga
// GET /api/manga/latest?page=1&perPage=20
router.get('/latest', mangaController.getLatestManga);

// Search manga across any provider
// GET /api/manga/search?q=<query>&provider=mangadex&page=1
router.get('/search', mangaController.searchManga);

// Get manga info from a specific provider
// GET /api/manga/:provider/:id
router.get('/:provider/:id', mangaController.getMangaInfo);

// Get chapter pages from a specific provider
// GET /api/manga/:provider/chapter/:chapterId/pages
router.get('/:provider/chapter/:chapterId/pages', mangaController.getChapterPages);

export default router;
