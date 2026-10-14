# Sprint 2.4 — Boot reviews and ratings

Implemented locally on 14 October 2026. This sprint extends the existing Auth.js email accounts, PostgreSQL/Prisma catalogue identities and Clean Minimal UI. No new dependencies or environment variables, fabricated community activity, verified-owner badges, Fit Finder, comparison tool or Sprint 2.5 features were added.

## Behaviour and identity policy

- Verified, active accounts can publish, edit and delete structured reviews. One row per `(authorId, variantId)` is enforced by PostgreSQL, including hidden reviews. Deletion is permanent, cascades helpful votes and permits a later fresh review. A review cannot move to another variant or author. Version checks reject stale updates/deletions with 409.
- `BootReview.variantId` references the existing `BootVariant`, whose tier/generation identity is already constrained. Generations, tiers and outsole variants never share aggregates. **Colorways of the same exact variant share reviews**; a review does not claim to review a particular colorway. The return link uses that variant's first catalogue slug in alphabetical order. The eight catalogue entries remain explicitly fictional, unverified samples.
- Required: size worn and UK/US/EU/CM system, ownership in whole months (zero allowed), approximate matches, written experience, pros/cons, six integer ratings 1–5. Sizes are entered numerically because available manufacturer sizes are unknown; no stock/size range is invented.
- Six equally weighted criteria: comfort, fit satisfaction, traction, ball touch, durability, value for money. `overall = (comfort + fit + traction + ballTouch + durability + value) / 6`. The server derives `ratingTotal`; a database CHECK requires it to equal the six stored ratings. UI rounds to one decimal only for display. Distribution groups each review by `Math.round(overall)`, with .5 rounding upwards.
- Aggregates include only published reviews from active, verified authors with public profiles. Empty averages are null, displayed as **Not yet rated**. Review count is always shown; fewer than five receives a small-sample label. Summary includes all public reviews for the exact variant, while filters affect the list.
- Optional context: playing position/surface, subjective width, toe room, midfoot pressure, heel lockdown, break-in and self-reported price/currency. None become manufacturer facts, verified experimental measurements, endorsements or authoritative sizing advice. Editorial/experimental data is not implemented.
- Helpful voting is a desired boolean state, unique per review/user, idempotent and owner-forbidden. Historical votes remain when a voter is suspended; account deletion cascades their votes. Counts come from stored votes, not a client-supplied counter.

## Privacy and security

Foot length, width and shape are private by default. The form has an explicit unchecked consent checkbox. Public reads use a projection that excludes private fields; a second query retrieves them only from consenting records, within the same RepeatableRead snapshot. Public responses expose no author IDs, emails or sessions. Shape filters/options also exclude non-consenting records, preventing a private shape from leaking through query results. Revoking consent removes all three fields from subsequent public responses and filters; the author can still retrieve their own values.

`GET /api/reviews/:id/owner` is authenticated, strictly owner-only and uses `Cache-Control: private, no-store` with `Vary: Cookie`. Only input fields and the version are returned. Public APIs are no-store as well. Written content is plain React-escaped text; HTML/Markdown is not executed. Users are warned not to put private measurements into free text.

Mutations reuse existing Origin checks, bounded streaming JSON input (16 KiB), fresh post-body authentication, shared database/HMAC rate limits and transaction-level account privilege locking. Reviews allow 30 change attempts/minute and five create attempts/15 minutes per user; helpful changes allow 60/minute. Limits are independent of post/comment/vote budgets. Zod strictly rejects forged author/score/permission fields and invalid ratings/measurements. Prisma queries are parameterized; raw locking SQL uses tagged parameters. Review row locks serialize edits/deletes/votes; unique constraints handle concurrent creation. No sensitive environment values are rendered or documented here.

## Schema and migration

`prisma/schema.prisma` adds `BootReview`, `ReviewHelpfulVote` and relations to the existing User/BootVariant. Six scalar rating columns and optional fit columns avoid unnecessary entities for this fixed MVP.

`prisma/migrations/20261014020000_boot_reviews/migration.sql` is additive: tables, author/variant FKs, author+variant uniqueness, rating/field CHECKs, variant/status/date and rating-sort indexes, author-history index, helpful vote compound PK and user index. Triggers prevent review identity changes and self-helpful votes. No existing table data is reset or rewritten.

