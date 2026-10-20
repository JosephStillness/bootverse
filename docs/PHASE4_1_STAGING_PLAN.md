# Phase 4.1 — AWS staging architecture and deployment preparation

**20 October 2026 · Australia/Sydney · baseline `main` / `1d03604`.**

**Decision: CONDITIONALLY READY for staging preparation, not authorized or ready for first cloud deployment.** This change adds reviewed configuration candidates and a release procedure. It does not provision AWS/Neon resources, migrate remote databases, install secrets, deploy, or push. The application remains stopped on localhost:3000.

## 1. Scope and evidence

Read the [original audit](BOOTVERSE_FULL_AUDIT.md), [remediation report](BOOTVERSE_REMEDIATION_REPORT.md) and [existing release runbook](deployment-runbook.md), then inspected current Next/Docker/Prisma/Auth/storage/health/rate-limit/CI implementations. Historical test counts below are dated evidence, not fresh Phase 4.1 test claims. The original audit's missing comparison, static catalogue and absent Docker/health/CI descriptions are superseded by implemented remediation. Their external readiness concerns remain valid.

| Area | Current implementation / readiness |
|---|---|
| App | Next 16.4 / React 19.3 / TypeScript; standalone enabled only by `BOOTVERSE_STANDALONE=1`; build compiles without production DB credentials |
| Container | Digest-pinned Node 24, `npm ci --ignore-scripts`, explicit Prisma generation/build, node UID 1000, exec-form `node server.js`; no env baked in |
| Database | Prisma 7.10 + adapter-pg + pg 8; singleton pool max 10/process, UTC, 5s connection deadline; existing architecture retained |
| Authentication | Auth.js 5 beta.32, Nodemailer SMTP, custom Prisma adapter, DB sessions/tokens; magic links only. No Neon Auth/password migration |
| Email | Existing env points to Resend SMTP; presence is not proof of a valid key, verified sender or Gmail delivery |
| Media | S3 SDK abstraction; random `images/*.webp` keys; private, auth-checked proxy reads; no image bytes in PostgreSQL. Supports default AWS credential chain or paired explicit credentials |
| Local Compose | `compose.storage.yaml` is RustFS development storage only; it must not become staging persistence |
| Health | `/api/health/live` process-only; `/api/health/ready` checks DB and latest migration record. Neither proves full drift, IAM, SMTP or restore readiness |
| Limits | PostgreSQL-backed shared rate buckets, owner quotas and bounded bodies; IP limits depend on a trusted, overwriting proxy |
| Diagnostics | Safe bounded service/request correlation, opt-in Finder timing. No live external log/alert destination verified |
| CI | Existing install/generation/lint/types/unit/schema/build/isolated-DB integration/runtime audit and separate full audit. New manual build-only Docker gate; no AWS credentials or deployment step |

No runtime app, dependency, Prisma schema or migration was changed in Phase 4.1.

## 2. Recommended architecture

**Option A: one Lightsail Linux 2GB instance, Docker app behind host-installed Caddy, isolated Neon staging database, private standard AWS S3 staging bucket, Resend SMTP.** Start with one instance and limited staging testers. Build off-host; do not compile Next on a 2GB staging VM. This accepts one-host failure and brief deploy downtime. It is a staging choice, not an HA production design.

The configured Neon endpoint indicates **AWS Sydney (`ap-southeast-2`)**. Prefer colocating the staging app/bucket with the approved database to avoid avoidable latency/egress; confirm supported plans and costs before purchasing. Local `.neon` identifies project `holy-frost-99739143`, but does not establish the active branch. A hostname is not proof of a staging environment. Verify project, branch ID, endpoint, role and region in Neon Console before any write.

```mermaid
flowchart LR
    Tester[Approved staging testers] -->|HTTPS 443| Edge[Caddy on Lightsail host\nTLS and operator IP allowlist]
    Edge -->|loopback port 3000\nfixed host and sanitized IP| App[Non-root Next.js Docker container]
    App -->|TLS pooled URL| DB[(Isolated Neon staging database\nSydney candidate)]
    App -->|HTTPS SDK\nprivate objects| S3[(Private staging S3 bucket)]
    App -->|TLS SMTP 465| Mail[Resend staging sender]
    Release[Approved single migration job] -.->|TLS direct URL\nmanual release gate| DB
    App -.-> Logs[Bounded local logs and alerts]
    DB -.-> Recovery[Plan-specific history plus encrypted logical backup]
    S3 -.-> Versions[Versioning and reviewed retention]
```

