import { randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../../../../config/env.js';
import { BadRequestError } from '../../../../utils/errors.js';
import { identityApplication } from '../../composition/createIdentityApplication.js';
import { requireAuthenticatedUser } from './requireAuthenticatedUser.js';

function buildCallbackRedirectUrl(params: {
  accessToken?: string;
  refreshToken?: string;
  error?: string;
  isNewUser?: boolean;
}): string {
  const frontendUrl = env.FRONTEND_URL || 'http://localhost:3200';
  const url = new URL('/auth/callback', frontendUrl);

  if (params.error) {
    url.searchParams.set('error', params.error);
  } else {
    const fragment = new URLSearchParams();
    if (params.accessToken) fragment.set('accessToken', params.accessToken);
    if (params.refreshToken) fragment.set('refreshToken', params.refreshToken);
    if (params.isNewUser !== undefined) fragment.set('isNewUser', String(params.isNewUser));
    url.hash = fragment.toString();
  }

  return url.toString();
}

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth/oauth',
  maxAge: 10 * 60 * 1000,
};
function consumeState(
  req: Request<Record<string, string>>,
  res: Response,
): { provider: string; userId?: string } {
  const cookie = req.headers.cookie
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith('watchlist_oauth='))
    ?.slice('watchlist_oauth='.length);
  res.clearCookie('watchlist_oauth', cookieOptions);
  if (!cookie || typeof req.query.state !== 'string')
    throw new BadRequestError('Invalid OAuth state; start sign in again');
  const payload = jwt.verify(decodeURIComponent(cookie), env.JWT_SECRET, {
    audience: 'watchlist-oauth',
    algorithms: ['HS256'],
  }) as jwt.JwtPayload;
  const received = Buffer.from(req.query.state);
  const expected = Buffer.from(String(payload.state));
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected) ||
    payload.provider !== req.params.provider
  )
    throw new BadRequestError('Invalid OAuth state; start sign in again');
  return { provider: String(payload.provider), userId: payload.userId };
}

export async function getAuthorizationUrl(
  req: Request<Record<string, string>>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { provider } = req.params;
    const state = randomBytes(32).toString('hex');
    const userId = req.query.mode === 'link' ? requireAuthenticatedUser(req).id : undefined;
    const authorizationUrl = identityApplication.getAuthorizationUrl({ provider, state });
    res.cookie(
      'watchlist_oauth',
      jwt.sign({ state, provider, userId }, env.JWT_SECRET, {
        audience: 'watchlist-oauth',
        expiresIn: '10m',
      }),
      cookieOptions,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.json({ authorizationUrl });
  } catch (error) {
    next(error);
  }
}

export async function handleCallback(
  req: Request<Record<string, string>>,
  res: Response,
  _next: NextFunction,
): Promise<void> {
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

    const state = consumeState(req, res);
    if (state.userId) {
      await identityApplication.linkOAuthAccount({ userId: state.userId, provider, code });
      res.redirect(
        new URL(
          '/auth/callback#linked=true',
          env.FRONTEND_URL || 'http://localhost:3200',
        ).toString(),
      );
      return;
    }
    const result = await identityApplication.handleOAuthCallback({ provider, code });
    res.redirect(
      buildCallbackRedirectUrl({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        isNewUser: result.isNewUser,
      }),
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'OAuth authentication failed';
    res.redirect(buildCallbackRedirectUrl({ error: errorMessage }));
  }
}

export async function linkAccount(
  req: Request<Record<string, string>>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const { provider } = req.params;
    const { code } = req.body as { code?: string };

    if (!code) {
      throw new BadRequestError('Authorization code is required');
    }

    const state = consumeState(req, res);
    if (state.userId !== user.id)
      throw new BadRequestError('OAuth link session does not match this account');
    const result = await identityApplication.linkOAuthAccount({ userId: user.id, provider, code });
    res.json({
      message: `${provider} account linked successfully`,
      provider: result.provider,
    });
  } catch (error) {
    next(error);
  }
}

export async function unlinkAccount(
  req: Request<Record<string, string>>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const { provider } = req.params;
    await identityApplication.unlinkOAuthAccount({ userId: user.id, provider });
    res.json({ message: `${provider} account unlinked successfully` });
  } catch (error) {
    next(error);
  }
}

export async function getLinkedProviders(
  req: Request<Record<string, string>>,
  res: Response,
  next: NextFunction,
): Promise<void> {
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
