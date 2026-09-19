# Deployment and rollback

Deploy only after the PR is reviewed and merged. Do not deploy this branch automatically. The application domains are `watchlist.hoodgail.me` and `watchlist-api.hoodgail.me`; Dokploy is at `https://server.lumina.pw/swagger`.

## Before changing production

1. Identify the exact Dokploy Compose/application linked to `Hoodgail/watchlist`. Inspect its current commit, environment, domains, network and deployed image. Do not guess its application/Compose ID.
2. Confirm the merged commit's CI is green. Build the exact merged revision with Node 24 and the committed npm lockfiles.
3. Take and verify a restorable PostgreSQL backup; record the current image/commit and environment. Test the upgrade against a restored staging database first. Never use production as the integration-test database.
4. Provide the real JWT secrets, `DATABASE_URL`, provider keys, `CORS_ORIGIN`, `FRONTEND_URL`, Discord callback settings and SMTP settings through Dokploy secrets/environment. No deployment API key belongs in source control or build arguments. Only `VITE_API_URL` and `VITE_FRONTEND_URL` are public build-time values.
5. The existing Compose file expects the external `dokploy-network` and the configured Traefik HTTPS redirect middleware/certificate resolver. Verify those objects exist. Frontend container port is now **8080**, backend **3201**; Compose routing and health checks have been updated together.

## Database baseline (existing installation only)

The old repository did not track migrations. `20260919000000_baseline` represents the schema at the starting commit. `prisma/baseline.prisma` is its comparison snapshot; `prisma/schema.prisma` is the new schema.

From `backend`, against a restored staging copy, inspect the baseline diff:

```sh
npx prisma migrate diff --from-config-datasource --to-schema prisma/baseline.prisma --script
```

If the output contains changes, investigate them. Do **not** mark an incompatible database as baselined. For a matching pre-existing schema without Prisma history, record the baseline, then apply the upgrade:

```sh
npx prisma migrate resolve --applied 20260919000000_baseline
npx prisma migrate deploy
```

For an empty database, simply use `npx prisma migrate deploy`; do not resolve the baseline manually. If `_prisma_migrations` already exists, inspect its history before taking either path.

The upgrade is transactional. It qualifies legacy TMDB movie/TV references, normalizes the retired AniList prefix, widens episode keys, and scopes provider mappings to their original verified user. It refuses ambiguous movie/TV references. Unique-key conflicts from already-duplicated canonical/legacy identities also fail rather than delete data. Resolve those cases from the actual titles, types and provider IDs in staging; do not infer identity from a numeric ID alone. Unresolvable orphan mapping/progress references need manual review.

Repeat the proven procedure in a production maintenance window, with the old backend stopped while data identities change. The container includes the Prisma CLI/config/migrations, so a one-off backend container can run `npm run db:deploy`. Migrations are intentionally not run on every application startup. Do not run `prisma migrate reset` or `db push` on production.

## Deploy and verify

Use the installed Dokploy version's Swagger schema to inspect the target and trigger its deployment. Wait for build and rollout completion; an accepted deploy request alone is not success.

Verify all of the following from a network that can reach the deployment:

- DNS A/AAAA/CNAME resolution for both domains points to the intended edge/server. Check IPv6 too if AAAA records exist.
- `http://watchlist.hoodgail.me` redirects to HTTPS, the certificate is valid for the hostname, and HTTPS serves the merged application's HTML/assets.
- `https://watchlist-api.hoodgail.me/api/health` returns 200 with `status: ok` and database access actually works.
- Login, refresh, a temporary user's list create/update/delete, collection visibility and a comment roundtrip work; clean up the temporary records.
- Cross-origin API requests and OAuth cookie roundtrip work from the configured frontend origin. No wildcard CORS or secret-bearing redirect query strings.
- Manifest, icons and `/sw.js` are reachable; an already-installed client receives an update after its previous tabs close. A new browser session can install/cache the shell and reload offline.
- At least one intended video provider passes search → detail → episode → source → actual playback/seek/subtitle → download → offline replay. Check the intended manga provider through actual image decoding and offline reading as well. Enable only capabilities with recorded evidence.
- Browser console, container logs and readiness remain clean after the rollout.

Record commit SHA, migration status, deployment ID, verification time and results without credentials.

## Rollback

Keep the previous images and pre-migration backup. Because media identities and mapping uniqueness change, **rolling back code alone is not safe after the data migration**. Stop writers, restore the tested backup into the designated database (or a replacement database), point the previous release at it, and verify health and user data before reopening traffic. Restoration discards writes made after the backup; plan the maintenance window accordingly. Do not improvise a reverse identity migration.

## Access observed during this audit

The executor could not resolve the three deployment hostnames directly. Requests through its outbound path to Swagger, the frontend and API health returned 403 (the repeated Swagger response identified Cloudflare error 1010). No deployment, DNS change, production database access or credential validation was completed. Those observations must be rechecked from the deployment-capable environment after merge; they do not establish whether the public domains currently resolve for ordinary users.
