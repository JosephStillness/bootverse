# BootVerse — post-audit remediation

**17 October 2026, Australia/Sydney.** Baseline: `main`, `818021d`. Original input: [full audit](BOOTVERSE_FULL_AUDIT.md). Changes are uncommitted; no push, deployment or AWS provisioning was performed. Original audit content is preserved.

## A. Original audit findings

The twelve findings were checked against the current implementation. Deployment configuration, missing functionality, confirmed bugs and future risks are different categories; passing local tests does not make the configured remote database ready.

| Finding | Original concern | Outcome |
|---|---|---|
| D1 · High | Configured non-local migration history pending | BLOCKED: remote approval/reconciliation required |
| D2 · High | Comparison missing | FIXED |
| D3 · High | Static discovery/details; DB additions return 404 | PARTIALLY FIXED: DB integration complete; genuine product/evidence curation outstanding |
| D4 · High advisory | Five lint-chain dependency entries | BLOCKED: upstream advisory has no patched `braces` version |
| D5 · Medium | Workspace typecheck/build fail | PARTIALLY FIXED: workflow checks now pass repeatedly; duplicate-file writer remains unidentified |
| D6 · Medium | Finder profile preload can hang | FIXED |
| D7 · Low | Unchanged moderation filter spinner | FIXED, with additional history regression fixed |
| D8 · Medium | Unbounded review-summary options/redundant fetch | FIXED within documented bounds |
| D9 · Medium | pg concurrent-client-query warning | BLOCKED compatibility follow-up; warning remains visible |
| D10 · Medium | Unexpected service failures lack correlation | FIXED at community/platform/catalogue API error boundaries |
| D11 · High gate | Deployment/operational controls unverified | PARTIALLY FIXED: application/container/CI preparation; external gates remain |
| D12 · Low | README contradicts current functionality | FIXED |

## B. Fix status and evidence

**D1:** Local validate/status/drift passed after applying only `20261017010000_catalogue_publication` through the guarded localhost profile. All twelve local migrations are applied. The configured non-local URL is pooled; its direct override is absent and read-only status lists all twelve pending migrations. No remote schema/data write was executed. [Migration/backup/recovery runbook](deployment-runbook.md) is prepared; it is not a backup or rehearsal result.

**D2:** `/compare` accepts up to four public entry IDs and deduplicates exact variants, including colorway siblings. Cards, details and Finder have selection actions; the table preserves model/generation/tier/outsole/colorway and sourced attributes/scoped offers. Missing information stays unknown. Unit, real HTTP and browser checks cover selection, removal, clear, cap, reload/share, unpublished exclusion and exact identities. Mobile scroll is confined to a labeled keyboard-focusable region.

**D3:** Home, catalogue, details, new-review routes, comparison, community references, review links and Finder use published database identities. No runtime product renderer imports fixture products. New published QA entries actually appeared without a rebuild and returned details/metadata with sourced test specifications; unpublished/missing entries returned HTTP 404. Static fixtures remain only for explicit local seeding/tests; preference labels were separated so the client no longer imports sample product records. Actual development data remains eight labeled samples, seven variants, and no genuine recommendation evidence. Additional preference brands/manufacturer evidence domains still require operator configuration.

**D4:** Both audits ran. Runtime: zero advisories. Full: five High package entries from **one** [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), via micromatch/fast-glob/Next lint configuration. Registry latest `braces` is 3.0.3; no patched version is listed. The suggested Next lint downgrade is incompatible and was not applied. No forced update, exception suppression or lockfile edit was made. Restricted CI and a deliberately failing full-audit job make the risk explicit; release-owner acceptance/upstream resolution is still required.

**D5:** Baseline typecheck failed on duplicate generated route declarations. A subsequent build also reproduced invalid persisted Turbopack numeric cache filenames such as `00000005 2.sst`. Only confirmed generated artifacts were quarantined/cleaned; source files were not deleted. The official Next 16.4 filesystem-cache flags disable persistence. No TypeScript includes, compiler checks or lint rules were weakened. Two consecutive final builds and post-build typechecks pass in this workspace; a frozen-install Linux Docker build also passes. Development mode works. The creator of duplicate files was not identified, so machine/filesystem health remains a caveat. A dependency-directory move stalled and was stopped; do not interpret it as a successful workspace reinstall. Docker performed the verified frozen install.