The migration was tested on disposable databases, then applied locally. Existing User/UserProfile/Post/Comment/PostVote/CatalogueEntry counts and content hashes were identical before/after (0/0/0/0/0/8). No fake users/reviews were inserted into the development database. All six migrations are applied; Prisma reports no schema difference.

## Routes and APIs

| Method | Route | Behaviour |
| --- | --- | --- |
| GET | `/api/reviews` | Public paginated list; variant/author/size+system/shared shape/surface/duration filters; recent/highest/lowest/helpful sorting |
| POST | `/api/reviews` | Create exact-variant review; authenticated |
| GET | `/api/reviews/:id` | Public full review with consent-aware foot information |
| PATCH | `/api/reviews/:id` | Author-only full update, including version; stable variant |
| DELETE | `/api/reviews/:id` | Author-only deletion, including version |
| GET | `/api/reviews/:id/owner` | Author-only form input, including private measurements |
| GET | `/api/reviews/:id/helpful` | Private current voting state/permission |
| PUT | `/api/reviews/:id/helpful` | Set `{ helpful: true/false }`; active non-author only |
| GET | `/api/boot-variants/:id/ratings` | Real overall/count/criteria/distribution and available filter options |

List query: `variant`, `author` (public username), `size`, `system`, `shape`, `surface`, `duration` (`under-3`, `3-12`, `over-12`), `sort` (`recent`, `highest`, `lowest`, `helpful`), `page` (1–1000). Ten reviews/page; deterministic timestamp/ID tie-breaks. Reads/counts/privacy projections use consistent snapshots. Unknown variant aggregation returns 404; unavailable database returns a sanitized 503.

Pages: `/boots/:slug/reviews/new`, `/reviews/:id`, `/reviews/:id/edit`. Anonymous form access returns to the same form after email verification. Boot details keep static catalogue rendering and fetch live reviews independently, with loading, empty, error/retry and filter reset states. Filters appear only when actual stored values exist. The six star controls are native radio groups, with labels, keyboard behaviour, 44px targets and visible focus. Optional sections use disclosure; invalid optional fields reveal their section. Pending submissions are guarded both by disabled controls and a synchronous ref. Delete requires explicit inline confirmation; cancel restores focus.

Public profiles include paginated review history, boot identity, score, excerpt, date and link to the full review, where authors see edit/delete actions. Shared linked-boot cards in Community feed/detail link to structured reviews. Publishing a review never creates a duplicate Post.

## Changed files for this sprint

- `prisma/schema.prisma`; new `prisma/migrations/20261014020000_boot_reviews/migration.sql`.
- New `src/lib/reviews/{validation,service,reviews.test}.ts`.
- New `src/app/api/reviews/route.ts`, `[id]/route.ts`, `[id]/owner/route.ts`, `[id]/helpful/route.ts`; `src/app/api/boot-variants/[id]/ratings/route.ts`.
- New `src/components/reviews/{review-form,review-card,review-list,review-actions}.tsx`.
- New `src/app/boots/[slug]/reviews/new/page.tsx`, reviews loading/error boundaries; `src/app/reviews/[id]/page.tsx`, `[id]/edit/page.tsx`, loading/error boundaries.
- Updated `src/app/boots/[slug]/page.tsx`, `src/app/users/[username]/page.tsx`, `src/components/community/post-card.tsx`, `src/app/globals.css`, `src/lib/community/http.ts`.
- New `tests/reviews.integration.ts`; updated `tests/auth.integration.ts` to include reviews and unavailable-database checks.
- Updated README and architecture/design notes; this document. Existing uncommitted Sprint 2.3 implementation is preserved.

## Setup and manual verification

Existing `.env.example` is unchanged: PostgreSQL `DATABASE_URL`, Auth.js `AUTH_SECRET`/fixed `AUTH_URL`, `EMAIL_SERVER`/`EMAIL_FROM`; optional trusted-proxy header only behind a properly configured proxy. See [foundation setup](phase-2-foundation.md).

```sh
npm ci
npm run db:deploy
npm run db:catalogue
npm run dev:mail  # local SMTP capture, separate terminal
npm run dev
```

Use a disposable local QA environment/database for workflows that create/delete test data. Never reset the development database. With a local PostgreSQL URL, `npm run build` then `npm run test:integration` automatically creates, migrates, exercises and removes its own random test database.

