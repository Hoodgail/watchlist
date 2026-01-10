import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService.js';
import type { 
  RegisterInput, 
  LoginInput,
  SetRecoveryEmailInput,
  VerifyRecoveryEmailInput,
  SetPasswordInput,
  ChangePasswordInput,
  InitiateRecoveryInput,
  CompleteRecoveryInput,
} from '../utils/schemas.js';

export async function register(
  req: Request<unknown, unknown, RegisterInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request<unknown, unknown, LoginInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function refresh(
  req: Request<unknown, unknown, { refreshToken: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tokens = await authService.refreshAccessToken(req.body.refreshToken);
    res.json(tokens);
  } catch (error) {
    next(error);
  }
}

export async function logout(
  req: Request<unknown, unknown, { refreshToken: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await authService.logout(req.body.refreshToken);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function logoutAll(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await authService.logoutAll(req.user.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function me(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await authService.getCurrentUserWithOAuth(req.user.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
}

// Recovery email endpoints
export async function setRecoveryEmail(
  req: Request<unknown, unknown, SetRecoveryEmailInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const result = await authService.setRecoveryEmail(req.user.id, req.body.email);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function verifyRecoveryEmail(
  req: Request<unknown, unknown, VerifyRecoveryEmailInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.verifyRecoveryEmail(req.body.token);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function removeRecoveryEmail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await authService.removeRecoveryEmail(req.user.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// Password endpoints
export async function setPassword(
  req: Request<unknown, unknown, SetPasswordInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await authService.setPassword(req.user.id, req.body.password);
    res.json({ message: 'Password set successfully' });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(
  req: Request<unknown, unknown, ChangePasswordInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
}

// Account recovery endpoints
export async function initiateRecovery(
  req: Request<unknown, unknown, InitiateRecoveryInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.initiateAccountRecovery(req.body.email);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function completeRecovery(
  req: Request<unknown, unknown, CompleteRecoveryInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tokens = await authService.completeAccountRecovery(req.body.token, req.body.newPassword);
    res.json({ tokens, message: 'Account recovered successfully' });
  } catch (error) {
    next(error);
  }
}