No CDN/shared HTTP cache in front of authenticated APIs or private media initially. Caddy is host-installed so it can use the app's loopback binding; the example is not a container-to-host topology. Keep Caddy certificate state on durable host disk. Replacing the host must restore configuration/certificates or safely reissue certificates; neither certificates nor local Next caches are user-data storage.

| Decision | A: Lightsail | B: ECS/Fargate |
|---|---|---|
| Cost/complexity | Bundled small host; OS patches, Docker/Caddy, disk and recovery are operator work | Task/service, ECR, networking, ALB, log groups, IAM and release configuration; higher fixed floor |
| Scaling | Resize after measurements; eventually move the same image to ECS. One host is a single failure domain | Task scaling/rolling releases; two AZs/tasks for availability cost more. Multi-instance cache and total pool sizing need review |
| Identity | No assumption of an EC2 instance profile or ECS task role. Explicit restricted S3 key/rotation is an approval gate | Separate execution role (image/log/secret delivery) and application task role (only staging objects); prefer temporary credentials |
| Network | Only 80/443 public; SSH from operator CIDR; app 3000 loopback; no exposed Postgres/S3 console | ALB 443 only, target security group accepts only ALB. Public task egress avoids NAT cost but must deny direct ingress; private tasks add NAT/endpoints costs |
| Migration | Same external DB/object contracts; no DB move required to adopt ECS | Same image/runtime env and controlled migration procedure; proxy/IP trust must be redesigned/tested for ALB |
| Recommendation | First low-traffic staging, if key-management/patch responsibility accepted | Prefer when task-role credentials, multi-host operation or managed rolling deployments justify the cost |

