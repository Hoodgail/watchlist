import { Request, Response, NextFunction } from 'express';
import * as oauthService from '../services/oauthService.js';
import { env } from '../config/env.js';
import { BadRequestError } from '../utils/errors.js';

/**
 * Get authorization URL for OAuth provider
 * GET /oauth/:provider
 */
export async function getAuthorizationUrl(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { provider } = req.params;
    const state = req.query.state as string | undefined;
    
    const authUrl = oauthService.getAuthorizationUrl(provider, state);
    
    res.json({ authorizationUrl: authUrl });
  } catch (error) {
    next(error);
  }
}

/**
 * Build callback redirect URL with tokens or error
 */
function buildCallbackRedirectUrl(
  params: { accessToken?: string; refreshToken?: string; error?: string; isNewUser?: boolean }
): string {
  const frontendUrl = env.FRONTEND_URL || 'http://localhost:5173';
  const url = new URL('/auth/callback', frontendUrl);
  
  if (params.error) {
    url.searchParams.set('error', params.error);
  } else {
    if (params.accessToken) url.searchParams.set('accessToken', params.accessToken);
    if (params.refreshToken) url.searchParams.set('refreshToken', params.refreshToken);
    if (params.isNewUser !== undefined) url.searchParams.set('isNewUser', String(params.isNewUser));
  }
  
  return url.toString();
}

/**
 * Handle OAuth callback
 * GET /oauth/:provider/callback
 */
export async function handleCallback(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { provider } = req.params;
    const code = req.query.code as string | undefined;
    const error = req.query.error as string | undefined;
    const error_description = req.query.error_description as string | undefined;
    
    // Handle OAuth errors from provider
    if (error) {
      const errorMessage = error_description || error;
      const redirectUrl = buildCallbackRedirectUrl({ error: errorMessage });
      res.redirect(redirectUrl);
      return;
    }
    
    if (!code) {
      const redirectUrl = buildCallbackRedirectUrl({ error: 'No authorization code received' });
      res.redirect(redirectUrl);
      return;
    }
    
    const result = await oauthService.handleCallback(provider, code);
    
    const redirectUrl = buildCallbackRedirectUrl({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      isNewUser: result.isNewUser,
    });
    
    res.redirect(redirectUrl);
  } catch (error) {
    // For callback errors, redirect to frontend with error message
    const errorMessage = error instanceof Error ? error.message : 'OAuth authentication failed';
    const redirectUrl = buildCallbackRedirectUrl({ error: errorMessage });
    res.redirect(redirectUrl);
  }
}

/**
 * Link OAuth account to authenticated user
 * POST /oauth/:provider/link
 */
export async function linkAccount(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const { provider } = req.params;
    const { code } = req.body as { code?: string };
    
    if (!code) {
      throw new BadRequestError('Authorization code is required');
    }
    
    const result = await oauthService.linkAccount(req.user.id, provider, code);
    
    res.json({
      message: `${provider} account linked successfully`,
      provider: result.provider,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Unlink OAuth account from authenticated user
 * DELETE /oauth/:provider/link
 */
export async function unlinkAccount(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const { provider } = req.params;
    
    await oauthService.unlinkAccount(req.user.id, provider);
    
    res.json({
      message: `${provider} account unlinked successfully`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get linked OAuth providers for authenticated user
 * GET /oauth/providers
 */
export async function getLinkedProviders(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const providers = await oauthService.getLinkedProviders(req.user.id);
    const supportedProviders = oauthService.getSupportedProviders();
    
    res.json({
      linked: providers,
      available: supportedProviders,
    });
  } catch (error) {
    next(error);
  }
}
