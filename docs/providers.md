# Provider contracts and live checks

The single frontend/backend availability catalog is `shared/providers.ts`. A registered provider is not automatically enabled or verified. `enabled` controls selection and backend calls; `status`, `reason`, `isWorking` and optional `verifiedAt` communicate evidence. Disabled providers return explicit unavailability rather than silently substituting another provider.

## Current evidence

Probe timestamp: `2026-09-19T21:25:48.588Z`. These checks ran from a restricted executor; connection timeouts, proxy errors and upstream status codes are reported as observed. They do not prove a provider is permanently gone. Successful search or page URL extraction is not proof of playable/downloadable bytes. TMDB/RAWG credentials were unavailable.

| Provider/integration | Observed checks |
| --- | --- |
| hianime | search: **failed** — Something went wrong. Please try again later. |
| animepahe | search: **failed** — Connection to establish proxy tunnel timed out after 5000ms |
| animekai | search: **failed** — Something went wrong. Please try again later. |
| kickassanime | search: **failed** — timeout of 10000ms exceeded |
| flixhq | search: **failed** — Request failed with status code 522 |
| goku | search: **failed** — Connection to establish proxy tunnel timed out after 5000ms |
| sflix | search: **failed** — Connection to establish proxy tunnel timed out after 5000ms |
| himovies | adapter: **disabled** — Incorrect adapter: instantiates FlixHQ instead of HiMovies |
| dramacool | search: **failed** — Request failed with status code 502 |
| mangadex | search: **passed** — 20 results; info: **failed** — Missing title |
| comick | search: **failed** — Connection to establish proxy tunnel timed out after 5000ms |
| mangapill | search: **passed** — 50 results; info: **passed** — Detail returned a title; pages: **passed** — 17 pages; image bytes not verified |
| mangahere | search: **failed** — Connection to establish proxy tunnel timed out after 5000ms |
| mangareader | search: **failed** — Connection to establish proxy tunnel timed out after 5000ms |
| asurascans | search: **failed** — Cannot read properties of undefined (reading 'split') |
| anilist | search: **failed** — Cannot read properties of undefined (reading 'Page') |
| anilist-manga | search: **failed** — Request failed with status code 403 |
| myanimelist | search: **passed** — 9 results; info: **failed** — Cannot read properties of undefined (reading 'trim') |
| tmdb | search: **unconfigured** — TMDB_API_KEY absent |
| libgen | search: **failed** — BOOKS.Libgen is not a constructor |
| novelupdates | search: **failed** — Search returned no results for the fixture query |
| getcomics | probe: **timeout** — 45 second budget exceeded |
| rawg | search: **unconfigured** — RAWG_API_KEY absent |
| mangaplus | pages: **failed** — Fixture chapter returned no pages |
| hianime-comments | comments: **failed** — The operation was aborted due to timeout |
| reddit-comments | adapter: **disabled** — Removed stub: returned empty results without making a request |
| mal-comments | adapter: **disabled** — Removed stub: returned empty results without making a request |
| anilist-comments | adapter: **disabled** — Removed stub: returned empty results without making a request |
| letterboxd-comments | adapter: **disabled** — Removed stub: returned empty results without making a request |
| mangakakalot | adapter: **disabled** — Stale frontend identifier with no backend adapter; removed from selectors |
| readlightnovels | adapter: **disabled** — Stale frontend identifier with no backend adapter; removed from selectors |
| animenewsnetwork | adapter: **disabled** — Advertised in registry but no callable adapter |

Raw output: [provider-checks.json](provider-checks.json). The probe tests SDK endpoints directly so disabled adapters can be diagnosed without enabling them in the application. It is opt-in and has per-provider time budgets. The app's custom MegaCloud extraction could not be validated because a working source flow was not reached.

Release defaults keep video scrapers and unsuccessful alternative manga/book/comic sources disabled. AniList, TMDB, RAWG and MangaDex metadata entry points remain configurable/unverified; missing keys or upstream outages still prevent new searches. Existing data is not deleted. MangaPill returned metadata and page URLs but image bytes were not verified, so it remains disabled pending that check. HiMovies used a FlixHQ adapter under the wrong name; Libgen had no SDK constructor; ANN had no callable dispatcher. These are implementation defects, not network conclusions.