**D6:** Saved-profile reads have a ten-second deadline combined with caller cancellation. Pending and error states offer manual continuation; retries replace the prior attempt. Abort guards prevent obsolete reads from overwriting typed input. Manual mode clears save intent and disables saving until owner state is known. Nine client tests and browser cases exercise successful/slow reads, real deadline, network error, expired-session response, retry, manual escape, stale completion and unmount. No private profile is embedded in initial HTML or comparison URLs.

**D7:** Loading is derived from the actual query/retry request identity, not set unconditionally on submit. Responses/errors/finally from canceled attempts cannot complete another query. Reapplying identical filters does not create a phantom request. Controlled draft fields synchronize with applied URL filters; documented Next router navigation handles back/forward/reset without retaining an obsolete search value. Browser regressions cover identical/changed/reset filters, repeated submissions, history, empty results, 503 and recovery.

**D8:** Separate database groupings replace the unbounded Cartesian combination query. Displayed size/system options cap at 200 with an explicit truncation flag; shapes/surfaces/months have fixed domain bounds, with durations reduced to three buckets. Aggregate count/ratings/distribution still use all eligible reviews. An isolated fixture of 205 distinct legal size/system pairs verified 200 options and the correct 205-review aggregate. Mounted review lists reuse variant-wide summaries when only filters change; retry/remount refreshes them. No performance gain is inferred from code shape alone.

**D9:** The current Prisma/pg path still emits its deprecation warning, and the suite reports it. pg remains on major 8. Registry pg latest was 8.23.1. Prisma adapter 7.10.1 is available, but its extracted `dist/index.mjs` is byte-identical to the installed 7.10.0 adapter; a full client patch upgrade was not tested or claimed to fix the warning. Do not upgrade to pg 9 without a compatible upstream resolution and regression testing. This is not a present pg 8 failure.

**D10:** Unexpected API failures now emit a generated `x-request-id`, bounded status/category and a `service_failure` event. No exception text, SQL, URLs, emails, IDs or measurements enter this helper's log. Tests include Prisma P2021/P2010 failures and an actual isolated missing-table 503. Existing recommendation diagnostics remain unchanged. Unclassified dependencies use `unavailable`; production tracing/alert delivery is not implemented or verified.

**D11:** Added a digest-pinned Node 24 multi-stage Dockerfile, non-root standalone runtime, secret-excluding context, liveness/readiness APIs, pinned read-only GitHub Actions quality jobs, SDK default credential-chain support and optional paired temporary S3 credentials. Real Linux image build and HTTP smoke were exercised; role-only configuration acceptance is tested, not real AWS IAM. Normal `npm run build`/`npm start` remain supported; Docker explicitly enables standalone output. CI has not run on GitHub because no push was authorized. Cleanup schedules, TLS/proxy, secret delivery, real email, object policy, backup restore and release rollback remain external tasks.

**D12:** README now describes current functionality/setup and links dated sprint evidence separately. Stale “Sprint 3.4 not implemented” and missing-comparison claims were removed.

## C. Root causes and additional confirmed fixes

