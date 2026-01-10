import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { ConflictError, UnauthorizedError } from '../utils/errors.js';
import type { RegisterInput, LoginInput } from '../utils/schemas.js';
import type { JwtPayload } from '../middleware/auth.js';

const SALT_ROUNDS = 12;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  isPublic: boolean;
  createdAt: Date;
}

function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

export async function register(input: RegisterInput): Promise<{ user: UserResponse; tokens: AuthTokens }> {
  // Normalize email to lowercase for case-insensitive matching
  const normalizedEmail = input.email.toLowerCase();

  // Check if email already exists
  const existingEmail = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingEmail) {
    throw new ConflictError('Email already registered');
  }

  // Check if username already exists
  const existingUsername = await prisma.user.findUnique({
    where: { username: input.username },
  });
  if (existingUsername) {
    throw new ConflictError('Username already taken');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  // Use transaction to create user and refresh token atomically
  const refreshTokenValue = generateRefreshToken();
  const expiresAt = new Date(Date.now() + parseExpiresIn(env.JWT_REFRESH_EXPIRES_IN));

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        username: input.username,
        email: normalizedEmail,
        passwordHash,
        displayName: input.displayName,
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        isPublic: true,
        createdAt: true,
      },
    });

    await tx.refreshToken.create({
      data: {
        userId: newUser.id,
        token: refreshTokenValue,
        expiresAt,
      },
    });

    return newUser;
  });

  const accessToken = generateAccessToken({ userId: user.id, email: user.email });

  return { 
    user, 
    tokens: { 
      accessToken, 
      refreshToken: refreshTokenValue 
    } 
  };
}

export async function login(input: LoginInput): Promise<{ user: UserResponse; tokens: AuthTokens }> {
  // Normalize email to lowercase for case-insensitive matching
  const normalizedEmail = input.email.toLowerCase();

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Verify password (OAuth-only users have null passwordHash)
  if (!user.passwordHash) {
    throw new UnauthorizedError('Please login with your OAuth provider');
  }
  
  const isValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Generate tokens
  const tokens = await createTokens(user.id, user.email);

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isPublic: user.isPublic,
      createdAt: user.createdAt,
    },
    tokens,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  // Find the refresh token
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!storedToken) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  if (storedToken.expiresAt < new Date()) {
    // Delete expired token
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    throw new UnauthorizedError('Refresh token expired');
  }

  // Delete old token
  await prisma.refreshToken.delete({ where: { id: storedToken.id } });

  // Generate new tokens
  return createTokens(storedToken.user.id, storedToken.user.email);
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { token: refreshToken },
  });
}

export async function logoutAll(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
}

async function createTokens(userId: string, email: string): Promise<AuthTokens> {
  const accessToken = generateAccessToken({ userId, email });
  const refreshToken = generateRefreshToken();

  // Store refresh token
  const expiresAt = new Date(Date.now() + parseExpiresIn(env.JWT_REFRESH_EXPIRES_IN));
  await prisma.refreshToken.create({
    data: {
      userId,
      token: refreshToken,
      expiresAt,
    },
  });

  return { accessToken, refreshToken };
}

export async function getCurrentUser(userId: string): Promise<UserResponse | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      isPublic: true,
      createdAt: true,
    },
  });
}

export interface UserWithOAuthResponse extends UserResponse {
  hasPassword: boolean;
  oauthProviders: Array<{ provider: string; linkedAt: Date }>;
  recoveryEmail: string | null;
  recoveryEmailVerified: boolean;
}

export async function getCurrentUserWithOAuth(userId: string): Promise<UserWithOAuthResponse | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      isPublic: true,
      createdAt: true,
      passwordHash: true,
      recoveryEmail: true,
      recoveryEmailVerified: true,
      oauthAccounts: {
        select: {
          provider: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isPublic: user.isPublic,
    createdAt: user.createdAt,
    hasPassword: !!user.passwordHash,
    oauthProviders: user.oauthAccounts.map((account) => ({
      provider: account.provider,
      linkedAt: account.createdAt,
    })),
    recoveryEmail: user.recoveryEmail,
    recoveryEmailVerified: user.recoveryEmailVerified,
  };
}

/**
 * Create tokens for a user (used by OAuth service)
 */
