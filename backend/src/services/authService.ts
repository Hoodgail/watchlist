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
      createdAt: true,
    },
  });
}

export interface UserWithOAuthResponse extends UserResponse {
  hasPassword: boolean;
  oauthProviders: Array<{ provider: string; linkedAt: Date }>;
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
      createdAt: true,
      passwordHash: true,
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
    createdAt: user.createdAt,
    hasPassword: !!user.passwordHash,
    oauthProviders: user.oauthAccounts.map((account) => ({
      provider: account.provider,
      linkedAt: account.createdAt,
    })),
  };
}

/**
 * Create tokens for a user (used by OAuth service)
 */
export async function createTokensForUser(userId: string, email: string): Promise<AuthTokens> {
  return createTokens(userId, email);
}