1. **Finder:** only an unmount signal bounded a preload; a pending fetch replaced the entire form. The deadline/manual escape now cancels that fetch rather than hiding a spinner with a timer.
2. **Admin:** unchanged serialized criteria did not rerun the fetching effect after submit set loading true. Loading now belongs to request identity. Further browser testing reproduced a stale search value after history traversal; URL/applied/draft state now follows actual router transitions.
3. **Product 404:** a loading boundary committed HTTP 200 before database visibility was known. Product layout now resolves publication/existence before its child loading boundary. Catalogue loading moved into a route group; public URLs are unchanged.
4. **Review media publication leak:** review APIs hid an unpublished product's reviews, but uploaded-image parent checks did not include product publication. Public image/video/report target visibility now also requires a published product entry. An isolated regression first returned 200 instead of 404; final tests enforce public denial while preserving owner access.
5. **Mixed-case sorting:** PostgreSQL's ordering put lowercase `adidas` after capitalized brand names. A real integration test failed. Sorting now case-folds names **in PostgreSQL before pagination**, with stable ID ties. Count and bounded ID selection share a parameterized SQL fragment in a snapshot transaction; associated records are batched. Literal wildcard/quote input remains tested.
6. **Invalid catalogue URLs:** malformed query values previously reached the generic service error boundary. A regression failed; the page now provides a dedicated validation view and reset link, while the API still rejects invalid input with 400.
7. **Build artifacts:** duplicate generated declarations and invalid persistent-cache filenames were confirmed. Their writer was not confirmed; no speculative blame is assigned to Next or filesystem software.

## D. Implementation summary

Core contracts:

- `GET /api/boots`: bounded search/brand/silo/tier/surface/sort/page; twelve entries per page, consistent snapshot count and ordering, literal wildcard escaping and no sample fallback.
- `/boots/[slug]`: request-time published lookup, exact normalized identity, source-aware specifications/offers, review/discussion/comparison integration and real missing/private 404.
- `/compare?boot=ID&boot=ID`: maximum four public entry IDs; first selected colorway represents one exact variant. URL contains no private Finder inputs.
- `/api/health/live`: dependency-independent liveness. `/api/health/ready`: read-only latest-migration metadata check, not a full drift/storage/SMTP certification.
- `npm run test:browser:serve` and `npm run test:browser -- catalogue|profile|admin`: reusable local-only fixture environment and CLI regression functions. No new package dependency was required.

[Catalogue/data/privacy/QA contract](catalogue-and-comparison.md) and [deployment runbook](deployment-runbook.md) document limits and manual procedures. The appendix lists changed files; the original audit is unchanged input.

## E. Database changes

One additive migration: `prisma/migrations/20261017010000_catalogue_publication/migration.sql`.

- `CatalogueEntry.published`: pre-existing entries retain visibility; new inserts default false.
- `CatalogueEntry.specifications`: JSON object with a DB object-shape constraint. Runtime projection only accepts sourced allowed attributes; samples stay unknown.
- Publication/ID index. Existing generation/variant/colorway composite FKs and review/vote/identity constraints are preserved.

Applied only to the guarded existing **local** development database after isolated migration tests. New migration tests and all mutation scenarios used randomly named local databases/private buckets. No reset occurred; no existing real community or private profile record was edited. Non-local database received status reads only. Before any remote migration, review the visibility backfill against legacy drafts, direct connection, backup and staging rehearsal.

## F. Test results

Final commands and actual outcomes; zero skipped cases are counted as pass.

| Check | Command/procedure | Executed / passed / failed / skipped |
|---|---|---|
| Unit/component | `npm test` | 226 / 226 / 0 / 0; 24 files |
| Full isolated integration/security/storage/benchmark | `BOOTVERSE_BENCHMARK=1 npm run test:platform:local` | 75 / 75 / 0 / 0; includes lifecycle parent |
| ESLint | `npm run lint` | PASS, exit 0 |
| Typecheck | `npm run typecheck` | PASS, exit 0 |
| Consecutive release builds | Two `npm run build` commands on unchanged final application code | Both PASS |
| Post-build type generation | `npm run typecheck` after each build | Both PASS |
| Schema/local status/drift | Installed Prisma validate/status/diff with guarded local env | PASS; twelve applied, no drift |
| Configured non-local status | Installed Prisma `migrate status`, read-only | FAIL release gate: twelve pending |
| Runtime audit | `npm audit --omit=dev --json` | PASS: zero advisories |
| Full audit | `npm audit --json` | FAIL: five High entries, one root advisory |
| Linux container | `docker build -t bootverse:remediation .` | PASS; frozen script-disabled install, explicit generation/build |
| Browser CLI suites | `npm run test:browser -- admin`, `npm run test:browser -- profile`, `npm run test:browser -- catalogue` | PASS on the final production build; invalid-filter recovery and fresh captured-email login also passed |
| Dev mode/history | Guarded dev server; admin suite and catalogue Back test | PASS |
| Client literal scan | In-memory comparison of private configured values to production client JS | PASS: 45 JS files, zero literal matches, zero tracked private env files |
| Diff hygiene | `git diff --check` | PASS |

