# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy shared module first
COPY shared ./shared
COPY server ./server

# Copy frontend package files
COPY frontend/package*.json ./frontend/

# Install dependencies
WORKDIR /app/frontend
RUN npm ci

# Copy frontend source files
COPY frontend ./

# Build arguments for environment variables
ARG VITE_API_URL
ARG VITE_FRONTEND_URL

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_FRONTEND_URL=$VITE_FRONTEND_URL

# Build the Vite application
RUN npm run build

# Build the SSR server
RUN npm run build:server

# Production stage with Node.js
FROM node:24-alpine AS production

WORKDIR /app

# Copy shared module (needed at runtime for SSR server)
COPY shared ./shared
COPY server ./server

# Install production dependencies only
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/frontend/dist ./dist

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Build args become runtime env vars
ARG VITE_API_URL
ARG VITE_FRONTEND_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_FRONTEND_URL=$VITE_FRONTEND_URL

# Run without root privileges
USER node

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start the SSR server
CMD ["node", "dist/server.js"]
