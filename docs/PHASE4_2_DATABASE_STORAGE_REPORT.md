# Phase 4.2 — Neon staging database and private object storage

**20 October 2026 · Australia/Sydney. Status: CONDITIONALLY READY.**

Local database/storage integration and preparation are verified. **No isolated remote staging environment has been provisioned or verified.** Explicit target, recovery, spending and identity approvals remain required before any cloud change. No Phase 4.3 deployment is started.

## 1. Scope and preserved decisions

Read the [Phase 4.1 plan](PHASE4_1_STAGING_PLAN.md), [remediation report](BOOTVERSE_REMEDIATION_REPORT.md), [original audit](BOOTVERSE_FULL_AUDIT.md) and actual Prisma/Auth/storage/CI implementations. The working tree already contained Phase 4.1 configuration/docs; these were preserved. No existing application behavior, schema, migration SQL, dependency versions or real env file was changed.

Retain the Phase 4.1 choice: low-traffic Lightsail candidate, Neon PostgreSQL, private S3, Resend, existing Auth.js/Prisma/pg architecture. ECS remains the alternative when managed task-role identity/availability justifies its cost. RustFS remains local-only. Existing tests now invoke a read-only verification tool in their isolated database.

## 2. Database architecture and actual environment observations

- PostgreSQL stores accounts/sessions/tokens, normalized boot identities, posts/comments/votes, six-category reviews, creators/moderation/media metadata, private foot profiles/consent and recommendation evidence. Image bytes remain outside PostgreSQL.
- App: existing `PrismaPg` singleton, maximum ten connections per process, UTC, five-second connect timeout. Application traffic can remain pooled; release/backup tools need direct connections.
- Prisma 7 config reads **`DATABASE_URL_UNPOOLED` before `DATABASE_URL`**. `DIRECT_URL` is not read by this repository.
- `.neon` identifies existing project `holy-frost-99739143`; neither that context nor the existing endpoint confirms an approved staging branch. Configured endpoint is pooled Neon in Sydney (`ap-southeast-2`). No second project was created and no organization/credential inventory was exported.
- Fresh read-only verification of the configured non-local target reports **zero public tables / no migration history or app models**; native `prisma migrate status` exits 1 with twelve pending migrations. These observations concern that database/public schema, not every database/schema in the project. Do not initialize it merely because it appears empty.
- Read-only role capability check: connected role is not a PostgreSQL superuser, but has **CREATEDB, CREATEROLE and public-schema CREATE**. It is an operator-style identity, **not an approved least-privilege web role**. No grants, role changes or credentials were created/modified.
- Existing local database verification reports **31 public tables (30 Prisma models plus migration history), 12 completed migrations, 45 foreign keys, 45 CHECK constraints, 52 unique indexes, no detected checksum/drift/critical-check/trigger issues**. No original local user rows or uploaded images were modified.

**Remote status: FAIL for current application schema readiness; staging isolation/role setup: NOT TESTED / not provisioned.** Read-only inspection is not successful staging integration.

## 3. Staging isolation and role strategy

Recommend a **dedicated empty staging Neon project/database** in the approved Sydney region, independent credentials/administration where practical. It avoids copying private accounts, sessions and foot measurements and gives a clean rehearsal of the complete chain. Confirm plan/root-branch limits, expiry and compute/storage costs before creation.

