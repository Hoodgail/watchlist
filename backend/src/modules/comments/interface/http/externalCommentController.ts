import type { NextFunction, Request, Response } from 'express';
import { requireAuthenticatedUser } from '../../../../shared/interface/http/requireAuthenticatedUser.js';
import { commentsApplication } from '../../composition/createCommentsApplication.js';
import type {
  FetchCommentsInput,
  FetchFromProviderInput,
  FetchWithResolutionInput,
  ResolvePreviewInput,
} from './externalCommentSchemas.js';
import type { SupportedCommentMediaType } from '../../application/dto/comments.js';

export async function getProviders(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const providers = await commentsApplication.getExternalProviders();
    res.json({
      providers: providers.map((provider) => ({
        name: provider.name,
        displayName: provider.displayName,
        supportedMediaTypes: provider.supportedMediaTypes,
        isConfigured: provider.isConfigured(),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function getProvidersForMediaType(
  req: Request<{ mediaType: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const mediaType = req.params.mediaType as SupportedCommentMediaType;
    if (!['TV', 'MOVIE', 'ANIME', 'MANGA'].includes(mediaType)) {
      res.status(400).json({ error: 'Invalid media type' });
      return;
    }

    const providers = await commentsApplication.getExternalProvidersForMediaType({ mediaType });
    res.json({
      mediaType,
      providers: providers.map((provider) => ({
        name: provider.name,
        displayName: provider.displayName,
        supportedMediaTypes: provider.supportedMediaTypes,
        isConfigured: provider.isConfigured(),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function fetchComments(
  req: Request<unknown, unknown, FetchCommentsInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    requireAuthenticatedUser(req);
    const { refId, mediaType, title, ...options } = req.body;
    const result = await commentsApplication.fetchExternalComments({ refId, mediaType, title, options });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function fetchFromProvider(
  req: Request<{ providerName: string }, unknown, Omit<FetchFromProviderInput, 'providerName'>>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    requireAuthenticatedUser(req);
    const providerName = req.params.providerName;
    const provider = commentsApplication.getExternalProviderByName(providerName);
    if (!provider) {
      res.status(404).json({ error: `Provider "${providerName}" not found` });
      return;
    }

    const { refId, mediaType, title, ...options } = req.body;
    const result = await commentsApplication.fetchExternalCommentsFromProvider({
      providerName,
      refId,
      mediaType,
      title,
      options,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function refreshPopularMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    requireAuthenticatedUser(req);
    const result = await commentsApplication.refreshExternalComments();
    res.json({ message: 'Refresh job completed', ...result });
  } catch (error) {
    next(error);
  }
}

export async function fetchWithResolution(
  req: Request<unknown, unknown, FetchWithResolutionInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    requireAuthenticatedUser(req);
    const result = await commentsApplication.fetchExternalCommentsWithResolution(req.body);
    res.json({
      comments: result.comments,
      resolvedMatches: result.resolvedMatches,
      errors: result.errors,
      confidence: result.confidence,
      usedDirectFetch: result.usedDirectFetch,
      totalComments: result.comments.length,
    });
  } catch (error) {
    next(error);
  }
}

export async function resolvePreview(
  req: Request<unknown, unknown, ResolvePreviewInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    requireAuthenticatedUser(req);
    const result = await commentsApplication.previewExternalResolution(req.body);
    res.json({
      resolvedMatches: result.resolvedMatches,
      titleBasedProviders: result.titleBasedProviders,
      confidence: result.confidence,
    });
  } catch (error) {
    next(error);
  }
}
