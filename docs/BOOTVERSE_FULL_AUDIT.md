# BootVerse — Complete System Audit & Production Readiness Review

**Audit date:** 17 October 2026, Australia/Sydney. **Snapshot:** `main`, commit `818021d`.
**Mode:** read-only application review and testing. Only this requested report is added to the repository. No application source, dependency manifest, lockfile, configuration, schema or migration was changed. No fixes, commits, pushes, deployments or AWS resources were created.

## A. Executive summary

**Overall technical quality: 6.5/10 — reviewer judgment, not a test-derived metric.** The application has a credible tested foundation: strict TypeScript, normalized identities, server-side authorization, transactional writes, DB constraints, private storage, explicit consent and an explainable deterministic recommendation pipeline. Fresh execution produced **209 passing unit/component tests and 69 passing integration cases**, with no skipped cases. A clean copy of the committed source builds successfully.

It is **not functionally complete against the supplied expected scope and is not ready for AWS deployment/public launch**:

- Product comparison is explicitly absent.
- Discovery and detail pages still read eight fictional fixtures; PostgreSQL catalogue additions do not become public pages. Technical specifications, genuine product imagery, current offers and usable real fit evidence remain absent.
- The configured non-local database reports **all 11 migrations pending**. Its connection can answer the migration-status check, but application-schema readiness is not established. No migration was applied there.
- This workspace's typecheck/build fail on duplicated ignored Next declarations. Clean-copy checks pass; that distinction must not be hidden.
- Two new browser-confirmed UI defects remain: a stalled private-profile read blocks Finder without a deadline/escape, and resubmitting unchanged moderation filters leaves its loading indicator stuck.
- Five High development dependency entries remain in the lint chain. Runtime audit is clean, but the full audit is not.
- Production storage/IAM, delivery of real email, proxy/TLS behavior, migration reconciliation, backup restoration, cleanup scheduling, monitoring, CI/CD and rollback are not verified.

No Critical remotely exploitable vulnerability, cross-owner access bypass or private-measurement leak was confirmed in the tested paths. This is not a penetration-test certification or proof of scientific fit accuracy.

### Boundaries and evidence

The original working tree was clean at the start. SHA-256 comparison of **254 existing tracked files** found no changes during testing. Test reports, fault-injection scripts, clean source/dependency copies, screenshots and logs are isolated under `/tmp/bootverse-audit-20261017/`; Playwright also produces its ignored `.playwright-cli/` artifacts. Temporary artifacts are local evidence and are not portable repository fixtures. Both temporary databases and the browser QA bucket/captured email were removed after testing; the audit database count returned to zero. The original localhost:3000 development server was restored and its Home/catalogue/community/Finder pages returned HTTP 200.

Data-changing tests used fresh random local databases and private buckets with captured local SMTP. The browser helper used a separate DB/bucket from the integration harness and from development. Temporary role changes affected only its synthetic account. No real community users, posts, measurements or reviews were edited. Read-only development metadata and a read-only migration-status query against the configured non-local target were also executed. No reset or migration was run against either existing target.

### Architecture inspected

Next.js 16.4 App Router, React 19.3, TypeScript, Tailwind 4, customized shadcn/Base UI components; Prisma 7.10 with the `pg` adapter; Auth.js 5 beta.32 with Nodemailer and a customized Prisma adapter. Authentication is email magic-link only, not passwords/OAuth. User/session/verification-token storage is PostgreSQL-backed. Feature APIs are route handlers; the reviewed mutations use those APIs, not a parallel server-action architecture.

Pure catalogue/profile/recommendation functions are separated from server-only services and client forms. PostgreSQL stores community content, identities, relationships, votes, ratings, consent, profiles, media metadata and moderation state. S3-compatible storage holds image bytes. Private transient Finder inputs/results stay in client/request memory; private profiles are persisted only through explicit save. There is no implemented shared recommendation history/cache or external AI model.

## B. Phase completion

Statuses assess the implemented contract and executed evidence. PASS does not mean production hosting or real-world fit accuracy is verified.

| Phase/sprint | Status | Assessment |
|---|---|---|
| Phase 1 | PARTIAL | Home/catalogue/search/filter/sort/details/states work with fixtures; comparison and genuine sourced product data are missing. Catalogue pagination is not implemented or needed for the current eight entries; not treated as a pagination bug. |
| Sprint 2.1 | PASS | Actual email sign-in/account creation, PostgreSQL sessions, expiry/logout, protected routes and profile updates tested locally. Non-local deployment readiness remains blocked. |
| Sprint 2.2 | PASS | Persisted post CRUD, ownership, tags/categories/search/sorts/pagination tested; browser publication/edit/refresh/delete verified. |
| Sprint 2.3 | PASS | Real comments/replies/edit/soft delete/votes/counters tested; browser vote direction/removal and reply preservation verified. |
| Sprint 2.4 | PASS | Six integer criteria, exact-variant reviews, CRUD, aggregates, duplicates, helpful votes and measurement visibility tested. Synthetic test content was isolated. |
| Sprint 2.5 | PARTIAL | Uploads, moderation, creators, verification decisions and video validation work in isolated tests; unchanged-filter loading defect and operational/cloud gates remain. Live video playback and real external ownership were not verified. |
| Sprint 3.1 | PASS | Private profile CRUD, conversions, two feet, defaults, concurrency and access controls tested, including browser save/update/delete. |
| Sprint 3.2 | PARTIAL | Deterministic engine and authenticated API pass; real catalogue evidence/offer coverage is absent and catalogue/detail DB integration is incomplete. No physically validated fitting capability exists. |
| Sprint 3.3 | PASS | Implemented observational analysis policy passes exact-variant/size, consent, deduplication, moderation and small-group tests. Inference/Sybil limitations remain. |
| Sprint 3.4 | PARTIAL | Authenticated guided workflow and explanation/product/review navigation work; stalled profile-read defect remains. Guest queries and comparison are explicitly unsupported. |
| Sprint 3.5 | PARTIAL | Evaluation/benchmarks/diagnostics exist and run; workspace build gate, dependency findings, new UI issues and production-scale/operational validation remain unresolved. |

## C. Test execution

### Commands and actual results

