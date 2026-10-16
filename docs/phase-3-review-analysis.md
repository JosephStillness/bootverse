# Sprint 3.3 — Review-based fit analysis

This adds observational, self-reported community evidence to the private Sprint 3.2 preview. It does not predict shoe size, guarantee physical fit, certify a product, change recommendation ranking, or implement Sprint 3.4.

## Audit and prerequisites

At implementation audit, guarded local PostgreSQL contained **0 BootReviews, 0 FootProfiles and 0 RecommendationEvidence records**. All catalogue entries were sample configurations. Existing public sharing did not authorize analytical processing. Existing reviews have one optional length/width pair in cm, no review-specific instep/sensation or structured toe/heel/break-in categories. Hidden/spam moderation uses `HIDDEN`; suspended/unverified authors are ineligible. There is no separate “authentic experience verified” flag, and an active verified email is not proof of independent human identity or ownership.

Live results therefore cannot establish meaningful community fit conclusions. No reviews or curated product evidence were seeded into development or Neon. Synthetic cohorts are used only in disposable local test databases.

## Storage and consent

Additive migration `20261016010000_review_analysis_consent` adds default-off `analysisConsent`, server-generated `analysisConsentAt`, and optional `reviewInstep`, `reviewFitSensation`, `toeRoomCategory`, `heelLockdownCategory`, `breakInCategory`. It adds category/consent SQL checks and the `(variantId,status,analysisConsent,id)` index. Existing foreign keys and unique `(authorId,variantId)` remain authoritative. No tables, dimensions or historical data are replaced.

The review form describes the analytical purpose separately from public sharing. Analysis requires both flags, active consent timestamp, and the author's explicit maximum-measurement declaration. Existing reviews are excluded until their authors opt in. The timestamp records the first current opt-in; withdrawal clears it and reconsent records a new timestamp. Clients cannot submit timestamps. Editing without the flag defaults it off, which is privacy-safe for old clients. Save an edit to withdraw; deleting the review/account removes it from subsequent analyses. Completed responses are not retroactively erased from another user's screen, so rerun the preview after changes.

Reviewers' private `FootProfile` records are **never** queried or copied. Review-only traits are available through the existing owner-only edit API; they are not added to public author DTOs. Public sharing of dimensions remains the existing independent feature. Structured aggregate observations are not extracted from written reviews. No matching snapshots, histories, external AI calls or analytics datasets are created.

## Eligibility and exact product scope

Only persisted `PUBLISHED` reviews with both permissions, non-null consent time, active/email-verified authors with public profiles and valid structured ratings are considered. Disclosed sponsored reviews are excluded from this independent evidence pool; their existing public display is unchanged. Reports alone do not exclude content: a moderator must hide it or suspend the author. Deleted/nonexistent/hidden records are absent. The requesting user's own reviews are excluded.

One exact `BootVariant.id` anchors family, generation, tier and outsole through existing immutable relationships. Different IDs are never merged by name. Colorways share evidence only because the catalogue explicitly links them to the **same** variant; there is no inference of equivalence between variants. Sample catalogue configurations are excluded entirely from genuine product analysis.

Overall summaries cover all eligible worn sizes for that exact variant and are labeled accordingly. Similar cohorts additionally require a supplied requesting size/system and numerically equal worn size in the **same** system (`9` equals `9.0`; UK9 does not equal US9 or EU9). There is no automatic size conversion, gender/last equivalence, or size recommendation.

## Similarity formula

Pure code: `src/lib/recommendations/similarity.ts`. Inputs are mm. The requester's profile is normalized by Sprint 3.1/3.2; review cm values are multiplied by ten. Review precision remains 1 mm because stored cm use one decimal place. Broad existing profile guardrails apply (length80–400mm, width30–180mm); invalid values are unknown. An out-of-range historical review can remain in overall ratings but cannot match on dimensions.

