# Sprint 3.5 — Recommendation validation and stabilization

Executed 16 October 2026, local development only. No deployment, new infrastructure, schema migration, dependency upgrade or real user-data mutation in this sprint. All pre-existing pending Sprint 3.2–3.4 changes are preserved.

## A. Phase 3 completion status

| Sprint | Status | Evidence / qualification |
|---|---|---|
| 3.1 Private foot profile | PASS | CRUD, ownership, units, concurrent updates, consent and deletion integration tests |
| 3.2 Rule engine | PASS | Deterministic pure engine, manufacturer surface gate, bounded real PostgreSQL service, exact variant evidence |
| 3.3 Review analysis | PASS | Opt-in eligibility, independent authors, same-size matching, sparse/complement suppression and consent withdrawal tests |
| 3.4 Finder UI | PARTIAL | Working authenticated wizard/results/links; guest queries and product comparison are explicitly unsupported |
| 3.5 Stabilization | PARTIAL | Software validation and bounded local benchmarks completed; field performance, scientific fit accuracy and production-scale query profiling remain unverified |

PASS means the implemented software contract passed the executed checks, not that product evidence is complete or physical fit is proven.

Initial audit: this is a Next 16 App Router app using React 19, Prisma 7's PostgreSQL adapter, Auth.js email sessions, shared PostgreSQL rate limits and private S3-compatible uploads. Pure catalogue/profile/recommendation modules are separated from owner-scoped services and UI. Product identity follows brand → family → generation → tier → outsole, with separate colorways/entries. Composite foreign keys prevent cross-generation tier/colorway assignments. Reviews belong to exact outsole variants, intentionally shared across colorways; commerce evidence belongs to an exact entry and optional worn size/system. No SKU or boot-publication status field exists. No comparison tool exists. These missing capabilities were not invented during stabilization.

Read-only development-data audit: 8 catalogue entries, all 8 samples; 7 variants, 0 reviews, 0 recommendation evidence, 0 foot profiles, 0 inconsistent entry/variant/colorway generation joins. Unknown technical specifications remain unknown. The sample artwork is explicitly concept artwork, not a verified product photo. Real data cannot currently support genuine recommendations or community fit conclusions.

## B. Code quality and changes

Confirmed defect: `src/components/recommendations/finder-client.ts`, `runFinder`, previously awaited fetch indefinitely. A stalled request could leave the controller busy with no retry. A regression first failed by timeout; the fix uses a 20-second `AbortSignal.timeout`, preserves server validation errors and returns a clear retry message. This aborts the browser read; it does not guarantee cancellation of server-side PostgreSQL work. No automatic write retry was introduced.

Operational gap addressed: recommendation failures were previously generic 503 responses without correlation or diagnostic classification. The route now generates a fresh UUID and returns `x-request-id` for successes and errors. `src/lib/recommendations/telemetry.ts` records only an explicit bounded event shape: event, entryPoint, requestId, status, category, durationMs and stage durations. No input, profile, user ID, email, URL, SQL, stack, exception message or provider credential is serialized. Database codes are mapped into a category, never emitted. Success timing is default-off; errors/warnings remain visible. No monitoring dependency or shared cache was added.

New/changed Sprint 3.5 files:

- `src/components/recommendations/finder-client.ts` and `.test.ts`: bounded reads / retry regression.
- `src/app/api/boot-fit/recommendations/route.ts`: route-level diagnostics and request IDs.
- `src/lib/recommendations/telemetry.ts` and `.test.ts`: safe categories, severity and timing.
- `src/lib/recommendations/evaluation.test.ts`, `tests/fixtures/recommendation-evaluation.ts`: A–J and evidence edge cases.
- `tests/benchmark-recommendations.mts`: bounded pure engine plus review-analysis workload.
- `tests/recommendation-performance.integration.ts`: authenticated HTTP workload and real query-failure injection in the disposable database.
- `tests/auth.integration.ts`: opt-in benchmark invocation and actual server-log shape assertions.
- `README.md`, `tasks/plan.md`, `tasks/todo.md`, this report: reproduction, decisions and limitations.

No scoring formula, authentication architecture, live API key, production data or migration was changed in this sprint. Existing work in the Git tree belongs to earlier sprints and is not all attributed to this change.