The full integration command runs the existing `tests/auth.integration.ts` entrypoint with additional storage/benchmark coverage; it is not an invented integration script. Watch-mode tests, live cleanup against real data and destructive database commands were not run.

### Verified regressions/features

- Real PostgreSQL/SMTP registration, single-use links, login/logout, sessions, revoked/suspended account checks, ownership and current server roles.
- Persisted post/comment/reply/vote CRUD, search/categories/tags/sorts/pagination, duplicate and concurrency constraints.
- Six-category reviews, exact variants, ownership/edit/delete, helpful voting, actual aggregates, private measurement/consent controls and bounded analytical cohorts.
- Real private-S3 uploads, signatures/decoding/size/count/quota restrictions, EXIF stripping, permissions, deletion queues and storage failure handling.
- Creator profiles/social links, verification authorization/proof/history, reports, hide/restore and audit history.
- Private profile CRUD/conversion/concurrency; deterministic recommendation evidence, consent, privacy, bounds and request correlation.
- New published products, private/missing products, missing optional specs, exact comparison and case-insensitive global sorting.

### Failed intermediate checks — retained, not reclassified as passes

- Baseline typecheck and early workspace build failed on generated duplicate declarations. Early implementation build also caught a fixture test's obsolete direct `.reason` access after the attribute union changed; it was corrected without removing the validation assertion.
- An initial lint attempt included a quarantined generated directory while it was still inside the workspace. It was moved outside; lint rules were not relaxed.
- A subsequent build failed restoring malformed Turbopack persistent cache. Official cache-persistence settings and generated-artifact repair were verified by later consecutive builds.
- Strict unpublished HTTP 404 regression failed (200); layout fix made it pass. Its dependent comparison assertion also failed before setup completed.
- The first large option fixture used an illegal non-half-size value. PostgreSQL correctly rejected it; the fixture was changed to 205 distinct constraint-valid system/size pairs.
- Public review-image access after product unpublication failed (200); the parent visibility fix passed later.
- Brand ordering integration failed on mixed case; final ordering test passes. A malformed catalogue URL also failed its recoverable-validation assertion before the dedicated view was added.
- Admin history checks failed before the final router/state fix. A transient variable redeclaration in that edit was caught by the dev compiler and fixed; final typecheck/build are green.
- Browser setup/locator attempts also failed: initial helper variable error/connection refusal, unsupported CLI dynamic import, wrong account heading, incorrect Nike fixture count (10 versus 11), and missing waits for asynchronous router transitions. Corrected helper/CLI runner/locators/expectations are checked in. These first attempts are not claimed as passing. Failed helper resources were explicitly cleaned.

Local evidence is under `/tmp/bootverse-remediation-20261017/` (not portable release fixtures). Per-command logs retain failures alongside final passes. Browser scripts and their isolated setup are in the repository.

## G. Security report

Targeted review found no remaining confirmed Critical exploit in modified paths; this is not a penetration-test certificate.