MangaDex's SDK detail probe returned no title. The application now uses its existing direct MangaDex API for details/pages, with explicit chapter pagination and fixture tests. That replacement still needs a successful live check from the deployment network. External HiAnime comments stay disabled; Reddit, MAL, AniList and Letterboxd placeholder classes were removed instead of advertising empty results as integrations. MangaPlus is an external-chapter integration, not an independent catalog provider; its probe did not establish usable page bytes.

## Identity rules

| Object | Key / rule |
| --- | --- |
| Catalog title | `<provider>:<provider-title-id>`; never use a title string as identity |
| TMDB title | `tmdb:movie/42` and `tmdb:tv/42` are different titles; ANIME from TMDB belongs to its TV namespace |
| AniList compatibility | `consumet-anilist:42` normalizes to `anilist:42` |
| Episode/chapter | `mediaPartKey(provider, parentId, partId)` encodes parent and part independently, including slashes |
| Personal list | Unique `(userId, canonicalRefId)` after alias resolution |
| Personal playback choice | Unique `(userId, refId, provider)`; authenticated reads and writes only |
| Global alias | Connects a verified provider title to a canonical `MediaSource`; only configured catalog editors may mutate it |
| Comments | New writes use canonical references; reads include known aliases while preserving media type and episode/chapter scope |
| Progress | Exact title reference, explicit alias, or the current user's mapping; no provider-only/title-similarity fallback |

A fuzzy match is a suggestion, never a global alias. Cached confidence retains its actual score and is cleared when the auth token changes. Choosing a source does not change someone else's list or choice. Existing automatic database mappings remain unowned and ignored. Do not merge two existing catalog records automatically: remapping their lists, collections, comments and progress requires an explicit data migration with collision checks.

Old browser downloads are not destroyed or guessed into new identities. New downloads use scoped keys; re-downloading is the safe way to replace an old ambiguous local record. Device-local files remain shared within a browser profile.

## Add or repair a provider

1. Choose one stable, unique provider name and register its display name, category, capabilities, base URL and disabled/unverified status in `shared/providers.ts`. Preserve compatibility identifiers for existing records. Frontend names and video availability derive from this catalog.
2. Implement the relevant category adapter in `backend/src/services/consumet`. Search/detail must return the unified types; video exposes episodes, servers and sources, manga exposes chapters and pages. Use the existing SDK when it works; use a small direct adapter when its data contract is demonstrably broken. Do not register one site's implementation as another site's name.
3. Wire the adapter through `consumetService.ts` and the category list/types. Validate availability at the API boundary. Keep metadata lookup separate from playback. For large chapter catalogs implement `getChaptersPaginated` with stable IDs, language and total/has-next-page information.
4. Never send a scoped browser episode/chapter key upstream. Unwrap it with `rawMediaPartId`; never remove arbitrary prefixes by substring guesses. Return raw provider IDs from server adapters; frontend services add their scope once.
5. Add deterministic fixtures for title conversion, paging, missing fields, error responses, and repeated numeric IDs across providers/titles. Keep fixtures small and free of signed URLs, tokens and copied media. Add a live probe in `backend/scripts/check-providers.ts`.
6. From the actual deployment network, check search, detail, title/season/episode identity, source extraction, redirects/headers, playable bytes, seek, subtitles, cancellation, download and offline replay. For manga, decode an actual image, check chapter pagination and offline page completeness. Record exact stages and time; include region/rate-limit failures.
7. Enable only after those checks pass. Set the availability/reason/verification timestamp together, rebuild both apps and review the change. The probe report never flips production settings automatically.

For external comments, implement the existing `ExternalCommentProvider` contract in the comments infrastructure gateway: real fetch/parse logic, supported media types, configuration check, stable external comment IDs and canonical title/episode mapping. Add fixtures for parsing and deduplication before registration. A provider returning `[]` without making a request is not an implementation.

## Downloads and network boundaries

HLS fixtures cover AES-128 VOD, implicit/explicit IVs, encryption reset, relative URLs, byte ranges, resume and cancellation. Unsupported live/DRM/SAMPLE-AES and changing initialization layouts fail explicitly. Proxy URLs are validated before every redirect and at DNS resolution to block private/reserved destinations. Do not bypass those checks to make a provider pass; repair its adapter/headers or keep it disabled.

Do not enable a provider based on an HTTP 200 alone. Upstreams often return an HTML challenge, an empty metadata shell, expired signed sources, or only an external-reader link.
