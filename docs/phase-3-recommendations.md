# Sprint 3.2 — Deterministic recommendation engine

Implemented locally on 15 October 2026. Rule version **3.2.0**. This is experimental preference ranking, **not a scientifically validated foot-fitting system**, fit probability or a recommendation to purchase without checking the exact boot and pitch. No AI/ML, statistical review learning, affiliate ranking, live FX, recommendation history or private profile snapshots were added. Sprints 3.3–3.5 are not implemented.

## Audit and actual data availability

- Phase 1 public pages use validated TypeScript sample fixtures; PostgreSQL holds the corresponding catalogue identities for community/review relationships. Eight colorway entries represent **seven exact outsole variants**. There is no comparison tool in this repository.
- Identity is brand → family/silo → generation → tier → outsole variant → colorway entry. Prices/inventory must additionally match an exact colorway entry and, when supplied, sizing system/size.
- All existing catalogue configurations are explicitly fictional samples. There are no verified manufacturer specifications, interior dimensions, size charts, current offers, inventory or authoritative product fit records. Existing community reviews remain opinions, with their separate measurement-sharing policy.
- Sprint 3.1 has private, owner-scoped bilateral measurements and preferences; its CRUD, privacy and concurrency regressions remain in the integration suite.

**Current real catalogue example:** the preview and API evaluated 7 variants and returned **0 eligible, 7 unverified, 0 excluded**. Unverified entries include `future-pro-ag` and `f50-elite-unknown`; their price is null, availability unknown and preference score null. They are not recommendations. No evidence records or synthetic prices/fit claims were inserted into development/Neon for demonstration.

The public catalogue is still fixture-backed. Before introducing real product records, coordinate the existing public catalogue/detail publishing path with PostgreSQL identities and verify each detail URL. This sprint does not replace the catalogue architecture or add an importer/admin UI for real products.

## Architecture and changed files

Pure logic is in `src/lib/recommendations/`:

- `types.ts`: normalized preferences, exact candidate identity, provenance, output contracts.
- `normalize.ts`: reuse Sprint 3.1 validation and exact cm/mm conversion; no shoe-size or width-category inference.
- `config.ts`: rule version, normalized preference weights, freshness windows, limits, manufacturer host allowlist and surface policy references.
- `evidence.ts`: strict typed payloads, public HTTPS source URLs, timestamp/freshness validation and colorway/size scope matching. URLs are never fetched.
- `eligibility.ts`: surface safety gate, exact scoped price/currency and inventory assessment.
- `scoring.ts`: supported preference factors, known-factor score and separate evidence coverage.
- `engine.ts`: deterministic deduplication, gate/evaluate/score/explain/sort/bound pipeline. No database, clocks or UI dependencies; callers provide `asOf`.
- `service.ts`: PostgreSQL candidate/evidence projection, private profile normalization, current consent/privilege checks and bounded retrieval.
- `engine.test.ts`, `evidence.test.ts`: synthetic, explicitly test-only evidence fixtures and regressions.

Additional changes: additive Prisma table/migration, `src/app/api/boot-fit/recommendations/route.ts`, minimal `/boot-fit/preview` page/loading/error, `src/components/recommendations/preview.tsx`, account navigation, current Foot Profile consent copy, `tests/recommendations.integration.ts` and its lifecycle harness hook. `tasks/plan.md` and `tasks/todo.md` record the scoped implementation/checkpoints. No dependencies or environment variables were added.

## Surface eligibility policy

General references consulted:

- [Nike Football Footwear Guide](https://www.nike.com/au/football/shoe-guide)
- [adidas field-surface guide](https://www.adidas.com.au/blog/867677-how-to-buy-football-studs-fit-features-field-surface)

These distinguish natural grass, soft ground, artificial grass, short turf and indoor courts. Broad guidance and product classifications can differ; a generic brand guide is **not** evidence that a specific model/generation/tier/outsole is safe on every pitch.

| Outsole → selected surface | Default policy |
| --- | --- |
| SG → FG/AG/TF/IN | Excluded conservatively |
| SG → SG | Needs exact-variant manufacturer evidence |
| FG/AG/TF/IN → any surface | Unknown unless exact-variant manufacturer evidence explicitly permits it |
| Missing selected surface/outsole | Unverified, never ranked |
| Sample product | Unverified regardless of supplied evidence |

Approved manufacturer evidence must match the candidate's outsole and official brand host. Explicit denials win over approvals. Missing, stale, future-dated, malformed, wrong-brand or incomplete evidence never establishes eligibility. A matching AG label alone does not grant approval; FG→AG is never universally assumed. Manufacturer/pitch rules still need checking by the user.

Surface contributes **zero preference points**: it is a prior gate. Incompatible products are excluded; unknown products are listed separately as unverified with no preference score. A compatible result is evidence of the cited surface use, not a physical-fit guarantee.

## Scoring, coverage and tie-breakers

Remove the proposed 30 surface points and normalize the remaining experimental 70:

| Factor | Relative points | Normalized weight | Assessment |
| --- | ---: | ---: | --- |
| Budget | 25 | 25/70 | Within = 1; near = 0.5; over = 0; missing/invalid currency scope = unknown |
| Fit sensation preference | 25 | 25/70 | Exact preference comparison with a cited manufacturer description or editorial description with methodology |
| Preferred brand/tier | 15 | 15/70 | Average matches over only the requested brand and/or tier criteria |
| Other preference: snugness | 5 | 5/70 | Cited preference description, same source rules as fit sensation |

Near-budget means no more than 10% over the budget (experimental policy, not a recommended spending increase). Prices are original-currency listing amounts, not a guaranteed final checkout total. No shipping/tax or live FX assumptions are made. A verified foreign-currency price can be shown but its budget comparison remains unknown. Missing price is null, never zero; a genuinely sourced zero price remains distinguishable from missing data.

`score = 100 × Σ(known requested weight × match) / Σ(known requested weight)`.

`coverage = 100 × Σ(known requested weight) / Σ(all requested supported factor weights)`.

No known requested factor means a null score; no supported requested factors means zero coverage. Unknown is not a mismatch or a positive match. A 100 preference score based only on a requested brand can have very little supporting coverage when budget/fit preferences are also requested. Coverage describes **these supported requested factors**, not complete product knowledge or physical-fit certainty. Foot length/width, shape, instep, arch, toe/heel preferences and playing position do not create points or exclusions without an implemented validated matching methodology.

Rank eligible products by preference score descending (null last), coverage descending, then exact variant ID in locale-independent code-unit order. Identical duplicate rows collapse; conflicting identities for the same variant fail loudly. Evidence sorts newest first, then stable evidence ID. No randomness or popularity/creator boosts.

`evidenceConfidence` is descriptive: none when no usable source exists; documented when surface is established and all requested supported factors are covered; otherwise limited. It is not calibrated confidence, fit accuracy or independent-source verification. `physicalFit` always remains `unknown` in this sprint. Community fit observations can be displayed with provenance but never train, aggregate or automatically score fit.

## Evidence storage and operator workflow

Migration `20261015040000_recommendation_evidence` creates only `RecommendationEvidence`, linked by FK to the exact `BootVariant`. This table is necessary because existing catalogue models have no provenance/freshness storage. Fields: kind, source kind, public source URL, observed time, valid-until time, typed JSON payload, approval flag (default false), UTC created/updated timestamps. Composite `(variantId, approved, observedAt)` index supports scoped retrieval. SQL constraints enforce kinds, timestamp ordering, HTTPS shape, object payload and a 16 KiB payload bound. Runtime Zod additionally validates the full payload, URL credentials/secret parameters, currency and scope.

Only trusted operators can curate records through server-side Prisma/database tooling; **no public or creator evidence-write/approval endpoint exists**. A database approval flag is an operator's assertion, not automatic factual verification. Before approving:

1. Verify a real product's exact generation, tier and outsole identity. Never relabel the current fictional sample fixtures as real products merely to obtain recommendations.
2. Read the public source and confirm the claim is about that exact variant. Generic family/brand copy must not become a model-specific surface or fit claim.
3. Record actual source/time/expiry and the required payload. PRICE and AVAILABILITY require exact entry ID; sized evidence requires the original size and sizing system. Do not copy prices across colorways or convert size systems.
4. Review methodology for editorial fit descriptions. Community opinions and verified physical measurements remain separate source kinds; measurements are not automatically converted into subjective fit labels.
5. Keep records unapproved until review is complete. Retire/expire superseded or conflicting evidence, and retain source provenance according to the operator's data policy. No private Foot Profile data belongs in this table.

Payload shapes (all values below describe schema, not actual product facts):

- SURFACE: `{outsole, allowed: Surface[], denied: Surface[]}`; manufacturer source only establishes eligibility.
- PRICE: `{entryId, amount: decimalString, currency: ISOCode, size: decimalString|null, sizeSystem: UK|US|EU|CM|null}`. Size/system are a pair. Unsized offers do not prove a supplied size's price; sized offers are not generalized when no size is supplied.
- AVAILABILITY: `{entryId, available: boolean, size: decimalString, sizeSystem}`; only fresh exact size/system stock is classified available/unavailable. Otherwise availability is unknown.
- FIT: `{attribute: fitSensation|snugness, value, observation, methodology: string|null}`. Manual cited descriptions only; no automated review statistics.

Freshness requires `observedAt ≤ asOf < validUntil`, plus age limits: price 7 days, inventory 1 day, surface/fit 365 days. Malformed active evidence or more than 32 active records leaves the whole variant unverified, avoiding a partial assessment that might omit contradictory evidence.

To add an attribute: define its unit/scope/provenance, extend the discriminated payload contract and projection, implement pure validation/eligibility/scoring only where justified, add tests and bump the rule version. Do not overload a family field with variant-specific data. To adjust weights: edit `config.ts`, maintain normalization, update exact-weight tests and documentation, bump rule version. To add a manufacturer source: verify its official domain and applicability, update the explicit host registry and tests; never wildcard arbitrary domains or fetch client URLs.

## API, privacy and bounds

`POST /api/boot-fit/recommendations`, JSON `{limit?: 1..20}` (default 10). No owner IDs, raw measurements, evidence or client weights accepted. There is no guest mode. Requirements: active verified Auth.js session, same-origin request, bounded JSON (32 KiB), shared PostgreSQL/HMAC rate limit (20 attempts per 15 minutes), saved own Foot Profile and explicit `allowFitFinder` consent/time.

The service rechecks current account privileges, profile generation/version and consent under a transaction/User share lock; existing Foot Profile updates acquire that user's update lock. Revoked or changed settings cannot silently be reused. Responses/errors are private/no-store and vary by cookie; private foot dimensions, profile IDs, consent tokens and user IDs are not returned or logged. No history is persisted and no third party receives the profile. Foot Profile consent copy now explains the current experimental preview, retaining the same private purpose.

Output: rule version/as-of, eligible results, separately unverified results, assessed counts, truncation flag and notices. Each item identifies exact variant/generation/tier/outsole/colorway, scoped price and availability, factors, preference score/coverage, qualitative fit observations, missing data, cautions and source references.

Limits: scan 100 variants in stable ID order, load at most 33 evidence rows to detect overflow, and return at most `limit` items in **each** eligible/unverified section. One canonical colorway per variant is selected (non-sample first, then entry ID). Evidence from other colorways is not borrowed. Scans are explicitly marked nonexhaustive when capped. Queries use explicit projections and bounded relations; no per-result database loop or shared private-result cache was introduced. Larger catalogues will need a deliberate candidate retrieval/pagination design rather than silently raising limits.

Statuses: 400 invalid input/query IDs, 401 anonymous, 403 missing consent/inactive/unverified/invalid origin, 409 missing/changed profile, 413 oversized request, 429 rate limit, 503 service unavailable. No mutation or public evidence ingestion is implied by POST; it evaluates an authorized snapshot.

## Verification and limitations

Executed on the final implementation:

- Unit suite: **149 passed** across 13 files, including 17 new recommendation/evidence cases. Exact conversion, hard gates, absent/stale/future evidence, same-currency comparisons, foreign-currency display, size/colorway scope, availability, weights, missing factors, conflicting evidence, stable ties, duplicate identity handling and bounds.
- Full real HTTP/PostgreSQL/SMTP/private-S3 integration suite: **60 passed**, 0 skipped. Five new recommendation scenarios cover auth/consent, actual DB sample results, approval/provenance/scoping, private output/no profile mutation, revocation, strict input/body limits and shared rate limiting. Positive evidence exists only in the disposable database, with explicitly synthetic sources; fixtures are removed afterward.
- Prisma validation, 10 local applied migrations, schema diff/no drift, TypeScript, ESLint and production build pass. Before/after hashes prove existing users/profiles/community/reviews/catalogue were unchanged by the additive local migration. No Neon migration, reset, paid resources or deployment occurred.
- Playwright: actual local magic-link sign-in, missing-profile/consent denials, enabling consent through Foot Profile UI, real sample-only results and 320/768/1024/1440px layout checks without horizontal overflow. No JavaScript page errors were observed in the successful preview path. Deliberately denied 409/403 requests appear as resource errors in the console and are not hidden.
- One integration assertion initially failed because Next.js appends its own Vary fields; it now checks that Cookie is present, and the full suite was rerun. Red tests proved missing-evidence bounds and foreign-currency display fixes. A review mutation removing the currency-equality guard caused failures; restoring it passed.
- Runtime dependency audit: zero advisories. Full audit retains five existing high ESLint transitive glob findings; forced remediation would downgrade Next lint config, so it was not applied. Review compatible fixes by 22 October 2026. Existing pg concurrency deprecation warnings remain.

Not verified: real product evidence accuracy (none is currently available), live pricing/inventory/FX, production load/latency, cross-browser/screen-reader testing or a production backup/restore exercise. No performance speedup or fit accuracy is claimed. The evidence curation UI, full Fit Finder UI and review statistical analysis are intentionally outside this sprint.

## Run and manual checks

```sh
npm run db:local
npm run dev:storage
npm run dev:mail
# Another terminal:
npm run dev:local
# Build before the isolated integration suite:
npm run build
npm run test:platform:local
```

1. Sign in and open Account → Recommendation engine preview (`/boot-fit/preview`). Without a profile or private-use consent, Run must explain the missing requirement.
2. Save a private profile, optionally select AG/budget/brand/fit preferences and explicitly enable private Fit Finder use. Run again; the current sample catalogue must show **zero eligible** products and seven unverified variants, without invented prices or fit scores.
3. Inspect the evidence gaps, exact generation/tier/outsole/colorway and links. Confirm no private dimensions appear in results or public pages.
4. Revoke consent in another tab; the next request must fail 403. Client `userId`, weights or evidence fields must fail validation.
5. Use only an isolated database with labeled synthetic fixtures to verify positive eligibility, expired/foreign/sized offers and ranking calculations. Never mutate production product/sample flags for testing.

## Completion and next sprint

- PASS: pure deterministic engine, normalized inputs, conservative surface gate, scoped commerce, transparent preference scoring, separate coverage/physical uncertainty, sourced observations, stable bounds/ties.
- PASS: real PostgreSQL retrieval, minimal provenance storage, consent-gated API, technical preview, regression/security checks and documentation.
- DATA GAP: no real evidence-backed recommendation can be responsibly produced from the current sample catalogue. Verified product/evidence publishing is required before real-user recommendation launch.
- NOT PERFORMED: production migration/deployment; no subsequent sprint started.

The engine foundation is ready for Sprint 3.3 development after review. That is not a production-readiness or validated-fit claim; product evidence, publishing consistency and existing operational/dependency release gates remain prerequisites.
