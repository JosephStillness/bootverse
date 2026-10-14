# BootVerse repository review and verification — 14 October 2026

## Decision

**Core implemented functionality: PASS after fixes. Public production launch: NO, pending the deployment/privacy/operations checks below.** No critical application exploit was confirmed by this review. Passing these tests is evidence for the implemented local behaviour, not a penetration-test or production certification.

This review inspected the existing working tree, including uncommitted Sprint 2.3/2.4 changes, and kept those changes intact. No production/development records, secrets, dependencies or database schema were changed. Mutation tests and browser fixture writes used generated, disposable local PostgreSQL databases. No deployment, push or new sprint was performed.

## Project and architecture

Next.js 16.4 App Router, React 19.3, strict TypeScript, Tailwind 4, customized shadcn/Base UI, Prisma 7.10 with its PostgreSQL adapter, pg 8.23.1, Auth.js 5 beta with Nodemailer email verification, Zod and react-markdown. npm/package-lock owns the installation boundary; installed dependencies were already available, so no installation was needed.

UI is under `src/app`/`src/components`; catalogue identities and filters under `src/lib/boots`; auth and request security under `src/lib/accounts`; post/comment/vote services under `src/lib/community`; reviews under `src/lib/reviews`. Six incremental migrations are applied. Brands → families → generations → tiers → outsole variants remain distinct; catalogue entries add a generation-consistent colorway. Reviews reference exact variants and pool only their colorways.

Home and catalogue detail bodies are statically generated. The catalogue initially renders query-aware results on the server and uses client URL state afterwards. Community/profile/account content is dynamic; boot reviews load independently through real database APIs. There is no password login, OAuth, boot comparison tool, recommendation engine, Fit Finder, image upload system or reporting/moderation dashboard. A Comparisons discussion category does not implement product comparison.

## Confirmed findings and fixes

| ID | Severity | Finding, impact and evidence | Fix/location |
| --- | --- | --- | --- |
| F1 | Medium, security hardening | Actual HTTP responses lacked MIME-sniffing and clickjacking protections, an explicit referrer policy and feature restrictions. This was a missing defense, not a demonstrated XSS/auth exploit. The new response-header integration test failed before the change. | `next.config.ts:4`: disable X-Powered-By; nosniff; DENY; no-referrer; disabled camera/microphone/geolocation; CSP frame-ancestors/base-uri/object-src/form-action. Verified on home/catalogue/community, API and SVG asset responses. |
| F2 | Medium, functionality | Authenticated `/reviews/missing-review/edit` propagated a known 404 domain error into a generic service failure. It also lacked a review-specific not-found view. New integration test reproduced the wrong view. | `src/app/reviews/[id]/edit/page.tsx:22` handles known 404s from both owner lookup and public label lookup with `notFound()`; new `src/app/reviews/not-found.tsx:1` provides the correct message/navigation. Genuine service errors still reach the error boundary. |
| F3 | Medium, UI functionality | When 11 reviews became 10 between page requests, page 2 returned no records and the UI removed Previous because total pages became one. Reproduced in the real production preview; there were zero Previous controls. | New `src/components/reviews/review-pagination.tsx:11`, used by `review-list.tsx:292`, keeps recovery navigation for out-of-range pages, disables Next and explains the changed dataset. Browser recheck verified Previous enabled, Next disabled, and Previous returned all ten remaining records. Four rendering regression tests cover normal/empty/concurrently removed pages. |
| F4 | Low, stale information | Community guidance said structured reviews would arrive later despite working reviews. | `src/app/community/page.tsx:70` now directs readers to linked boots for structured reviews. |

F1's CSP is deliberately a **limited baseline**: it does not restrict script/style sources or provide nonce-based script protection. A strict script CSP must be designed and tested with Next hydration/static rendering separately; no unsafe-inline policy was introduced and no claim of full CSP protection is made. HSTS belongs on the validated production TLS boundary; it was not forced onto localhost.

Files changed in this review: `next.config.ts`; `src/app/community/page.tsx`; `src/app/reviews/[id]/edit/page.tsx`; new `src/app/reviews/not-found.tsx`; `src/components/reviews/review-list.tsx`; new `review-pagination.tsx`/`review-pagination.test.tsx`; `tests/auth.integration.ts`; `tests/reviews.integration.ts`; new `vitest.config.ts`; README, Sprint 2.4 notes and this report. The pagination extraction is limited to the tested recovery control; existing UI primitives are reused.