1. Open a sample boot's Reviews section. Expect Not yet rated/zero count on an empty database. Write a review anonymously; confirm sign-in and return URL.
2. Sign in, fill the six ratings and required ownership/experience fields. Enter optional fictional measurements with consent off. Publish; refresh and check the review persists without measurements in public content/API.
3. Open the review through your profile; edit scores, enable sharing and verify public foot information. Disable sharing again; verify removal from public fields and shape-filter options.
4. With another test account, verify helpful toggle and that edit/delete/private-owner APIs reject access. Try a duplicate review, out-of-range score, forged author and stale version.
5. Compare two colorways of one exact variant (same review count), another outsole and another generation/tier (separate aggregates). Try each available filter and sort and page 2 with enough disposable records.
6. Cancel deletion and check focus returns to Delete review; confirm deletion and verify count/averages recalculate. Test 375/768/1024/1440px and keyboard radio navigation.

## Verification results

Executed successfully against the final implementation:

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS — 100 tests in six files |
| `npm run test:integration` | PASS — 38 tests including the parent lifecycle test |
| `npm run build` | PASS — catalogue detail pages remain statically generated |
| `npx prisma validate` | PASS |
| `npx prisma migrate status` | PASS — six migrations applied |
| Prisma schema diff with `--exit-code` | PASS — no difference |
| `npm audit --omit=dev` | PASS — zero production dependency vulnerabilities |
| `npm audit` | FAIL — five pre-existing High findings in the development-only braces/ESLint chain; incompatible downgrade not applied |

Review integration covers authenticated creation/persistence, validation/forged fields/Origin, duplicate races, owner/private API enforcement, stale edit/delete, score recalculation, consent/revocation and private-shape query protection, real averages/distribution/criterion means, same-family outsole and generation/tier separation, user history, sorting/filtering/pagination, concurrent/idempotent helpful votes, DB checks/identity/self-vote guard, literal XSS escaping, hidden reviews, in-flight suspension, rate limiting and delete/vote cascading. Existing authentication/posts/comments/voting tests also pass. An initial fixture header/SQL error was corrected before the successful full runs.

Browser QA used a separate disposable production preview. It verified anonymous login return, create/refresh/edit, score updates, consent on/off, profile history, same-variant colorway sharing and deletion returning to Not yet rated. Summary layouts at 375/768/1024/1440px had no document horizontal overflow. QA accounts/content were explicitly labeled temporary; the QA database and captured email were removed. Helpful-voting UI with a second user, screen-reader behaviour, cross-browser testing, production SMTP/deployment and load testing remain manual checks.

Generated duplicate `.next/types/routes.d N.ts` files caused a local typecheck failure; removing only these ignored generated duplicates restored the actual typecheck. Source was not changed to hide the issue. Full dependency audit has the pre-existing development-only braces advisory documented in [foundation notes](phase-2-foundation.md#trusted-proxy-limits-and-dependency-advisory); no incompatible dependency downgrade was applied.

## Completion and limits

| Sprint 2.4 requirement | Status |
| --- | --- |
| Secure exact-variant review CRUD and one-review policy | PASS |
| Six ratings, documented overall, live aggregates and truthful empty state | PASS |
| Optional subjective fit data and explicit measurement/shape consent | PASS |
| Normalized identities, additive migration, constraints and transactions | PASS |
| Secure paginated/filterable/sortable APIs and helpful voting | PASS |
| Boot detail summary/list/form integration | PASS |
| Accessible form, pending/error/success states and responsive layouts | PASS for executed checks; full assistive-technology audit NOT TESTED |
| Public profile history and own-review management | PASS |
| Community navigation without duplicate posts | PASS |
| Automated verification and preservation of prior features/data | PASS |
| Sprint 2.5 / Phase 3 implementation | Not started, as requested |

Ready for **local Sprint 2.5 planning: YES**, based on the executed checks and isolated lifecycle coverage; no automatic next sprint. This is not a production deployment sign-off. Manufacturer catalogue verification, ownership verification, moderation/reporting dashboard, review images, recommendation algorithms and scale optimizations remain outside this sprint. Read filtering is indexed where needed for this MVP, but aggregate/options queries are live and may require caching or dedicated aggregation after measured load. Available filter options currently inspect stored distinct combinations; no large-dataset performance claim is made. Private measurements remain in the authenticated database and require appropriate operator access/backups; consent governs public display, not external data export. Comparison was not present in the repository and was not added.

Subsequent repository-wide audit added regression coverage and fixed response headers, missing-review routing and concurrent-deletion pagination. Current verification is 104 unit tests and 40 integration tests. See [production review and remaining release gates](production-review-2026-10-14.md).
