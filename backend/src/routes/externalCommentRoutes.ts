import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import * as externalCommentService from '../services/externalCommentService.js';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const fetchCommentsSchema = z.object({
  refId: z.string().min(1, 'refId is required'),
  mediaType: z.enum(['TV', 'MOVIE', 'ANIME', 'MANGA']),
  title: z.string().min(1, 'title is required'),
  year: z.number().int().min(1800).max(2100).optional(),
  seasonNumber: z.number().int().min(0).optional(),
  episodeNumber: z.number().int().min(0).optional(),
  chapterNumber: z.number().int().min(0).optional(),
  volumeNumber: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  providerNames: z.array(z.string()).optional(),
  providerIds: z.record(z.string()).optional(),
});

const fetchFromProviderSchema = z.object({
  providerName: z.string().min(1, 'providerName is required'),
  refId: z.string().min(1, 'refId is required'),
  mediaType: z.enum(['TV', 'MOVIE', 'ANIME', 'MANGA']),
  title: z.string().min(1, 'title is required'),
  year: z.number().int().min(1800).max(2100).optional(),
  seasonNumber: z.number().int().min(0).optional(),
  episodeNumber: z.number().int().min(0).optional(),
  chapterNumber: z.number().int().min(0).optional(),
  volumeNumber: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  providerIds: z.record(z.string()).optional(),
});

type FetchCommentsInput = z.infer<typeof fetchCommentsSchema>;
type FetchFromProviderInput = z.infer<typeof fetchFromProviderSchema>;

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /external-comments/providers
 * Get list of all registered providers and their status
 */
async function getProviders(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const providers = externalCommentService.getAllProviders().map((provider) => ({
      name: provider.name,
      displayName: provider.displayName,
      supportedMediaTypes: provider.supportedMediaTypes,
      isConfigured: provider.isConfigured(),
    }));

    res.json({ providers });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /external-comments/providers/:mediaType
 * Get providers available for a specific media type
 */
async function getProvidersForMediaType(
  req: Request<{ mediaType: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { mediaType } = req.params;

    // Validate media type
    if (!['TV', 'MOVIE', 'ANIME', 'MANGA'].includes(mediaType)) {
      res.status(400).json({ error: 'Invalid media type' });
      return;
    }

    const providers = externalCommentService
      .getProvidersForMediaType(mediaType as 'TV' | 'MOVIE' | 'ANIME' | 'MANGA')
      .map((provider) => ({
        name: provider.name,
        displayName: provider.displayName,
        supportedMediaTypes: provider.supportedMediaTypes,
        isConfigured: provider.isConfigured(),
      }));

    res.json({ mediaType, providers });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /external-comments/fetch
 * Trigger a fetch from all relevant providers for a media item
 * Requires authentication (admin/system use)
 */
async function fetchComments(
  req: Request<unknown, unknown, FetchCommentsInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // TODO: Add admin role check here for production use
    // For now, any authenticated user can trigger fetches

    const { refId, mediaType, title, ...options } = req.body;

    const result = await externalCommentService.fetchAndImportComments(
      refId,
      mediaType,
      title,
      options
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /external-comments/fetch/:providerName
 * Trigger a fetch from a specific provider
 * Requires authentication (admin/system use)
 */
async function fetchFromProvider(
  req: Request<{ providerName: string }, unknown, Omit<FetchFromProviderInput, 'providerName'>>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { providerName } = req.params;
    const { refId, mediaType, title, ...options } = req.body;

    // Check if provider exists
    const provider = externalCommentService.getProvider(providerName);
    if (!provider) {
      res.status(404).json({ error: `Provider "${providerName}" not found` });
      return;
    }

    const result = await externalCommentService.fetchFromProvider(
      providerName,
      refId,
      mediaType,
      title,
      options
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /external-comments/refresh
 * Trigger a refresh of external comments for popular media
 * Requires authentication (admin/system use)
 */
async function refreshPopularMedia(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // TODO: Add admin role check here for production use

    const result = await externalCommentService.refreshExternalCommentsForPopularMedia();

    res.json({
      message: 'Refresh job completed',
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Route Definitions
// ============================================================================

// Public routes - get provider info
router.get('/providers', getProviders);
router.get('/providers/:mediaType', getProvidersForMediaType);

// Authenticated routes - trigger fetches
router.post(
  '/fetch',
  authenticate,
  validate(fetchCommentsSchema),
  fetchComments
);

router.post(
  '/fetch/:providerName',
  authenticate,
  validate(
    fetchFromProviderSchema.omit({ providerName: true })
  ),
  fetchFromProvider
);

router.post('/refresh', authenticate, refreshPopularMedia);

export default router;
