# Repository Shared

This directory is reserved for framework-agnostic, cross-runtime code that is safe to use from both backend and frontend.

- Put pure TypeScript helpers, shared domain primitives, and neutral matching/refId utilities here.
- Do not import Express, React, Prisma, browser APIs, or Node-only infrastructure concerns here.
- If a utility needs runtime-specific behavior, place it in `backend/src/shared/` or `frontend/src/shared/` instead.
