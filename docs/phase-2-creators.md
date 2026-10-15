# Sprint 2.5 — Images, moderation and creators

Implemented locally on 15 October 2026. No production deployment, cloud storage provisioning or Neon migration was performed. Existing local records were retained. This sprint extends the existing Auth.js, Prisma, community and review architecture; it does not introduce another identity system.

## Functionality and implementation map

- `src/lib/platform/`: validated contracts, private S3 adapter, image processing, ownership checks, creator services, reporting, moderation and verification.
- `src/components/platform/`: accessible image picker/drop zone with previews and progress, reporting, creator settings, verification badge, video attachments and moderator dashboard.
- `/creators`: real searchable directory with specialization filter and pagination. Empty databases show an empty state, not sample creators.
- `/creators/[username]`: public creator profile, social links and actual contributions. Existing member names, usernames, biography and avatars are reused.
- `/account/creator`: authenticated creator settings, cover image, verification application and decision feedback. Avatar settings remain on `/account`.
- `/admin`: server-authorized reports, content previews, filters, pagination, confirmation dialogs, activity counts and moderation history. Only administrators can decide creator verification requests.
- Existing posts, comments, reviews and public profiles now display uploaded avatars and appropriate reporting/creator controls. Post and review attachments are added after saving the content, avoiding abandoned draft attachments. Explicit sponsorship text does not change ranking or review scores.

The catalogue remains usable without community infrastructure. The repository has no comparison tool to regression-test; this sprint does not create one.

## Database

The additive migration `20261015020000_creator_media_moderation` adds `UploadedImage`, `StorageDeletion`, `ContentReport`, `ModerationAction`, `CreatorProfile`, `CreatorVerificationRequest`, `CreatorVerificationDecision` and `CreatorVideo`. It reuses existing users/posts/comments/reviews, adds moderation and optional sponsorship fields, and permits normalized Unicode usernames. It does not reset, drop or replace existing user data.

Foreign keys, concrete target constraints, unique report/video associations, a partial unique pending-verification index, timestamps and query indexes protect relationships. A database deletion trigger creates durable storage-cleanup jobs even when a parent record is deleted through a cascade. Comment counts exclude hidden/deleted comments. Moderation updates increment existing content versions so stale author edits cannot silently undo moderation.

All eight migrations were applied to the original **localhost** development database. Before/after record counts and content hashes were unchanged, excluding added default/nullable fields. A local schema diff reported no drift. A read-only check of the configured Neon database returned exit code 1 with **all eight migrations pending**. Reconcile its actual schema/history before an approved deployment; do not blindly migrate an existing database. No change was made there.

## API

| Endpoint | Behavior |
| --- | --- |
| `GET/POST /api/images` | List/upload for a concrete owned avatar, cover, post or review target |
| `GET/DELETE /api/images/[id]` | Authorized image proxy / owner deletion |
| `GET /api/creators` | Public directory search, specialization filter, pagination |
| `GET/POST /api/creators/me` | Read/update own creator profile |
| `POST /api/creators/me/verification` | Request ownership review with a unique public challenge |
| `POST /api/reports` | Report post/comment/review/image/creator |
| `GET/POST /api/videos` | List/attach validated YouTube video to own post/review |
| `DELETE /api/videos/[id]` | Remove own attachment |
| `GET /api/admin` | Authorized moderation overview and queues |
| `POST /api/admin/reports/[id]` | Dismiss, hide or restore with recorded notes |
| `POST /api/admin/verification/[id]` | Administrator approval/rejection with decision history |

Mutations require current server-side authentication, authorization, same-origin checks, Zod validation and existing PostgreSQL-backed rate limits. IDs and computed trust states are not accepted from the client. JSON is bounded; upload bodies are bounded while streaming. Public selectors omit emails, private measurements and object storage keys. Mutation forms use POST even before JavaScript loads, keeping sensitive form values out of query strings.

## Private image storage

AWS SDK v3 provides the S3-compatible boundary. Files are never stored in PostgreSQL or the application filesystem. JPEG/PNG/WebP uploads require matching signatures and successful full Sharp decoding; animated/malformed images, excessive dimensions and oversized bodies are rejected. Decoded images are resized, re-encoded to WebP and stripped of EXIF. Random server-generated UUID keys prevent client-selected paths. Per-user quota reservations are serialized before object writes; failed writes roll back the reservation and retain cleanup work.