- Catalogue SQL uses Prisma bound values and constant allowlisted order expressions, never client SQL/identifiers. Reads enforce publication; snapshot transactions prevent count/order inconsistency. Unsafe Markdown/HTML is not introduced.
- Product/review/media visibility and existing role/owner checks remain server-side. Test-only admin fixture is unverified until a captured local magic link is actually used, and exists only in a random disposable DB.
- Source URLs require public HTTPS syntax, reject credentials/sensitive query-key patterns, and render as escaped text/links with safe relationship attributes. App does not fetch arbitrary source URLs.
- Private FootProfile/input state stays out of public HTML/URLs/cache/logging. Manual Finder mode cannot silently save over an unloaded profile. Public reviews retain independent sharing/analysis controls.
- Storage default chain configuration does not expose credentials to the browser. Local S3 is tested; real task-role access and least privilege remain NOT TESTED.
- Client scan is limited to exact current private literals. Historical/encoded/revoked secrets and a complete Git-history/provenance scan are NOT TESTED.
- Runtime dependency audit is clean; development advisory remains. pg warning remains. CSP nonce/hash hardening, real HTTPS/proxy behavior and production cookie verification remain release tasks.

## H. Remaining deployment tasks

1. Confirm/reconcile Neon target and all pending history. Back up, restore-test, rehearse and obtain explicit migration approval. No auto-baselining or resets.
2. Resolve/explicitly accept the upstream development advisory under restricted CI controls; run the new workflow on GitHub after a user-approved push.
3. Select AWS runtime/network and review/pin image updates, container/OS scan, IAM secret delivery and private bucket policy. No cloud provisioning was done.
4. Verify actual sender/domain/deliverability, HTTPS/Auth origin/cookies, reverse-proxy header rewriting and prevention of direct untrusted access.
5. Configure cleanup scheduling/backlog alerts, logging retention, monitoring/SLOs, backup/PITR and rollback exercise. Health endpoints alone do not prove these.
6. Curate genuine product specifications/photos/scoped offers/manufacturer evidence. Current sample data must not be promoted as real product/fit evidence.
7. Define privacy retention/export/erasure, moderation staffing and creator ownership procedures. Self-reports/small cohorts do not establish physical fit or anti-Sybil guarantees.

## I. Updated readiness assessment

**Technical quality: 7.8/10, reviewer judgment.** The missing application workflows, exact product identity, publication boundary, regressions and reproducible local/container build coverage are substantially improved. Unresolved upstream/tooling and operational evidence prevent a stronger score.

**CONDITIONALLY READY for Phase 4 staging/deployment engineering. NOT READY or authorized for public production deployment.** Remaining High gates are non-local migration reconciliation, the full development advisory/release acceptance, and external production storage/email/security/backup/monitoring checks. Genuine product/evidence curation also gates launching a real-product fitting service. No Critical application exploit was confirmed; pg compatibility and the unidentified duplicate-file writer remain Medium follow-ups.

Cross-browser/device-lab, formal screen-reader/axe/WCAG certification, field LCP/INP/CLS, physical fit accuracy, real email/IAM/TLS/backups, OS image vulnerability scanning and full Git-history secret/provenance auditing are NOT TESTED. Browser community/review write forms were not all re-exercised in this remediation run; their real HTTP/DB CRUD/authorization regressions did run. No Phase 4 deployment was started.

## J. Next actions and manual acceptance

- [ ] Review the uncommitted change set and current report; approve a push separately if wanted.
- [ ] Close remote migration/backup/staging and dependency-risk gates before authorizing deployment.
- [ ] Run public DB catalogue filters/search/sorts, pagination and Back/Forward on localhost:3000; add/remove four exact variants and reload the comparison URL.
- [ ] In the disposable QA environment, confirm new published product details and sourced/unknown fields; use the checked-in browser commands for admin/Profile recovery.
- [ ] Rehearse actual production secrets, IAM, SMTP, TLS, backup recovery and scheduled maintenance using the runbook.
- [ ] Revisit pg adapter/client compatibility before any pg-major upgrade; do not suppress the warning.

Skills actually applied: `using-agent-skills`, `ponytail`, `incremental-implementation`, `test-driven-development`, `debugging-and-error-recovery`, `frontend-ui-engineering`, `ui-ux-pro-max`, `api-and-interface-design`, `security-and-hardening`, `code-review-and-quality`, `performance-optimization`, `observability-and-instrumentation`, `playwright`, `ci-cd-and-automation`, `shipping-and-launch`, and existing-connection guidance from `neon-postgres`. Their instructions were loaded; UI search informed layout/accessibility without replacing the existing minimal design. No subagent was spawned for remediation.