Remaining debt: candidate scan is bounded to 100 stable IDs, results to 20 per eligibility section, evidence to 32 per variant and analytical reviews to 2,000 globally across returned variants. Bounds deliberately sacrifice completeness and announce truncation; overflowed review analysis is withheld rather than computed from a biased partial scan. Canonical-entry selection does not search every colorway/offer. A broader retrieval policy needs product requirements and larger real datasets before alteration.

The full integration run also emits pg's concurrent-client-query deprecation warning. Current pg 8 tests pass; do not upgrade to pg 9 without tracing and resolving this compatibility issue. This sprint does not rewrite unrelated image/admin transaction code.

## C. Recommendation quality

Fixtures are explicitly synthetic self-reports and invented evidence, not manufacturer specifications or validated anatomical categories. Unit fixtures stay in process; database/browser fixtures exist only in freshly named local QA databases.

| Scenario | Actual engine assertion |
|---|---|
| A: wide label, 280/110 mm, AG, AUD200 | AG manufacturer approvals only; known price matches budget; no physical-fit inference |
| B: narrow label, 265/90 mm, FG, AUD150 | FG-only eligible set; ranking uses actual synthetic prices, not a shape bonus |
| C: regular label, 275/100 mm, TF, AUD100 | TF-only set; all offers over budget remain clearly over-budget |
| D: asymmetric feet | Deterministic ranking, both measurements preserved; no invented size conversion |
| E: high instep, sparse fit evidence | Fit factor unknown and evidence coverage below 100%; no high-instep claim |
| F: missing width | Discovery still works, comparable-review cohort unavailable |
| G: no brand/tier preference | Identity factor not requested; no reputation bonus |
| H: budget below all offers | All eligible offers explicitly over budget, not relabeled affordable |
| I: different currency | Original AUD offer retained; USD comparison unknown; no currency conversion or budget score |
| J: no relevant reviews | No fabricated aggregate, Insufficient Evidence |

Every scenario checks equivalent results with reversed candidate order, stable unique identities, score bounds, real provenance, explanations and explicit unknown physical fit. Additional tests cover missing/expired evidence, samples and denial precedence. Existing suites cover normalized weights, conflicting fit claims, wrong-brand sources, evidence limits, distinct tiers/generations/outsoles, same-size currency/colorway scoping, availability freshness and privacy suppression.

Review observations never change ranking or override surface denials. Similarity bands and quality labels are experimental observational policies. Minimum groups/cells of five and complementary suppression reduce disclosure but are not differential privacy; repeated queries, colluding accounts and self-reported traits remain inference/Sybil risks. Scientific fit validation, expert relevance judgments, precision/recall against real outcomes and real ranking usefulness are NOT TESTED. There is no labeled real-world fit dataset.

## D. Measured performance

Hardware: Apple M2 Pro, 10 logical CPUs, 16 GiB RAM, macOS arm64, Node v24.8.0. Localhost production build and local PostgreSQL; developer machine with normal background work, not a dedicated benchmark host.

| Workload | Dataset / concurrency | Warmup / measured | p50 | p95 | Error rate |
|---|---|---|---|---|---|
| Pure engine + one variant's analysis | 100 candidates, 2 evidence rows each, 2,000 synthetic reviews, 10 scenarios; concurrency 1 | 30 / 300 | 2.05 ms | 2.60 ms | 0% |
| Authenticated recommendation HTTP, small | 7 sample variants, 0 reviews; concurrency 4 | 4 / 32 | 9.93 ms | 23.46 ms | 0% |
| Authenticated recommendation HTTP, bounded scale | 100 variants, 94 synthetic approved AG configurations, 2,000 persisted opted-in reviews on one variant; concurrency 4 | 4 / 32 | 80.90 ms | 95.04 ms | 0% |

Pure-process RSS: 154 MiB before measured loop, 188 MiB observed peak; final heap used 30 MiB. RSS includes Node/tsx/module/JIT allocations; it is not a measured app leak or production memory budget. HTTP app RSS and exact Prisma SQL query durations/counts were NOT MEASURED. An equivalent single-variant review eligibility/filter SQL probe (`EXPLAIN ANALYZE`) returned 2,000 rows with execution 9.762 ms and planning 0.479 ms. It is not the full Prisma-generated query and excludes its projections/serialization. HTTP total includes auth, limiter, Prisma retrieval and response serialization. The tiny sample catalogue skips substantive analytical review retrieval, so its latency must not be extrapolated to a populated production database. The second HTTP phase exercises actual retrieval/analysis of all 2,000 persisted reviews and asserts their published aggregate count. It adds 93 variants/entries, scoped synthetic surface evidence and 2,000 synthetic reviewers/reviews only inside the random test DB; these are removed in `finally` before other regressions continue. It is intentionally skewed to one reviewed variant and is not a representative organic data distribution. The pure maximum-bound analysis is a separate CPU test. The earlier small-data trial measured 9.48/12.02 ms p50/p95; the final small-data run above shows why single-run tail latency should not be treated as a speedup/regression or a production guarantee.

