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

# Data D1 — Product schema and source registry

Approved scope: the supplied D1 specification. No crawling/import pipeline, cloud writes, deployment or push. Existing checkpoints above are complete.

1. Preserve the six existing product identity tables and stable public slugs. Add optional brand metadata, variant construction/designation, scoped SKU records, structured source-backed claims and image metadata referencing existing uploads.
2. Add a source registry with documented access permission separate from source classification. New claims start unverified; administrative verification is source checking, not scientific certification. Keep recommendation safety evidence separate.
3. Add a lifecycle beside the legacy publication boolean. A compatibility trigger keeps them consistent for existing trusted import/SQL callers; the admin service validates readiness and locks public slugs. No automatic draft publication.
4. Add reusable strict Zod contracts, quality reports, source CRUD and bounded admin product inspection/mutations. Use existing auth, origin/body/rate guards, recheck admin role inside transactions and record decisions in the existing audit trail. D4 bulk approval UI is deferred.
5. Test one additive migration on empty and pre-D1 disposable localhost databases. Preserve old JSON specifications as documented legacy data; never relabel them as new verified provenance. Offers reuse RecommendationEvidence with optional relational source/entry/region links; regional offers do not silently enter regionless Finder decisions.
6. Execute regressions, database/index checks, build and D1 report with mappings, Mermaid, transition rules, migration rollout and honest limitations. After disposable rehearsals, back up and preflight the explicitly guarded localhost development DB before applying this additive local change. Never migrate the configured Neon or other remote target automatically.

Risks: existing duplicate brand names must stop the migration, not be merged/deleted. A source's permission is not product authenticity. Colorways share a variant only by explicit curation; different constructions can use different variant IDs even with identical tier/outsole labels. Product images are metadata associations, not a new upload/storage implementation. Legacy publication/specification write compatibility remains until a later audited migration.