If a real existing schema must be retained, a schema-only branch is an alternative, subject to current Beta/plan limitations. It can contain existing tables and is not synonymous with an empty database; reconcile schema/history first. A normal branch containing real data requires separate privacy/access approval and appropriate sanitization. Neither branch type is created here. See [Neon branching](https://neon.com/docs/introduction/branching) and [schema-only branching](https://neon.com/docs/guides/branching-schema-only).

Use independent credentials:

| Identity | Scope |
|---|---|
| Staging app | Required schema usage and app DML, migration-history SELECT for readiness; no role/database/schema creation, no migrator or production credentials |
| Staging migrator | Only approved staging database/schema ownership/DDL needed for Prisma/custom SQL; no blanket superuser/BYPASSRLS or production scope |
| Backup/recovery operator | Reviewed direct read/export/restore privileges and separate encrypted backup access; not present in web container |
| CI/integration | Disposable localhost database/bucket and synthetic users only; never stage/prod URLs |

Server authorization remains essential: this app's database role serves multiple users; ownership/privacy enforcement is in the server APIs, not a claim of per-user PostgreSQL RLS. Confirm actual table/function/default privileges in rehearsal. Pools, release tools and cleanup workers must fit the plan's connection cap. Cross-region egress/latency and cold compute wake-up must be measured, not inferred from local results. [Neon pooling guidance](https://neon.com/docs/connect/connection-pooling).

## 4. All twelve migrations — ordering, dependencies and risks

Repository timestamp order is unchanged; each row requires prior objects. No migration was rewritten or remotely applied.

| Migration suffix | Purpose | Main safety concern |
|---|---|---|
| `20261013010000_account_foundation` | Users/profiles/sessions/tokens/rate limits | Conflicts with untracked pre-existing objects; uniqueness/format/cascade semantics |
| `20261013020000_timezone_safe_timestamps` | Foundation timestamps → timestamptz | Assumes existing values mean UTC; conversion/rewrite/locks |
| `20261013030000_community_posts` | Boot identities, catalogue, posts/tags/categories | Requires users; creates constraints/indexes and inserts five category labels; no fake community records |
| `20261013060000_catalogue_generation_integrity` | Generation backfill/composite references | Explicit transaction, fails generation mismatch; UPDATE/NOT NULL/index scans and FK replacement |
| `20261014010000_comments_and_post_votes` | Replies/votes/counters/guards | Post/user dependencies; immutable identities, nesting and counter trigger behavior |
| `20261014020000_boot_reviews` | Reviews/helpful votes/six ratings | Exact variant/user FKs, duplicate/rating/field checks and identity/vote triggers |
| `20261015010000_review_sizing_advice` | Optional sizing text | ALTER TABLE still needs a lock |
| `20261015020000_creator_media_moderation` | Creators/images/queue/reports/audit/verification/videos | Largest change; replaces username constraint/comment-count function, adds partial unique indexes, cleanup trigger and sponsorship fields |
| `20261015030000_private_foot_profiles` | Private measurements/preferences/consent | New sensitive-data obligations, bounds/consent/version checks; no implicit copy/publication |
| `20261015040000_recommendation_evidence` | Approved variant-scoped provenance | Payload/date/source constraints; does not fabricate evidence |
| `20261016010000_review_analysis_consent` | Separate review analysis consent/categories | Existing reviews remain opt-out; CHECK/index creation locks |
| `20261017010000_catalogue_publication` | Publication/sourced-spec JSON/index | Existing entries become **published=true**, future inserts false; review any legacy drafts first |

No DROP TABLE/COLUMN, TRUNCATE or standalone destructive DELETE was found. There are DROP CONSTRAINT replacements, UPDATE backfills, type conversion and deletion policies. Only the generation-integrity file explicitly wraps itself in a transaction; do not assume one atomic transaction covers all twelve. A failed migration may leave partial DDL. PostgreSQL 18 connectivity was observed remotely, but remote application/migration execution on 18 remains NOT TESTED. Current local integration uses its existing PostgreSQL version; it does not prove version-18/cloud parity.

### Safety/recovery procedure — not execution permission

1. Confirm owner, environment, project/branch/database/role and region using private connection details; compare app/direct endpoint identity before any release action.
2. Capture schema, migration history/checksums and data-count metadata; encrypted direct backup and independently verified restore into an approved isolated target. Define staging RPO/RTO; do not use the source database as a restore test.
3. Rehearse on empty or appropriately sanitized isolated target; review lock time, backfills, constraints and visibility. All data-changing tests in this phase used random **local** DBs only.
4. Obtain explicit approval naming the remote target, SQL/commit, backup evidence and recovery owner. Only then run a separate controlled `db:deploy` release job with direct credentials. Never start migrations in Docker build/web startup.
5. Run read-only verifier, native migration status and functional/constraint/visibility tests. Preserve safe logs and release identity.
6. On failure: stop affected writes, inspect partial history/DDL, preserve data. Review a forward repair or restore into a separate target and reconcile writes. Do not reset, blindly retry, edit applied SQL, mark migrations applied or drop columns to clear a warning. Prefer compatible app rollback while retaining schema/data.

## 5. Reusable read-only verification

New command, from repository root after Prisma client generation:

```sh
npm run db:verify -- --env-file /PRIVATE/PATH/database.env
```

[`scripts/verify-database.mts`](../scripts/verify-database.mts) does not choose a database target from an ambient `.env`, mutate records, create objects, seed, reset or migrate. It:

- Requires an explicit env file. Prefers direct URL when provided and rejects mixed app/migrator endpoint/database/port pairs before connecting. Pooled/direct hostname siblings may differ by `-pooler`; database roles may differ intentionally.
- Requires a PostgreSQL URL and explicit `sslmode=verify-full` for the selected non-local verification connection. It is not a complete application env validator. Uses bounded connection/query time and a read-only metadata transaction.
- Checks completed/failed/pending/unknown/duplicate history, SHA-256 checksums against local migration files, all current Prisma model tables in `public`, unvalidated constraints, invalid indexes and selected critical CHECKs/triggers.
- Runs installed Prisma **introspection-only** `migrate diff --from-config-datasource --to-schema ... --exit-code`; captures potentially identifying CLI diagnostics rather than printing them.
- Emits bounded JSON: PASS/FAIL, hashed target fingerprint, local flag, counts and fixed issue codes. No URLs, usernames, private user data, SQL errors, keys or tokens.

Limits: public schema/current model names, selected custom checks/triggers only; not every function body/constraint definition is proved equivalent by Prisma. A release must still review custom SQL and exercise constraints. A single snapshot is not an ongoing drift monitor or a backup. A failed connection is reported generically as `verification-unavailable`; diagnose privately without publishing raw exceptions. No direct URL is constructed or fetched automatically.

The Phase 4.1 [`verify-staging.sql`](../deploy/verify-staging.sql) remains available for owner-operated read-only inspection. Native Prisma status/diff and actual integration tests complement the verifier.

Templates: existing [`staging.env.example`](../deploy/staging.env.example) for the web process, new [`migration.env.example`](../deploy/migration.env.example) for a **separate private release environment**. Real files belong outside the checkout, mode 0600. Web runtime receives no direct migrator credentials. Keep AUTH secret/origin/Resend sender and storage identity separate from development/production. No real env was switched or overwritten.

## 6. Private storage and proposed AWS template

Reuse existing `src/lib/platform/storage.ts` / `images.ts`; no alternate upload API, presigned public bucket or new storage SDK was added. Avatars, post/review photos and creator covers already use the same persistence/validation pipeline. Bytes live in private S3; metadata and authorization relationships live in PostgreSQL.

[`deploy/s3/staging-bucket.cfn.yaml`](../deploy/s3/staging-bucket.cfn.yaml) is a **not-deployed CloudFormation candidate** for a new approved staging bucket and a separate unattached managed policy. It contains no IAM users, access keys, role creation, production bucket name or deployment command.

- All four bucket public-access blocks enabled; BucketOwnerEnforced disables ACLs.
- Explicit default SSE-S3/AES256, versioning and deny non-TLS bucket policy. The SDK currently omits per-request encryption headers; default bucket encryption is intentional. A policy requiring an explicit SSE header would break existing uploads and was not added.
- No current-object expiry, public website hosting, public Allow, browser bucket CORS or anonymous upload policy. App proxies same-origin image access.
- Incomplete multipart upload abort after one day; current code uses single PUT, so this is an orphan-cost guard rather than a claimed exercised multipart feature.
- Proposed 14-day noncurrent-version expiry for `images/` and removal of expired delete markers. Owner must approve privacy/restore window; version deletion/lifecycle is irreversible. Current DB-backed cleanup is still required for live orphan objects.
- Bucket Retain policies on stack deletion/replacement preserve data, but retained versions/objects **continue costing money** and require an accountable teardown/retention owner.

[AWS S3 security guidance](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html), [CloudFormation bucket reference](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-s3-bucket.html), [lifecycle rule reference](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-s3-bucket-rule.html), [versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html). Offline template assertions are not AWS IAM evaluation or proof of successful provisioning.

## 7. IAM and access boundaries

The unattached app policy permits only **GetObject, PutObject, DeleteObject** on this bucket's `images/*`. It does not permit ListBucket, bucket configuration, public ACLs, cross-bucket objects or DeleteObjectVersion. Current app/cleanup use database-owned keys, not bucket listing. Do not grant broad list/admin rights to satisfy a separate operator diagnostic.

Lightsail has no assumed ECS task role; use an approved limited identity/rotation mechanism or reconsider ECS if managed workload credentials are required. ECS must separate execution role from application task role; omit both custom S3 keys/token for SDK default credential-chain use. No identity or credentials were created/attached here.

Backup/version recovery needs a different operator policy; permanent erasure across versions/backups requires reviewed additional authority. DeleteObject on a versioned bucket normally hides the current object with a marker rather than erasing every historical version. A DB deletion is not a complete erasure certification. No key-management or lifecycle change is enabled remotely in this phase. Live database quotas do not account for retained noncurrent S3 versions: repeated upload/delete cycles can accrue historical storage beyond the visible per-user quota. Retention approval, existing upload rate limits and storage/billing monitoring are therefore required before enabling versioning for real users.

## 8. Upload/privacy/security verification

Existing real implementation enforces active account, owner and current parent visibility on writes; trusted actor identity comes from the server. Byte limits, signature/Sharp decoding, pixel limits, JPEG/PNG/WebP allowlist, WebP re-encoding without EXIF, random UUID object keys, serialized quotas and server-owned paths remain intact. Client-selected object paths are not accepted. S3 credentials remain server-side.

An authenticated user may not alter someone else's image; hidden/unpublished review media is denied publicly while authorized owner access remains. **Private bucket does not mean every published photo requires login:** public post/avatar/review images intentionally remain available through the authorization-aware app proxy when parent publication permits it. Direct anonymous bucket access is denied.

A failed upload removes its reservation and queues durable cleanup. Crashed UPLOADING reservations and known deletion jobs are handled by the existing hourly-candidate cleanup, with failed jobs retained. Real scheduler activation is still an approval gate. No global AWS object sweep or real-image deletion was run.

Security findings/gates:

- **High configuration gate:** configured remote DB is missing required schema/history and the current connection identity has elevated creation capabilities. Do not point the web app at it as a staged deployment.
- **High tooling gate:** full npm audit still has five High entries rooted in one braces lint-chain advisory; runtime audit is zero. No incompatible downgrade, suppression or lockfile change.
- **Medium compatibility:** pg concurrent-client warning remains; SSL-mode future semantics require explicit verified TLS. ESLint 9.39.5 deprecation appears during frozen Docker installation. No upgrade was claimed to resolve these.
- Source/config and client literal checks cover current configured values only; no complete Git-history/encoded-secret or formal penetration-test certification. Existing partial CSP, real HTTPS/cookies, origin/proxy and privacy-retention gates remain in Phase 4.1.

## 9. Executed checks — actual results

Local mutations were restricted to harness-owned random databases/private RustFS buckets with synthetic users and captured SMTP. The existing development database was used only for read-only verification. No actual AWS S3 upload occurred.

| Check | Status / evidence |
|---|---|
| `npm test` | **PASS** 226/226, 24 files; zero skipped |
| ESLint / typecheck | **PASS** final commands after verifier fixes |
| Workspace `npm run build` + post-build typecheck | **PASS**; app production build, not a cloud deploy |
| Installed Prisma validate | **PASS** |
| Local native migrate status / read-only verifier | **PASS** all 12 applied; counts in section 2 |
| Configured non-local native migrate status | **FAIL** exit 1, twelve pending; no changes |
| Configured non-local verifier | **FAIL** missing history/model tables/critical checks/triggers; intended refusal rather than a fake PASS |
| `npm run test:platform:local` | **PASS** 76 cases, zero failed/cancelled/skipped, including lifecycle parent and two new verifier cases |
| Verifier regressions | **PASS** explicit env, mixed target rejection, unverified TLS rejection, successful migrated schema/drift inspection, checksum tampering rejection, unvalidated constraint rejection and no app-row mutation/URL output |
| Storage integration | **PASS** real local post/avatar/cover/review uploads, anonymous upload 401, other owner 403, invalid signature 400, oversize 413, count/quota 409, EXIF absent, direct bucket anonymous 403, hidden review image 404, owner read 200, queued deletion/cleanup and unavailable storage 503 |
| Browser real email/session | **PASS** captured magic link and reload-persistent DB session; not Gmail delivery |
| Browser image UI | **PASS** preview → real upload → decoded image/reload/read; anonymous deletion denied. Owner removal verified after reload; malformed file rejected by server |
| Browser reusable suites | **PASS** catalogue/comparison, Profile timeout/manual/retry/privacy state, admin filters/history/error recovery |
| Docker `--platform linux/amd64` build | **PASS** final candidate, frozen install/client generation/production build; no publish |
| S3 template offline assertions | **PASS** YAML/intrinsics parsing and public-block/encryption/versioning/least-privilege/no-current-expiry/no-credential-resource assertions. AWS service validation **NOT TESTED** |
| Production client scan | **PASS** 45 JS files, zero exact configured private literals, zero tracked private env files |
| Runtime npm audit | **PASS** zero advisories |
| Full npm audit | **FAIL** five High development entries, unchanged known root issue |

The 76-case command does not enable `BOOTVERSE_BENCHMARK=1`. The remediation's 75-case ledger included the optional benchmark; this run adds two verifier cases and omits that optional case. Do not treat counts as evidence of removed/skipped tests. Existing lifecycle cases cover PostgreSQL sessions, posts/comments/votes, six-rating review aggregates/privacy, creators/moderation, FootProfile, recommendations, catalogue/details and safe failures.

Intermediate failures retained: positive verifier test failed before the script existed; the new paired-target case failed before its validation was added; initial lint rejected a reassigned-never `let` and passed after `const`. An initial browser fill used a stale element ref after navigation; refreshed/atomic login passed. The first image-removal command ended at the browser's confirmation snapshot without a final result; subsequent explicit reload/server-validation assertions established completion, and a separate full upload/read/authorization run returned PASS. Expected invalid-upload/401/503 injections can emit browser resource errors; this is not a blanket zero-console-error claim.

Evidence directory: `/tmp/bootverse-phase42-20261020/` with `unit.log`, `lint.log`, `typecheck*.log`, `build.log`, `integration.log`, red-case logs, `prisma-validate.log`, local/configured migration-status logs, `configured-verification.log`, `browser-*.log`, `docker-build.log`, `audit*.json`, `client-scan.json`. Private temporary connection env is removed after inspection. Logs are local temporary evidence, not hosted CI artifacts.

**NOT TESTED:** isolated Neon provisioning or migrations, a least-privilege remote app role, PostgreSQL 18 application parity, real AWS encryption/IAM/lifecycle/version restore, real email delivery, cloud TLS/cookies/proxy/load, backup/restore rehearsal, scheduled cleanup, hosted Actions, formal accessibility/cross-browser/device coverage. No UI code changed, and earlier responsive evidence was not automatically re-certified.

## 10. Files and CI integration

Phase 4.2 creates `scripts/verify-database.mts`, `tests/database-verification.integration.ts`, `deploy/migration.env.example`, `deploy/s3/staging-bucket.cfn.yaml`, this report; modifies `package.json` (one script), `tests/auth.integration.ts` (invokes verifier cases) and README (usage/link). Phase 4.1 uncommitted files remain separate preparation work, not overwritten.

Existing quality CI calls the integration entrypoint after Prisma generation/build, so new verifier cases are included. No cloud deployment/migration workflow, secret, AWS credential, IAM attachment, new dependency or lockfile edit was added. Hosted Actions themselves were not executed by this task.

## 11. Costs and blockers

Preserve Phase 4.1's **planning estimates**, not a new price quote. Neon isolation adds plan-dependent branch/project compute, storage/history and wake-up charges. S3 adds current/noncurrent storage, request/transfer and retained-bucket costs; versioning and backup retention multiply stored bytes. SSE-S3 avoids deliberately adding a KMS key/service charge, but it does not make storage free. Real budget/region/retention/egress calculation must precede approval. No billable cloud resource, paid feature or new identity was enabled.

Outstanding: exact staging target/owner, budget and source-data policy; independent roles/secrets; backup/restore rehearsal; twelve-migration rehearsal on that target; selected bucket/identity/lifecycle approval; real TLS/email/IAM tests and dependency gate. Local RustFS validates S3 API behavior, not AWS IAM or recovery controls.

## 12. Target-specific approvals before any remote change

1. **Isolation:** approve new staging project/database (preferred) or identified branch, exact source/region/expiry/budget and synthetic-only data policy. Do not infer permission to modify project `holy-frost-99739143`.
2. **Recovery:** approve backup destination/encryption/access/retention, restore-test target, RPO/RTO and recovery owner. Present evidence before migration approval.
3. **Migration/roles:** separately approve roles/permissions and all twelve migrations for a named target/commit, with lock/rehearsal/recovery plan. Current configured non-local DB remains untouched until that specific authorization.
4. **Storage:** approve AWS account/region/bucket name and the actual reviewed template/change set, IAM attachment/credential method, lifecycle/erasure/retention and monthly cap. Template creation is not approval to execute CloudFormation.
5. **Smoke tests:** approve uploading/deleting disposable objects and test records on that newly approved remote staging environment. Never use genuine private profiles as fixtures.
6. **Operations:** approve real secret injection/rotation, scheduler/backup/alerts and their data changes/costs. Deployment, image publication and GitHub push each require separate permission. No Phase 4.3 work starts automatically.

## 13. Completion decision

**CONDITIONALLY READY.** Local database/storage integration, verification tooling and reviewable provisioning configuration are complete. Remote staging is **not created**, and the currently configured database cannot run this application. Approvals, role isolation, recovery rehearsal and actual cloud validation still gate staging provisioning/use; existing tooling advisories remain visible.

Skills actually used: `using-agent-skills`, `ponytail`, `incremental-implementation`, `test-driven-development`, `security-and-hardening`, `code-review-and-quality`, `playwright`, and existing-connection/branch-planning guidance from `neon-postgres` / `neon-postgres-branches`. Previously loaded CI/shipping guidance informed gate review; no deployment is claimed. No UI-design, API redesign, performance optimization or external monitoring implementation is claimed. No subagent was spawned.

Final cleanup/verification: the browser helper confirmed removal of its owned random database, private bucket, objects and captured email. The temporary strict-TLS connection env was deleted; original real env files were preserved. Final workspace build/post-build typecheck and diff whitespace check passed. Localhost:3000 and the temporary QA port:3100 have no listener. No commit, push, remote migration, cloud resource or IAM/credential change was performed.
