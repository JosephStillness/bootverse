# Sprint 3.1 — Private Foot Profile

Implemented on 15 October 2026. This adds current private measurements and playing preferences to the existing Auth.js/Prisma application. It does not implement recommendations, boot fit scores, compatibility classifications, AI, affiliate targeting or public sharing. No new dependency or cloud resource was added.

## Existing architecture and scope

The repository has a working sample catalogue, auth/accounts, posts, comments/replies/votes, exact-variant reviews, private images, moderation and creators. A comparison tool is not present. Historical review foot information exists, with its own public-sharing policy; it is not a current bilateral Foot Profile and is deliberately not reused or overwritten.

One new `FootProfile` row belongs to one existing `User`, enforced by unique `userId` and a cascading foreign key. There is no second account/profile identity. The new relation is never included in public selectors. The only data access interface is `getOwnFootProfile(actor)` in `src/lib/foot-profile/service.ts`; it derives the owner from a verified active principal and returns normalized millimetre decimal strings. Future Fit Finder consumers must separately honor `allowFitFinder` before processing this data.

## Files

- `prisma/schema.prisma` and `prisma/migrations/20261015030000_private_foot_profiles/migration.sql`: private table, unique ownership, nullable measurements, constraints and UTC timestamps.
- `src/lib/foot-profile/{validation,currencies,service}.ts`: contracts, deterministic currency options, exact conversions and owner-only persistence.
- `src/app/api/account/foot-profile/route.ts`: authenticated GET/PUT/DELETE.
- `src/app/profile/foot-profile/{page,loading,error}.tsx`: protected page and meaningful loading/error states.
- `src/components/foot-profile/{foot-profile-form,measurement-guide}.tsx`: grouped optional form and home measurement guide.
- `src/app/account/page.tsx`: private profile navigation; `src/app/globals.css`: scoped responsive styles using existing tokens.
- `src/lib/foot-profile/validation.test.ts`, `src/components/foot-profile/foot-profile-form.test.tsx`, `tests/foot-profile.integration.ts`, `tests/auth.integration.ts`: tests and integration harness hook.

## Data and validation policy

All measurement and preference fields are optional; there are no example or inferred measurements. Length/width are separate for left and right feet. PostgreSQL `Decimal(6,2)` stores mm; input accepts decimal **strings**, with up to two decimals in mm or three in cm. Conversion uses scaled integers, never floating-point rounding. Unsupported precision, signs, exponent notation, incomplete decimals, negative or out-of-range values are rejected. Switching units with incomplete input preserves the original fields and explains the problem.

`measurementLimits` centrally configures broad input-error guardrails: lengths **80–400 mm**, widths **30–180 mm**, inclusive. They permit a broad range including small feet while catching likely unit/typing errors. They are not validated medical, age, width-category or shoe-sizing classifications; values outside this application's supported range cannot currently be stored. Changing these boundaries requires aligning the schema CHECK constraints through a new migration and updating UI/tests.

Optional measurement date is a real calendar date from 1900 through today in UTC, stored as PostgreSQL `date`; method is at most 200 characters. Characteristics are explicitly self-reported enums, never diagnoses or inferred categories. Position has a primary selection and distinct secondary selections; it imposes no model rule. Surface is separate (FG/AG/TF/SG/IN), without a claim that FG is safe on artificial grass.

Budget and currency must both be present or both absent. Budget is a nonnegative decimal up to 1,000,000 with at most two decimal places, stored as `Decimal(9,2)`; it is an approximate preference, not a payment amount or currency conversion. Currency uses a shared ISO code snapshot from Node ICU (October 2026). This explicit list prevents browser/server ICU differences from changing options or validation; maintain it when currency support changes. It is not a live currency registry. Current size and system must both be supplied or neither; size is above 0 through 60, at most two decimals, with UK/US/EU/CM identification. No size-system conversion or gender assumption is applied. Preferred brands and tiers use the currently available catalogue identities/names; they are preferences, not another boot product model.

## API contract

`/api/account/foot-profile` accepts no user/owner identifiers in query strings or bodies. An opaque `revision` token identifies only the current profile generation for concurrency comparison; it is never used to select a profile. There is no public lookup-by-ID route and no moderator override.

| Method | Input / response |
| --- | --- |
| GET | `{ profile: null }` when absent; otherwise the owner's normalized profile |
| PUT | Full replacement of optional fields. `{version: 0, revision: null, unit: "cm", leftLengthMm: "26.735", ...}` creates; existing profiles require their returned version and revision. Field names end in `Mm` for normalized storage, but submitted measurement strings use the explicitly supplied `unit` (default `mm`). Response is `{profile: ...}` in mm. |
| DELETE | `{version: <current version>, revision: <returned token>}` deletes the owner's row and returns `{deleted: true}`. Already-absent rows also return success. |

PUT also updates playing and privacy preferences; no separate preferences table/endpoint is necessary. Omitted optional fields in PUT are cleared, not patched. Repeating an old PUT is not an automatic retry strategy: stale versions receive 409. Each transaction locks the current user, rechecks active/verified authorization and prevents concurrent creates/overwrites. The revision token also rejects stale writes/deletes after a profile is deleted and recreated, even if its numeric version restarts. This is a settings replacement contract, not a historical measurements timeline.

Responses are private/no-store and vary by cookie, including errors. Statuses: 401 anonymous, 403 inactive/unverified or invalid origin, 400 invalid/forged input, 409 stale version, 429 rate limit, 503 unavailable services. Mutations reuse bounded JSON and shared PostgreSQL/HMAC rate limiting (30 attempts per 15 minutes). Reads allow 120 per minute per account. Error responses never include database internals or submitted measurement values.

## Privacy, threat model and retention

