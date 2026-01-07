import { Router } from 'express';
import * as mangadexController from '../controllers/mangadexController.js';

const router = Router();

// Search manga
// GET /api/mangadex/search?q=<query>&limit=10&offset=0&contentRating[]=safe&contentRating[]=suggestive
router.get('/search', mangadexController.searchManga);

// Get manga details by ID
// GET /api/mangadex/manga/:id
router.get('/manga/:id', mangadexController.getMangaById);

// Get manga chapters
// GET /api/mangadex/manga/:id/chapters?language=en&limit=100&offset=0
router.get('/manga/:id/chapters', mangadexController.getMangaChapters);

// Get chapter pages (for reading)
// GET /api/mangadex/chapter/:chapterId/pages
router.get('/chapter/:chapterId/pages', mangadexController.getChapterPages);

export default router;
