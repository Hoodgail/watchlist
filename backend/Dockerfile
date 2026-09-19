FROM node:24-alpine AS builder
WORKDIR /app
COPY shared ./shared
COPY server ./server
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/
COPY backend/prisma.config.ts ./backend/
WORKDIR /app/backend
RUN npm ci && npx prisma generate
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=builder --chown=node:node /app/backend/package*.json ./
COPY --from=builder --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/backend/prisma ./prisma
COPY --from=builder --chown=node:node /app/backend/prisma.config.ts ./
COPY --from=builder --chown=node:node /app/backend/dist ./dist
USER node
EXPOSE 3201
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 CMD wget -q --spider http://127.0.0.1:3201/api/health || exit 1
CMD ["node", "dist/backend/src/index.js"]
