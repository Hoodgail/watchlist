# Release hardening audit

Date: 2026-09-19. Starting revision: `ceae7d3` (`main`). This records code changes and verification evidence, not a certification that every screen or upstream service is production-ready.

## Findings and changes

| Area | Finding | Change |
| --- | --- | --- |
| Frontend structure | Implementations existed outside `src`, with duplicate entry points and wrapper imports | Consolidated implementations in `src`; removed root entry points, dead dependencies and Bun lockfiles |
| Backend structure | Old services and legacy gateways duplicated the active modules | Removed unreachable implementations; retained gateways still referenced by composition roots |
| Dependencies | Old major versions and broken peer installation | Updated direct packages and lockfiles; React 19, Vite 8, TS 7, Express 5, Prisma 7, Node 24; normal `npm ci` |
| Prisma | No migrations tracked; Prisma 7 requires a driver adapter | Added PostgreSQL adapter, CLI config, baseline and transactional data migration |
| Identity | TMDB movie and TV numeric IDs could collide | New `tmdb:movie/ID` and `tmdb:tv/ID` references; legacy collision preflight fails instead of guessing |
| Aliases | Adding an alias could duplicate a user's list entry | Lists, collections and suggestions store the resolved canonical reference; duplicate guard remains backed by a unique index |
| Provider selections | Anonymous/global writes could affect everyone | Authenticated, user-scoped mappings with a compound database key; automatic mappings no longer persist |
| Catalog editing | Any user could modify shared aliases | Explicit `CATALOG_EDITOR_IDS` authorization; empty configuration grants nobody access |
| Progress | A provider-only fallback could advance an unrelated title | Exact reference, alias or current user's exact mapping required; ambiguous matches do not update a list |
| Episode/chapter IDs | Local IDs could collide between titles/providers | Provider + encoded parent + encoded part keys; local storage rejects cross-title overwrites |
| Comments | Alternative provider references fragmented threads | Canonical references and alias-aware reads; stable time-ordered cursor pagination; server-side followed-author filter; editor-only external imports; removed four external-comment stubs and fake refresh success |
| OAuth | Caller-controlled state was not verified; tokens appeared in query strings | Random state bound to an HTTP-only signed cookie, provider check, authenticated account-link intent, fragment token delivery; callback handles React StrictMode once |
| Passwords | Set-password could replace an existing password | Existing-password accounts must use change-password; password changes/recovery revoke refresh sessions |
| Recovery | Logged delivery instead of sending email; plaintext reusable recovery tokens | SMTP transport, hashed purpose-specific tokens, conditional single-use reset; explicit 503 when SMTP is absent |
| Refresh | Concurrent client refreshes raced rotating tokens | One in-flight refresh per browser app; conditional server token deletion |
| Auth offline | Session helper swallowed network errors and erased the cached user | Network failure reaches the offline-auth path; confirmed by production browser test |
| Proxy | Caller-controlled URLs could reach internal network addresses | Protocol/port restrictions, private/reserved IP rejection, DNS validation at connection, validation of every redirect, timeouts |
| Images | Browser pointed to a proxy route on the wrong server | Frontend-relative image proxy; upstream active document types rejected |
| PWA | Tailwind loaded from a CDN; static cache did not reliably contain the whole app | Tailwind compiled locally; build-hashed shell precaches all generated assets; API/media requests are excluded |
| Downloads | Video context remounted between screens | Single provider at app root preserves the active queue across navigation |
| HLS | AES IV/sequence, key reset and byte-range handling were incorrect | Big-endian explicit IVs, media-sequence IVs, METHOD=NONE reset, per-download keys, range checks and cancellation |
| Unsupported HLS | Live, SAMPLE-AES and changing/encrypted initialization segments could produce corrupt downloads | Clear rejection of unsupported formats; these are not marked complete |
| IndexedDB | Writes resolved before commit; partial files counted as complete | Resolve on transaction completion, reject aborts, validate full chunk/segment/page counts, preserve typed-array slices |
| Startup storage cleanup | Background scans could delete newly saved bytes and resumable HLS segments | Removed unsafe automatic cleanup; browser regression verifies playback and retained partial segments after reload |
| Manga chapters | First-page-only behavior and SDK detail conversion could lose metadata | Direct MangaDex detail/pages adapter and explicit chapter pagination; deterministic fixture tests |
| Fake synchronization | Manga progress was marked synced without an API call | Removed the fake sync path; reading position remains local |
| Runtime | Node 20 images, root frontend, frontend/backend port mismatch | Node 24 images, non-root runtime, port 8080 frontend/3201 API, matching Compose routing and env examples |
| Health | API health did not verify its database | Readiness now queries PostgreSQL and returns 503 on database failure |

