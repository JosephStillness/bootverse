> Historical Sprint 2.1 report. Sprint 2.2 is now implemented; see [Community + Posts](phase-2-community.md) for current status and setup.

Historical sprint delivery notes. Structured reviews are now implemented in [Sprint 2.4](phase-2-reviews.md); use that document and the README for current verification and scope.

# Phase 2 — Sprint 2.1 foundation

Status: implemented and verified locally. This sprint establishes accounts, profiles and authorization. Community feeds, posts, comments, votes, boot reviews, uploads and moderation UI are not implemented yet. Phase 1 catalogue data, filters and boot pages remain unchanged. There was no previous database/auth infrastructure to replace.

## Routes and API

| Route                          | Behavior                                                             |
| ------------------------------ | -------------------------------------------------------------------- |
| `/register`                    | Email registration; account created only after verifying the link    |
| `/login`                       | Passwordless email login for new/existing members                    |
| `/check-email`                 | Single-use link / expiry instructions                                |
| `/account`                     | Protected public-profile settings, logout, revoke all sessions       |
| `/users/[username]`            | Public display name, username, bio and join date; initial avatar     |
| `/api/auth/[...nextauth]`      | Auth.js CSRF, email sign-in/callback, session and sign-out endpoints |
| `PATCH /api/account/profile`   | Validated owner-only update; JSON username/displayName/bio           |
| `DELETE /api/account/sessions` | Revoke the current user's sessions on every device                   |

Navigation includes My account on desktop and mobile. No navigation points at unfinished community routes. Avatar files and activity history arrive with their respective later sprints. No seeded users, reviews, ratings or engagement counts exist.

## Authentication

Auth.js v5 (`5.0.0-beta.32`, explicitly pinned), Prisma adapter and Nodemailer implement email magic links. Registration and login use the same verified-email flow. There are no passwords, password hashes or reset-password endpoints. The email link verifies mailbox ownership and creates the account only on first successful use. Links last 15 minutes, are hashed in the database, and are consumed once by the adapter. Sessions are opaque database-backed sessions lasting up to 30 days, renewed by Auth.js; normal logout deletes the current session, and the separate account endpoint deletes all sessions for that user.

`User` and `UserProfile` are created atomically in the adapter. The initial public username is random and the display name is "Boot enthusiast"; neither is derived from the private email. Users choose their public identity in settings. Email changes, account deletion, OAuth and password login are outside this sprint.

Public queries explicitly select only username, displayName, bio and join date. Session responses omit email. Public profiles omit account IDs, role, verification state, session tokens and email. Bio is plain text escaped by React, never raw HTML. Suspended/unverified accounts cannot perform account mutations, and their profiles are not public.

## PostgreSQL schema and migrations

- `User`: private email identity, verified timestamp, USER/MODERATOR/ADMIN role, ACTIVE/SUSPENDED status.
- `UserProfile`: unique owner and normalized unique username, display name and bio.
- `Session`: unique token, owner FK with cascade deletion, expiry index.
- `VerificationToken`: unique token and composite identifier/token constraint, expiry index.
- `RateLimit`: hashed window key, atomic counter, expiry index.

Two additive migrations create the foundation and make timestamps timezone-aware. PostgreSQL `timestamptz` stores instants; Prisma connections explicitly use UTC because the pg adapter normalizes timestamp text as UTC. Integration tests run with a non-UTC local PostgreSQL timezone and verify expired links are refused.

The Phase 1 catalogue is still fixture-backed. Do not duplicate boot names into future posts/reviews: Sprint 2.2/2.4 should add normalized catalogue tables preserving existing IDs, then reference an exact outsole variant for reviews and an optional catalogue entry for colorway context. No speculative community tables were added in this foundation sprint.

Roles cannot be set through profile input. `requireModerator` provides a tested guard for future administrative handlers. No admin UI or public role-promotion endpoint exists. Provision moderator/admin roles with a trusted database administrator; never derive privileges from a username or email submitted by a client.

## Setup

Requires Node 22.12+ (tested on Node 24), npm, PostgreSQL and SMTP. The catalogue runs without account configuration; account routes fail closed and show an explicit setup message.

```sh
npm ci
cp .env.example .env
# Edit .env with your dedicated PostgreSQL database, random secret, origin and SMTP.
npm run db:deploy
npm run dev
```

Generate a secret with `openssl rand -base64 32`. Keep `.env` private and never commit it. `AUTH_URL` must be a fixed public origin without a path, query or credentials. HTTPS is required for public hosts. HTTP is supported only for localhost/loopback previews. Auth.js uses secure cookies for HTTPS, HTTP-only cookies, SameSite protection and its CSRF token flow. Account mutation endpoints require an exact Origin match as an additional CSRF check. Configure reverse proxies to preserve the fixed public host/origin; untrusted forwarded IP headers are not used for limits.

| Variable       | Purpose                                                          |
| -------------- | ---------------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection URL (use TLS appropriate to your provider) |
| `AUTH_SECRET`  | At least 32 characters of cryptographically random secret        |
| `AUTH_URL`     | Canonical origin, e.g. `http://localhost:3000` locally           |
| `EMAIL_SERVER` | SMTP transport URL with credentials when required                |
| `EMAIL_FROM`   | Sender address authorized by the SMTP provider                   |

For local testing without external email delivery:

```sh
# Separate terminal; refuses NODE_ENV=production and binds only loopback.
npm run dev:mail
# EMAIL_SERVER=smtp://127.0.0.1:1025
# EMAIL_FROM=BootVerse <noreply@bootverse.local>
```

The development mail sink writes messages to ignored `.local/mail/*.eml` with private file permissions. Open the newest `.eml` to use its sign-in link. These files contain authentication links: keep them private and remove them after use. This tool is not a production mail service. No emails are sent externally by the local sink.