## Features actually tested

| Feature | Result | Evidence/limits |
| --- | --- | --- |
| Home, navbar/footer and boot detail routing | PASS | Production build/static generation; real HTTP checks; browser navigation and catalogue return URL preservation. |
| Eight sample catalogue identities | PASS | Fixture tests, database import in disposable environments, cross-generation constraints and unknown specification labels. Entries remain fictional, not verified manufacturer products. |
| Search/brand/silo/tier/outsole/sorting | PASS | Unit tests and real browser combined Nike/Mercurial/Elite/FG filtering, name sorting, empty search/reset and mobile filter drawer. |
| Catalogue return/query behaviour | PASS | Browser filtered detail → Back to boots retained selections. |
| PostgreSQL/Prisma | PASS | Read-only schema validation/status/diff, clean migration deployment to each test DB, FK/unique/check/trigger/cascade tests. |
| Email registration/login/session/logout | PASS locally | Real HTTP+PostgreSQL+local SMTP lifecycle, single-use/expired links, persistent/expired sessions, suspension, logout and all-device revocation. Browser verified sign-in return and logout protection. External email delivery/TLS remains NOT TESTED. |
| Profile CRUD/public history/privacy | PASS | Strict owner input, unique usernames, private-email projection, public post/review history; browser saved QA display name and saw public history. |
| Community post CRUD | PASS | Owner/moderator authorization, stale versions, persistence, deletion cascades; browser publish/refresh/edit/delete with a linked boot. |
| Feed categories/tags/search/sorting/pagination | PASS | Real database-backed integration assertions and browser page 2, search-empty-reset. Popular/Most Discussed use actual votes/non-deleted comments. |
| Markdown/XSS protection | PASS for tested payloads | Unit/integration payloads reject dangerous URLs/HTML/image loads; browser rendered bold and script text safely with no observed script dialog or console error. This is not an exhaustive XSS proof. |
| Comments/replies/deletion context | PASS | CRUD/ownership/version/auth tests, same-post depth limit two, independent branch pagination, soft-delete context/counters, cascade/concurrency assertions; browser posted comment and reply. |
| Post votes | PASS | Switch/remove/idempotency/concurrent totals/hidden-post/auth/rate tests; browser upvote persisted while editing the post. |
| Structured reviews | PASS | Exact variant CRUD, duplicates, ratings, aggregates/distribution, edits/deletion, hidden rows, consent/privacy, database filters/sorting/pagination. Browser published a review and saw profile history/owner actions. |
| Helpful votes | PASS | Real concurrent/idempotent API tests; browser marked another QA author's review helpful, refreshed, removed the vote and saw no owner-edit control. |
| Security headers | PASS | New real-response assertions cover pages, API and asset. |
| Loading/empty/error/unconfigured states | PARTIAL | Browser observed loaders and catalogue/feed/review empty states; APIs return sanitized 400/401/403/404/409/413/429/503 cases; unconfigured account/community/review APIs tested. A controlled browser database-outage/retry recovery test was not performed. |
| Responsive/accessibility | PARTIAL | Browser checks at 375/768/1024/1440px on community/catalogue/detail found no horizontal overflow. Mobile menu/drawer, focus and native form/radio controls inspected. Full screen-reader, cross-browser and WCAG audit NOT TESTED. |
| Comparison/recommendations/uploads/reporting | NOT IMPLEMENTED | Not counted as passed; no new functionality was invented or added during this review. |

No checked-in browser E2E runner exists. Browser checks above were executed through the available browser automation, against a separate production preview and explicitly temporary fixtures; they are not an automated CI E2E suite.

## Security and integrity conclusions