## Dependency policy

Direct npm dependencies were refreshed to the latest stable releases available during this audit, with committed lockfiles. Prisma CLI and client remain on matching **7.10.0**: the CLI latest tag points to an 8.0 release candidate, which is not a stable upgrade target. Node 24 is the runtime baseline. The overrides in `backend/package.json` address vulnerable pinned transitive dependencies and should be removed when Prisma ships those fixes itself.

## Verification

- Backend HTTP/database suites cover auth, OAuth state, list ownership, comments and visibility, friends, collections, suggestions, profiles, watch progress, provider mapping isolation and identity regressions.
- Migration tests apply the old baseline to an isolated schema, seed legacy data, upgrade it, and verify both data preservation and rollback on ambiguous TMDB references.
- Frontend tests cover component routing/auth, API refresh, identity and image routing, HLS encryption/ranges/resume/abort, actual IndexedDB byte roundtrips, incomplete downloads and deletion.
- Chromium tests use the production build: offline shell/styles, manifest/icons, missing-asset 404, proxy private-address rejection, and playback of a locally generated VP8 fixture from IndexedDB after an offline reload. This tests real decoding, not just presence of a player element.
- Local database validation used PGlite's PostgreSQL engine with a wire-protocol bridge because this executor cannot initialize an embedded PostgreSQL OS user. The checked-in CI runs PostgreSQL 18, not PGlite. Its result must be checked on the PR.
- `npm audit` reported zero advisories for both lockfiles after updates. Prisma's pinned transitive `deepmerge-ts` and `mysql2` dependencies required explicit patched overrides. Dependency audit is not a security certification.
- Final local results: **224 backend tests (18 files), 63 frontend tests (15 files), and 4 production-build Chromium tests passed**. Both builds, frontend type checking, and a direct import of the compiled backend passed. No tests claim live provider playback success.

## Remaining release gates and limitations

1. **Provider access:** consult [the live report](providers.md). There is no verified live video stream in this environment. Failed/partial probes stay disabled; metadata credentials and deployment-network checks are still required. Existing lists and downloaded media are retained.
2. **Production access:** DNS lookup failed locally and outbound requests to the Dokploy Swagger page and Watchlist domains returned 403. A repeated Swagger request returned Cloudflare error 1010. This is an execution-environment observation, not proof of a production outage. No production deployment or migration was performed.
3. **Database migration:** restore a real production backup into staging and follow [deployment.md](deployment.md). The baseline must match the existing schema. Legacy references that already collided cannot be reconstructed automatically. Unowned old automatic mappings are retained with `user_id = NULL` and ignored.
4. **Browser/device coverage:** Chromium desktop is exercised. iOS Safari installation, storage pressure/eviction, mobile download interruptions and device-specific codec support still need real-device acceptance testing. Layout markup was retained, but no claim of pixel-identical rendering across all browsers is made after the Tailwind/React upgrade.
5. **Offline scope:** downloads and reading position are browser-local. Pending download queues do not survive a tab/process restart; HLS segment resume is supported when restarting the same download. Partial bytes are retained; abandoned data may require clearing site storage. Offline video progress is stored locally; automatic replay to the backend on reconnect is not implemented. Online video progress continues to post to the API.
6. **Download memory:** large direct MP4 responses are still buffered before chunked IndexedDB storage. Live/DRM/SAMPLE-AES and multi-initialization HLS are unsupported, with explicit errors. Byte-range and AES-128 VOD paths have deterministic tests; upstream source bytes remain a separate gate.
7. **Accounts:** existing local-storage token persistence remains. Offline content is shared within a browser profile. SMTP delivery and Discord's real callback must be checked with deployment credentials. Old pending recovery codes should be reissued because purpose-specific hashed tokens replaced the previous representation.
8. **Containers/ops:** Docker image definitions were reviewed and Node builds tested; this executor did not run a Docker daemon. Validate images, TLS, CORS, backups and readiness on staging before production. The media proxy is public; put bandwidth/request limits at the reverse proxy appropriate to segment downloads.

This PR deliberately does not add queues, microservices, a new application framework, or a redesign. The remaining large feature components can be split during feature work; mechanically extracting every component would make this already broad migration harder to review.
