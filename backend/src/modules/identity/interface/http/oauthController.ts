import type { NextFunction, Request, Response } from 'express';
import { env } from '../../../../config/env.js';
import { BadRequestError } from '../../../../utils/errors.js';
import { identityApplication } from '../../composition/createIdentityApplication.js';
import { requireAuthenticatedUser } from './requireAuthenticatedUser.js';

function buildCallbackRedirectUrl(
  params: { accessToken?: string; refreshToken?: string; error?: string; isNewUser?: boolean },
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

export async function getAuthorizationUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { provider } = req.params;
    const state = req.query.state as string | undefined;
    const authorizationUrl = identityApplication.getAuthorizationUrl({ provider, state });
    res.json({ authorizationUrl });
  } catch (error) {
    next(error);
  }
}

export async function handleCallback(req: Request, res: Response, _next: NextFunction): Promise<void> {
  try {
    const { provider } = req.params;
    const code = req.query.code as string | undefined;
    const error = req.query.error as string | undefined;
    const errorDescription = req.query.error_description as string | undefined;

    if (error) {
      res.redirect(buildCallbackRedirectUrl({ error: errorDescription || error }));
      return;
    }

    if (!code) {
      res.redirect(buildCallbackRedirectUrl({ error: 'No authorization code received' }));
      return;
    }

    const result = await identityApplication.handleOAuthCallback({ provider, code });
    res.redirect(buildCallbackRedirectUrl({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      isNewUser: result.isNewUser,
    }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'OAuth authentication failed';
    res.redirect(buildCallbackRedirectUrl({ error: errorMessage }));
  }
}

export async function linkAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const { provider } = req.params;
    const { code } = req.body as { code?: string };

    if (!code) {
      throw new BadRequestError('Authorization code is required');
    }

    const result = await identityApplication.linkOAuthAccount({ userId: user.id, provider, code });
    res.json({
      message: `${provider} account linked successfully`,
      provider: result.provider,
    });
  } catch (error) {
    next(error);
  }
}

export async function unlinkAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const { provider } = req.params;
    await identityApplication.unlinkOAuthAccount({ userId: user.id, provider });
    res.json({ message: `${provider} account unlinked successfully` });
  } catch (error) {
    next(error);
  }
}

export async function getLinkedProviders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const linked = await identityApplication.getLinkedOAuthProviders({ userId: user.id });
    res.json({
      linked,
      available: identityApplication.getSupportedProviders(),
    });
  } catch (error) {
    next(error);
  }
}
