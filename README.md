# BootVerse

Football boot catalogue, comparison, community and evidence-based Boot Fit Finder. Next.js App Router, TypeScript, Tailwind/shadcn, PostgreSQL/Prisma, Auth.js email links and private S3-compatible images.

## Local setup

Requires Node 24, npm, PostgreSQL and SMTP. Private S3-compatible storage is required for uploads; `npm run dev:storage` prepares local RustFS with ignored credentials. See [storage setup](docs/phase-2-creators.md).

```sh
npm ci --ignore-scripts
npm run db:generate
cp -n .env.example .env
# Configure your own LOCAL database, SMTP, origin and generated Auth secret.
npm run db:deploy
# Optional: fictional samples, localhost databases and non-production mode only.
npm run db:catalogue
npm run dev:mail
# In another terminal:
npm run dev
```

Open [localhost:3000](http://localhost:3000). Never run the migration or sample-import commands against an existing remote database as a setup shortcut. Real `.env`, `.env.local`, `.local` and API keys must remain untracked.

This workspace also has an ignored `.local/development.env`. `npm run dev:local`, `npm run db:local` and `npm run test:platform:local` validate that its database, SMTP, storage and origin are localhost URLs and override ordinary `.env` values. A fresh checkout must create that private local profile before using these commands.

## Current functionality

- Published database catalogue, search, brand/silo/tier/outsole filters, sorting and 12-entry pagination. New published entries have dynamic detail pages without a rebuild; unpublished or missing entries return 404.
- Exact generation/tier/outsole/colorway identities, sourced technical attributes, scoped sourced offers, and explicit unknowns. No verified product photo is inferred from concept artwork.
- Up to four exact variants in `/compare`; select from cards, details or Finder. Colorways of one variant share a comparison column. The URL contains public entry IDs only; the tray is page-memory state.
- Email-link authentication, private sessions, profiles, community posts, nested comments/votes, structured six-category reviews, ownership checks and rate limits.
- Private images, creator profiles/verification, reports, moderation and audit history.
- Private two-foot profiles and authenticated four-step Finder. Request-only inputs are not saved; saving needs an explicit choice. Missing evidence never becomes a fit guarantee.

Eight fictional sample entries remain available through the **explicit local seed**, not as a runtime fallback. Existing imported entries retain their visibility after the additive migration. New database entries default to unpublished. Genuine product curation is still an operator task. Review opinions and manufacturer/measurement evidence remain separate.

Identity: `Brand → Family → Generation → Tier → Outsole variant → Catalogue entry/colorway`. Reviews aggregate only an exact variant, not across tiers/outsoles/generations. See [catalogue architecture](docs/catalogue-and-comparison.md).

Data D1 adds a source registry, manufacturer/region-scoped SKUs, validated source-backed claims, licensed image metadata and an audited draft/review/publication lifecycle. ADMIN-only APIs support manual curation; a full product editor and import pipeline are deferred. Legacy source/specification gaps stay explicit, and broader catalogue outsole labels do not relax Finder safety. See the [D1 schema, API and migration report](docs/DATA_D1_SCHEMA_SOURCE_REGISTRY_REPORT.md) before applying the two additive migrations. Never apply them to Neon automatically.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npx --no-install prisma validate
npm run build
npm run typecheck
# Local PostgreSQL; creates and removes its own random database:
npm run test:integration
# Guarded local PostgreSQL + private S3 + captured SMTP, with optional benchmark:
BOOTVERSE_BENCHMARK=1 npm run test:platform:local
npm audit --omit=dev
npm audit
```

Run integration tests after a successful build. Never substitute a production DB for the guarded local URL. Browser acceptance procedures and the full executed test ledger are in [the remediation report](docs/BOOTVERSE_REMEDIATION_REPORT.md).

Next builds, generated route types and TypeScript's incremental cache use `.next.nosync`, excluded from iCloud sync in this Documents workspace. The obsolete `.next` is ignored; current generated types remain checked. Turbopack filesystem persistence remains disabled after earlier cache corruption. Do not build concurrently with a dev process sharing the same output directory. Use a fresh CI checkout.

The pinned Next ESLint plugin's directory-glob dependency is replaced by a small Node 24 built-in adapter under `tooling/next-lint-glob`. All Next/React/TypeScript lint rules remain enabled. Run its compatibility tests when updating Next. Prisma's pg connections enable supported query pipelining for concurrent transaction queries; dependent operations still use sequential awaits. See [tooling and driver fixes](docs/tooling-and-driver-fixes.md).

## Deployment preparation

No AWS resources or production deployment are included. Docker builds enable `BOOTVERSE_STANDALONE=1`; normal `npm run build` / `npm start` keep the existing Next server workflow. A non-root standalone [Dockerfile](Dockerfile), secret-excluding build context, [quality workflow](.github/workflows/quality.yml), `/api/health/live`, `/api/health/ready`, safe failure correlation and IAM credential-chain support are prepared.

Readiness checks database migration metadata only; it does **not** certify SMTP, object storage, IAM, backups or full schema drift. The runtime image does not apply migrations or run cleanup jobs; use separate reviewed release/maintenance jobs. The Node base image is pinned to the digest tested locally; release engineering must review updates and scan the complete image.

The configured non-local database still requires explicit schema/history reconciliation and migration approval. Full and runtime dependency audits pass at the latest local verification; keep running both against the lockfile. Production email delivery, TLS/proxy trust, IAM, restore exercises and monitoring require external verification.

See [Phase 4.1 staging architecture and approval gates](docs/PHASE4_1_STAGING_PLAN.md), [deployment/migration/backup runbook](docs/deployment-runbook.md), [original audit](docs/BOOTVERSE_FULL_AUDIT.md), and [remediation status](docs/BOOTVERSE_REMEDIATION_REPORT.md). Historical sprint reports under `docs/` describe their dated snapshots; this README describes current behavior.

Repeatable browser regression setup and CLI requirements: [browser QA environment](docs/catalogue-and-comparison.md#reusable-browser-regression-environment). `npm run test:browser:serve` creates disposable local fixtures; it is never a production server or sample seed command for a real database.

With an authenticated disposable QA ADMIN session, `BOOTVERSE_BROWSER_SESSION=your-session npm run test:browser -- data` checks D1 source/claim verification, public provenance, mobile/desktop wrapping and source revocation. It mutates only the `qa-product-0` fixture in that disposable environment; never run it against a real app database.

Phase 4.2 database/storage verification: [report and approval requirements](docs/PHASE4_2_DATABASE_STORAGE_REPORT.md). After Prisma client generation, run `npm run db:verify -- --env-file /PRIVATE/PATH/database.env` from the project root. This command is read-only, requires explicit env selection, checks migration checksums/model tables/critical constraints/triggers and Prisma schema drift, and refuses mixed pooled/direct targets or unverified remote TLS. It never migrates, seeds or provisions. Use independent app/migrator credentials for an approved staging target; no remote initialization is authorized by the command.

### Product data workspaces (D2 / D3)

ADMIN-only `/admin/products/import` previews structured CSV/JSON and commits attributed drafts. `/admin/products/enrich` adds immutable observations and licensed asset metadata to exact existing products, detects contextual conflicts, displays quality/freshness issues and records audit history. No automatic publishing or arbitrary URL retrieval. Product photos reuse the private S3 upload pipeline; unknown image rights remain restricted. Real source access and licensing must be documented first; example fixtures are synthetic only.

These workspaces enforce a localhost database guard. D2/D3 migrations are tested in disposable databases; they have **not** been applied to the existing development database or Neon. Run the isolated QA environment (`npm run test:browser:serve`) after a successful build and local PostgreSQL/S3 setup to explore them safely. Applying migrations to an existing database requires a separate target/backup/rehearsal review; never reset it.

See [D2 import contracts and setup](docs/DATA_D2_IMPORT_PIPELINE_REPORT.md) and [D3 enrichment, verification, assets and tests](docs/DATA_D3_ENRICHMENT_REPORT.md). Limits/freshness settings are documented in `.env.example`; real credentials remain ignored. `BOOTVERSE_IMPORT_BENCHMARK=1 BOOTVERSE_BENCHMARK=1 npm run test:platform:local` runs synthetic measurements on owned temporary databases/buckets only.
