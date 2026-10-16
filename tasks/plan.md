# BootVerse Sprint 3.2

Approved scope is the supplied Sprint 3.2 specification. No follow-on sprint, deployment or cloud provisioning.

1. Audit current catalogue/profile contracts. Current products are samples, with no verified prices, inventory or fit evidence; preserve this uncertainty.
2. Pure deterministic engine: normalize private inputs, gate surface using exact-variant manufacturer evidence, rank known preference factors independently of coverage, bounded stable output. Test synthetic evidence only in isolated fixtures.
3. Add the minimum provenance table because existing product tables have no evidence/source/freshness storage. Reuse variant/user models; no profile snapshots/history. Local additive migration only.
4. Authenticated consent-gated POST service, bounded indexed queries and a minimal preview page. Never accept client owner IDs or evidence.
5. Full regression checks, real local database/API tests, targeted browser QA, security review and documentation. Record gaps, not fabricated recommendations.

Risks: generic surface guidance differs between brands; require exact product approval. Prices and inventory need exact colorway/size scope and freshness. Community observations remain qualitative until Sprint 3.3. With present sample data, zero eligible recommendations is the correct result.

# Sprint 3.3 — Review-based fit analysis

Approved scope: supplied Sprint 3.3 specification. Preserve the pending Sprint 3.2 changes.
Audit: local PostgreSQL has 0 reviews, 0 foot profiles and 0 curated evidence. Public sharing is not analytical consent. Existing review measurements are single cm values; no review-specific instep, sensation or structured toe/heel/break-in categories. Hidden reviews and suspended authors are already excluded. No live evidence can currently support conclusions.

1. Test and implement pure similarity, exact size/variant eligibility, privacy suppression and transparent evidence quality. No ranking changes.
2. Add explicit default-off review analysis consent and structured optional observations; extend existing review CRUD/form, additive migration only against guarded local database.
3. Attach bounded analysis to the existing private recommendation API and minimal preview. No reviewer FootProfile queries or histories.
4. Run isolated integration/browser regressions, Prisma, typecheck, lint, tests and build. Document formulas, limitations and setup. No cloud migration/deployment.

Privacy: match the maximum length and maximum width across both requester feet to explicitly opted-in review measurements recorded on the same basis. Require same numeric worn size and size system for similar groups; unknown size cannot match. Suppress groups under 5, complementary groups under 5, and distributions containing small cells. Bound scans and withhold analysis on overflow, rather than presenting biased partial aggregates. Self-report cannot establish scientific fit or authenticity.

# Sprint 3.4 — Boot Fit Finder

Scope: supplied Sprint 3.4 UX specification; no Sprint 3.5/deployment/new cloud resources.
Audit: saved-profile/recommendation/review-analysis services exist. The recommendation endpoint is authenticated and saved-consent-gated, with no guest mode. Catalogue contains only samples, no verified photos/prices/fit evidence. Comparison is explicitly unimplemented in existing docs/code; do not invent a dead Compare route or claim it works.

Design contract: preserve Geist and existing monochrome tokens. A concise left-aligned hero, four numbered steps in a white form surface, explanatory side rail on desktop/stacked on mobile, persistent accessible back/continue controls, separate eligible and unverified results, expandable evidence panels. No fabricated metrics, decorative gradients or animations. All personal state stays in component memory, never URLs/storage/analytics. Use existing profile endpoints, strict recommendation normalization, measurement guide, Input and Button.

1. Add tested strict per-request preference contract to existing authenticated recommendation endpoint (explicit processing consent, no persistence); preserve old saved-profile mode, surface gates and scores.
2. Guided input state/validation/normalization and optional explicit save merge using existing concurrency tokens; retain unrelated saved fields and clear stale measurement-method context when measurements change.
3. Public finder landing and guest limitation; authenticated preload, four steps, real results/explanations/filtering and catalogue/review links. Do not add unsupported comparison actions.
4. Isolated API tests, browser desktop/mobile/keyboard/privacy/error journeys, complete lint/typecheck/tests/build and targeted review. Document remaining limitations and actual checks.

# Sprint 3.5 — Validation and stabilization

1. Audit actual Sprint 3 contracts, data uncertainty, privacy and operational gaps; preserve all pending work.
2. Reproduce defects before fixes, run deterministic synthetic scenarios A–J, and bounded pure/HTTP benchmarks before considering optimization.
3. Add allowlisted recommendation diagnostics and correlation IDs; retain no inputs, identities or error messages. Test failures and timeouts.
4. Run isolated PostgreSQL/S3/SMTP regressions, Prisma checks, production build and responsive browser journeys. Record exact results and unresolved blockers in docs/phase-3-validation.md.

Operational questions: which request failed, was it auth/validation/rate-limit/database/service, and was time spent before or inside recommendation generation? No external monitoring or private shared cache.
