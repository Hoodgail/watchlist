# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared module first
COPY shared ./shared

# Copy backend package files
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/

# Install dependencies
WORKDIR /app/backend
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy backend source code and tsconfig
COPY backend/tsconfig.json ./
COPY backend/src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy shared module (needed at runtime for compiled imports)
COPY shared ./shared

# Copy backend package files
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/

# Install production dependencies only
WORKDIR /app/backend
RUN npm ci --omit=dev

# Generate Prisma client for production
RUN npx prisma generate

# Copy built files from builder
COPY --from=builder /app/backend/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expose port
EXPOSE 3201

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3201/api/health || exit 1

# Start the application
CMD ["node", "dist/backend/src/index.js"]
