# Watchlist

A personal media tracker with lists, friends, collections, comments, and browser downloads. React + TypeScript, an Express API, and PostgreSQL. Existing layouts and visual structure are retained.

**Release status:** this branch hardens the application; it is not a claim that every external provider works. Streaming scrapers are disabled pending successful live playback checks. Metadata services require working upstream access and, for TMDB/RAWG, API credentials. Read [the audit](docs/audit.md), [provider report](docs/providers.md), and [deployment procedure](docs/deployment.md) before releasing.

## Local development

Use Node 24.12 or newer and npm. PostgreSQL 18 is used in CI. The checked-in npm lockfiles are authoritative; Bun lockfiles were removed.

```sh
npm ci --prefix backend
npm ci --prefix frontend
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Set `DATABASE_URL` and generate two independent JWT secrets, for example with `openssl rand -hex 32`. Configure provider credentials in the backend only. For a **new, empty development database**:

```sh
cd backend
npm run db:generate
npm run db:deploy
npm run dev
```

In a second terminal, run `npm run dev --prefix frontend` from the repository root. The frontend/proxy runs on port 3200 and the backend on 3201. `dev:vite` serves only the client and does not provide the media proxy routes.

**Existing databases need the baseline procedure in [deployment.md](docs/deployment.md). Do not run `db push` against production.**

## Structure

| Directory | Responsibility |
| --- | --- |
| `frontend/src/app` | Application composition, navigation, overlays, layout |
| `frontend/src/features` | Feature components, APIs, offline storage and downloader |
| `frontend/src/context` | Auth, notifications, offline state; one video provider per app |
| `frontend/src/shared` | Browser API, identity, UI and storage contracts |
| `frontend/server.ts`, `frontend/build` | Node media proxy/HTML serving and generated offline shell |
| `backend/src/modules` | Existing domain use cases and Prisma gateways |
| `backend/src/services/consumet` | Upstream adapters and extractors |
| `shared` | Runtime-independent identity, matching, MangaPlus and provider definitions |
| `server` | Node-only shared network boundary for proxy requests |
| `backend/prisma/migrations` | Versioned schema and data migrations |

The previous root-level frontend implementation and re-export layer have been consolidated under `src`. Unused legacy backend gateways/services were removed; active compatibility gateways remain where still used.

## Verification

```sh
npm run typecheck --prefix frontend
npm test --prefix frontend
npm run build --prefix frontend
npm run build:server --prefix frontend
npm exec --prefix frontend -- playwright install chromium
npm run test:e2e --prefix frontend
npm run build --prefix backend
```

For backend tests, use a **dedicated database whose name ends in `_test`**:

```sh
cd backend
DATABASE_URL=postgresql://postgres:password@localhost:5432/watchlist_test npm run db:deploy
DATABASE_URL=postgresql://postgres:password@localhost:5432/watchlist_test npm test
```

Tests delete data in that test database. With no `DATABASE_URL`, the suite attempts an embedded PostgreSQL instance; this requires a host that permits its subprocess/user setup. CI uses a real PostgreSQL service, runs migrations, builds both apps, and runs the Chromium production/offline tests.

Live provider checks are separate from deterministic tests:

```sh
npm run test:providers --prefix backend
npm run test:providers --prefix backend -- --only=hianime,mangapill --output=/tmp/provider-checks.json
```

See [providers.md](docs/providers.md) for adapter contracts, identity rules, and the enablement checklist. Offline downloads use browser storage, are device-local, and can be evicted if the browser declines persistence. Downloaded content is not encrypted or isolated between accounts using the same browser profile. Reading position is local; there is no claimed background reading-progress synchronization.
