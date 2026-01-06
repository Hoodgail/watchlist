// Set test environment before anything else
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-minimum-32-characters-long';

import "dotenv/config";

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../config/database.js';

beforeAll(async () => {
  // Ensure database connection
  await prisma.$connect();
});

beforeEach(async () => {
  // Clean up database before each test
  // Delete in order to respect foreign key constraints
  await prisma.refreshToken.deleteMany();
  await prisma.friendRequest.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.mediaItem.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  // Clean up and disconnect
  await prisma.refreshToken.deleteMany();
  await prisma.friendRequest.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.mediaItem.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});