Lightsail service-linked roles are not app bucket credentials. AWS documents that Lightsail does not support service roles; do not treat that role as an app role. See [Lightsail IAM](https://docs.aws.amazon.com/lightsail/latest/userguide/security_iam_service-with-iam.html). If the owner requires workload roles without managing explicit credentials, choose ECS instead; do not silently grant broad IAM keys to make Option A work.

## 3. Cost comparison — planning, not an AWS quote

**USD, 730 hours/month, low traffic, before tax/FX; official pages checked 20 October 2026.** Credits/free trials are not assumed. Final Sydney pricing and Neon/Resend plan charges require an owner-approved calculator estimate.

| Item | A: planning allowance | B: reference calculation / allowance |
|---|---|---|
| Compute | Official Lightsail public-IPv4 2GB Linux bundle lists **$12/month**; verify Sydney offer/transfer allowance | US East Linux x86 example: 0.5 vCPU + 1GB continuously ≈ **$18.02/month**, using AWS published per-second rates; this is not a Sydney quote |
| Front door/network | Host Caddy; bundled instance IPv4, no ALB/NAT selected | US East ALB base $0.0225/hour ≈ $16.43/month plus LCU. At $0.005/IP-hour: two ALB IPv4 + one task IPv4 ≈ $10.95/month. Actual IP count varies |
| Logs/storage/backups/DNS/registry/egress | Set aside **$3–18/month estimate**, subject to volume/retention | Set aside **$10–30/month estimate**, plus actual LCU/egress; NAT or extra tasks are additional |
| Rough AWS-only budget | **$15–30/month estimate** | **$60–100/month estimate**, one-task small deployment; not an HA/Sydney commitment |
| External services | Add separately: Neon compute/storage/retention/branch usage and Resend tier/volume | Same; do not count an unverified free tier as zero |

Example B fixed reference subtotal is approximately $45.40 before LCU/storage/logs/egress. LCU usage, NAT, cross-region transfer, backups and orphaned IPv4 can materially change the bill. Optional domains are annual charges. Stopping compute does not erase all storage/address costs. Before provisioning, approve a line-item monthly cap and budget alerts at 50/80/100%; alerts do not impose a spending hard cap.

Sources: [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/) and [bundle table](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html); [Fargate example rates](https://aws.amazon.com/fargate/pricing/); [ALB pricing](https://aws.amazon.com/elasticloadbalancing/pricing/); [IPv4 pricing](https://aws.amazon.com/vpc/pricing/). Dynamic regional rates not retrievable as a verified Sydney quote are deliberately labeled estimates.

## 4. Neon assessment and isolation

### Fresh read-only observation

The existing configured connection succeeded with a `BEGIN READ ONLY` metadata transaction. Endpoint is Neon/pooled, region Sydney, fingerprint `d5cba41a85c8` (hostname hash, not a connection string). No direct override is configured. PostgreSQL major is **18**. Under the connected role, no public base tables or required app tables were visible, including no `_prisma_migrations`. Therefore **all 12 repository migrations remain pending** and this target is incompatible with the current application. This is not proof that every schema/database/project is empty, or permission to initialize it. Branch identity and owner intent remain unverified. No user rows were selected or changed.

### Migration inventory

Apply in repository timestamp order only after target approval. Each later migration assumes earlier objects exist; Prisma history/checksums must agree. PostgreSQL needs UTF-8/Unicode normalization support. Ordinary index builds/ALTER/constraint scans can lock tables; measure on rehearsal data rather than promise zero downtime.

| Migration directory | Purpose/dependency | Data/locking risk |
|---|---|---|
| `20261013010000_account_foundation` | Users, profiles, sessions, tokens, rate limits and constraints | CREATE conflicts with untracked existing objects; unique/format constraints; cascade policies apply to future deletes |
| `20261013020000_timezone_safe_timestamps` | Converts foundation timestamps to timestamptz assuming old values represent UTC | Type conversion/rewrite and locks; wrong legacy timezone assumption changes interpretation |
| `20261013030000_community_posts` | Normalized boots, entries, posts/tags/categories + five real category labels | Requires User; unique/FK/check constraints; category inserts conflict if partially pre-existing; no fake users/reviews seeded |
| `20261013060000_catalogue_generation_integrity` | Generation backfill + composite unique keys/FKs | Explicit transaction; aborts cross-generation entries; UPDATE/NOT NULL and replaces three FK constraints, not data deletion |
| `20261014010000_comments_and_post_votes` | Comments/replies/votes, immutable identity/depth guards, counter triggers | Requires posts/users; indexes and trigger correctness matter on later writes/deletes |
| `20261014020000_boot_reviews` | Exact-variant reviews/helpful votes, six criteria and identity/ownership guards | Requires variants/users; uniqueness/rating bounds; trigger-based write checks |
| `20261015010000_review_sizing_advice` | Nullable bounded sizing advice | ALTER existing BootReview; short lock still possible |
| `20261015020000_creator_media_moderation` | Creators, uploads, deletion queue, reports/audit/verification/videos, sponsorship, comment visibility | Largest migration; replaces comment count function and username constraint (Unicode NFC), adds cleanup trigger/partial unique indexes. Existing data must satisfy new checks; audit FK deletion semantics need review |
| `20261015030000_private_foot_profiles` | Owner-only profile storage, consent/version/bounds constraints | Requires users; no existing measurements copied or made public; new sensitive-data access/backup obligations |
| `20261015040000_recommendation_evidence` | Variant-scoped sourced/approved evidence | Requires variants; payload/date/source bounds; no automatic real-product evidence |
| `20261016010000_review_analysis_consent` | Separate analytical consent/categories + index | Existing reviews default opt-out; shares only with explicit foot sharing; ALTER/check/index lock risk |
| `20261017010000_catalogue_publication` | Publication and sourced-spec JSON + index | Existing entries backfilled **published=true**; new default false. Must review legacy drafts before approval; JSON object check |

No `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` or standalone destructive DELETE was found in the migration chain. There **are** DROP CONSTRAINT replacements, UPDATE backfills, type conversions, and ON DELETE CASCADE/SET NULL/RESTRICT relationships. Do not describe the entire chain as risk-free or wholly additive. Only generation-integrity migration explicitly wraps itself in BEGIN/COMMIT; do not assume Prisma wraps the full chain as one atomic transaction. A failure can leave partial changes and requires reviewed recovery, not blind retries or `migrate resolve`.

### Proposed staging strategy — not executed

1. Confirm actual production/source branch and database with the owner. Protect it; never repoint existing `.env` or infer target from the name “production”.
2. Prefer a **new empty staging project/database** in the same approved region with independent roles/secrets, then rehearse the complete 12-migration chain. This best fits the currently visible empty schema and avoids copying private account/foot data. Creation/cost still requires approval.
3. If preserving an actual source schema is necessary, use a **schema-only branch** (currently Beta, independent root; confirm limits). Do not apply CREATE migrations over pre-existing tables without a reviewed schema/history reconciliation. Schema-only is not an empty database or proof migration history was preserved. [Schema-only documentation](https://neon.com/docs/guides/branching-schema-only).
4. A normal branch for production-like migration rehearsal copies accessible data and needs separate privacy/access approval, an expiry and cost limit. Prefer sanitized synthetic fixtures; never run disposable integration tests against staging/production credentials. [Branching documentation](https://neon.com/docs/introduction/branching).
5. Obtain pooled app and direct migrator URLs privately from the approved staging endpoint. Keep `DATABASE_URL_UNPOOLED` only in the release/backup environment; `prisma.config.ts` reads it before `DATABASE_URL`. This repository does **not** read `DIRECT_URL`.
6. App role: required DML/schema usage and read-only access to migration metadata for readiness after migrations; migrator role owns schema and runs DDL. Validate actual privileges/triggers in rehearsal; do not grant superuser/BYPASSRLS broadly. The same endpoint alone does not establish role isolation.
7. Before any migration: encrypted logical backup with verified direct connection, checksum/manifest and a successful restore into a separate approved database; capture schema/history/constraints/counts. If source is empty, document that metadata rather than skipping target confirmation.
8. Rehearse installed `prisma migrate status`, the approved one-shot `npm run db:deploy`, status and read-only schema diff. No `migrate dev`, `db push`, `reset`, auto-baselining or sample seeding. This document is not authorization to execute these steps.
9. After migration use [`deploy/verify-staging.sql`](../deploy/verify-staging.sql), status and diff. Expect all 12 completed, zero failed rows, no checksum drift, zero unvalidated constraints/invalid indexes/generation mismatches. Ready must return 200; missing/private boot routes must return actual 404.
10. Record migration duration, locks, rollback trigger and backup restoration evidence before exposing traffic. For failed/partial migration stop writes; inspect, forward-repair or restore to an isolated target and reconcile. Prefer app rollback retaining compatible additive columns; never edit applied SQL or drop private data to make status green.

Example **read-only** verification after privileges/env have been separately approved: `PGSERVICE=bootverse_staging_direct psql -X -v ON_ERROR_STOP=1 -f deploy/verify-staging.sql`. Keep passwords in a mode-0600 service/pass file, not shell arguments, output or this repository. Full Prisma diff remains necessary; the SQL is a small set of assertions, not complete schema equivalence.

## 5. Docker and proxy candidates

Files: [`compose.staging.yaml`](../deploy/compose.staging.yaml), [`Caddyfile.example`](../deploy/Caddyfile.example), [`staging.env.example`](../deploy/staging.env.example). Dockerfile remains unchanged because its existing standalone/runtime boundaries meet this preparation scope. Installed Next 16.4 self-hosting/output docs were consulted.

- Build off-host for **linux/amd64** to match the proposed x86 Lightsail host; do not upload the prior arm64-only image. The base-image digest is pinned, but security patch freshness and base OS scanning remain approval gates. Frozen npm install does not guarantee byte-identical application images; record commit, target platform and immutable image digest.
- Compose never builds or migrates. Requires an explicit image, injects a private env file at runtime, listens on loopback only, drops Linux capabilities, forbids privilege escalation, limits PID/CPU/memory, rotates bounded logs and allows 60s shutdown. `init: true` forwards signals/reaps children. Review limits with measured image-upload/Finder workloads before calling them sufficient.
- Healthcheck is inherited from Dockerfile. Docker/Compose alone does **not** restart a merely unhealthy but running process. External readiness monitoring/operated recovery is required.
- Exec-form Node receives SIGTERM; Next drains according to its installed behavior. Local idle-stop verification is not proof that uploads/SMTP/transactions survive a loaded shutdown. Drain tester traffic before stopping; never run overlapping old/new containers with unreviewed migration compatibility.
- No persistent app upload volume. Next/image caches can be disposable and writable; user state remains in Neon/S3. Do not force read-only rootfs without testing Sharp/Next cache writes. Private keys/DB secrets belong outside images/build args and public Next variables.
- Caddy candidate expects direct internet clients, a fixed approved domain and operator CIDRs. Its documentation-only allowlist intentionally prevents public staging access until edited. Bind SSH to admin CIDR in Lightsail firewall; handle IPv6 too. Deny direct 3000; Docker's explicit loopback binding is essential.
- Proxy overwrites Host, forwarded host/proto and `X-Real-IP`, strips alternative client headers; app uses `AUTH_TRUSTED_IP_HEADER=x-real-ip`. Do not place Cloudflare/ALB in front unchanged: `{remote_host}` would identify the proxy, not the tester. Option B needs a separately tested trusted-ALB address extraction boundary; do not trust client-supplied XFF's first value. Keep the IP header unset there until reviewed.
- Request cap 12MB accommodates the existing max 10MiB upload plus multipart overhead; default app max stays 5MiB. CSP is preserved; it is currently partial (no complete script/default-source policy). Staging HSTS is one day, no preload/includeSubDomains; test HTTPS before enabling it.
- No proxy access logs by default because magic-link callback URLs contain tokens. Review Caddy error logs for privacy before forwarding them; don't export raw URL/query, headers/cookies, emails, private dimensions or SQL. Configure safe aggregate metrics separately.

Config-only check (does **not** start services):

```sh
STAGING_ENV_FILE=./staging.env.example BOOTVERSE_IMAGE=bootverse:check \
  docker compose -f deploy/compose.staging.yaml config --quiet
```

Avoid `docker compose config` without `--quiet` when using real secrets; rendered output contains them. Real Compose substitution variables (`BOOTVERSE_IMAGE`, `STAGING_ENV_FILE`) are operator inputs, separate from the container env file. Pin `BOOTVERSE_IMAGE` to an approved `registry/path@sha256:...`, not a mutable tag.

## 6. Staging environment and identity

Use the example only as a list of keys. Install a real `/etc/bootverse/staging.env` owned by the deployment operator/root, mode 0600; never run with placeholders. Allow Docker administration only to trusted operators (Docker access is effectively root access). `.gitignore` and build context exclude accidental `deploy/*.env` copies. Do not put a direct migration URL or cloud provisioning keys into the web container.

| Key | Required contract |
|---|---|
| `DATABASE_URL` | Approved staging pooled **app-role** URL, explicitly `sslmode=verify-full`; 10 connections/app process plus maintenance must fit plan limits |
| `DATABASE_URL_UNPOOLED` | Direct staging migrator/backup connection only; no fallback to pooled migrations; not `DIRECT_URL` |
| `AUTH_SECRET` | New independent random secret ≥32 characters; local/production secret must not be reused. Generate privately; no key rotation in this task |
| `AUTH_URL` | Exact `https://staging.<owned-domain>` origin, no path/query/trailing whitespace. Existing fixed-origin checks are preserved |
| `AUTH_TRUST_HOST` | Not necessary: existing Auth.js config sets `trustHost:true`; fixed origin + sanitizing proxy + denied direct ingress are mandatory |
| `EMAIL_SERVER` | Resend SMTP `smtps://resend:URL_ENCODED_KEY@smtp.resend.com:465`; independent scoped key, never browser-visible |
| `EMAIL_FROM` | Verified owned staging sender domain/subdomain. `.local`, `.example.com` and an arbitrary Gmail From are not deliverable production identities |
| `AUTH_TRUSTED_IP_HEADER` | `x-real-ip` for this exact direct-Caddy topology; don't assume ALB's headers work unchanged |
| `S3_BUCKET`, `S3_REGION` | Independent private staging bucket in approved region; all public access blocked, Object Ownership enforced, encryption and versioning/retention reviewed |
| `S3_ENDPOINT` | Omit for standard AWS S3; no localhost. Non-AWS provider endpoint requires a separate approved policy/TLS check |
| Custom S3 keys/token | Option A approved restricted rotation path; Option B omit both custom keys/token for task role. Partial keys fail closed |
| Upload limits | Preserve current 5MiB/4 images/100 per user/100MiB quota until measured change is separately reviewed |
| Public application URL | `AUTH_URL` is the currently read public origin; no extra `NEXT_PUBLIC_APP_URL` key is invented. Some metadata still uses relative links; verify rendered canonical/social metadata after domain approval |
| Logs/timing | `BOOT_FIT_TIMING_LOGS=0` initially; stdout bounded operational events only; no monitoring credential added without provider approval |

SMTP source: [Resend SMTP](https://resend.com/docs/send-with-smtp). `smtps` uses TLS immediately; localhost capture is not a delivery test. Verify test-recipient restrictions and plan/domain permissions before sending genuine mail. Never enable the local demo-login path in staging; follow existing real magic-link authentication.

### S3 least privilege

App principal needs only `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` for `arn:aws:s3:::APPROVED-STAGING-BUCKET/images/*`. It does not need bucket creation, public ACLs, `s3:*`, whole-account storage or production bucket access. Current cleanup removes known queued keys, not arbitrary prefixes; verify exact requirements before adding ListBucket. Versioning makes DeleteObject create a delete marker; private erasure includes historical versions/backup policy. Do not grant permanent version-delete rights to the web app merely for cleanup.

Backup/recovery operator has separate version/list/restore rights. If SSE-KMS is selected, scope key permissions separately; do not select its extra cost by default. Reject non-TLS bucket access and use no public website bucket. A compromised app with DeleteObject can delete live objects; versioning and separate retention administration limit that risk. No real IAM policy or key was created here.

## 7. CI/CD preparation

The existing quality workflow now also supports **manual `workflow_dispatch`**, with a Docker validation/build-only job depending on both application and full-audit gates. It has read-only repository permission, pinned action commits, timeout and no AWS identity, `id-token:write`, registry login/push, deploy step or remote migration. Current High audit findings intentionally prevent the image gate from proceeding; no `continue-on-error`, downgrades or exception suppression were added.

Build stages: frozen script-disabled install → explicit client generation → lint/types/units/schema → production build/post-build types → isolated local PostgreSQL integration/runtime audit → full dependency audit → manually requested Docker config/image verification. Integration harness creates its own random loopback test DB. Existing hosted workflow does not execute the private-S3/browser gate; run those in isolated services before release. Do not inject staging/production secrets into PR or fork jobs.

No automatic deploy pipeline is activated. Future deployment requires a **separate** reviewed release workflow, protected `staging` GitHub environment with required human reviewers, pinned reviewed SHA/image digest, scoped OIDC trust for exact repository/environment, least-privilege publish/deploy roles, and a separate manually approved migration job. Disable self-approval if available. `workflow_dispatch` by itself is not a deployment approval/security boundary. Branch protection/environment capabilities and actual Actions runs have not been configured/verified here.

No cloud mutation commands are executed by the checked-in Phase 4.1 workflow. New image publication, SSH/deploy automation, OIDC trust or protection changes require explicit authorization.

## 8. Monitoring, backups and maintenance

Start low cost, keep an operator owner and test alert delivery. Proposed thresholds are staging starting points, not proven SLOs:

- External liveness every minute; readiness every five minutes, alert after two failures. Readiness DB probes can prevent Neon's idle suspension and add cost; tune frequency or intentionally disable external probes outside test hours. Don't claim scale-to-zero savings while polling constantly.
- Alert CPU >80% for 10min, memory >80% of limit, disk >80%, app restart/health failures and safe 5xx rate >1% for 5min with meaningful request volume. Measure p95 baseline before latency-based rollbacks. Lightsail built-in metrics do not prove per-container memory/disk coverage; choose reviewed host agent/tool if needed.
- Docker local logs: max 3×10MB; journal/Caddy need independent rotation. Start 7-day restricted log retention; metadata only, redact error contexts before export. CloudWatch/log/error-provider setup, billing and credentials are approval gates, not installed features.
- Cost budgets/alerts before provisioning; inventory idle compute/IPv4/snapshots/storage monthly. Never place secrets in alarm descriptions or user dimensions.
- Auth/image cleanup: reuse `npm run db:cleanup` / `npm run storage:cleanup` from a separately reviewed tooling/maintenance image or secure checkout, once/hour with single-worker lock, safe timeout/retries and backlog alarms. Runtime standalone image does not include Prisma CLI/maintenance scripts. Do not add them to the app startup. Cleanup changes data: schedule only after staging-owner approval and verify queued deletions first.
- Database: owner-approved target **RPO 24h / RTO 4h for synthetic staging only**. Confirm actual Neon plan history retention; it is not a free/unlimited backup guarantee. Daily encrypted direct `pg_dump`, pre-migration dump and weekly restore exercise to a separate approved target. Verify schema, constraints, migration history, counts and functional login/post/review/Finder paths. Keep backup keys separate; restrict/delete old sensitive dumps by policy.
- A normal branch shares project administration; separate project/backup access adds isolation. A branch snapshot is not protection against project/account compromise. Independently retained encrypted exports are needed if that threat is in scope.
- S3: enable versioning before tester uploads, reviewed noncurrent-version retention/lifecycle (initial proposal 14 days), encryption/public-block/policy checks, version restore exercise. Define consent/erasure handling across versions and DB backups. Snapshots of the host are for configuration/cert recovery, not a substitute for Neon/S3 backups. Test account/foot data remain synthetic until privacy/retention approval.
- Recovery drill: restore DB and matching object versions privately, compare references, verify no public access, then owner-authorized traffic cutover. Record lost-write window/RPO/RTO. Do not overwrite the existing source as a “test”.

## 9. First staging release — instructions requiring future approval

**Do not execute this section based on this document alone.** Each gate below needs an explicit owner decision. No AWS creation CLI/Terraform apply or self-deploy script is included.

1. Approve Option A/B, AWS account/region, exact monthly budget, named operator/testers, domain and CIDRs. Confirm no production traffic or genuine private foot data will be collected yet. Reconcile upstream tooling risk with a compatible fix; current workflow remains blocked rather than hiding it.
2. Approve independent Neon target/roles, empty/schema-only/sanitized strategy, expiration/cost, direct URL and backup/restore rehearsal. Reconfirm all twelve SQL files/visibility backfill and schema. Run a remote migration only under separate target-specific approval, never as Docker build/start side effect.
3. After infrastructure approval, provision the selected instance/firewall/static IP, private bucket and restricted identity, Resend verified staging sender, DNS and budgets using reviewed account-specific configuration. No default public bucket/DB port. Retain IDs privately.
4. Install/patch Docker Compose and Caddy on the host; validate example after replacing domain/CIDRs. Restrict management ingress and preserve Caddy state. Inject approved secrets outside checkout and keep migrator credentials out of web env. Verify host time synchronization/UTC.
5. Run existing application/isolated PostgreSQL/storage/browser release checks. Build immutable **linux/amd64** candidate off-host, scan OS/runtime image, record digest and publish only to approved registry after authorization. Build image without runtime credentials. Image publishing may incur storage/transfer charges.
6. Resolve staging schema gate, test read-only verification and readiness, then curated sample-labeled catalogue only if approved. Do not run `db:catalogue` automatically: its deliberate development sample import is not a real-product data source.
7. On the approved host only: set `BOOTVERSE_IMAGE` to recorded immutable digest and `STAGING_ENV_FILE` to the private file; run `docker compose -f deploy/compose.staging.yaml config --quiet`. A human approves that precise release/target, then starts `docker compose -f deploy/compose.staging.yaml up -d --no-build`. This command is documentation, **not executed here**. No migration is part of it.
8. Validate app loopback liveness and readiness; Caddy TLS/domain before testers use it. Confirm public 3000 is unreachable, wrong Host/origin rejected, spoofed IP overwritten, ordinary users denied admin APIs and unrelated networks denied staging. Inspect actual Secure/HttpOnly/SameSite auth cookie behavior over HTTPS.
9. Test real recipient magic link → single use → reload → logout; complete post/comment/vote/review/helpful/upload/delete/creator/moderation/Profile/Finder/comparison flows with disposable tester records. Test queued-object cleanup and independent privacy/analysis consent. Measure image memory and representative concurrent cloud traffic without private inputs in telemetry.
10. Rehearse rollback to previous digest/config with draining; retain schema/data unless a reviewed repair/restore is needed. Ready alone does not declare success. Operator watches the first hour and records health/error/latency/billing evidence. If privacy/access/integrity fails, close tester access immediately; app restart alone is not a security response.

For first release with no previous working image, rollback is **stop tester access/stop candidate**, preserve DB/S3 and investigate. Later release rollback replaces the image with the known previous digest, verifies schema compatibility and smoke tests. Never roll back by dropping tables or resetting the database.

## 10. Approvals and blockers

Explicit approval is required **before**: (1) any AWS billable resource/registry/budget integration; (2) Neon project/branch/role creation and every remote migration/reconciliation; (3) IAM keys/policies/OIDC, secret delivery and rotation; (4) domain/DNS/TLS/verified sender changes; (5) publishing an image or deploying the reviewed digest to staging; (6) enabling maintenance jobs or data-changing remote tests; (7) GitHub push/protection/environment/release automation. Approval must name target, scope, budget, data handling and recovery owner. A plan approval does not imply permission for all seven actions.

Remaining High gates: remote schema/history/branch isolation, unapproved cloud/storage identity, real email/TLS/secure-cookie checks, backup/restore and the failing full dependency audit. Medium follow-ups: pg concurrent-client deprecation, pg SSL-mode future semantics, generated-file duplication, image OS scan and loaded shutdown/load tests. Existing CSP/privacy/self-report limitations remain documented in the remediation report. No forced dependency upgrade or suppression was applied.

## 11. Phase 4.1 verification ledger

The final executed command results are recorded below after local validation. Earlier **226 unit / 75 integration** counts and responsive browser results are historical remediation evidence; this configuration-only change does not automatically renew those claims. No browser redesign or cloud operation is in scope.

| Check executed 20 October | Actual result |
|---|---|
| Fresh `npm test` | PASS: 226/226 tests, 24 files, zero failed/skipped |
| `npm run lint` | PASS, exit 0 |
| `npm run typecheck` | PASS, exit 0; no duplicate generated declaration error in this run |
| Installed `prisma validate` | PASS, exit 0; no schema change |
| Read-only configured `prisma migrate status` | FAIL release gate, exit 1: twelve pending; no migration applied |
| Remote metadata transaction | PASS read-only inspection, PostgreSQL 18; zero visible public base tables, no app/history tables. Application schema readiness FAIL |
| `deploy/verify-staging.sql` against guarded existing localhost DB | PASS: 12 completed, zero unvalidated constraints, invalid indexes or generation mismatches; no local migration/data write |
| Compose placeholder `config --quiet` | PASS; absent `BOOTVERSE_IMAGE` deliberately rejected in a separate assertion |
| Workflow syntax/safety assertions via installed `js-yaml` | PASS: manual image trigger, both dependency gates, read-only permissions, no deploy/push/migration commands in new job |
| Offline Caddy validation | PASS with networking disabled; no certificates issued. Initial formatting warning corrected; final validation has no formatting warning |
| `docker build --platform linux/amd64 -t bootverse:phase41 .` | PASS: frozen install, Prisma generation and production Next build inside Linux image. No runtime DB/auth/storage secrets supplied |
| Final local image | linux/amd64, **107,851,906 bytes (~102.86 MiB)** uncompressed local image size; not registry transfer size. Non-root UID 1000; `/app/.env` and `/app/.local` absent |
| Container HTTP without DB env | PASS: live 200/no-store; ready 503/no-store as intentionally expected. Not a cloud/full-app smoke test |
| Idle SIGTERM/cleanup | Stopped in **269ms**, exit **143** (SIGTERM), no OOM; owned test container removed. Loaded request/transaction drain NOT TESTED |
| `npm audit --omit=dev --json` | PASS: zero runtime advisories |
| `npm audit --json` | FAIL: five High entries from one braces lint-chain advisory; no forced incompatible downgrade or lockfile changes |
| Diff/secret/config review | PASS: `git diff --check`; nine changed/created files, zero configured private literal matches or private env candidates. No actual env values printed or modified |

A first optional workflow-validation probe failed because the `yaml` module was absent. It was rerun successfully using the existing `js-yaml` dependency; no package was installed. Initial Caddy formatter/validation emitted a formatting warning before tabs were corrected. Those attempts are not represented as passes. The local amd64 runtime used emulation on an arm64 machine; initial Docker warning reflects that architecture difference, not native AWS verification.

The direct read probe also exposed a **pg SSL-mode future-semantics warning** for existing configuration; new staging examples explicitly use `sslmode=verify-full`. The Linux frozen install also warned that ESLint 9.39.5 is no longer supported. This is a development-tooling maintenance follow-up, not evidence of an additional runtime advisory; a compatible upgrade requires separate testing. The earlier concurrent-client pg warning is still an unresolved compatibility finding; no driver/app upgrade was made or claimed to fix it.

Evidence: local `/tmp/bootverse-phase41-20261020/` contains `unit.log`, `lint.log`, `types.log`, `prisma-validate.log`, `migration-status.log` (private), `audit.json`, `audit-runtime.json`, `docker-build.log`, and `caddy-final.log`. Console results above are actual observations. Source/config files reproduce the config checks; logs are temporary local evidence, not hosted CI artifacts.

**Not executed in Phase 4.1:** full 75-case integration/storage/browser suite, current workspace-root production build (the fresh Linux Docker production build did run), Actions on GitHub, native AWS runtime, image OS vulnerability scan, cloud provisioning/load tests, actual SMTP delivery, TLS issuance/HTTPS cookies, IAM/S3 calls, backup/restore, scheduled cleanup, loaded shutdown or remote migrations. Existing tests from remediation remain historical evidence only.

Skills actually loaded/applied: `using-agent-skills`, `ponytail`, `ci-cd-and-automation`, `shipping-and-launch`, `security-and-hardening`, `code-review-and-quality`, `neon-postgres` and `neon-postgres-branches` (planning guidance only; branch creation explicitly prohibited). Neon parent overview and installed Next output/self-hosting docs were consulted. No UI/Playwright skill is claimed for this configuration-only task. No subagent was spawned.

**Final assessment: CONDITIONALLY READY.** Architecture/configuration preparation is complete. First cloud deployment still requires the seven target-specific approvals in section 10 and successful remote migration rehearsal, real identity/TLS/email/storage/backup checks. Nothing in this report grants deployment or spending authorization.