Comparison requires both left/right lengths and widths for the requester and both valid review dimensions. Use maximum left/right length and maximum left/right width (potentially different feet). Opting-in review authors are told to record dimensions on this same basis. Previously stored unilateral/unspecified measurements are never silently grandfathered into analysis. Missing dimensions prevent similarity matching, without penalizing overall fit ratings.

Default experimental bands are ±5mm for each dimension. Weights are length0.40, width0.40, self-reported shape0.10, instep0.05, preferred fit sensation0.05. Dimension similarity is `max(0,1-abs(distance)/band)`. Categorical similarity is 1 for equal supplied traits, otherwise 0. `average` review shape maps to `Regular`; missing/Unsure categories are excluded from both numerator and denominator. No shape or instep is inferred from measurements.

`score = round(100 * sum(weight * similarity) / sum(shared weights))`. A reviewer is comparable only if both dimension distances are inside the bands **and** the rounded score is at least50. Bands/minimum score and weights are centralized. Completeness is the available comparison weight, not a medical data-quality measure. A score100 with missing categories does not establish full evidence coverage or shoe compatibility.

These are unvalidated search heuristics, not scientifically calibrated thresholds. Size labels do not encode gender-specific lasts; optional measurement dates/methods are not comparable across historical reviews. User preferences and manual measurements may be inaccurate.

## Aggregation, privacy and quality

Pure analysis: `review-analysis.ts`. Reviews are stably ordered by ID and deduplicated by ID and independent author within the variant. Edits contribute only once. Fit satisfaction and comfort are equal-author arithmetic means, rounded to one decimal; all original rating values remain in eligible distributions. No Bayesian prior, smoothing or popularity boost is applied.

Minimum publishable group size is **5**. Zero is reported as0; counts1–4 are `null` (withheld), with no means/distributions or profile similarity. Similar summaries/counts are also withheld if subtracting them from overall would expose a complementary group1–4. Each full categorical distribution is withheld if **any** nonzero cell, including `not-reported`, is smaller than5. Missing observations are counted explicitly, never inferred. This conservative policy supersedes descriptive one/two-person breakdowns to protect privacy.

Published similar-group mean similarity is rounded to the nearest10, without individual scores, measurements, review IDs, author IDs or links. Quality considers only released cohorts/breakdowns, so a hidden category cannot leak through a label:

- **Insufficient Evidence**: no releasable similar cohort.
- **Limited Evidence**: at least5 comparable reviewers, but thresholds/completeness/consistency below the next tier or protected fit/width breakdowns.
- **Moderate Evidence**: at least10 comparable reviewers, comparison completeness≥0.8, releasable fit and width distributions, no missing width reports, no disclosed conflict.
- **Stronger Evidence**: Moderate rules plus at least30 comparable reviewers and completeness≥0.9.

Conflicts are reported only from releasable distributions: fit satisfaction spanning at least2 stars or both narrow-side and wide-side width experiences. A conflict prevents Moderate/Stronger labels. These labels describe internal observational coverage, not probabilities or scientific confidence. Five agreeing people can still be wrong. Missing foot dimensions never count as a match. Lack of structured observations is not evidence of lack of a problem.

Small-cohort suppression is **not differential privacy**: repeated profile edits, colluding accounts and prior knowledge can still permit inference. Existing per-user database-backed limits bound requests (20 per15 minutes), but cannot prove identity or prevent all Sybil attacks. Before wide release, assess consent UX, population sizes, inference risk and abuse monitoring. Do not present withheld counts as zero.

## Query and API contract

Existing `POST /api/boot-fit/recommendations` remains owner scoped. No client user IDs, candidate IDs, weights or raw reviewer inputs are accepted. Existing same-origin, active-authentication,32KiB body limits, database rate limits and private/no-store responses remain in place. Owner consent/version are rechecked under existing user locks. A repeatable-read transaction provides a consistent product/review snapshot.