export async function createTokensForUser(userId: string, email: string): Promise<AuthTokens> {
  return createTokens(userId, email);
}

/**
 * Set a recovery email for a user
 */
export async function setRecoveryEmail(userId: string, recoveryEmail: string): Promise<{ recoveryEmail: string; verificationSent: boolean }> {
  const normalizedEmail = recoveryEmail.toLowerCase();
  
  // Check if this email is already used by another user
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: normalizedEmail },
        { recoveryEmail: normalizedEmail },
      ],
      NOT: { id: userId },
    },
  });
  
  if (existingUser) {
    throw new ConflictError('This email is already in use');
  }
  
  // Generate verification token
  const token = crypto.randomBytes(32).toString('hex');
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      recoveryEmail: normalizedEmail,
      recoveryEmailVerified: false,
      recoveryEmailToken: token,
      recoveryEmailTokenExp: tokenExpiry,
    },
  });
  
  // In a production environment, you would send an email here
  // For now, we'll just return that verification needs to be done
  console.log(`[Recovery Email] Verification token for ${normalizedEmail}: ${token}`);
  
  return {
    recoveryEmail: normalizedEmail,
    verificationSent: true,
  };
}

/**
 * Verify a recovery email using the token
 */
export async function verifyRecoveryEmail(token: string): Promise<{ verified: boolean }> {
  const user = await prisma.user.findFirst({
    where: {
      recoveryEmailToken: token,
      recoveryEmailTokenExp: {
        gt: new Date(),
      },
    },
  });
  
  if (!user) {
    throw new UnauthorizedError('Invalid or expired verification token');
  }
  
  await prisma.user.update({
    where: { id: user.id },
    data: {
      recoveryEmailVerified: true,
      recoveryEmailToken: null,
      recoveryEmailTokenExp: null,
    },
  });
  
  return { verified: true };
}

/**
 * Remove recovery email from a user
 */
export async function removeRecoveryEmail(userId: string): Promise<void> {
  // Check if user has other auth methods
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { oauthAccounts: true },
  });
  
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  
  // Must have password or OAuth to remove recovery email
  if (!user.passwordHash && user.oauthAccounts.length === 0) {
    throw new ConflictError('Cannot remove recovery email - it is your only account recovery method');
  }
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      recoveryEmail: null,
      recoveryEmailVerified: false,
      recoveryEmailToken: null,
      recoveryEmailTokenExp: null,
    },
  });
}

/**
 * Set a password for a user (for OAuth-only users to add password auth)
 */
export async function setPassword(userId: string, password: string): Promise<void> {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

/**
 * Change password for a user (requires current password)
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  
  if (!user.passwordHash) {
    throw new ConflictError('No password set. Use set password instead.');
  }
  
  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError('Current password is incorrect');
  }
  
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

/**
 * Initiate account recovery using recovery email
 */
export async function initiateAccountRecovery(email: string): Promise<{ sent: boolean }> {
  // Find user by recovery email
  const user = await prisma.user.findFirst({
    where: {
      recoveryEmail: email.toLowerCase(),
      recoveryEmailVerified: true,
    },
  });
  
  if (!user) {
    // Don't reveal if email exists for security
    return { sent: true };
  }
  
  // Generate recovery token
  const token = crypto.randomBytes(32).toString('hex');
  const tokenExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour
  
  await prisma.user.update({
    where: { id: user.id },
    data: {
      recoveryEmailToken: token,
      recoveryEmailTokenExp: tokenExpiry,
    },
  });
  
  // In production, send email with recovery link
  console.log(`[Account Recovery] Recovery token for ${user.email}: ${token}`);
  
  return { sent: true };
}

/**
 * Complete account recovery - set new password using recovery token
 */
export async function completeAccountRecovery(token: string, newPassword: string): Promise<AuthTokens> {
  const user = await prisma.user.findFirst({
    where: {
      recoveryEmailToken: token,
      recoveryEmailTokenExp: {
        gt: new Date(),
      },
    },
  });
  
  if (!user) {
    throw new UnauthorizedError('Invalid or expired recovery token');
  }
  
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      recoveryEmailToken: null,
      recoveryEmailTokenExp: null,
    },
  });
  
  // Create new session
  return createTokens(user.id, user.email);
}
