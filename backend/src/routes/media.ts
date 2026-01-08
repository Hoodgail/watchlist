import { Router } from 'express';
import * as mediaSearchController from '../controllers/mediaSearchController.js';

const router = Router();

router.get('/search', mediaSearchController.search);
router.get('/trending', mediaSearchController.getAllTrending);
router.get('/trending/movies', mediaSearchController.getTrendingMovies);
router.get('/trending/tv', mediaSearchController.getTrendingTV);
router.get('/trending/anime', mediaSearchController.getTrendingAnime);

export default router;