Each returned result gains optional `reviewAnalysis` with policyVersion, variantId, caller's size scope, counts, separate overall/similar summaries, rounded similarity, qualitative quality, conflicts, warnings and explanation. The pure Sprint 3.2 engine can still return unenriched results. Surface-incompatible products remain excluded **before** enrichment. No scores or ranking inputs are changed by reviews.

`review-query.ts` reads only eligible reviews for the returned nonsample variants in one bounded batch (max2001 rows). It groups once in memory, avoiding per-candidate queries. If more than2000 rows are encountered, **all** affected non-sample summaries are withheld with an overflow notice rather than publishing selected partial counts. No huge review bodies, private profiles or helpful-vote lists are fetched. Scaling beyond this bound requires privacy-reviewed database aggregation/partitioned retrieval; silently increasing the limit is not a solution.

The minimal `/boot-fit/preview` disclosure shows actual counts, labels, means and safe similar-cohort category counts; no fabricated charts. It distinguishes overall sizes from the exact-size similar pool. The existing review form exposes consent and optional structured fields using accessible labels and validation. Full finder UX remains Sprint 3.4.

## Local setup and verification

1. Use the existing ignored `.local/development.env` profile, with loopback PostgreSQL/SMTP/storage endpoints. Never paste credentials into reports.
2. `npm run db:generate`, then `npm run db:local` applies pending additive migrations to that guarded local database. Neon/production migrations require separate review/approval and were not applied here.
3. `npm run dev:local`; sign in via local captured magic link. Save your private foot profile with both feet's optional dimensions, a worn size/system, and explicit own-Fit-Finder consent.
4. Edit your own review: public sharing alone remains insufficient. Read and enable the analytical checkbox only when appropriate; optional structured categories are independent of free text. Save, reload the edit form and verify settings persist. Uncheck/save to withdraw.
5. Run `/boot-fit/preview`. With current sample catalogue/zero live reviews, expect withheld sample analysis and **no fit claim**. Genuine non-sample cohorts need authorized persisted reviews and applicable exact-variant metadata. Never mark samples real merely to populate the UI.
6. In an isolated test environment only, synthetic cohorts exercise sufficient evidence, small groups, withdrawals, moderation and overflow. `npm run test:platform:local` provisions and removes its own database and private storage bucket. Never run fixture writes against development/production data.

Test outcomes and browser verification are recorded in the completion report. A prior pg concurrency deprecation warning remains a platform/harness limitation; it is not hidden as a clean warning-free run.

## Completion record — 16 October 2026 (Sydney)

| Check | Executed result |
| --- | --- |
| `npm test` | PASS:172 tests in15 files;0 skipped |
| `npm run test:platform:local` | PASS:64 tests;0 failed,0 skipped; fresh local DB/private bucket removed |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; local production compilation, no deployment |
| Prisma `validate` | PASS |
| Prisma `migrate status` against guarded local configuration | PASS:11 migrations applied |
| Prisma schema drift comparison | PASS:No difference detected |
| `git diff --check` | PASS |
| `npm audit --omit=dev` | PASS:0 reported vulnerabilities |
| Full `npm audit` | FAIL:5 pre-existing High tooling dependency findings (`braces`, `micromatch`, `fast-glob`, `@next/eslint-plugin-next`, `eslint-config-next`); no dependency versions changed |
| Playwright | PASS:real local magic-link sign-in, private profile save,10 eligible/5 similar synthetic cohort with correct means, default-off consent, missing-sharing validation, review create/edit/reload/withdrawal |
| Responsive browser checks | PASS:preview320/768/1024/1440px;form320/768/1440px, no horizontal overflow;mobile screenshots visually inspected |
| Browser console | Observed0 errors and0 warnings in the tested successful QA session |

New unit coverage:similarity/exact and near distances/missing dimensions/traits/cm normalization/invalid values;eligible/hidden/deleted-status/spam-moderated/inactive/sponsored/missing-permission reviews;variant/size/system integrity;duplicate edits;zero/small/large/conflicting cohorts;actual means/distributions;quality thresholds;small-cell/complement suppression;bounded overflow;no identifiable DTO fields. Existing surface/scoring suites remain unchanged and pass.