## Final acceptance / performance / file inventory

### Measured performance

Direct service calls against the original **read-only local** catalogue (8 sample entries, 7 variants, 0 reviews on the measured variant), macOS arm64 / Node 24.8 / local PostgreSQL. Each row: 3 warmups, 20 measured calls, concurrency 1, zero errors. These are local measurements, not cloud capacity or a claimed improvement over an unmeasured baseline.

| Service | p50 / p95 (ms) | SQL statements per call |
|---|---|---|
| Catalogue page | 4.64 / 5.79 | 11 |
| Filtered catalogue | 4.18 / 10.08 | 11 |
| Product detail | 1.25 / 1.57 | 8 |
| Compare one variant | 1.03 / 1.29 | 8 |
| Compare four variants | 0.99 / 1.72 | 8 |
| Review summary | 3.07 / 3.54 | 8 |

Comparison query count is constant from one to four variants. Product projection intentionally uses explicit relations; eleven catalogue statements warrant future profiling on realistic data, rather than speculative consolidation now.

The final isolated production-HTTP recommendation benchmark used 4 warmups, 32 measured requests and concurrency 4: 7 variants / 0 reviews took **7.83 / 11.00 ms** p50/p95; 100 variants / 2,000 persisted synthetic reviews took **72.04 / 81.75 ms**, both zero errors. An equivalent review-filter SQL probe took 8.659 ms execution / 0.44 ms planning for 2,000 rows; it is **not** the exact Prisma-generated query or the full request query count. No production memory, field Web Vitals or geographical latency claim is made.

### Browser acceptance

Real browser checks used an isolated random local database, private local S3 bucket and captured local SMTP, including a fresh magic-link sign-in and session reload. Final reusable catalogue/admin/profile commands passed after the final source change. Additional checks exercised search/filter intersections, pagination 12→3→12, empty/reset, four-item selection limit, remove/clear/reload/share, URL history, unpublished HTTP 404, invalid-filter recovery, manually entered unsaved Finder inputs, actual evidence-backed synthetic recommendations and exact detail/comparison links.

Twenty-eight page/viewport checks (seven routes at 375, 768, 1024 and 1440px) found no body overflow. Four-column comparison keeps horizontal scrolling inside its focusable labeled region; ArrowRight scrolling passed at 375px and the resulting screenshot was visually inspected. Mobile menu Escape/focus return passed. Synthetic fixtures are restricted to QA and were not presented as genuine public content. Deliberately induced 401/network/503 cases naturally produced expected browser errors; this is not a blanket zero-console-error claim.

### Evidence files

Final local logs in `/tmp/bootverse-remediation-20261017/`: `unit-final.log`, `build-repeat-1.log`, `build-repeat-2.log`, `types-final.log`, `integration-final.log`, `database-checks-final.log`, `audit-final.json`, `audit-runtime-final.json`, `browser-*-final.log`, `browser-viewport.log`, `browser-pagination-cap.log`, `query-benchmark-final.json`, `client-scan-final.json`, `docker-build-final.log`, `docker-runtime-final.log`, `docker-smoke-final.log`. Temporary logs are not permanent CI artifacts. Checked-in commands recreate the test environment.

### Changed-file inventory

Application changes remain uncommitted. The two old `src/app/boots/{page,loading}.tsx` files moved into `(catalogue)`; public URLs did not change. No lockfile, real secret or original audit content was modified.


Modified or moved/deleted paths:

