# Data D2 — Import pipeline

24 October 2026. Local-only implementation; no Neon migration, scraping, downloads, automatic publication, deployment or push.

## Integration and contracts

Reuses D1 product ancestry, sources, immutable claims, image metadata, offers and moderation audit. The D1 checkpoint is commit `1bf885a`. CSV/JSON parsing and identity resolution live in `src/lib/data-import`, independently of React. `csv-parse` is pinned to 7.0.3. Three additive tracking tables record batches, source-record mappings and row outcomes. Claims, images and offers retain import-row provenance. Unknown swatches are nullable.

Flow: authorized source → bounded file → read-only preview → signed 15-minute approval → explicit confirmation → serializable transaction → draft products or staged proposals → private report. Exact matching uses source record IDs or brand/region/case-sensitive SKU, with full identity checks. Names and case-only SKU matches need review. Construction sharing across colorways requires an explicit source construction key. Tiers and outsoles never merge automatically.

Existing products and verified attributes are never overwritten. Conflicts and proposed additions are stored as staged row payloads. New products remain DRAFT; claims/images UNVERIFIED; offers unapproved. Invalid rows block execution; valid conflict rows may be recorded atomically alongside valid new drafts. Idempotency keys bind the exact input, persist beyond payload pruning, and support replay/interrupted-attempt recovery. A global transaction lock prevents overlapping import writers. Stale previews require validation again.

## Usage

ADMIN-only `/admin/products/import`. Register a genuinely authorized source using D1 APIs first. Upload UTF-8 CSV/JSON, select source, optionally map CSV columns, validate, inspect diagnostics and confirm execution. Templates: `/data-import/synthetic-template.csv` and `/data-import/synthetic-products.json`. These are synthetic fixtures, never genuine product records.

JSON: `{ "version": 1, "products": [...] }`. Required fields: recordId, brand, family, generation, tier, colorway, sourceUrl, observedAt. Optional: outsole, sku, skuRegion, constructionKey, manufacturerOutsole, swatch, colorNames, specifications, images, offers. Array fields in CSV are JSON cells. Mapping is target→source, e.g. `{ "recordId": "supplier_id", "sku": "manufacturer_sku" }`. Source URLs must be public HTTPS without credentials; no URL is fetched.

`PRODUCT_IMPORT_MAX_BYTES` defaults to 10485760 (clamped 1024–20971520); `PRODUCT_IMPORT_MAX_ROWS` defaults to 5000 (1–5000). JSON depth ≤12, CSV record ≤64 KiB, canonical row ≤64 KiB. Per-brand graph limits reject oversized scopes rather than silently truncate. Split/narrow larger jobs; this is not a background queue.

## API and migration

- GET/POST `/api/admin/product-imports`: paginated history / execute signed input.
- POST `/api/admin/product-imports/preview`: strict input, read-only PostgreSQL snapshot, no persisted rate counter.
- GET `/api/admin/product-imports/[id]`: 50-row report; `?download=csv` formula-safe export.
- PATCH same route `{confirmed:true}`: prune canonical payload only, retain mappings/provenance/outcomes.

Migration `20261024030000_product_imports` adds bounded JSON/status/hash constraints, FKs, indexes and unique intent/source-record keys. Tested only on disposable local databases at D2 closeout. Persistent development database still has the fourteen D1 migrations; no D2 migration has been applied there. Auth.js adapter uses a narrowly scoped read-only context during preview to prevent session-refresh/deletion writes; normal authentication remains unchanged.

## Verification ledger

- PASS: `npm test` — 287 tests, 31 files.
- PASS: full isolated platform/integration/benchmark — 106 tests, zero failed/skipped, 20.62 seconds (`integration-final.log`). Earlier run failed the email-rate test at a fixed-window boundary; deterministic isolated bucket setup fixed the test without changing production limits.
- PASS: `npm run lint`, `tsc --noEmit`, Prisma validate/generate and production build. Early syntax/type build failures were fixed. The named post-build typecheck passed in D3 verification.
- PASS: full/runtime npm audit — zero advisories at D2 check.
- PASS (final closeout): browser import workflow exercised file preview, commit, repeat/no-op, reports, keyboard and four viewport sizes. Initial mobile overflow and duplicate confirmation were fixed. Last browser failure was an assertion before the streamed guest redirect completed; corrected to wait for `/login`; the final D3 closeout run passed the complete import workflow.
- PASS: remote execution guard with dummy non-local URL rejected without connecting.

Local logs: `/tmp/bootverse-data-d2-20261024/`. Failed attempts remain recorded. No live adapter or production benchmark was executed. The feed interface was tested with synthetic transport, bounded pages/rows/timeouts/retry/backoff/cursor guards and redacted errors. Future real transport needs an authorized destination/DNS/redirect allowlist; this sprint supplies no arbitrary-fetch endpoint.

## Performance and limitations

Pure 5000-row preview, one warmup/five measured repetitions, improved from mean 505.308 ms to 319.956 ms by indexing variant/colorway pairs (36.7%). Process high-water RSS was 387264→382864 KiB; this is not attributed per-import heap. Full HTTP benchmarks include 10/100/1000/5000 rows and repeated no-op batches; see executable integration fixture and logs for raw measurements. Query counts are explicitly uninstrumented (null); writes chunk at 250 rows.

Preview throttling is process-local to preserve a truly read-only DB dry run and is suitable only with the enforced local-only guard. Source creation and D4 approval UI are outside D2. No scheduled refresh, real-provider feed, image-byte import or remote import enablement. D3 may consume staged proposals but must preserve verification/publication boundaries. D2 core and final browser closeout pass. Persistent-local/Neon activation migrations remain explicit outstanding operational work. D3 final regression contains 311 unit and 117 isolated integration tests, all passing; see its report for current evidence.

Skills loaded/applied: using-agent-skills, Ponytail, API/interface design, TDD, security/hardening, incremental implementation, planning, frontend UI, performance optimization, code review, git workflow and Playwright.