- Request bodies are bounded and parsed as unknown through strict Zod schemas; forged owner/permission/aggregate fields are rejected. Public mutations check exact Origin, authenticate again after body consumption and lock fresh account privileges in database transactions.
- Prisma and tagged SQL queries parameterize user-controlled values. Tests reject invalid input and enforce resource ownership; no unsafe user-input SQL concatenation, eval or raw HTML injection was found in the reviewed application source.
- Email-link auth has no password hashes to inspect. Database sessions and current account status underpin authorization; token reuse/expiry/session revocation and role/suspension races are covered by real tests.
- Shared HMAC-keyed PostgreSQL limits apply to auth/email/profile/post/comment/vote/review mutations. Trusted client-header limits reject spoofing when configured. Public read traffic still needs edge-level abuse protection before public deployment.
- Exact catalogue generation constraints, unique review author+variant identity, rating-total CHECKs, comment thread depth/FKs, vote uniqueness and triggers passed integrity tests. No schema drift was detected. No app-database destructive command was executed.
- Public review projections exclude measurements/shape unless consent is set; private shape does not leak via filter options or results. Owner-only reads are private/no-store. Author IDs/emails/private profile data are not spread into public DTOs.
- Source and git-history filename/pattern scans found `.env.example` only, no tracked real env/PEM or obvious provider-key/private-key patterns in reviewed paths. This is a targeted scan, not a comprehensive secret-history scanner. Existing real env values were neither printed nor changed.
- One intentional authorization mutation was caught by three existing tests; original source was restored byte-for-byte before final verification. This checks one critical guard, not a whole-project mutation score.

## Tests added and final results

Added four `src/components/reviews/review-pagination.test.tsx` tests, a missing-review-edit integration case in `tests/reviews.integration.ts`, and a response-header integration case in `tests/auth.integration.ts`. Added `vitest.config.ts` only to resolve the repository's existing `@` imports for real component rendering tests; no dependency was added. Runtime deprecation warnings are now surfaced by the integration harness rather than hidden in its captured app output.

| Executed command/check | Final result |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run test` | PASS — 104 tests, seven files; zero failures/skips |
| `npm run test:integration` | PASS — 40 tests including parent lifecycle; zero failures/skips; disposable DB cleanup |
| `npm run build` | PASS — static catalogue details retained |
| `npx prisma validate` | PASS |
| `npx prisma migrate status` | PASS — six applied migrations |
| `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | PASS — no difference |
| `npm audit --omit=dev` | PASS — zero vulnerabilities |
| `npm audit` | FAIL — five High entries propagated through the development-only braces/ESLint chain |
| Browser production preview | PASS for flows explicitly listed above; no error/warn entries observed in the inspected browser log |
| `git diff --check` | PASS |

Failures were not omitted: the baseline new integration cases failed (37 passed/3 failed including the parent test); the pagination reproducer initially had two failing tests. A later test regex incorrectly matched Tailwind's `disabled:` class rather than the HTML disabled attribute; the assertion was corrected to check the actual attribute, then all 104 tests passed. The deliberately inverted authorization guard produced 3 failures/23 passes before restoration.

The initial build failed with ENOTEMPTY removing generated `.next/server/chunks`. An attempted reversible cache move also timed out; it did not successfully preserve/move the cache. A later build failed on duplicate ignored `.next/dev/types/* 2.ts` declarations. Only these generated duplicate files were removed; retry and final builds/typecheck succeeded without tsconfig exclusions, suppressions or skipped checks. The cause of external duplicate artifact creation/file contention was not determined and remains an environment reliability issue.

## Remaining findings and limitations