Reproduce:

```sh
node --import tsx tests/benchmark-recommendations.mts
npm run build
BOOTVERSE_BENCHMARK=1 npm run test:platform:local
```

The latter requires existing guarded `.local/development.env`, local PostgreSQL with permission to create disposable databases, and the local S3 service. The harness overrides both DB URLs, creates a random QA DB/private bucket, applies existing migrations, imports samples, runs the production server with captured local SMTP and removes only its own resources. It resets only its synthetic actor's recommendation-limit bucket between measured batches. It does not weaken the deployed rate limiter. Do not point an ad hoc load tool at Neon or production.

Optimization ledger: no speculative cache, index, memoization or batching change was kept. These measurements did not identify a Sprint 3 bottleneck that justified added complexity. Before/after optimization delta is N/A: this sprint adds validation and operational safety, not a claimed speedup. Future populated-database profiling must measure actual SQL plans/counts/latency, pool wait time, catalogue truncation and concurrent review workloads. Field LCP/INP/CLS, throttled mobile testing, Lighthouse and real-user monitoring are NOT TESTED.

## E. Security and operational readiness

Executed tests cover active verified accounts, anonymous denial, cross-owner access, forged IDs, same-origin CSRF checks, bounded request bodies, strict Zod fields, shared rate limits, opt-in transient processing, consent withdrawal, private profile CRUD/concurrency, safe review rendering, moderation/creator authorization and upload constraints. No confirmed Sprint 3 authentication bypass or private-measurement disclosure was found in this review's tested paths. This is not a penetration-test certification.

A deliberate missing `RecommendationEvidence` relation in the disposable DB causes an actual query failure: API returns generic 503, private/no-store, generated request ID, and a structured database-category event without query/error internals. The table is restored in `finally`. This tests a DB query failure, not an actual dropped network/Neon outage. Connection-failure classification is unit-tested with a simulated Prisma P1001; real connection-refusal/network-outage behavior is NOT TESTED.

Client literal scan of 43 generated JS files found 0 files containing configured private environment values. This exact-value scan does not detect encoded/derived secrets and is not a historical Git-secret audit. `.env` and `.env.local` were neither printed nor committed.

`npm audit --omit=dev --json`: 0 known runtime vulnerabilities. Full `npm audit --json`: 5 High findings in the lint toolchain (`eslint-config-next`, `@next/eslint-plugin-next`, `fast-glob`, `micromatch`, `braces`). No force-fix was applied: npm proposes an incompatible downgrade of eslint-config-next to 14.2.35. Reassess compatible remediation before release and again by 23 October 2026; isolate CI from untrusted inputs while unresolved. Known-advisory audits do not prove supply-chain safety.

### Diagnostics / health strategy

Questions answered: which request failed; which bounded class failed; whether access checks or recommendation generation consumed time. `BOOT_FIT_TIMING_LOGS=1` enables success JSON logs for bounded local/staging investigations. Use `requestId` from the response to find the event. Do not add bodies, profile IDs or raw exception messages to improve diagnostics. Restrict operational log access/retention; rotate logs outside application code. This sprint adds no external monitoring, automatic alert or distributed tracing platform.

Liveness: probe public `/` for HTTP availability without forcing a database query. Readiness: an authenticated/private operator check should execute `SELECT 1`, inspect migration status and the recommendation response in the intended environment; keep DB diagnostics out of a public endpoint. No new unauthenticated DB-polling route was introduced.

If 503s occur: find the request ID; inspect category and stage timings; check database connectivity/pool saturation/migration status using server-side tools; retry only safe reads after recovery. For 401 reauthenticate; for 403 check consent/account status; for 409 reload current profile; for 429 wait for the existing window. Do not reset the DB or blindly replay profile writes. A high p95 alone on a tiny local dataset is not a production SLO; collect a representative baseline before choosing alerts.

## F. Executed checks

