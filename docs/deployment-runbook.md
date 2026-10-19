# Release preparation — no deployment authorization

This runbook prepares a future staging/AWS release. No AWS runtime, DNS, paid resources or production schema has been provisioned by remediation.

## Migration gate

1. Confirm target environment, owner, database name and **direct/unpooled** connection in a private channel. Do not infer environment from an existing `.env`. App traffic can retain its pooled URL. Prisma config prefers `DATABASE_URL_UNPOOLED` for CLI operations.
2. Inspect `prisma migrate status` read-only and inspect existing schema/history. Pending migrations do not prove the database is empty. Never reset, auto-baseline or mark applied without a reviewed schema comparison.
3. Back up with encrypted storage and restricted access. Use a private PostgreSQL service/password file (0600), not a credential URL in a shared command line. Example with preconfigured `PGSERVICE=bootverse_backup`: `pg_dump --format=custom --file=release-backup.dump`. Treat the dump as sensitive; never commit it.
4. Restore that backup into an isolated staging environment. Verify restore completeness, FK/check constraints and existing content. Review all pending SQL, especially custom triggers and the new additive catalogue migration. Review the publication backfill: pre-existing catalogue entries become visible, so identify any legacy drafts before approval. Rehearse migration using the same PostgreSQL/Prisma versions and representative volume; observe lock time.
5. Release owner approves target/backup/rehearsal before **any remote write**. Run a single release job with the direct URL privately injected: `npm run db:deploy`. Do not run it in every web container or apply `migrate dev` remotely. No production sample seeding.
6. Verify `prisma migrate status`, schema diff (read-only, `--exit-code`), required counts/constraints, readiness, published/unpublished routes and critical account/community/review/Finder paths. Retain release ID and safe logs.
7. Recovery: stop affected writes and assess data first. This migration is additive; prefer application rollback retaining the new columns/index and data. Do not drop columns or rewrite applied migration history. For incompatible failures, reviewed forward repair or isolated backup/PITR restoration plus reconciliation is required. Verify the restored target before traffic cutover; document potential writes since backup and owner-approved RPO/RTO.

Current configured non-local target has pending history and is **not approved for migration**. Local disposable migrations are not evidence of remote readiness.

## Runtime and configuration

- Choose AWS runtime/network strategy; review the currently pinned Node 24 base-image digest before promotion. `Dockerfile` is a local-tested candidate, not an ECS/EKS/Lambda deployment. Review runtime-image scan and CPU architecture before promotion.
- `docker build -t bootverse:local .` excludes `.env*`, `.local`, `.git`, dependencies and local caches. Runtime is non-root standalone Next; inject secrets at runtime. The image has no Prisma CLI/cleanup runner. Use the build/tooling stage or a separately hardened maintenance image for release/cleanup commands.
- Required app env: `DATABASE_URL`, strong `AUTH_SECRET`, exact HTTPS `AUTH_URL`, working `EMAIL_SERVER` and verified-domain `EMAIL_FROM`. Never bake any into image/Next public variables. Real email deliverability and secure production cookies must be tested.
- Storage: private persistent bucket, `S3_BUCKET`, region, optional validated `S3_ENDPOINT`. Omitting custom `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` uses the SDK's normal credential chain, including task roles. Explicit keys must be paired; optional `S3_SESSION_TOKEN` supports temporary custom credentials. Do not set static keys when a task role is intended. Real IAM least privilege/policy/rotation is unverified.
- Keep uploads private; allow only the app role to Get/Put/Delete its prefix and the cleanup worker's needed permissions. No arbitrary client paths or public bucket ACLs.
- Reverse proxy must terminate TLS, preserve the approved origin, block direct untrusted access and overwrite whichever supported trusted-IP header is configured. Existing Auth client-IP support is `x-real-ip`/`cf-connecting-ip`; do not trust ALB/user-supplied forwarded values automatically.
- Pool capacity: ten connections per app process; fit replicas, release jobs and workers within DB limits. Measure queue/wait and query latency before increasing capacity.

## Health, diagnostics and scheduled maintenance

- `/api/health/live`: process HTTP liveness, dependency-independent, no-store.
- `/api/health/ready`: read-only DB connection/latest-migration metadata check, 503 on failure. It is not a full drift, SMTP or bucket/IAM probe; those need staging smoke checks.
- Unexpected community/platform/catalogue API failures have `x-request-id` and an allowlisted `service_failure` log category/status. Recommendation logs retain named stage timing and opt-in successful timing. Do not add URLs, input, emails, IDs, measurements, exception strings or stacks to logs.
- Configure log retention, error-rate/readiness alerts, p95 latency, DB pool saturation and cleanup backlog. Keep private profile/input data out of telemetry. No external monitoring delivery is claimed.
- Schedule `npm run db:cleanup` and `npm run storage:cleanup` from reviewed single-worker jobs; start hourly, monitor failures/backlog, then tune to measured volume. Scripts batch safely; they do not schedule themselves. Auth cleanup and one-hour abandoned image cleanup are not a user-data retention policy.
- Define privacy retention/export/erasure and backup handling, incident response and moderation staffing before collecting real foot data. Establish RPO/RTO and restore exercises.

## CI and release gates

`.github/workflows/quality.yml` uses read-only repository permissions and pinned action revisions. It runs frozen script-disabled install, explicit Prisma generation, lint, types, units, schema validation, build, post-build types, isolated DB integration and runtime audit. Its PostgreSQL trust configuration is only for the disposable loopback CI service, never a real deployment.

The separate full-audit job deliberately remains red while upstream `braces` is vulnerable. No audit suppression or forced lint downgrade is included. Restrict untrusted forks/PRs: no production secrets, privileged runners, deployment tokens or `pull_request_target` execution. Review code and dependency scripts before execution.

Full private-S3 and browser acceptance must also pass with isolated storage/SMTP before release; the hosted workflow does not claim those gates. Current automated workflow has not been run on GitHub until the user authorizes a push. Linux/container, proxy/TLS, real email, IAM, migration rehearsal, backup restore and rollback evidence are separate checks.
