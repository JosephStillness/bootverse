# Tooling and driver fixes — 2026-10-22

This supersedes the three remaining tooling/cache/pg caveats in the dated audit reports. No database schema, cloud resources or secrets changed.

Skills loaded and applied: `ponytail`, `debugging-and-error-recovery`, `test-driven-development`, `security-and-hardening`, `incremental-implementation`, `git-workflow-and-versioning`, `code-review-and-quality`, and `playwright`. No UI redesign or new API design was needed.

## Generated type conflicts

`npm run typecheck` reproduced TS2300/TS2428 from `.next/types/routes.d 2.ts`. The conflicting files were byte-identical copies of generated files. macOS identifies Documents as an Apple iCloud File Provider domain. This supports a sync-conflict diagnosis; the exact writer was not traced.

Next's `distDir` is now `.next.nosync`, inside the checkout. Its generated production and dev types remain explicitly included in TypeScript; incremental compiler state also lives there. The old `.next` is excluded because it is no longer build output. Git, ESLint, Docker context and standalone image paths all follow the new directory. Old cache copies need not be manually deleted to pass typecheck.

Apple documents [excluding recreatable data with `.nosync`](https://developer.apple.com/library/archive/documentation/General/Conceptual/iCloudDesignGuide/Chapters/iCloudFundametals.html). This is iCloud-specific: for another sync provider, exclude generated artifacts using its own settings or keep the checkout outside sync. Continue to use fresh CI checkouts and avoid simultaneous dev/build processes sharing output. Persistent Turbopack caches remain disabled.

## Dependency advisories

The five High audit entries came from one dependency chain: `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. The [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) has no patched version. Upgrading fast-glob does not remove that chain.

The exact Next plugin version is scoped to a local development-only `fast-glob` replacement, `tooling/next-lint-glob`. It implements only the API that this plugin actually calls: `globSync(string, {onlyDirectories:true})`, using Node 24's built-in filesystem glob and directory checks. Unsupported calls fail clearly. It is not a general fast-glob replacement. There is no downloaded fork, vulnerable parser, audit exception or disabled lint rule. A direct development dependency makes npm's local file reference reproducible; Docker copies it before `npm ci`.

Tests cover actual plugin root discovery with absolute/relative paths, brace globs, arrays, missing directories and file exclusion. They also prove `no-html-link-for-pages` still reports a violation. Review these tests and the plugin's `get-root-dirs` implementation before upgrading Next or widening the override. Remove the workaround when an audited upstream implementation replaces fast-glob.

The fresh audit also found two Moderate entries from Vitest's mocker. The [4.1.12 security backport](https://github.com/vitest-dev/vitest/releases/tag/v4.1.12) fixes them without moving to Vitest 5. Both full and runtime npm audits now report zero vulnerabilities.

## Prisma / pg compatibility

The real HTTP integration suite reproduced pg's concurrent-client-query deprecation; `--trace-deprecation` located it in Prisma's adapter `performIO/queryRaw` path. The warning was previously merely logged by the suite.

Application, catalogue-import and auth-cleanup Prisma adapters now set `pipeline:true`, [supported by pg 8.23+](https://node-postgres.com/features/pipelining). The driver sends queued queries using the supported protocol pipeline rather than its deprecated serial queue. PostgreSQL still executes statements in order. Queries depending on an earlier result continue to use sequential awaits. No warning filter, version downgrade, transaction removal or global request serialization was added. Cursor/custom streaming queries are not used by this Prisma adapter; review compatibility before introducing them.

The integration suite now fails if the deprecation appears. It failed before the fix and passed after rebuilding with pipeline mode, including actual CRUD, concurrent updates/votes, constraint failures, duplicate races, uploads and authentication. Tests use only randomly named local databases and private local S3 buckets, with cleanup owned by the harness.

## Verification

Executed on 2026-10-22, Node 24.8.0, macOS, with disposable localhost services:

| Check | Result |
| --- | --- |
| `npm test` | PASS — 229 tests, 25 files |
| `npm run lint` | PASS |
| `npm run typecheck`, before/after production build and after dev startup | PASS with the obsolete duplicate files still present |
| Intentional error in `.next.nosync/types` | Correctly rejected by TypeScript; probe removed |
| Intentional broken lint-adapter guard | Compatibility test failed; original guard restored and test passed |
| `npm run build` | PASS |
| `npx --no-install prisma validate` | PASS |
| `prisma migrate status` with guarded local env | PASS — 12 migrations, up to date; none applied to the app DB |
| `NODE_OPTIONS=--trace-deprecation BOOTVERSE_BENCHMARK=1 npm run test:platform:local` | PASS — 78 tests, 0 failed/skipped, pg-warning regression passed |
| `npm audit` / `npm audit --omit=dev` | PASS — 0 vulnerabilities in each |
| Docker `linux/amd64` build, including clean `npm ci --ignore-scripts` | PASS |
| Standalone Docker runtime without credentials | Health and login 200; all 13 referenced static assets 200 |
| Browser magic link with captured local SMTP | PASS; synthetic QA account only |
| Existing browser catalogue/comparison, admin, Finder profile suites | PASS, including intentionally injected network/error recovery |
| Browser smoke at 375px and 1440px | Five routes each returned 200; no horizontal overflow or page exceptions |
| `npm run dev:local` smoke | Home, catalogue and detail returned 200; then server stopped |
| Literal configured-secret scan of 55 client artifact files | 0 matches; no values logged |
| `git diff --check` | PASS |

The optional local benchmark recorded p95 11.80ms for the small fixture and 97.39ms for 100 variants / 2,000 synthetic reviews, 32 requests each at concurrency 4, zero request errors. These are local regression measurements, not production capacity claims.

The initial typecheck and pg-warning regression runs deliberately failed to reproduce the defects. A direct tinyglobby alias was also rejected by compatibility tests before the built-in adapter was selected; it is absent from the final override. An initial restricted build stalled, was stopped and rerun successfully with local process permissions. The final checks above passed. Local logs for this run are under `/tmp/bootverse-tooling-fixes-20261022`; temporary logs are not committed.

Installation still reports the existing ESLint 9 end-of-support notice (and host npm printed peer-resolution warnings); this change does not attempt an unrelated ESLint major upgrade. The audited lockfile and full lint suite pass. Keep the Next lint adapter pinned and retest it on dependency upgrades. iCloud exclusion was checked through fresh dev/build/type-generation cycles; long-term behavior of an external sync process cannot be guaranteed by a single run.

No real email delivery, Neon migration or cloud deployment was attempted. Existing reports describe historical states. Production readiness still requires the separately documented database, mail, storage, IAM and operational acceptance gates; these three fixes do not certify cloud deployment.
