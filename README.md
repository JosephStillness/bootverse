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

Turbopack filesystem persistence is disabled: this workspace reproduced duplicate numeric cache filenames and invalid persisted-cache parsing. Next already separates dev/release artifacts; do not run a release build concurrently with a dev process sharing `.next`. Use a fresh CI checkout. Do not weaken TypeScript includes or delete source files to repair caches.

## Deployment preparation

No AWS resources or production deployment are included. Docker builds enable `BOOTVERSE_STANDALONE=1`; normal `npm run build` / `npm start` keep the existing Next server workflow. A non-root standalone [Dockerfile](Dockerfile), secret-excluding build context, [quality workflow](.github/workflows/quality.yml), `/api/health/live`, `/api/health/ready`, safe failure correlation and IAM credential-chain support are prepared.

Readiness checks database migration metadata only; it does **not** certify SMTP, object storage, IAM, backups or full schema drift. The runtime image does not apply migrations or run cleanup jobs; use separate reviewed release/maintenance jobs. The Node base image is pinned to the digest tested locally; release engineering must review updates and scan the complete image.

The configured non-local database still requires explicit schema/history reconciliation and migration approval. Full dependency audit remains non-green while the upstream development-only `braces` advisory has no safe compatible fix; runtime audit is separate. Production email delivery, TLS/proxy trust, IAM, restore exercises and monitoring require external verification.

See [deployment/migration/backup runbook](docs/deployment-runbook.md), [original audit](docs/BOOTVERSE_FULL_AUDIT.md), and [remediation status](docs/BOOTVERSE_REMEDIATION_REPORT.md). Historical sprint reports under `docs/` describe their dated snapshots; this README describes current behavior.

Repeatable browser regression setup and CLI requirements: [browser QA environment](docs/catalogue-and-comparison.md#reusable-browser-regression-environment). `npm run test:browser:serve` creates disposable local fixtures; it is never a production server or sample seed command for a real database.
