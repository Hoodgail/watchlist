import type { NextFunction, Request, Response } from 'express';
import type {
  ChangePasswordInput,
  CompleteRecoveryInput,
  InitiateRecoveryInput,
  LoginInput,
  RegisterInput,
  SetRecoveryEmailInput,
  SetPasswordInput,
  VerifyRecoveryEmailInput,
} from '../../../../utils/schemas.js';
import { identityApplication } from '../../composition/createIdentityApplication.js';
import { requireAuthenticatedUser } from './requireAuthenticatedUser.js';

export async function register(
  req: Request<unknown, unknown, RegisterInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await identityApplication.registerUser(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request<unknown, unknown, LoginInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await identityApplication.loginUser(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function refresh(
  req: Request<unknown, unknown, { refreshToken: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tokens = await identityApplication.refreshSession({ refreshToken: req.body.refreshToken });
    res.json(tokens);
  } catch (error) {
    next(error);
  }
}

export async function logout(
  req: Request<unknown, unknown, { refreshToken: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await identityApplication.logoutSession({ refreshToken: req.body.refreshToken });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    await identityApplication.logoutAllSessions({ userId: user.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const currentIdentity = await identityApplication.getCurrentIdentity({ userId: user.id });
    res.json(currentIdentity);
  } catch (error) {
    next(error);
  }
}

export async function setRecoveryEmail(
  req: Request<unknown, unknown, SetRecoveryEmailInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const result = await identityApplication.setRecoveryEmail({ userId: user.id, input: req.body });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function verifyRecoveryEmail(
  req: Request<unknown, unknown, VerifyRecoveryEmailInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await identityApplication.verifyRecoveryEmail(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function removeRecoveryEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    await identityApplication.removeRecoveryEmail({ userId: user.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function setPassword(
  req: Request<unknown, unknown, SetPasswordInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    await identityApplication.setPassword({ userId: user.id, input: req.body });
    res.json({ message: 'Password set successfully' });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(
  req: Request<unknown, unknown, ChangePasswordInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    await identityApplication.changePassword({ userId: user.id, input: req.body });
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
}

export async function initiateRecovery(
  req: Request<unknown, unknown, InitiateRecoveryInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await identityApplication.initiateAccountRecovery(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function completeRecovery(
  req: Request<unknown, unknown, CompleteRecoveryInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tokens = await identityApplication.completeAccountRecovery(req.body);
    res.json({ tokens, message: 'Account recovered successfully' });
  } catch (error) {
    next(error);
  }
}
