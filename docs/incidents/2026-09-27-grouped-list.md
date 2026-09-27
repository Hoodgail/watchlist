# Grouped-list production failure

## Cause

The merged release was deployed without applying its database migrations. Requests
for populated video lists failed in `loadActiveProgressMap` with Prisma `P2022`:
`provider_mappings.user_id` did not exist. The old health endpoint only executed
`SELECT 1`, so Docker reported a healthy backend with an incompatible schema.

## Recovery

- Took PostgreSQL custom-format backups in the database container's persistent
  `/var/lib/postgresql/watchlist-backups` directory. Restored the first backup to
  `watchlist_upgrade_check_20260927` and verified restoration completed.
- Compared the restored schema with `prisma/baseline.prisma`: no differences.
- Rehearsed the identity migration. Its ambiguity guard rejected one legacy
  reference: `tmdb:810693`, stored as both ANIME and MOVIE.
- Verified the source title against TMDB's movie page for 810693 (Jujutsu Kaisen 0).
  Explicitly qualified this reference as `tmdb:movie/810693` across references,
  preserving the users' ANIME/MOVIE categories. One source and two list records
  changed; no matching progress, mappings, aliases, comments, collection items,
  or suggestions needed that correction. No user records were deleted.
- Applied the unchanged identity migration to the restored copy. Prisma reported
  no schema differences; grouped-list application queries passed for all five
  existing accounts.
- Took a second production backup, verified production still matched the baseline,
  and recorded the baseline. Applied the explicit reference correction and identity
  migration atomically, with exclusive locks on affected tables and a ten-second
  lock timeout. Recorded the completed migration using Prisma's resolve command.
- Verified production migration status and schema diff: up to date, no differences.

Backup files: `pre-identity-20260927.dump` and
`pre-repair-final-20260927.dump`. These contain private production data and must
remain on the server, not in this repository. The restored diagnostic database is
also private and is retained for recovery review.

## Prevention

The health endpoint now resolves `provider_mappings.user_id` without returning any
rows. It returns 503 for the exact incompatible schema that previously passed.
A database integration test temporarily renames that column in the isolated test
database, checks 503, restores it, then checks 200. This is a targeted readiness
check, not a substitute for running `prisma migrate status` and schema diff during
deployment. Keep authenticated, populated-list smoke tests in the release checklist;
an empty list does not exercise provider-mapping enrichment.

## Separate configuration gaps

Production logs also report missing TMDB and RAWG API keys. Those credentials are
not available in the Watchlist deployment environment. This migration repair does
not enable those providers or repair their credentials.