For this workspace, a dedicated Homebrew PostgreSQL cluster is initialized in ignored `.local/postgres`, listening on `127.0.0.1:55432` with a random password in ignored local files. To restart/stop it:

```sh
pg_ctl -D .local/postgres -l .local/postgres.log -o '-h 127.0.0.1 -p 55432 -k /tmp' start
pg_ctl -D .local/postgres stop
```

This optional workspace configuration is not required on other machines. Create a dedicated database on your own PostgreSQL instance and set `DATABASE_URL`. No Docker daemon, cloud database, storage account or deployment was created.

## Security and maintenance

- Authentication and fresh account status/role checks run at the server/data boundary; settings never trust client owner IDs.
- Zod strict objects reject unknown/privileged fields; username rules are also constrained in PostgreSQL. Unique constraints resolve concurrent username collisions.
- Mutating request bodies are bounded by bytes, including chunked bodies; profile updates max 4 KiB and auth requests max 8 KiB.
- Email requests: 3 per email per 15-minute fixed window and 60 total per hour. Auth POST requests: 300/minute globally. Profile updates: 20/minute per account. Database atomic upserts share these limits across processes. Keys are HMACs rather than raw emails. Requests fail closed if the database is unavailable.
- Fixed windows permit bursts near boundaries. Global limits intentionally favor a small early community; tune thresholds and add trusted-edge IP limits/anti-bot protection before opening registration to a large audience. Global limits can also cause shared availability loss under abuse; this is not a full DDoS defense.
- Auth errors log only error names, not SMTP payloads, addresses, tokens or connection credentials. Auth endpoint access logging is suppressed in Next.js development mode so callback query tokens do not appear in the terminal. Do not enable auth debug logging publicly.
- Periodically run `npm run db:cleanup` to delete expired tokens, sessions and rate buckets. No production scheduler is provisioned in this sprint.
- Dependency overrides pin patched Nodemailer 10.1.0, deepmerge-ts 8.0.2 and mysql2 3.24.5 because upstream Auth.js/Prisma ranges currently pull vulnerable releases. SMTP lifecycle, Prisma generate/migrations and production build were verified with these overrides. Revisit them when upstream ranges include the fixes.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:integration
npm audit --omit=dev
```

Integration tests require a running **local** PostgreSQL server and a role allowed to create temporary databases. The harness creates `bootverse_auth_test_<random>` and applies committed migrations, starts a production Next.js server and loopback SMTP sink, uses actual email callbacks/cookies, then deletes the test database. It never seeds the application database and never delivers external email. Run `npm run build` before integration tests; they use its production output. Do not build concurrently with `next dev` against the same `.next` directory.

Verified: typecheck, ESLint, 51 unit tests, 10 HTTP/PostgreSQL/SMTP integration tests and production build. The suite checks registration, verified identity/profile creation, anonymous rejection, CSRF, link replay/expiry, persistent/expired sessions, owner-only input, concurrent username collisions, public privacy/XSS escaping, suspension, revocation, rate limiting unconfigured account-service fallback and Phase 1 rendering. Browser QA covers email submission/confirmation, profile validation/save/public link, mobile menu focus/Escape and layouts at mobile/tablet/desktop widths. Temporary UI QA accounts are removed after verification.

Runtime audit: zero vulnerabilities. Full audit: five high findings in the existing ESLint glob/braces chain; no compatible patch is currently provided by the installed Next lint config. Do not use `npm audit fix --force` to downgrade Next's lint tooling. External SMTP delivery, full assistive-technology/cross-browser QA, load tests and penetration testing were not performed.

## Sprint boundary and next steps

| Sprint                                             | Status           |
| -------------------------------------------------- | ---------------- |
| 2.1 Database/auth/profile/authorization            | Complete locally |
| 2.2 Community feed and post CRUD                   | Not started      |
| 2.3 Comments, replies and voting                   | Not started      |
| 2.4 Reviews, aggregation and boot integration      | Not started      |
| 2.5 Uploads, reporting/moderation and final polish | Not started      |

Continue with Sprint 2.2 after reviewing this foundation. Phase 2 as a whole is incomplete; Phase 3 Boot Fit Finder is not ready because no review/fit-observation data exists yet.

References: [Auth.js email provider](https://authjs.dev/getting-started/providers/nodemailer), [Prisma adapter](https://authjs.dev/getting-started/adapters/prisma), [Prisma PostgreSQL adapter](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql). Installed Next.js guides in `node_modules/next/dist/docs/` were used for the App Router APIs.

## Trusted proxy limits and dependency advisory

`AUTH_TRUSTED_IP_HEADER` is optional for local development. For a public deployment, configure `x-real-ip` or `cf-connecting-ip` only when a trusted reverse proxy overwrites that header and direct access to the Next server is blocked. Never trust an arbitrary incoming `X-Forwarded-For` list. Once enabled, missing/invalid client addresses fail closed, auth POSTs are limited to 30/minute per client and email requests to 10/15 minutes per client. Canonicalized addresses are stored only as HMAC bucket keys. Without this proxy setup, per-email and global protection remains active but distributed/rotating-address abuse is not fully prevented.

Per-email rejection now returns before the global SMTP budget is consumed; suspended-account requests also do not spend it. Global budgets remain intentional mail-cost safeguards, not a DDoS service.

The [braces advisory GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) currently lists no patched release; npm also reports 3.0.3 as latest. Keep the compatible Next 16 lint tooling rather than force-downgrading it. This is a development-only dependency, absent from production installs. The Next plugin uses its default current-directory root here; no external `settings.next.rootDir` globs are accepted. Recheck upstream before enabling root-directory glob configuration. Full audit therefore still reports the five linked High findings; runtime audit is zero.
