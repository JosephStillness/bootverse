# Sprint 3.2 checkpoints

- [x] Pure engine contracts, evidence parsing, deterministic ranking and unit tests.
- [x] Additive evidence storage, scoped candidate loader and consent-gated API; isolated integration tests.
- [x] Minimal authenticated preview and account integration, with honest evidence gaps.
- [x] Prisma/typecheck/lint/unit/integration/build checks, browser smoke test and security review.
- [x] Documentation, current-catalogue example and readiness/limitations report.

Verification: 149 unit tests, 60 isolated integration tests; lint/typecheck/Prisma/build and browser QA pass. See docs/phase-3-recommendations.md for evidence gaps, failed-attempt history and production limitations.

# Sprint 3.3 checkpoints

- [x] Pure similarity/aggregation/quality tests and implementation.
- [x] Review analytical consent, structured fields, safe additive local migration.
- [x] Bounded query and existing recommendation/preview integration.
- [x] Isolated integration and browser tests, all quality checks, targeted review.
- [x] Documentation and completion/limitations report.

Sprint 3.3 verification:172 unit tests and64 isolated integration tests passed;Prisma/local migrations/drift/typecheck/lint/build/browser checks passed. Runtime audit0;full audit retains5 pre-existing High lint-tooling findings. See docs/phase-3-review-analysis.md.

# Sprint 3.4 checkpoints

- [x] Strict transient recommendation contract and tests; saved mode regression.
- [x] Guided finder form, explicit processing/save choices and validation.
- [x] Result cards, evidence panels, supported refinements, catalogue/review integration and navigation.
- [x] Isolated integration/browser tests, accessibility/responsiveness/security review and all checks.
- [x] Documentation, checklist, limitations and readiness report.

Sprint 3.4:187 unit tests and68 isolated integration tests passed. Lint/typecheck/build/Prisma and final browser keyboard/responsive journeys passed. Compare is a documented pre-existing gap;5 High lint-tooling advisories and pg warning remain. See docs/phase-3-finder-ui.md.

## Sprint 3.5
- [x] Audit actual pipeline, existing tests, product identity constraints and known gaps.
- [x] Synthetic scenarios A–J, stale/conflicting evidence and deterministic reversed-input checks.
- [x] Reproduce and fix stalled recommendation UI; bounded 20-second read request timeout.
- [x] Allowlisted error categories, generated request IDs and opt-in stage timing; fault-injection and privacy assertions.
- [x] Reproducible bounded pure and isolated HTTP benchmarks; no speculative optimization or private caching.
- [x] Unit/integration regressions, production build, typecheck/lint, Prisma validation/status/drift and dependency audits.
- [x] Complete browser QA cleanup and publish the documented readiness assessment.

# Data D1 checkpoints

- [x] Audit identity, provenance, publication, offers and storage; record mappings and scope.
- [x] Add tested validation/quality/transition contracts.
- [x] Add Prisma schema and transactional additive migrations; test legacy preservation and conflict preflight on disposable DBs.
- [x] Implement authenticated source/product/claim/image/offer services and bounded admin APIs.
- [x] Integrate sourced specifications and expanded catalogue outsole categories without relaxing Finder surface rules.
- [x] Run unit/integration/schema/migration/type/lint/build and query-plan checks; review security and compatibility.
- [x] Complete docs/DATA_D1_SCHEMA_SOURCE_REGISTRY_REPORT.md with actual outcomes and D2 readiness.

D1: 247 unit tests and91 isolated integration/performance tests pass; lint/typecheck/Prisma/build, four browser regressions and local Docker smoke pass. Both additive migrations applied only to guarded localhost after private backup and isolated restoration. Fourteen migrations/checksums/constraints/triggers/drift pass; 8 entries/1 user/0 reviews and existing identities/URLs/specifications preserved. Full/runtime dependency audits0. No Neon migration, deployment, push or D2 work. See the D1 report for earlier failed attempts and remaining limits.

# Data D2 checkpoints

- [x] Canonical schemas, bounded CSV/JSON parsing, normalization and malicious-input tests.
- [x] Read-only deterministic identity/duplicate/conflict preview and tested adapter contract.
- [x] Additive tracking migration and atomic idempotent import services with isolated reliability tests.
- [x] Secure ADMIN preview/execute/history/report UI and endpoints; no remote writes or auto-publication.
- [x] Synthetic 10/100/1,000/5,000 measurements, regression/browser/security review and all quality checks.
- [x] Templates, canonical fixtures, usage/mapping guide and completed D2 report with actual results.

# Data D3 checkpoints

- [x] Inspect D1/D2 and document actual prerequisites.
- [x] Test normalization, explicit unknowns, contextual conflicts and quality/freshness rules.
- [x] Extend observation/asset metadata safely and private product uploads.
- [x] Implement exact-target, signed preview and atomic idempotent batch enrichment.
- [x] Integrate sourced public attributes/images, admin workflow and reporting.
- [x] Run isolated regressions, browser tests, measurements and security review.
- [x] Complete DATA_D3_ENRICHMENT_REPORT.md; no D4 work.

D3: 311 unit/component tests (34 files), 117 isolated integration/security/storage/performance tests and six relevant browser suites pass. Lint, named post-build typecheck, build, Prisma and audits pass. D3 complete local workflow includes licensed asset review and public projection. Persistent local DB remains 14 migrations, 8 sample products/1 user/0 reviews; D2/D3 activation migrations are deliberately pending. No Neon migration, deployment, push or D4/D5 work. See docs/DATA_D3_ENRICHMENT_REPORT.md.