Defaults: 5 MiB input, 20 million decoded pixels, 1,600-pixel output bounds, four photos per post/review, one avatar/cover, 100 images and 100 MiB stored per account. Configure `UPLOAD_MAX_BYTES`, `UPLOAD_MAX_PER_CONTENT`, `UPLOAD_MAX_PER_USER` and `UPLOAD_USER_QUOTA_BYTES` within the server's permitted bounds.

Required server-only configuration: `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Production requires HTTPS, a private bucket and least-privilege Get/Put/Delete access to `images/*`. Do not expose these credentials as `NEXT_PUBLIC_*`. Images are served through an authorization-aware, private/no-store proxy, including error responses; hiding parent content removes anonymous image access.

Deletion removes database visibility immediately. Object deletion is asynchronous: schedule `npm run storage:cleanup` regularly with the same database/storage configuration. It processes up to 100 jobs per run after a one-hour grace period, removes abandoned reservations, retains failed jobs and returns the remaining count. Monitor backlog and retry failures. No production scheduler was deployed.

### Local storage and application profile

Docker Desktop and local PostgreSQL are required for the complete local stack. `npm run dev:storage` starts pinned RustFS 1.0.0 on loopback ports 9000/9001, creates a private local bucket and generates credentials in ignored `.local/storage.env` (mode 0600). The named Docker volume persists local objects. Initial MinIO registry pulls failed (Quay authorization and Docker Hub image access); the working alternative is real S3-compatible RustFS, not simulated cloud storage.

This workspace has an ignored `.local/development.env` (mode 0600) containing local database, SMTP and storage settings. The existing `.env` with Neon/real email configuration was not replaced. For a fresh checkout, create the local profile from `.env.example`, set **both** database URLs to your local PostgreSQL database, copy the generated local S3 settings, generate a fresh secret, set `AUTH_URL=http://localhost:3000` and local SMTP `smtp://127.0.0.1:1025` with a local sender. Never commit either local file.

```sh
npm ci
npm run dev:storage
npm run db:local
# For a fresh empty local database only: import the explicitly labeled sample catalogue.
node --env-file=.local/development.env --import tsx scripts/import-catalogue.mts
npm run dev:mail
# In another terminal:
npm run dev:local
```

The `*:local` wrapper rejects non-loopback database, storage, SMTP and app origins and explicitly overrides inherited shell configuration. Prisma migrations use `DATABASE_URL_UNPOOLED` when supplied; application queries continue using `DATABASE_URL`. Ordinary `npm run dev` continues using the existing environment, so use `dev:local` to try this sprint without changing Neon.

Local cleanup: `node --env-file=.local/development.env --conditions=react-server --import tsx scripts/cleanup-images.mts`. Local mail capture prints sign-in links in the terminal; keep that terminal private. It never delivers real email.

## Moderation and verification policy

Reports cover all five content types and all requested reasons. One report per reporter/target is retained; repeated submissions return the original report. Report counts never automatically delete content. Moderators can dismiss, hide and restore; sensitive decisions require confirmation and notes, recorded transactionally in audit history. Hiding a creator removes their creator presentation/badge, while their separately published posts/reviews require their own moderation decisions. This dashboard does not add global account-ban administration.

There is no public role-grant endpoint. A trusted database operator must bootstrap an administrator through the existing `User.role` after identifying the intended account securely. Never grant a role based on a client-supplied email or user ID. Ordinary users and moderators cannot approve verification.

Verification requires a creator to place the generated challenge on a submitted public social profile. An administrator must independently inspect that profile, confirm the challenge, record the matching proof URL and meaningful notes, then approve. URL submission alone never grants a badge. Social-link changes revoke pending/approved trust and require a new application. Decisions are retained. A badge means account ownership was checked; it does not verify purchases, factual accuracy or rating quality. Automated tests simulate decisions only; no real external creator was verified.

## Video policy and international fields

Only validated YouTube IDs and allowed official URL forms are stored. No user iframe HTML is rendered or fetched server-side. Click-to-load, responsive `youtube-nocookie.com` embeds have a CSP allowlist, sandbox, limited permissions, strict referrer policy and an external fallback link. TikTok is supported as a creator profile link, not an embed. Creators must have rights/permission to link content and disclose sponsorship. Profile links do not affect ranking.

Optional region fields and Unicode text are accepted; usernames are NFC-normalized with safe route decoding. Database identifiers remain locale-independent. Timestamps use UTC storage and browser presentation. Full translation, recommendation engines and affiliate systems are outside scope.

## Verification and remaining release gates

Executed: 122 unit/component tests; 48 isolated real HTTP/PostgreSQL/SMTP/private-S3 integration tests; TypeScript; ESLint; Prisma validation; local migration status/schema drift; production build. Integration tests create a disposable local database and private bucket, then remove them; they do not reset the development or production database. Run `npm run build` followed by `npm run test:platform:local` for the complete local suite.

Coverage includes signatures/EXIF/limits/quotas, owner restrictions and storage failure rollback, cascade object cleanup, report deduplication, all target types, hide/restore/audit, role checks, Unicode profiles, creator search/filter/pagination, verification/link-change revocation, safe video URLs, sponsorship, existing accounts/posts/comments/votes/reviews/privacy and catalogue unit regressions.

Real-browser QA used disposable accounts/database/bucket: email sign-in, creator/profile edits, avatar/cover/photos with preview and removal, post publication, video click-to-load, reports, admin hide/restore/audit, verification rejection/history and ordinary-user admin denial. Layouts were inspected at 320, 768, 1024 and 1440 pixels without document horizontal overflow. Browser testing exposed missing explicit Base UI submit-button types and Unicode route decoding; both were fixed and regression-tested. Optional review form fallback POST protection was also regression-tested. QA resources and browser sessions were cleaned afterward.

`npm audit --omit=dev`: zero vulnerabilities. Full audit: five high findings in the existing ESLint transitive glob chain; the offered forced fix downgrades the Next lint configuration and was not applied. Review compatible upstream remediation by 22 October 2026. Existing pg concurrent-query deprecation warnings remain; they did not fail tests. Initial registry/test/browser failures were diagnosed and rerun, not counted as passes.

Unverified: real Resend delivery, cloud S3 policy/network behavior, live YouTube playback, cross-browser/screen-reader audits and production load. The iframe loaded with the expected allowed URL; playback availability is not guaranteed. A restrictive iframe sandbox generates a browser warning. Production backups/restore exercises, shared proxy rate-limit configuration, cleanup scheduling/alerts and human moderation coverage remain operational release gates.

### Manual smoke test

1. Start local storage, mail and `dev:local`. Sign in through `/login` using the captured local link.
2. Set a public username in `/account`, upload an avatar, then create a profile at `/account/creator`; add a cover and valid social links.
3. Confirm directory search/profile navigation and optional region/specialization. Apply for verification; confirm pending challenge, not an automatic badge.
4. Create a discussion/review, save it, upload multiple photos, remove one with confirmation, attach a valid YouTube video and disclose sponsorship where applicable.
5. Sign in as a second disposable account and report content. Confirm duplicate reports are harmless and ordinary accounts cannot use `/api/admin`.
6. With a trusted local ADMIN account, inspect the report, hide content with notes, confirm anonymous access disappears, restore it and inspect audit history. Reject a test verification request, or approve only after personally checking the challenge on a real owned public profile.
7. Delete an attachment/content, run cleanup after the grace period and verify the object is removed. Test bad images/oversize files, empty search, expired sessions and unavailable storage feedback.

### Phase 2 checklist

| Capability | Status |
| --- | --- |
| Existing catalogue/accounts/posts/comments/votes/reviews | Regression tests pass |
| Private photos, previews, limits, ownership, local S3 | Implemented and tested |
| Reports, moderation roles, audit, hide/restore | Implemented and tested |
| Creator directory/settings/profile/contributions | Implemented and tested |
| Human ownership verification workflow | Implemented; real external verification requires an operator |
| Safe YouTube attachments and sponsorship | Implemented; live playback not verified |
| Admin dashboard and responsive UI | Implemented and locally browser-tested |
| Neon migration and production storage/email/operations | Pending; not deployed |
| Phase 3 readiness | Local feature foundation available; production release gates remain. Phase 3 not started. |