| Command/check | Result |
|---|---|
| `npm test` | PASS: 209 tests, 20 files, no skipped tests |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS after removing ignored duplicate generated Next declarations and correcting a new fixture invocation |
| `npm run build` | PASS, local production build |
| `BOOTVERSE_BENCHMARK=1 npm run test:platform:local` | PASS: 69 tests, 0 failed/cancelled/skipped; real local HTTP/PostgreSQL/SMTP/S3 |
| `prisma validate` via installed CLI | PASS |
| `prisma migrate status` guarded local environment | PASS: 11 applied migrations, up to date |
| `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | PASS: no difference |
| `git diff --check` | PASS |
| Dependency audits | Runtime PASS; full audit FAIL: 5 High dev dependencies |

The integration command runs all existing test groups, including community CRUD/search/pagination, comments/votes, structured review CRUD/aggregates, profiles, real private S3 upload/delete/error paths, creators/verification/moderation, catalogue route rendering, consent and recommendation regressions. Unit catalogue tests cover search/filter/sort/validation. It is not a complete manual browser journey for every old feature. Comparison remains absent and NOT TESTED.

Failures during development were retained and resolved: new telemetry module initially absent (expected RED); stalled client regression failed at 5-second test timeout (expected RED); initial typecheck found duplicate ignored Next-generated types plus a mistaken `emptyFinder` function spread in the new test. Generated duplicates were removed only when gitignored; no type suppression or source-test deletion. A deliberate severity mutation (500→600 threshold) made the diagnostic tests fail, then restoration passed, demonstrating the guard detects the changed behavior. The audit's five dev advisories remain unresolved, rather than counted as PASS.

Browser PASS in a separate local QA production server/database: real captured SMTP sign-in; guest layout, authenticated form and result overflow assertions at 375/768/1024/1440 px; invalid width receives focus, correction and four-step navigation; consent defaults off; keyboard Space/Tab reaches the separate save checkbox; intercepted stalled request produces the real 20-second timeout and releases the button; removing interception allows a real successful retry; owner profile remains null with save off; one synthetic eligible variant plus six unverified products; supporting evidence shows the real synthetic five-person same-size cohort; reduced-motion media setting; exact boot-detail navigation. Browser console: 0 errors, 0 warnings. Four full-page screenshots are in ignored `output/playwright/sprint35-results-{375,768,1024,1440}.png`; mobile and desktop were visually inspected.

Initial automation attempts failed because the test used a wrong sign-in/result heading, assumed a nonexistent save-checkbox ID and matched a disclosure label without its visible plus sign. Selectors were corrected against the actual DOM; the final assertions passed. These were automation failures, not concealed application failures. No formal screen-reader/WCAG certification, mobile device lab or product-comparison browser test was performed.

The isolated browser session and QA helper were closed; its random QA database and captured email were removed. The application development server was restored on localhost:3000. No real app records were used for the synthetic review journey.

## G. Production prerequisites

Before public launch: curate genuine exact-variant manufacturer surface evidence and current scoped offers; replace/retain clear sample labeling appropriately; resolve or formally accept the lint advisories; test a populated isolated database with query instrumentation/plans and representative concurrency; trace the pg warning before a major driver upgrade; verify production SMTP sender/domain delivery, S3 policy/backups/cleanup, TLS/cookies/proxy trust and least-privilege Neon credentials. Define retention/deletion and backup recovery procedures, an operational log policy and an owner for incidents. Obtain real-world fit/relevance evaluation before making accuracy claims.

No synthetic users, ratings or analytical evidence were added to the development/production community. Existing comparison and guest-query limitations remain visible. Publication-state testing is N/A until that product concept exists in the schema; no invented publication filter was applied.

## H. Phase 4 decision

**CONDITIONALLY READY for further development; NOT READY for production launch.** The deterministic software pipeline and executed local regressions support continuing development. Progress depends on retaining the evidence/privacy limits and addressing the data/toolchain/operational gaps above. This is not sign-off on a real-world fitting system or on completion of missing comparison functionality. No Phase 4 work or deployment was started.

Skills loaded and used for this stabilization: ponytail, test-driven-development, code-review-and-quality, security-and-hardening, performance-optimization, observability-and-instrumentation, playwright and the already loaded incremental-implementation workflow. Local installed Next route-handler documentation was read before route changes. UI design skills from Sprint 3.4 were not claimed as new Sprint 3.5 redesign work; the existing design was preserved.