| ID | Severity/status | Location | Impact and recommended action |
| --- | --- | --- | --- |
| R1 | High advisory; unresolved development dependency | `package.json:52`/`package-lock.json` | Full audit is not clean. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched braces version; npm latest is 3.0.3. Installed chain is development-only; no public API path accepting glob patterns was identified. npm's force fix proposes incompatible Next lint config 14.2.35. Do not force downgrade; track compatible upstream remediation and explicitly accept the restricted development/CI risk before release. Recheck advisory before deployment. |
| R2 | Medium; confirmed runtime warning | `src/lib/db.ts:12`, installed pg/Prisma adapter | Integration/dev runtime emits pg's concurrent-client-query deprecation warning. Tests succeed on pinned pg 8.23.1; warning says this usage will be removed in pg 9. No pg 9 compatibility is claimed. Validate a compatible adapter/driver upgrade in isolation before any pg major upgrade; no vendor patch or blanket warning suppression was applied. |
| R3 | Medium; confirmed local build instability | Ignored `.next` artifacts | Duplicate generated files and filesystem contention interrupted builds. Use a clean checkout/CI build with a single cache writer; investigate filesystem copying/syncing before relying on this working directory for releases. Cause is unconfirmed. |
| R4 | High deployment gate; NOT TESTED | `src/lib/accounts/request-client.ts:5`, auth config, deployment boundary | No public HTTPS/proxy/SMTP environment was validated. Configure the trusted overwrite header only behind an access-restricted proxy; verify origin/cookie security, mail delivery, TLS/HSTS and edge request limits. Do not expose the local setup as production infrastructure. |
| R5 | Medium; privacy/operations incomplete | `prisma/schema.prisma:250`, `src/lib/community/http.ts:22`, repository lacks CI workflow | Public display consent works, but data-retention/export/account-erasure/backups/access policies and operator diagnostics/alerts are not complete. Define these before collecting real foot information. Add CI quality gates, safe diagnostic IDs/event logging, backup restoration and moderation/reporting operations before open public UGC. No legal-compliance claim is made. |
| R6 | Medium potential performance risk; NOT LOAD TESTED | `src/lib/reviews/service.ts:239`, `review-list.tsx:58` | Each list-filter change refetches whole-variant aggregate/filter options; distinct combinations are not paginated. This is not a measured slowdown on the small QA dataset. Measure query plans/concurrency with realistic volume before adding caching or SQL-side independent facet aggregation; size the 10-connection pool across processes. |
| R7 | Low maintainability/SEO recommendation | `src/app/globals.css`, metadata in `src/app/layout.tsx:9` | Global styles exceed 2,000 lines. Feature style modules could make later changes easier, but no broad refactor was warranted here. Production canonical URLs/sitemap/social metadata and indexing policy need a real domain/product strategy; no speculative domain was configured. |

Cross-browser/screen-reader testing, controlled browser outage recovery, production email deliverability, full penetration testing, dependency signature verification, complete secret scanning, backup restore/failover, load/CWV budgets and external infrastructure remain **NOT TESTED**. No pass is implied by code inspection. The preview's Next process needed forced termination after graceful shutdown did not finish; only that disposable process was terminated, and its parent cleaned up the test DB/email. Production shutdown/drain behaviour should be tested at the actual hosting boundary.

## Prioritized release plan

1. Preserve these fixes and run the existing checks in a clean CI environment; keep release artifacts separate from dev cache writers. Track/accept the development-only advisory instead of using force remediation.
2. Validate real staging HTTPS, secure cookies, trusted proxy isolation, SMTP, edge abuse controls and graceful shutdown. Configure TLS/HSTS at the actual boundary.
3. Establish privacy retention/erasure/export and backup/operator access policies, safe diagnostics/alerts and content moderation/reporting. These are production gates, not features silently added by this review.
4. Run screen-reader/cross-browser and realistic load/CWV/SQL-plan tests. Then decide whether aggregate/facet caching or cursor pagination is necessary.
5. Validate the intended catalogue/product content. The current eight entries are honest samples; comparison and recommendations are absent. Approve public launch only against that clearly stated scope.

Final recommendation: **NO public production deployment yet. YES for continuing local development with the implemented feature set and these fixes.**

Final resource check: development database still contains eight CatalogueEntry samples and zero User/UserProfile/Post/Comment/PostVote/BootReview/ReviewHelpfulVote rows. No disposable test databases remain. The local development app was restarted on port 3000.

## Subsequent independent review — pending P2

A read-only subagent review against merge base `9c024d99fa9e243343007a91214e560fcbe165b2`, including untracked files, identified a request-size mismatch in `src/lib/community/http.ts:67`. Reviews use a 16 KiB interaction limit, while schema-valid Unicode text can exceed it: 5,000 CJK experience characters and 1,500 each in pros/cons produced 24,463 bytes of JSON. Publishing/editing such a review returns 413 despite successful form/schema validation. This finding was verified in memory and remains unresolved in the temporarily pushed snapshot; increase the review-specific byte budget in a later fix with a regression test. The earlier successful suites did not cover this case.