| Check | Command/procedure | Actual result | Status |
|---|---|---|---|
| Workspace unit tests | `npm test` in repository | 209 passed, 20 files; 0 failed/skipped | PASS |
| Workspace ESLint | `npm run lint` | Exit 0 | PASS |
| Workspace typecheck | `npm run typecheck` | Exit 2: `.next/dev/types/routes.d 2.ts` duplicate declarations, TS2717/TS2300/TS2428 | FAIL |
| Workspace production build | `npm run build`, with dev process paused | Compiles, then fails TypeScript on the same ignored duplicate file | FAIL |
| Clean dependency bootstrap | `git archive HEAD` into isolated directory; `npm ci --ignore-scripts` | Frozen lockfile installed: 826 packages; no upgrade or original dependency changes | PASS |
| Isolated client generation | `npm run db:generate` in clean copy | Prisma client generated from unchanged schema; no DB migration | PASS |
| Clean production build | `npm run build` in clean copy | Exit 0, real production routes emitted | PASS |
| Clean typecheck/lint | `npm run typecheck`, `npm run lint` | Both exit 0; no source/config/assertion changes | PASS |
| Clean unit ledger | `npm test -- --reporter=json --outputFile=/tmp/bootverse-audit-20261017/unit-results.json` | 209 passed; 0 failed/pending; per-test ledger below | PASS |
| Full integration and HTTP benchmarks | `BOOTVERSE_BENCHMARK=1 npm run test:platform:local` in clean copy | 69 passed, 0 failed/cancelled/skipped; includes lifecycle parent case | PASS |
| Prisma schema | Installed CLI `prisma validate`, guarded local env | Valid schema | PASS |
| Local migrations | `prisma migrate status`, guarded local env | 11 applied, up to date | PASS |
| Local drift | `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | Exit 0, no difference | PASS |
| Non-local migration status | Installed CLI `prisma migrate status`, configured non-local env; no apply | Exit 1, all 11 pending | FAIL |
| Pure benchmark | `node --import tsx tests/benchmark-recommendations.mts` | 300 measured workloads, 0% errors | PASS |
| Runtime dependencies | `npm audit --omit=dev --json` | 0 advisories | PASS |
| Full dependency tree | `npm audit --json` | 5 High entries, unresolved | FAIL |
| Client/environment literal scan | In-memory comparison of configured private values against 43 clean-build client JS files | 0 matches; no tracked `.env`/`.env.local`/`.local` files | PASS, limited scope |
| Read-only fingerprint check | SHA-256 of original tracked files before/after | 254 unchanged | PASS |

The first isolated build attempt failed because Turbopack rejects a dependency symlink leaving its filesystem root. An attempted dependency copy stalled on an unused duplicated dependency file. Those setup failures were not application-build passes. A frozen clean install resolved the isolated setup; neither the original cache nor dependencies were repaired. The workspace failures remain FAIL.

### Browser procedures

Playwright CLI drove the **production build on localhost:3100**, separate from the user's browser and localhost:3000 development data.

| Procedure | Observed result | Status |
|---|---|---|
| Fully loaded Home/catalogue/community/creators/Finder at 375/768/1024/1440 | No document horizontal overflow; waited beyond skeletons | PASS |
| Catalogue combined Nike/Mercurial/Elite/AG + name sort | Exactly the AG sample remained | PASS |
| No-match search/reset; mobile menu keyboard Escape | Empty state/reset work; menu returns focus to trigger | PASS |
| Boot detail navigation | Technical unknowns and sample labeling shown; exact entry reached | PASS |
| Captured email sign-in and reload | Disposable account created; session survives reload | PASS |
| Post creation/edit/refresh/delete | Actual UI mutations persisted; deleted public API returns 404 | PASS |
| Comment/reply/edit/delete | Text persisted; soft deletion retained the nested reply | PASS |
| Upvote/downvote/remove | UI changed direction and removed vote; integration verifies exact stored scores/duplicates | PASS |
| Image choose/upload/reload/decode/remove | Real QA S3 object served as a 100px decoded image; removal works | PASS |
| Structured review publish/reload/edit/delete | Six real radio controls, required fields, ownership actions and persistence work; public `foot` remains null with sharing off | PASS |
| Creator save/directory/request | Profile searchable, pending ownership challenge displayed; no automatic badge | PASS |
| Ordinary user admin API | 403 before granting any test role | PASS |
| Moderator hide/restore/audit and creator rejection | Confirmation UI exercised; public post 404 when hidden and 200 after restore; DB confirms HIDE/RESTORE audit rows and REJECTED application | PASS |
| Resubmit unchanged admin filters | Loading indicator remains without a new request; Refresh recovers | FAIL: D7 |
| Finder profile GET deliberately held open | Still blocks wizard after 21 seconds, no deadline/escape control | FAIL: D6 |
| Release profile fault as 503, retry, complete Finder | Recovery works; consent required; actual synthetic evidence/cohort displayed; no implicit profile write; exact Reviews link works | PASS |
| Finder results at all four widths | No document horizontal overflow | PASS |
| Private profile create/convert/update/delete | 270 mm→27 cm, update 10.1 cm→101 mm/version 2; consent stays off; deletion returns owner state to null | PASS |
| Account display-name edit/public profile/logout | Saved publicly, sign-out redirects to login, private API becomes 401 and protected create page redirects | PASS |
| Compare boots | No implementation or supported interaction to execute | FAIL: missing feature |

Browser test harness corrections are not hidden: initial upload assertion ran before image decoding, an admin locator was incorrect, and a logout assertion expected `/` instead of the implemented `/login`. Corrected waits/selectors/redirect checks passed; the first attempts are not claimed as passing. Native dialog snapshots can lag their handlers; persisted database state independently confirmed moderation and deletion outcomes.

Final login-page console was **0 errors/0 warnings**. Earlier in the same journey the deliberate profile-GET 503 produced one expected resource error; therefore the whole session must not be described as universally error-free. No unexpected browser JavaScript exception was observed in the successful flows. Server-side pg emits the separate deprecation warning in D9.

Artifacts for confirmed failures:

- `/tmp/bootverse-audit-20261017/finder-profile-load-stuck.png`
- `/tmp/bootverse-audit-20261017/admin-unchanged-filter-stuck.png`

Not tested: physical fit accuracy, real consumer email delivery, real creator ownership, live YouTube/TikTok playback, cross-browser/device-lab behavior, formal screen-reader/axe/WCAG certification, field Core Web Vitals, Linux container runtime, production IAM/TLS/proxy behavior, backup restoration/failover and full historical secret scanning. Existing integration tests validate safe video URL handling; that is not proof a third-party video is playable or owned.

## D. Issues, severity, locations and remedies

No Critical issue was confirmed. Items explicitly distinguish defects from missing features, configuration state and future risks. Paths are repository-relative, with verified source line anchors where available.

### D1 — High / P1 — Configured non-local database is not migration-ready

**Type:** confirmed deployment state. **Location:** `prisma.config.ts:7`, migrations under `prisma/migrations/`; evidence `configured-db-status.log` in audit directory.

Read-only `migrate status` reaches the configured database and lists all 11 migrations pending. This does not prove the target is empty or that applying all migrations blindly is safe. Auth/community/review/Finder cannot be signed off against that target merely because localhost passes.

**Impact:** public deployment may start against missing/incompatible tables or untracked schema. **Fix:** inspect its existing schema/history, take and restore-test a backup, rehearse reconciliation and incremental migration on an isolated copy, then approve a controlled release job. Do not reset or auto-baseline production.

### D2 — High / P1 — Product comparison is missing

**Type:** confirmed incomplete requirement. **Location:** `src/components/recommendations/finder-results.tsx:84`; application route inventory contains no comparison implementation.

The UI explicitly states comparison is not implemented. Discussion category “Comparisons” does not provide boot selection or a comparison table. **Impact:** the expected Phase 1 comparison and final Finder comparison journey cannot be completed. **Fix:** implement exact-variant comparison in an approved feature task, or explicitly remove it from launch acceptance criteria. Do not count the discussion category as completion.

### D3 — High / P1 — Database catalogue additions have no discovery/detail route

**Type:** confirmed incomplete catalogue integration/data readiness. **Location:** `src/app/boots/page.tsx:4`, `src/app/boots/[slug]/page.tsx:12`, `:38`, `src/lib/boots/data.ts:18`; community DB references at `src/lib/community/service.ts:65`.

Catalogue/detail rendering uses the static `boots` fixture and `dynamicParams=false`; community/reviews/recommendations use database identities. A new synthetic QA variant/entry was actually inserted in the isolated DB: it persisted, `/boots` did not contain its slug and its detail URL returned 404. The fixture was removed afterward. The defensive Finder identity guard prevents wrong links but does not implement missing public pages.

**Impact:** curating real DB products does not make the discovery product usable. Current eight entries, photos and specifications remain sample/unknown; original local DB has zero usable recommendation evidence. **Fix:** choose and implement one product source of truth for discovery/detail/community/Finder, retain exact variant/colorway provenance, and curate sourced real data. Keep samples clearly labeled until then. No current verified specification was silently edited.

### D4 — High advisory / P1 — Development dependency audit remains unresolved

**Type:** confirmed advisory; runtime exploit not demonstrated. **Location:** `package-lock.json:5288`, `package.json` development `eslint-config-next` dependency.

There is **one root braces advisory propagated into five High package entries** through `micromatch`/`fast-glob`/Next ESLint packages, not five independent vulnerabilities. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) describes stack exhaustion from deeply nested patterns and lists no patched version at review time. Runtime-only audit is clean; no HTTP path taking user input into glob evaluation was identified. Npm proposes an incompatible Next lint-config downgrade to 14.2.35.

**Impact:** risk is concentrated in development/CI handling of untrusted patterns/code; full audit is not green. **Fix:** track compatible upstream remediation, restrict untrusted CI execution and explicitly document any release risk acceptance. Do not force-downgrade or hide the audit failure. Recheck before release.

### D5 — Medium / P2 — This workspace fails its required typecheck and build

**Type:** confirmed local artifact failure, not proven committed-source defect. **Location:** ignored `.next/dev/types/routes.d 2.ts:87`; `tsconfig.json:30` includes generated declarations.

Duplicate generated declarations cause TS2717/TS2300/TS2428. Both actual commands fail here; a clean, unchanged source copy passes. The cause of the duplicate file creation is unconfirmed, so blaming Next or filesystem sync would be speculation.

**Impact:** local release checks are unreliable and could block deployment packaging. **Fix:** with approval, clean only generated artifacts, investigate their writer, separate dev/release build caches and establish fresh CI builds. Do not suppress TypeScript diagnostics or weaken test assertions. No cleanup fix was made during this audit.

### D6 — Medium / P2 — Stalled Foot Profile read blocks the Finder indefinitely

**Type:** confirmed browser defect. **Location:** `src/components/recommendations/finder-client.ts:11`, `src/components/recommendations/finder.tsx:24`, `:69`.

`loadFinderProfile` has only an unmount AbortController, unlike the 20-second recommendation read. While pending, the wizard is replaced with “Loading your private saved profile…” and no retry/continue control. Holding the GET in the browser leaves it blocked after 21 seconds. Returning a 503 then exposes recovery controls, confirming the missing pending-state escape.

**Impact:** a stalled connection prevents even a request-only search. **Fix:** apply a bounded read deadline and/or an explicit continue-without-saving action while pending; cancel the old read and prevent saving until owner state is known. Add a regression for a never-resolving preload. No fix was applied.

### D7 — Low / P3 — Unchanged moderation filters leave a permanent loading status

**Type:** confirmed browser defect. **Location:** `src/components/platform/admin-dashboard.tsx:33`, `:38`.

Submitting the same q/status/kind/page sets `loading=true`, but the effect depends on the unchanged serialized query and retry counter, so no fetch/finally runs. Actual browser observation: loading visible after one second, zero new admin requests; Refresh dashboard recovers it.

**Impact:** misleading queue status during moderation, though existing controls/data remain usable. **Fix:** set loading when a fetch begins, skip unchanged submissions, or intentionally trigger a refresh. Add a same-filter regression. No source change was made.

### D8 — Medium / P2 — Review-summary option retrieval is not bounded

**Type:** confirmed query shape / scalability risk, not a measured current outage. **Location:** `src/lib/reviews/service.ts:242`, `:257`; repeated aggregate fetch in `src/components/reviews/review-list.tsx:61`.

The summary endpoint retrieves distinct combinations of size/system/surface/ownership-months without a limit, then reduces those rows into separate option lists. The set grows with review diversity and is fetched again whenever review filters change, even though the summary is variant-wide. This should not be confused with the explicitly bounded recommendation-analysis scan.

**Impact:** unnecessary database transfer/processing as reviews grow. **Fix:** retrieve each necessary distinct option/bucket directly with bounds, reuse invariant summary state during filtering, and profile the actual populated query before adding indexes/caching. No arbitrary index or private cache is recommended without measurement.

### D9 — Medium / P2 — pg concurrent-client-query deprecation is reproducible

**Type:** confirmed compatibility warning, not a present pg 8 failure. **Location:** `src/lib/db.ts:3`, `:11`; runtime trace enters `pg/lib/client.js:780`, Prisma adapter `performIO/queryRaw` and Prisma runtime.

Both integration and public community-page requests emit the warning that concurrent calls on one client will be removed in pg 9. A traced isolated server confirms the adapter/runtime path; it does not identify a single application `Promise.all` as the cause.

**Impact:** a future major driver upgrade may break working transactions. **Fix:** isolate the transaction/query shape in an upstream-compatible reproduction, check supported Prisma/adapter/pg versions and rerun regressions before upgrading. Do not blame or rewrite unrelated application code based only on the warning.

### D10 — Medium / P2 — Most service failures lack safe operational diagnostics

**Type:** confirmed observability gap. **Location:** `src/lib/community/http.ts:22`, `src/lib/platform/http.ts:33`; contrast recommendation instrumentation at `src/app/api/boot-fit/recommendations/route.ts:5`.

Generic 503 responses correctly avoid disclosing internals, but community/platform unexpected errors are discarded without the bounded request-ID/category logging added to recommendations. External storage/database failures therefore lack equivalent incident correlation.

**Impact:** operators cannot reliably distinguish database/storage/validation problems from customer reports. **Fix:** extend the same allowlisted diagnostic policy to critical boundaries, retain generic response bodies and keep measurements, user identities, URLs, exception messages and credentials out of logs. Configure retention/alerting before public operation.

### D11 — High / P1 readiness gate — Deployment/operational controls are not verified

**Type:** missing/unverified operational preparation, not a demonstrated public exploit. **Locations:** `package.json:6`, `next.config.ts:3`, `compose.storage.yaml:1`, `scripts/cleanup-auth.mts:1`, `scripts/cleanup-images.mts:1`, `src/lib/platform/storage.ts:9` and repository deployment-file inventory.

There is local storage Compose, but no application Dockerfile, selected AWS deployment configuration or CI workflow. No dedicated readiness endpoint or backup/restore rehearsal exists in the inspected repository. Cleanup scripts exist but no checked-in scheduler is present. The current non-local `.env` has no S3 settings, while the separate local profile works. Storage currently requires explicit access keys, so an AWS task-role-only setup is not supported by that constructor as written.

**Impact:** persistence, cleanup, delivery, least privilege, incident response and rollback are not launch-proven. **Fix:** choose AWS runtime/deployment strategy; Docker is only required if that choice uses containers. Verify secret/IAM delivery, private persistent storage, HTTPS/proxy/auth origin, backups/restoration, migrations, cleanup scheduling, readiness and rollback in staging. Support the default IAM credential chain if role-based AWS operation is chosen. Do not create resources as part of this read-only audit.

### D12 — Low / P3 — README contains contradictory current-state statements

**Type:** confirmed documentation debt. **Location:** `README.md:101` versus `:103`, and historical counts at `:87`.

It says Sprint 3.4 is not implemented and then documents the live Finder; migration/test counts vary across appended sections. **Impact:** setup/release decisions can use stale assumptions. **Fix:** consolidate a current-state section with dated historical reports kept separately. No README edit was made.

## E. Security report

### Verified controls in executed paths

- Server-side active-account checks, ownership/role enforcement, same-origin mutation checks and strict Zod inputs. Tests include anonymous/other-owner writes, forged IDs, revoked/suspended sessions and chunked-body revocation cases.
- PostgreSQL-backed atomic rate buckets; HMAC keys avoid raw emails/IPs in limiter rows. Per-account quotas and global email throttles exist. Trusted-client-IP limits require a correctly overwriting edge proxy; they are not configured in the inspected non-local env.
- Prisma parameterization/tagged SQL at the inspected boundaries; no unsafe raw-SQL API was found in application code. Isolated harness database names are server-generated and guarded, not HTTP input.
- Markdown raw HTML/images disabled and link transformations constrained; public text uses React escaping. Six rating integers and totals, duplicate reviews/votes and immutable variant relationships are enforced.
- Private profile APIs are owner-scoped/no-store; no client owner ID or computed score is trusted. Transient recommendation consent is explicit and separate from saving. Public review foot data requires sharing; analytical use needs the additional consent flag/timestamp.
- JPEG/PNG/WebP signatures plus decoding, pixel/byte/count/quota limits, metadata-stripping WebP conversion, random keys and owner checks. Private test bucket anonymous reads are rejected. Actual malicious/oversized/unauthorized uploads and storage failures are covered in integration.
- Creator verification decisions are privileged and logged, social-link edits revoke status, and URLs alone do not approve. Safe provider/video IDs are used instead of arbitrary iframe HTML.

### Limits and potential risks

The CSP has frame/base/object/form protections but no script/default-source restriction; it is not a complete XSS policy (`next.config.ts:18`). No exploit was demonstrated. Roll out a tested nonce/hash policy rather than breaking Next hydration by tightening it blindly. HTTPS/HSTS, forwarded-host/proxy trust, secure production cookies and network IAM cannot be certified by localhost tests.

Creator website links and approved evidence URLs are not server-side fetched in the inspected flows; a merely unusual public link is not evidence of SSRF. Provider embeds use fixed YouTube hosts and an identifier allowlist. Actual third-party playback/availability/permission remains unverified.

Small groups/cells and small complements are suppressed in review analysis, but this is not differential privacy or anti-Sybil proof. Repeated queries and colluding accounts remain architectural risks. Reviews are self-reports, not verified purchases. Real retention/export/account-erasure/backup policies and operator access controls need definition before collecting real foot information; the public UI disclosure is not a compliance certification.

The secret scan found no exact configured private value in 43 generated client JS files, and real env files are untracked. It does not prove there are no encoded, previously revoked or historical secrets. A complete Git-history/provenance/signature audit was not performed. No credentials or magic-link tokens are included in this report.

## F. Database report

Local schema validation/status/drift all pass. Metadata inventory reports **45 foreign keys, 44 CHECK constraints and 52 unique indexes** in the migrated QA schema. Prisma uses unique indexes, so an initial query returning zero separately declared UNIQUE constraints is not evidence of missing uniqueness.

Product identity is normalized as brand → family → generation → tier → outsole variant, with colorways scoped to generations and entries linking exact variants/colorways. Composite foreign keys prevent cross-generation associations; there is no SKU or product-publication-state model to test. Unknown sample specifications are explicitly unknown. Reviews share only the same exact variant across colorways, while price/stock evidence is entry/size/system scoped. Different tiers/outsoles/generations are not deliberately collapsed.

Executed integrity cases cover FK failures, generation mismatch, duplicate usernames/slugs/reviews/votes, rating constraints, optimistic versions, concurrent mutations and cascade behavior. Image deletion creates a durable storage-deletion job; metadata/public access disappears immediately, object removal is deferred. Moderation history survived deletion of the reported post in the browser QA DB. Two-foot profile deletion and account cascade behavior are tested independently from historical review consent.

Original local aggregate read: **8 entries / 8 samples / 7 variants / 0 reviews / 0 private foot profiles / 0 recommendation-evidence rows / 0 inconsistent generation joins**. Only aggregate values were read for this audit, not real private measurement rows. The non-local target was queried for migration metadata only. Pending migration history is D1; drift or referential integrity of that target is NOT TESTED.

Persisted: accounts, sessions, tokens, public profiles, content/tags/replies/votes, exact-variant reviews/helpful votes, private profiles/consent, curated evidence, creators/verification, report/audit/media metadata and cleanup jobs. Object bytes: private S3. Fixture catalogue/unknown technical specs: static TypeScript. Search/sort UI state is URL-backed where public; sensitive Finder inputs/results are component/request state, not URL/localStorage or automatic history.

## G. Performance report

**Measured environment:** macOS arm64, Apple M2 Pro, 10 logical CPUs, 16 GiB RAM, Node v24.8.0, local PostgreSQL/private S3, clean production build. Other audit/development work was running. No throttled mobile network, production topology, dedicated benchmark host or public load test was used.

| Workload | Dataset / samples / concurrency | p50 ms | p95 ms | Errors |
|---|---|---:|---:|---:|
| Pure recommendation + analysis | 100 candidates × 2 evidence; 2,000 synthetic reviews; 30 warmup + 300 measured; c=1 | 1.96 | 2.31 | 0% |
| Recommendation HTTP, small | 7 sample variants, 0 reviews; 4 warmup + 32 measured; c=4 | 8.62 | 11.23 | 0% |
| Recommendation HTTP, bounded scale | 100 variants, 2,000 persisted reviews; 4 warmup + 32 measured; c=4 | 93.23 | 117.76 | 0% |
| Home HTML | 3 warmup + 20 measured; c=2 | 2.76 | 3.53 | 0% |
| Filtered catalogue HTML | Same; fixture filtering, not DB catalogue query | 7.72 | 8.52 | 0% |
| Community HTML | Same; one synthetic post at measurement time | 12.94 | 14.33 | 0% |
| Boot detail HTML | Same; cached static route, client review loads excluded | 2.15 | 2.89 | 0% |
| Rating aggregate API | Same; 11 synthetic reviews on the variant | 4.59 | 6.04 | 0% |
| Optimized concept image | Same; warmed Next cache, 25,108-byte response | 0.88 | 1.02 | 0% |

The single-variant equivalent review-filter SQL probe returned 2,000 rows: **execution 9.535 ms, planning 0.583 ms**. It is an `EXPLAIN ANALYZE` filter probe, not the exact Prisma projection or full-request SQL time. Per-request Prisma SQL query counts were not instrumented; no invented count is supplied.

Pure-process RSS: 143 MiB before, 177 MiB observed peak, 28 MiB final JS heap. Separately sampled production-server RSS during public-route workloads: **131→174 MiB, observed peak 174 MiB**. This is not evidence of a leak; JIT/cache warming and unrelated earlier QA requests affect RSS.

HTTP measurements include body receipt, not browser LCP/INP/CLS. Public routes were already warmed by browser QA. Boot detail timing excludes asynchronous reviews/images. Synthetic review distribution is deliberately concentrated, not representative organic traffic. Local numbers cannot be extrapolated to cloud latency/capacity, and this run does not establish an SLO.

No optimization or configuration change was made. D8 is a concrete overfetch risk to profile; D9 is a compatibility warning. Recommendation queries already batch review retrieval, project fields and enforce caps (100 candidates, 32 evidence rows per variant, 20 results per eligibility section, 2,000 analytical reviews globally). Those caps protect work but sacrifice completeness; overflow withholds analysis rather than releasing biased partial statistics. One busy variant can withhold analysis for other returned variants. Treat this as a documented scale limitation, not a promise to consider every product/review.

Before public scale, measure actual SQL/query counts/plans, pool wait time (`max:10` per process must fit total deployment concurrency), representative data distributions, real image workloads and cold starts. Keep private inputs out of shared cache keys/stores. No field CWV, RUM, Lighthouse budget or Linux load result is claimed.

## H. UI/UX report

The existing minimal light design is consistent: Geist, #F6F6F4 background, #202020 primary and white surfaces; unknown/sample/community opinions are visible. Inputs, semantic headings, skip link, disclosures, keyboard mobile menu and focus return work in exercised flows. Public pages and Finder results fit 375/768/1024/1440 widths. Mobile controls were exercised in the actual drawer; no comparison control exists.

Confirmed failures are D6/D7, with screenshots in C. No unrelated redesign was made. Loading, empty, validation, no-compatible/no-evidence and error recovery cases are covered across browser/integration/unit tests; a handled 503 is different from the unbounded pending state. Unknown prices/currency conversion, missing community evidence and unavailable stock remain explicit instead of fabricated.

Public product detail and review links were exercised; a new database-only product's 404 is D3. Broad external-link liveness is NOT TESTED. A full accessibility certification, every touch-target/contrast pair, high zoom, real screen-reader output, landscape/device lab and cross-browser behavior were not exhaustively assessed; no WCAG 2.2 AA compliance claim is made. UI search/filter functionality passes actual browser and pure tests, while pagination of community/comments/reviews/creators is exercised in integration rather than every page manually.

Recommendations after fixes: add a bounded preload/escape route, make loading correspond to an actual in-flight request, retain explicit save/privacy wording, run automated accessibility checks and a keyboard/screen-reader regression suite. Keep concept artwork/sample caveats until real asset/spec provenance exists.

## I. Phase 4 readiness

**Decision: NOT READY for AWS deployment as the complete expected platform.** This is independent of the earlier Sprint 3.5 report's conditional development decision. Current evidence includes a fresh non-local migration-status failure and two newly reproduced UI defects. Starting deployment engineering to resolve prerequisites is different from signing off a deployable/launch-ready application.

| Area | Readiness |
|---|---|
| Clean-source build/test foundation | PASS on macOS/Node 24; current workspace FAIL must be resolved or isolated |
| Actual feature completeness | PARTIAL: comparison and real catalogue integration/data absent |
| Production database/migrations | FAIL: configured target reports 11 pending; no reconciliation/restore rehearsal |
| Application Docker/Linux compatibility | NOT TESTED; no application image/build recipe; local Compose covers storage only |
| Secrets/IAM/runtime environment | PARTIAL: env boundaries exist; production delivery/least privilege unverified; static-key-only storage constructor |
| Persistent storage and cleanup | PASS locally/private bucket; production policy, scheduler and alerting NOT TESTED |
| Email | PASS with local SMTP capture; real sender/domain/deliverability NOT TESTED |
| HTTPS/Auth/proxy/client limits | PARTIAL in source; actual hosting boundary NOT TESTED |
| Monitoring/readiness/incident response | PARTIAL: safe recommendation logs exist, broader diagnostics and deployed health/alerts absent |
| CI/CD/rollback/backup/disaster recovery | NOT TESTED; no repository CI workflow or restore exercise demonstrated |

No AWS resources, DNS, cloud storage, email provider configuration or production migrations were changed. No billable infrastructure was created.

## J. Prioritized action plan

### Must fix or explicitly resolve before deployment

1. Reconcile the configured database's existing schema/history, restore-test a backup and rehearse controlled incremental migrations on an isolated target. Resolve D1 before pointing this build at it.
2. Define the release contract: implement comparison and DB-backed product discovery/detail with sourced data, or explicitly approve a reduced sample-only preview. Do not market the current app as a complete real-product fitting platform.
3. Fix the Finder preload stall; add the never-resolving-read regression. Address the same-filter indicator as a small adjacent approved fix.
4. Establish a reproducible clean release build/CI gate; investigate duplicate generated/dependency files without weakening TS/tests. Triage/accept the development advisory with explicit restricted CI controls or a compatible upstream fix.
5. Select the AWS runtime and create its reviewed deployment artifact/configuration in a separate task. Verify environment/secret delivery, TLS/proxy origin, trusted client-IP rewriting, private storage and least-privilege credentials/roles.
6. Implement/test readiness, migration-release ordering, rollback and backup restoration. Schedule auth/storage cleanup and monitor failures. Extend safe request-correlated diagnostics to critical services.

### Should fix before public launch

7. Curate real variant/generation/tier/outsole/colorway specifications, images, evidence and scoped offers with sources/freshness; distinguish all community statements from verified measurements.
8. Profile review-summary retrieval and populated-database queries/pool saturation; resolve the pg warning before a major driver upgrade. Run representative staging load/cold-start/image tests.
9. Verify real email delivery and human creator verification/moderation staffing; define abuse handling, privacy retention/export/erasure, backup access and incident runbooks.
10. Add repeatable browser/a11y/viewport checks in CI and test the real reverse proxy/Linux runtime. Fix stale README statements.

### Can improve later

11. Improve retrieval beyond stable-ID scan/representative-colorway limits once real evidence volume warrants it. Consider stronger cohort privacy/Sybil defenses before exposing richer analysis. Do not invent a confidence probability.
12. Consolidate verbose/one-line feature modules and duplicated client error plumbing only where it improves maintenance; add measured public-data caching/bundle optimizations when justified. Defer guest recommendation support and real AI recommendations to explicitly approved scope.

### Skills actually used

`using-agent-skills`, `code-review-and-quality`, `security-and-hardening`, `performance-optimization`, `playwright`, `shipping-and-launch`, `frontend-ui-engineering`, `ui-ux-pro-max`, and `observability-and-instrumentation`. Installed API-design instructions were consulted for contract review; no API was redesigned. UI skill guidance/search was used for accessibility/loading/keyboard review, not a redesign. Existing test instructions informed executing the real implementations; no source mutation experiment or code fix was performed because the user's read-only instruction takes precedence. No subagent was spawned.

## Appendix — Per-test execution ledger

The following entries are generated from this audit's actual Vitest JSON results and node:test output. Group paths are relative to the unchanged clean copy. All listed unit cases use the command in C's “Clean unit ledger” row; integration cases use C's full integration command. Durations are observational, not independent performance benchmarks. The browser procedures, application failures and setup failures remain listed separately above; passing this ledger does not erase them.

<details>
<summary>209 executed unit/component cases — PASS</summary>


### src/components/platform/platform-ui.test.tsx

| Case | Result |
|---|---|
| creator identity and embed rendering new creator, reporting and video forms use explicit submit buttons | PASS |
| creator identity and embed rendering mutation forms keep submitted data out of query strings without JavaScript | PASS |
| creator identity and embed rendering only badges an approved, public creator | PASS |
| creator identity and embed rendering requires a click before connecting to YouTube and escapes titles | PASS |

### src/components/recommendations/finder-client.test.ts

| Case | Result |
|---|---|
| bounds a stalled recommendation request and gives a useful retry message | PASS |
| preserves server validation errors instead of disguising them as timeouts | PASS |

### src/components/recommendations/finder.test.tsx

| Case | Result |
|---|---|
| finder privacy and explainable presentation lets guests discover the product without collecting private dimensions or pretending guest queries work | PASS |
| finder privacy and explainable presentation loads authenticated data through the private API rather than embedding a saved profile in initial HTML | PASS |
| finder privacy and explainable presentation shows real sample uncertainty and only existing exact detail/review links | PASS |
| finder privacy and explainable presentation hides numerical ranking scores when requested-factor coverage is insufficient | PASS |
| finder privacy and explainable presentation does not turn withheld review counts into zeros or expose raw reviewer records | PASS |
| finder privacy and explainable presentation does not invent a public product route for a mismatched exact variant | PASS |
| withholds catalogue actions when colorway identity or outsole metadata no longer matches | PASS |

### src/components/reviews/review-pagination.test.tsx

| Case | Result |
|---|---|
| review pagination omits controls on the first and only page | PASS |
| review pagination allows returning from a page removed by concurrent deletion | PASS |
| review pagination allows returning when all reviews disappeared | PASS |
| review pagination enables normal middle-page navigation | PASS |

### src/components/foot-profile/foot-profile-form.test.tsx

| Case | Result |
|---|---|
| foot profile privacy and accessible defaults renders empty optional measurements in a POST form, never placing measurements in a URL | PASS |
| foot profile privacy and accessible defaults renders the same currency choices even when browser ICU differs | PASS |
| foot profile privacy and accessible defaults explains privacy, independent review history and a measurement guide without automatic sharing | PASS |

### src/lib/accounts/foundation.test.ts

| Case | Result |
|---|---|
| server authorization rejects anonymous users | PASS |
| server authorization rejects unverified and suspended accounts | PASS |
| server authorization allows owners and rejects editing another profile, including admins | PASS |
| server authorization requires moderator or admin role for moderation | PASS |
| profile input supports Unicode handles with canonical normalization | PASS |
| profile input normalizes usernames and keeps text as text | PASS |
| profile input rejects invalid/reserved username admin | PASS |
| profile input rejects invalid/reserved username ADMIN | PASS |
| profile input rejects invalid/reserved username a | PASS |
| profile input rejects invalid/reserved username ab--cd | PASS |
| profile input rejects invalid/reserved username foo/bar | PASS |
| profile input rejects invalid/reserved username user@example.com | PASS |
| profile input rejects privilege and ownership fields and excessive text | PASS |
| profile input normalizes single email addresses and rejects address lists | PASS |
| return links and CSRF ignores spoofable forwarded addresses unless the proxy header is configured | PASS |
| return links and CSRF validates and canonicalizes only the configured trusted header | PASS |
| return links and CSRF rejects unsafe return target https://evil.test | PASS |
| return links and CSRF rejects unsafe return target //evil.test | PASS |
| return links and CSRF rejects unsafe return target /\evil.test | PASS |
| return links and CSRF rejects unsafe return target /api/auth/signout | PASS |
| return links and CSRF rejects unsafe return target /login | PASS |
| return links and CSRF rejects unsafe return target null | PASS |
| return links and CSRF rejects unsafe return target / attack | PASS |
| return links and CSRF preserves internal navigation | PASS |
| return links and CSRF requires configured origin, rejects missing/spoofed origins | PASS |
| return links and CSRF fails closed on incomplete or insecure configuration | PASS |
| return links and CSRF rejects invalid SMTP configuration while supporting Resend and local SMTP | PASS |
| return links and CSRF bounds request bodies by bytes without relying on content-length | PASS |

### src/lib/foot-profile/validation.test.ts

| Case | Result |
|---|---|
| private foot profile input preserves exact left/right cm to mm conversion | PASS |
| private foot profile input allows a completely optional private profile without fabricated values | PASS |
| private foot profile input rejects out-of-range, negative and excessive precision rather than rounding | PASS |
| private foot profile input rejects forged identities, unsupported units, invented classifications and surfaces | PASS |
| private foot profile input validates budget/currency and optional boot sizing as pairs | PASS |
| private foot profile input validates real nonfuture calendar dates, deduplicated positions and known catalogue brands | PASS |
| private foot profile input does not round partially entered values on unit changes | PASS |

### src/lib/boots/catalogue.test.ts

| Case | Result |
|---|---|
| catalogue filtering shows all eight entries by default without modifying the source | PASS |
| catalogue filtering filters brand=nike | PASS |
| catalogue filtering filters silo=mercurial | PASS |
| catalogue filtering filters tier=Elite | PASS |
| catalogue filtering filters surface=FG | PASS |
| catalogue filtering filters surface=AG | PASS |
| catalogue filtering filters surface=unknown | PASS |
| catalogue filtering combines all filters with case insensitive multiword search | PASS |
| catalogue filtering returns an empty result for incompatible filters and unmatched search | PASS |
| catalogue filtering sorts deterministically in both directions without changing fixture order | PASS |
| catalogue filtering parses shareable query state and falls back from invalid sorts | PASS |
| catalogue navigation and search labels searches full surface label firm ground | PASS |
| catalogue navigation and search labels searches full surface label artificial grass | PASS |
| catalogue navigation and search labels searches full surface label turf | PASS |
| catalogue navigation and search labels preserves catalogue query state in a safe return link | PASS |
| catalogue navigation and search labels rejects unsafe return path null | PASS |
| catalogue navigation and search labels rejects unsafe return path https://example.com/boots | PASS |
| catalogue navigation and search labels rejects unsafe return path //example.com/boots | PASS |
| catalogue navigation and search labels rejects unsafe return path javascript:alert(1) | PASS |
| catalogue navigation and search labels rejects unsafe return path /boots/other | PASS |
| catalogue navigation and search labels rejects unsafe return path / | PASS |

### src/lib/boots/validation.test.ts

| Case | Result |
|---|---|
| boot data validation accepts eight sample entries with explicitly unknown attributes | PASS |
| boot data validation keeps generations, tiers, outsole variants, and colorways distinct | PASS |
| boot data validation rejects missing foreign keys at every identity level | PASS |
| boot data validation rejects duplicate IDs, slugs, and variant/colorway combinations | PASS |
| boot data validation rejects colorways from a different generation | PASS |
| boot data validation rejects unknown attributes without an explanation and invalid slugs | PASS |

### src/lib/community/community.test.tsx

| Case | Result |
|---|---|
| community validation normalizes, deduplicates and orders tags | PASS |
| community validation rejects invalid post input {"title":"hi"} | PASS |
| community validation rejects invalid post input {"title":"👟👟👟"} | PASS |
| community validation rejects invalid post input {"content":"short"} | PASS |
| community validation rejects invalid post input {"content":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"} | PASS |
| community validation rejects invalid post input {"categoryId":"made-up"} | PASS |
| community validation rejects invalid post input {"tags":["bad tag"]} | PASS |
| community validation rejects invalid post input {"tags":["turf","turf","turf","turf","turf","turf"]} | PASS |
| community validation rejects invalid post input {"tags":["xxxxxxxxxxxxxxxxxxxxxxxxx"]} | PASS |
| community validation rejects invalid post input {"bootEntryId":""} | PASS |
| community validation rejects invalid post input {"status":"PUBLISHED"} | PASS |
| community validation rejects invalid post input {"authorId":"bob"} | PASS |
| community validation requires a version for updates | PASS |
| community validation parses bounded filters and encodes shareable pagination links | PASS |
| community validation rejects invalid filter page=0 | PASS |
| community validation rejects invalid filter page=1001 | PASS |
| community validation rejects invalid filter page=nope | PASS |
| community validation rejects invalid filter page=1.5 | PASS |
| community validation rejects invalid filter sort=unsupported | PASS |
| community validation rejects invalid filter category=unknown | PASS |
| community validation rejects invalid filter q=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx | PASS |
| community validation makes excerpts plain bounded text | PASS |
| post authorization rejects anonymous and other authors | PASS |
| post authorization allows owners and authorized moderators, blocks inactive roles | PASS |
| safe Markdown blocks unsafe URL javascript:alert(1) | PASS |
| safe Markdown blocks unsafe URL data:text/html,bad | PASS |
| safe Markdown blocks unsafe URL vbscript:msgbox(1) | PASS |
| safe Markdown blocks unsafe URL https://user:pass@example.com | PASS |
| safe Markdown blocks unsafe URL https:\evil.test | PASS |
| safe Markdown blocks unsafe URL mailto:private@example.com | PASS |
| safe Markdown preserves normal web and internal links | PASS |
| safe Markdown drops raw HTML, unsafe links and remote image loads | PASS |

### src/lib/community/interactions.test.ts

| Case | Result |
|---|---|
| interaction inputs trims comments and rejects empty, oversized and control-character input | PASS |
| interaction inputs rejects claimed authors, depths, counters and moving an existing reply | PASS |
| interaction inputs accepts only desired voting states | PASS |
| interaction inputs bounds comment pages and supports real activity sorting | PASS |

### src/lib/platform/platform.test.ts

| Case | Result |
|---|---|
| creator and moderation boundaries accepts canonical YouTube IDs from supported URL forms | PASS |
| creator and moderation boundaries rejects unsafe video URL https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ | PASS |
| creator and moderation boundaries rejects unsafe video URL javascript:alert(1) | PASS |
| creator and moderation boundaries rejects unsafe video URL http://youtube.com/watch?v=dQw4w9WgXcQ | PASS |
| creator and moderation boundaries rejects unsafe video URL https://user@youtube.com/watch?v=dQw4w9WgXcQ | PASS |
| creator and moderation boundaries rejects unsafe video URL https://tiktok.com/@test | PASS |
| creator and moderation boundaries rejects unsafe video URL https://youtube.com/watch?v=../bad | PASS |
| creator and moderation boundaries allows international creator context but rejects forged verification and unsafe links | PASS |
| creator and moderation boundaries requires a valid reason and explicit proof confirmation | PASS |
| image processing decodes supported signatures and strips metadata by re-encoding | PASS |
| image processing rejects spoofed, malformed, oversized and excessive-pixel inputs | PASS |

### src/lib/reviews/reviews.test.ts

| Case | Result |
|---|---|
| structured review validation defaults to private foot info and retains six criteria | PASS |
| structured review validation rejects invalid rating 0 | PASS |
| structured review validation rejects invalid rating 6 | PASS |
| structured review validation rejects invalid rating 2.5 | PASS |
| structured review validation rejects invalid rating 5 | PASS |
| structured review validation rejects invalid rating null | PASS |
| structured review validation requires exact variant, size system and written observations | PASS |
| structured review validation does not accept forged user IDs, totals or permission | PASS |
| structured review validation validates measurements, consent and paired price/currency | PASS |
| structured review validation accepts optional sizing advice and bounds its length | PASS |
| structured review validation requires optimistic version on edits | PASS |
| structured review validation validates query bounds and desired helpful state | PASS |
| requires separate explicit analytical consent and public sharing; timestamps are server-owned | PASS |

### src/lib/recommendations/engine.test.ts

| Case | Result |
|---|---|
| deterministic evidence-based preference ranking normalizes both feet exactly and supports partial profiles | PASS |
| deterministic evidence-based preference ranking requires exact verified surface evidence and excludes incompatible pairs | PASS |
| deterministic evidence-based preference ranking never upgrades samples or generic FG/brand guidance into safety approval | PASS |
| deterministic evidence-based preference ranking marks missing, stale, differently scoped and foreign-currency prices unknown | PASS |
| deterministic evidence-based preference ranking separates known match quality and unknown evidence coverage without surface points | PASS |
| deterministic evidence-based preference ranking requires product evidence for fit and never scores foot dimensions or position | PASS |
| deterministic evidence-based preference ranking does not learn from community observations or combine variant generations/tiers | PASS |
| deterministic evidence-based preference ranking uses stable IDs for ties, deduplicates identical rows and rejects conflicting duplicates | PASS |
| deterministic evidence-based preference ranking handles empty inputs, no surface, result limits and invalid dates deterministically | PASS |
| deterministic evidence-based preference ranking distinguishes within/near/over budget and never fabricates inventory | PASS |
| scoring provenance and freshness edge cases calculates the documented normalized 25/25/15/5 weights | PASS |
| scoring provenance and freshness edge cases requires fresh, exact size inventory and rejects broad availability claims | PASS |
| scoring provenance and freshness edge cases does not trust wrong-brand, future or stale surface evidence | PASS |
| scoring provenance and freshness edge cases keeps contradictory surface approvals out of recommendations | PASS |
| bounds candidate/evidence work and rejects an unsupported currency at normalization | PASS |
| preserves a verified foreign-currency price while leaving budget comparison unknown | PASS |

### src/lib/recommendations/evaluation.test.ts

| Case | Result |
|---|---|
| scenario 'A': 'Wide self-report, 280/110 mm, AG, AUD…' | PASS |
| scenario 'B': 'Narrow self-report, 265/90 mm, FG, AU…' | PASS |
| scenario 'C': 'Regular self-report, 275/100 mm, TF, …' | PASS |
| scenario 'D': 'Asymmetrical feet' | PASS |
| scenario 'E': 'High instep with no catalogue fit evi…' | PASS |
| scenario 'F': 'Missing width' | PASS |
| scenario 'G': 'No preferred brand or tier' | PASS |
| scenario 'H': 'Budget below all verified offers' | PASS |
| scenario 'I': 'Different currency; no exchange rate' | PASS |
| scenario 'J': 'No community reviews' | PASS |
| keeps missing, stale, contradictory and sample eligibility out of recommendations | PASS |

### src/lib/recommendations/evidence.test.ts

| Case | Result |
|---|---|
| rejects malformed evidence/URLs without throwing or fetching untrusted locations | PASS |

### src/lib/recommendations/finder.test.ts

| Case | Result |
|---|---|
| finder request and saved profile boundaries requires an explicit surface and rejects IDs, saved consent and calculated results | PASS |
| finder request and saved profile boundaries uses existing measurement, international currency and paired-size validation | PASS |
| finder request and saved profile boundaries creates a saved payload only explicitly with existing profile concurrency and unrelated fields preserved | PASS |
| finder result refinements preserves engine order and does not mutate scores or promote unverified products | PASS |
| finder result refinements does not misclassify unknown budget or withheld reviews as confirmed matches | PASS |
| finder result refinements only connects catalogue actions when the exact variant/generation/entry is known | PASS |
| authenticated recommendation request contract retains saved-profile mode and requires explicit transient processing permission | PASS |
| validates steps independently while enforcing all fields at review | PASS |

### src/lib/recommendations/review-analysis.test.ts

| Case | Result |
|---|---|
| privacy-preserving exact variant review analysis reports no evidence without inventing ratings | PASS |
| privacy-preserving exact variant review analysis suppresses small group of 1 including similarity and distributions | PASS |
| privacy-preserving exact variant review analysis suppresses small group of 2 including similarity and distributions | PASS |
| privacy-preserving exact variant review analysis suppresses small group of 4 including similarity and distributions | PASS |
| privacy-preserving exact variant review analysis uses independent authors once and never treats edits as additional evidence | PASS |
| privacy-preserving exact variant review analysis filters hidden/spam, missing consent, withdrawn sharing and inactive authors | PASS |
| privacy-preserving exact variant review analysis does not mix variants, tiers, generations or outsoles and applies exact size/system to similar group | PASS |
| privacy-preserving exact variant review analysis calculates real means and distributions with sufficient cells | PASS |
| privacy-preserving exact variant review analysis suppresses entire sparse distributions and complementary groups | PASS |
| privacy-preserving exact variant review analysis counts missing measurements in overall only and does not fetch or infer private profiles | PASS |
| privacy-preserving exact variant review analysis has transparent moderate/stronger thresholds and no individual measurements/identities in DTO | PASS |
| privacy-preserving exact variant review analysis fails closed for bounded overflow and sample catalogue entries | PASS |
| privacy-preserving exact variant review analysis is deterministic on shuffled input and bounded large sets | PASS |
| withholds an overflowing direct analysis rather than computing unbounded partial evidence | PASS |
| excludes disclosed sponsored content from independent evidence | PASS |

### src/lib/recommendations/similarity.test.ts

| Case | Result |
|---|---|
| experimental reviewer similarity normalizes review cm without treating a missing value as zero | PASS |
| experimental reviewer similarity matches exact maximum dimensions and self-reported shape | PASS |
| experimental reviewer similarity distinguishes close, boundary and distant dimensions | PASS |
| experimental reviewer similarity requires both bilateral dimensions and does not infer missing categories | PASS |
| experimental reviewer similarity uses optional shared traits without turning missing or unsure into disagreement | PASS |
| experimental reviewer similarity rejects malformed normalized requester numbers and supports configurable bands | PASS |
| matches identically after cm/mm profile normalization | PASS |

### src/lib/recommendations/telemetry.test.ts

| Case | Result |
|---|---|
| generates a correlation ID and logs only bounded diagnostics, never exception messages or inputs | PASS |
| keeps success timing opt-in and records only named stage durations | PASS |
| categorizes status 400 without echoing errors | PASS |
| categorizes status 401 without echoing errors | PASS |
| categorizes status 403 without echoing errors | PASS |
| categorizes status 409 without echoing errors | PASS |
| categorizes status 413 without echoing errors | PASS |
| categorizes status 429 without echoing errors | PASS |
| categorizes status 503 without echoing errors | PASS |

</details>

<details>
<summary>69 executed integration cases — PASS, including lifecycle wrapper</summary>

| Case | Result |
|---|---|
| anonymous access, CSRF, registration and email delivery | PASS |
| single-use links, persistent sessions, existing-user login | PASS |
| profile editing, strict ownership input, unique usernames and public privacy | PASS |
| in-flight mutations recheck suspension, moderator revocation and logout | PASS |
| blocked email attempts do not consume the shared mail budget | PASS |
| database rejects cross-generation catalogue insert and parent updates | PASS |
| configured trusted proxy rejects spoofing and limits client auth/email traffic | PASS |
| post authentication, CSRF, bounded input and unique creation | PASS |
| owner-only editing, validation, stable slugs and concurrent version conflicts | PASS |
| moderator permission comes from current server role, never client input | PASS |
| stored feed search, category/tag/boot/author filters and safe public detail | PASS |
| pagination and deterministic sorting use real database rows | PASS |
| hidden and suspended/unverified content is not public, editing cannot publish it | PASS |
| concurrent tag reuse is unique and publishing limits are enforced | PASS |
| author-confirmed deletion rejects stale versions and removes tag joins | PASS |
| comments require authentication, valid input and a public post | PASS |
| owner-only edits reject stale versions and comment moves | PASS |
| replies validate post, depth and preserve context after parent deletion | PASS |
| root and branch pages are independent; database prevents cross-post/cyclic parenting | PASS |
| votes require auth, switch/remove idempotently and reject forged totals | PASS |
| concurrent votes preserve uniqueness and exact aggregate score; feed activity sorts | PASS |
| hidden posts reject reads/writes; creation and voting limits are enforced | PASS |
| post deletion cascades entire threads and votes without orphan records | PASS |
| reviews: empty aggregates, authentication, strict validation and origin | PASS |
| missing review edit renders a review-specific not-found state | PASS |
| reviews: persistence, exact variant, privacy and duplicate race prevention | PASS |
| reviews: ownership, stale edits, consent revocation and recalculation | PASS |
| reviews: actual aggregates, criterion averages, distribution, filtering and sorting | PASS |
| reviews: helpful voting is idempotent, authorized and changes sorting | PASS |
| reviews: DB constraints, pagination, XSS escaping and hidden data | PASS |
| reviews: in-flight suspension is rechecked, and publishing is rate limited | PASS |
| reviews: deletion cascades votes and recomputes empty aggregates | PASS |
| reviews: full-length Unicode content and sizing advice persist through create/edit | PASS |
| foot profiles deny anonymous access, CSRF, forged IDs and public lookup | PASS |
| foot profile persists exact independent measurements, consent and optional preferences | PASS |
| database enforces profile uniqueness, foreign keys and numeric limits | PASS |
| other users cannot read, mutate or delete an owner's foot profile | PASS |
| foot profile updates revoke consent, reject invalid input and detect concurrent edits | PASS |
| foot profile deletion removes only current profile and preserves review snapshots | PASS |
| stale tabs cannot modify a profile recreated after deletion | PASS |
| recommendation API requires authentication, bounded valid input and private profile consent | PASS |
| database sample catalogue produces no fabricated eligible products, scores, prices or inventory | PASS |
| operator-approved exact-variant evidence changes eligibility without bleeding tiers or colorways | PASS |
| recommendations do not grant consent, persist snapshots or permit another user to access a profile | PASS |
| recommendation requests enforce shared rate limits and body limits | PASS |
| fit analysis: explicit analytical consent is separate, server timestamped and owner-only | PASS |
| fit analysis: exact persisted cohorts, privacy and recommendation safety | PASS |
| fit analysis: consent withdrawal, moderation, suspension, size scope and deletion take effect immediately | PASS |
| fit analysis: bounded scan fails closed instead of publishing partial aggregate counts | PASS |
| finder: public guest guidance, protected transient mode and strict consent payload | PASS |
| finder: transient recommendations work without a saved profile and do not fabricate or persist data | PASS |
| finder: own-profile preload, explicit save, unrelated fields and optimistic concurrency remain intact | PASS |
| finder: transient output preserves exact variants and surface-denial precedence | PASS |
| bounded HTTP recommendation workload, correlation IDs, private errors and no persistence | PASS |
| platform: public empty directory, authentication, creator editing and Unicode handles | PASS |
| platform: verification is admin-only, proof-backed, audited and revoked on link changes | PASS |
| platform: secure real S3 image upload, signature, size, quantity, quotas and ownership | PASS |
| platform: creator-owned video linking, provider validation and clear sponsorship | PASS |
| platform: reports deduplicate; moderators hide/restore with audit; regular users denied | PASS |
| platform: comments, reviews, images and creator reports all support moderation | PASS |
| platform: image removal, parent cascades, durable S3 cleanup and storage failures | PASS |
| expired sessions and concurrent unique-username updates | PASS |
| expired links and email rate limiting | PASS |
| suspended accounts are blocked server-side and hidden publicly | PASS |
| logout revokes sessions and existing cookies cannot authorize writes | PASS |
| catalogue remains usable when account services are unconfigured | PASS |
| security response headers protect pages, assets and APIs | PASS |
| Phase 1 routes and catalogue still render | PASS |
| Sprint 2.1/2.2/2.3/2.4 real HTTP, PostgreSQL and SMTP lifecycle | PASS |

</details>