- `.env.example`
- `README.md`
- `next.config.ts`
- `package.json`
- `prisma/schema.prisma`
- `scripts/import-catalogue.mts`
- `src/app/boots/[slug]/page.tsx`
- `src/app/boots/[slug]/reviews/new/page.tsx`
- `src/app/boots/loading.tsx`
- `src/app/boots/page.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/components/boot-card.tsx`
- `src/components/catalogue.tsx`
- `src/components/footer.tsx`
- `src/components/navbar.tsx`
- `src/components/platform/admin-dashboard.tsx`
- `src/components/recommendations/finder-client.test.ts`
- `src/components/recommendations/finder-client.ts`
- `src/components/recommendations/finder-results.tsx`
- `src/components/recommendations/finder.test.tsx`
- `src/components/recommendations/finder.tsx`
- `src/components/reviews/review-list.tsx`
- `src/components/sample-notice.tsx`
- `src/lib/boots/data.ts`
- `src/lib/boots/labels.ts`
- `src/lib/boots/types.ts`
- `src/lib/boots/validation.test.ts`
- `src/lib/community/http.ts`
- `src/lib/community/service.ts`
- `src/lib/foot-profile/validation.ts`
- `src/lib/platform/storage.ts`
- `src/lib/platform/targets.ts`
- `src/lib/recommendations/finder.ts`
- `src/lib/recommendations/service.ts`
- `src/lib/recommendations/types.ts`
- `src/lib/reviews/service.ts`
- `tests/auth.integration.ts`
- `tests/platform.integration.ts`
- `tests/recommendation-performance.integration.ts`

Created paths:

- `.dockerignore`
- `.github/workflows/quality.yml`
- `Dockerfile`
- `docs/BOOTVERSE_REMEDIATION_REPORT.md`
- `docs/catalogue-and-comparison.md`
- `docs/deployment-runbook.md`
- `prisma/migrations/20261017010000_catalogue_publication/migration.sql`
- `scripts/browser-qa.mjs`
- `scripts/browser-regressions.mts`
- `src/app/api/boots/route.ts`
- `src/app/api/health/live/route.ts`
- `src/app/api/health/ready/route.ts`
- `src/app/boots/(catalogue)/loading.tsx`
- `src/app/boots/(catalogue)/page.tsx`
- `src/app/boots/[slug]/layout.tsx`
- `src/app/boots/error.tsx`
- `src/app/compare/error.tsx`
- `src/app/compare/loading.tsx`
- `src/app/compare/page.tsx`
- `src/components/comparison/selection.tsx`
- `src/components/platform/admin-filters.tsx`
- `src/components/product-attribute.tsx`
- `src/components/product-offers.tsx`
- `src/lib/boots/comparison.test.ts`
- `src/lib/boots/comparison.ts`
- `src/lib/boots/product.test.ts`
- `src/lib/boots/product.ts`
- `src/lib/boots/service.ts`
- `src/lib/observability/failure.test.ts`
- `src/lib/observability/failure.ts`
- `src/lib/platform/storage-config.test.ts`
- `tests/browser-regressions.mjs`
- `tests/catalogue.integration.ts`

### Final runtime and cleanup

The final Linux container built successfully and ran as UID 1000 on Node 24.22.0. `/app/.env` and `/app/.local` were absent. Read-only smoke requests returned 200 for live/ready/catalogue/existing detail/comparison, 404 for a missing detail, and the recoverable invalid-filter view for `page=0`.

The owned container was stopped and its private temporary env file removed. The final browser helper confirmed removal of its own random database, S3 bucket and captured email; existing local infrastructure/data were preserved. The user's `npm run dev:local` is restored at **http://localhost:3000**. Home, catalogue, community, Finder, comparison and readiness each returned HTTP 200. The known pg deprecation warning remains visible. Final diff whitespace check passed; the lockfile and tracked private env files remain unchanged. No commit, push, remote migration or deployment was performed.

### Pre-push verification — 20 October 2026

User authorized pushing these changes. Unit tests again passed 226/226 and ESLint passed. Typecheck initially failed because duplicate generated declarations had reappeared in `.next/types` and `.next/dev/types`. Eight generated `* 2.ts` files were quarantined outside the repository; typecheck then passed without any source/compiler-rule changes. The underlying duplicate-file writer remains unresolved. No new build or integration run was performed for this push; the results above are the 17 October remediation runs. Staged credential checks found no private env files or actual configured secrets; the sole literal match was the credential-free localhost SMTP example.