New real database/API coverage:server-owned consent timestamps and SQL constraints;ownership rejection;actual exact-variant cohorts;own-review exclusion;surface-denial precedence despite community evidence;withdrawal;hidden/suspended authors;different size systems;account/review deletion;2000-row scan fail-closed. The existing suite also covers anonymous access, forged owner input, CSRF origin checks,shared rate limits,profile consent and previous catalogue/community/review/storage/authentication features.

Initial attempts are not hidden:the first integration run had60 passes and4 failures (including its parent), caused by new fixture parameter types and overbroad fixture rate-limit cleanup. The fixtures now cast SQL parameters and reset only their review-specific buckets;the final rebuilt-app run passed64/64. Initial typecheck encountered duplicate gitignored generated `.next` declarations;only those duplicated generated files were removed and typecheck rerun successfully. A browser automation attempt used a click on a native `<option>`;using `selectOption` completed the real workflow. These were verification/setup issues, not silently suppressed production tests.

Targeted self-review checked correctness,privacy,authorization,variant identity,bounded query behavior,explicit output projection,UI state handling and maintainability. It added a direct-call scan bound with a failing-then-passing test. The SQL migration is additive/default-off;no production/Neon migration,reset,deployment,secret changes or synthetic live-data writes occurred. Existing uncommitted Sprint3.2 work is preserved.

### Sprint3.3 files

New:
- `src/lib/recommendations/similarity.ts`, `similarity.test.ts`
- `src/lib/recommendations/review-analysis.ts`, `review-analysis.test.ts`
- `src/lib/recommendations/review-query.ts`
- `tests/review-analysis.integration.ts`
- `prisma/migrations/20261016010000_review_analysis_consent/migration.sql`
- `docs/phase-3-review-analysis.md`

Extended:
- `prisma/schema.prisma`
- `src/lib/reviews/validation.ts`, `service.ts`, `reviews.test.ts`
- `src/components/reviews/review-form.tsx`
- Existing pending Sprint3.2 `src/lib/recommendations/service.ts`, `types.ts`, `src/components/recommendations/preview.tsx`
- `tests/auth.integration.ts`, `README.md`, `tasks/plan.md`, `tasks/todo.md`

### Sprint checklist and readiness

- [x] Audit real data and missing consent dependencies.
- [x] Deterministic mm-based reviewer similarity with optional self-reported traits.
- [x] Exact variant and same-size similar-cohort integrity.
- [x] Real persisted review aggregation with distinct overall/similar pools.
- [x] Explicit permissions,withdrawal,moderation and private output projection.
- [x] Descriptive quality/conflict/missing-data handling and small-group protection.
- [x] Existing API/minimal preview integration without score or surface-gate changes.
- [x] Isolated automated/browser tests and documentation.
- [x] Preserve previous sprints;do not begin Sprint3.4 or deploy.

**Ready to begin Sprint3.4 interface work:yes**, within this experimental contract. **Ready to make validated fit claims or broadly launch: no**. There are no real eligible local reviews, catalogue products remain samples, measurement methods are self-reported, small-group suppression is not a formal anonymity guarantee,and scan overflow intentionally withholds evidence. The pg concurrency deprecation warning remains untraced in the wider existing runtime/test stack. Resolve tooling advisories,review privacy/anti-abuse requirements for public launch,and evaluate the heuristics against genuine authorized evidence before treating outcomes as dependable personal fit guidance.

Skills actually loaded/applied across this implementation:planning-and-task-breakdown,api-and-interface-design,test-driven-development,security-and-hardening,incremental-implementation,frontend-ui-engineering,playwright,code-review-and-quality,and ponytail. No claim of a measured production performance optimization:query/data bounds and isolated behavior were verified;load testing and scientific calibration were not performed.