Primary assets are bilateral measurements, personal preferences and consent. Trust boundaries are browser input, session identity and PostgreSQL. Controls:

- Identity is server-derived; strict schemas reject `userId`/IDs/unknown keys (IDOR, mass assignment).
- Fresh account checks within transactions, same-origin mutations, existing secure session cookies and bounded inputs (CSRF, revocation, abuse).
- Parameterized Prisma/raw locking queries, React text escaping, no user HTML (injection/XSS).
- No public selector, image, URL, telemetry, analytics or third-party API receives the profile. Forms use POST for the no-JavaScript fallback to avoid measurements in query strings.
- No public sharing control is offered. The single optional unchecked consent only allows future use for the owner's own private fit results, never public sharing or advertising. The server records consent time; revocation clears it. No recommendation processing currently runs.
- DELETE removes the current row and consent, not old review snapshots; User deletion cascades the row. Backups may retain historical snapshots according to the operator's documented retention window. Production operators must set backup retention/restore and deletion-reapplication procedures; this sprint cannot erase unknown external backups.

The form uses progressive disclosure, associated labels/field errors, keyboard-accessible native controls, live status messages, loading/empty/error states, a deletion confirmation and unsaved-change protection for reload/close and normal link clicks. Browser Back/Forward or programmatic navigation are not universally intercepted; do not treat this as autosave. Failed saves retain inputs and advise checking saved state before retrying.

## Migration and local setup

Only the new additive migration was applied to the guarded localhost development database. Nine local migrations are applied and `prisma migrate diff` reports no differences. Before/after hashes verified that existing users, profiles, posts, comments, reviews, creators and images were unchanged. No Neon migration, reset, drop or production deployment was performed.

```sh
npm run db:local
npm run dev:mail
# Another terminal:
npm run dev:local
```

Existing `.local/development.env` uses local services and remains ignored. No new environment variable is required. With a separately configured nonlocal environment, inspect actual schema/history before an approved migration; do not blindly apply to the existing Neon database. Application rollback can disable the new route/link while preserving this additive table; do not drop private data as a rollback shortcut.

## Verification

- **132 unit/component tests pass**, including conversion precision, empty optional input, malformed/boundary input, identity rejection, paired budget/size, dates, duplicate positions, form privacy and deterministic currency rendering.
- **55 real HTTP/PostgreSQL/SMTP/S3 integration tests pass**, with seven new Foot Profile scenarios: auth/CSRF/IDOR, exact persistence/consent, unique/FK/CHECK constraints, owner isolation/public exclusion, updates/concurrent conflicts/consent revocation, deletion without review changes, and stale-tab protection across deletion/recreation. The harness creates and removes a disposable local database and private bucket; no development data is reset.
- Prisma validation, local migration status/no drift, TypeScript, ESLint and production build pass.
- Playwright tested real email sign-in against a separate disposable local database, save/reload, edit, exact mm/cm conversion, invalid/incomplete input feedback, privacy consent, deletion with confirmation, keyboard order and responsive layouts at 320/768/1024/1440 pixels.
- Browser QA found an ICU currency list hydration mismatch. A shared deterministic list fixed it; a regression test fails against the old runtime-dependent rendering and passes with the fix.
- A delete/recreate regression initially returned 200 for a stale tab that should receive 409. Generation-aware revision checks fixed this without accepting an owner ID from the client.
- The initial sandboxed build stalled; the same build succeeded with required local process permissions. The first integration attempt failed because Docker/S3 was stopped; after starting local storage the full suite passed. Failures were not counted as passes.
- Runtime dependency audit: zero advisories. Full audit retains five existing high findings in ESLint's transitive glob dependencies. Forced remediation would downgrade the Next lint config and was not applied; review compatible upstream fixes by 22 October 2026. Existing pg concurrent-query deprecation warnings remain.

No live email/cloud storage, cross-browser/screen-reader audit, load test or production backup/deletion exercise was performed. Existing Phase 1/2 behavior is covered by the regression suite, not a claim that every prior screen was manually retested this sprint.

## Manual smoke test

1. Sign in locally, open Account settings → My private foot profile. Confirm no fabricated measurements and all optional controls are empty/unspecified.
2. Enter `267.35` mm left and `270.1` mm right, switch to cm and confirm `26.735`/`27.01`. Try incomplete/negative/excessively precise input; verify inline feedback and no rounding.
3. Add an optional date, self-reported characteristics and preferences. Supply budget/currency together. Save and reload; normalized measurements must persist.
4. Toggle private future-fit consent, save/reload, then revoke it. Public member/creator pages must never display these values.
5. Edit in two tabs; after one save, the stale tab should receive 409 instead of overwriting changes. Try leaving with unsaved edits and dismiss the warning.
6. Use a second account: its form must be empty, and supplying another user's ID to the API must be rejected.
7. Delete with confirmation and reload. The form must return to its empty state; previous review measurements and published review content must remain unchanged.
8. Stop the database temporarily only in a disposable environment to inspect retry/error feedback. Never test destructive operations on development/production data.

## Completion and next sprint

| Requirement | Status |
| --- | --- |
| Bilateral optional measurements, exact unit conversion | PASS |
| Characteristics and football preferences | PASS |
| Private owner-only CRUD and consent controls | PASS |
| Additive schema, constraints and historical review independence | PASS |
| Grouped responsive form, guide and account integration | PASS |
| Unit/integration/build/security checks | PASS, with existing dependency/runtime warnings above |
| Production database/operations rollout | NOT PERFORMED |
| Recommendation engine and Sprint 3.2 | NOT IMPLEMENTED, intentionally |

The local data foundation is ready for Sprint 3.2 development after review. Real-user production readiness still depends on the existing Neon migration/configuration, storage/email, backup, moderation and dependency release gates documented in Phase 2. No subsequent sprint was started.
