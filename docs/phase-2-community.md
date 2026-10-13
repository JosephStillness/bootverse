# Phase 2 — Sprint 2.2: Community Feed + Posts

Sprint 2.2 builds on the existing Auth.js/PostgreSQL foundation. It implements a real stored discussion feed and post CRUD only. Sprint 2.3 interactions, Sprint 2.4 structured reviews, and Sprint 2.5 uploads/moderation tools have not started.

## Implemented

- `/community`: server-rendered feed, 10 discussions per page, category/tag/linked-boot/author filters, keyword search across title/content/tags, Newest/Oldest sorting, shareable query state, pagination, loading skeleton, empty/reset and error/retry states.
- `/community/new`: verified-member creation, title/body/category/tags, optional exact catalogue entry, safe Markdown preview, visible validation and pending/error feedback.
- `/community/[slug]`: public full Markdown, author/profile/date, category/tags, linked boot reference, opinion/unverified-claim notice, owner/moderator actions and public metadata.
- `/community/[slug]/edit`: protected editor retaining the immutable slug. Optimistic version checks reject stale edits instead of silently overwriting another tab.
- Delete requires an explicit UI confirmation; the API independently checks authentication, current account status, ownership/role and version. Deletion permanently removes the post and its PostTag joins; tags can remain reusable. There is no undo/history feature yet.
- Navbar/mobile menu/footer link to Community. Boot details link to discussions filtered to that exact entry and a preselected create form. Public profiles list actual public posts and link to the paginated author feed.

The five categories are Questions, Boot Reviews, Comparisons, Sizing Help and General Discussion. **Boot Reviews is a discussion category in this sprint**, not the structured rating system of Sprint 2.4. No scores, comments, endorsements, fit conclusions or fake engagement are generated.

## Setup and migrations

No new environment variables are needed. Reuse Sprint 2.1's `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `EMAIL_SERVER` and `EMAIL_FROM`.

```sh
npm ci
npm run db:deploy
npm run db:catalogue
npm run dev
# If using the local email sink, in another terminal:
npm run dev:mail
```

The additive `20261013030000_community_posts` migration creates Post, PostCategory, Tag and PostTag with foreign keys, unique slug/tag constraints, bounded text checks, version checks, author/category/boot/date indexes and PUBLISHED/HIDDEN state. It also creates normalized catalogue identity tables: BootBrand → BootFamily → BootGeneration → BootTier → BootVariant → CatalogueEntry, with BootColorway linked to a generation and entry. Existing accounts, sessions and profiles are preserved. Only the five category labels are seeded by the migration.

`db:catalogue` idempotently imports the **existing eight explicitly unverified sample identities** using their stable Phase 1 IDs. It imports neither technical claims nor users/posts/reviews. The existing fixture validator rejects cross-generation colorways before import. Catalogue pages continue to use those Phase 1 fixtures; posts reference CatalogueEntry through a database FK and obtain display labels by joining the identity tables. No public catalogue mutation API exists. Future trusted catalogue ingestion must continue validating generation/colorway consistency; the additive `20261013060000_catalogue_generation_integrity` migration now enforces it with composite foreign keys. BootVariant and CatalogueEntry carry a generation ID constrained against their parents. The migration backfills existing valid identities atomically and aborts on mismatches rather than repairing or deleting them.

Run the import after migration on a new environment, otherwise the optional boot selector is empty. There is no destructive reset or automatic production seed. Existing discussion links are preserved when re-running the import.

## API

| Method | Endpoint                      | Behavior                                                    |
| ------ | ----------------------------- | ----------------------------------------------------------- |
| GET    | `/api/community/posts`        | Public paginated feed; q/category/tag/boot/author/sort/page |
| POST   | `/api/community/posts`        | Verified member creation; returns the unique slug           |
| GET    | `/api/community/posts/[slug]` | Public published detail or 404                              |
| PATCH  | `/api/community/posts/[slug]` | Owner or current moderator/admin edit with version          |
| DELETE | `/api/community/posts/[slug]` | Owner or current moderator/admin deletion with version      |

Create body:

```json
{
  "title": "A specific question about my boots",
  "content": "At least 20 characters of context in Markdown.",
  "categoryId": "questions",
  "tags": ["sizing-help"],
  "bootEntryId": null
}
```

PATCH uses the same fields plus `version`; DELETE accepts only `version`. These are strict Zod objects: client author IDs, statuses, roles and unknown fields are rejected. Titles are 5–160 characters, bodies 20–10,000, tags at most five normalized unique ASCII names (24 characters each). API bodies are capped at 48 KiB. Unicode minimum lengths are aligned with PostgreSQL character constraints.

HTTP results include 400 validation, 401 unauthenticated, 403 unauthorized/origin, 404 unavailable post, 409 stale version, 413 oversized body, 429 rate limit and 503 service unavailable. Public JSON excludes email/account identifiers; feed responses contain excerpts rather than full bodies. Full post content is already public on its detail route.

## Security and consistency

- Reuses Auth.js HTTP-only database sessions. Mutations recheck the session after bounded body parsing, then reread and share-lock the account inside the write transaction, preventing stale role/status snapshots from authorizing writes. Anonymous users browse but cannot create, edit or delete.
- Owners and server-authorized MODERATOR/ADMIN accounts can manage content. A client cannot claim those roles. No moderation dashboard or status-changing endpoint is implemented early.
- HIDDEN posts and content by suspended/unverified authors are excluded from public queries and metadata. Editing a hidden post does not publish it.
- Account writes and community writes require the fixed configured Origin, alongside session cookies. Public SQL queries are parameterized through Prisma; `%`, `_` and backslashes in search are escaped so they are literal characters, not LIKE wildcards.
- Atomic create/update/delete and tag changes run in transactions. Counter/version conditions prevent edit/delete races. Shared tags use `createMany(skipDuplicates)` before joining, so concurrent tag reuse stays unique.
- Feed count and rows use one RepeatableRead snapshot and deterministic `(createdAt,id)` ordering. Offset pagination is intentionally small and bounded to 1,000 pages; concurrent new posts can shift later pages between requests. Cursor pagination/full-text indexes are candidates when real volume warrants them.
- Blocked per-email attempts and suspended accounts do not spend the global SMTP budget. Optional trusted-proxy client limits prevent one client from rotating email addresses; see the foundation setup requirements.
- Existing database-backed HMAC rate buckets limit each member to 30 mutation attempts/minute and 5 publish attempts/15 minutes. Invalid attempts also consume these abuse limits. This is basic spam control; it is not a full anti-bot or DDoS system. Continue the existing `db:cleanup` maintenance for expired buckets.
- `react-markdown` renders content without raw HTML, dangerous URL protocols or remote image loads. External web links are marked `ugc nofollow noopener noreferrer`. Preview and public rendering use the same component. Excerpts are plain React-escaped text, not injected HTML.
- The editor needs JavaScript; the form uses POST and displays a noscript notice so a native fallback cannot put a private draft into a GET URL. Drafts survive a failed API response while the page remains open, but are not persisted across reloads or devices. Native GET search remains usable without JavaScript.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:integration
npm audit --omit=dev
```

The existing isolated HTTP/PostgreSQL/SMTP harness now imports catalogue identities and runs `tests/community.integration.ts` alongside Sprint 2.1 regression cases. It creates and deletes a disposable local database, never seeds the application database, and delivers no external email. It covers authentication/CSRF, invalid input/foreign boot references, Unicode, unique slugs, owner/moderator access, version conflicts, atomic tags, keyword/category/tag/boot/author filtering, literal wildcard punctuation, ordering/pagination, public privacy and safe HTML, hidden/suspended/unverified content, publishing limits and deletion/cascade behavior. Existing authentication and catalogue tests remain included.

Browser QA used a separate temporary PostgreSQL database with clearly marked QA fixtures. It covered pagination, search/empty/reset, protected login return, safe preview, tag validation, publish/edit, linked boot context, delete confirmation/cancel with focus restoration, and responsive layouts at 375/768/1024/1440px. Actual delete behavior is tested in the automated suite. These QA records and their captured email are removed afterwards.

Runtime dependency audit remains clean. The existing five high ESLint/glob development findings remain; no incompatible forced downgrade was applied. External SMTP delivery, full screen-reader/cross-browser testing, load testing and penetration testing are outside the completed verification.

A local build initially stalled with duplicated dependency/cache files observed in the workspace; reinstalling exactly from package-lock using `npm ci` restored a successful build. Avoid building against the same `.next` while a dev server is writing to it; restart a production preview after rebuilding its assets.

## Remaining sprint boundaries

- Popular/Most Discussed sorting and vote/comment counts require real Sprint 2.3 interactions. Only working Newest/Oldest sorts are exposed now.
- Comments/replies/voting: not started.
- Structured reviews, ratings/aggregation and measurement consent: not started.
- Image uploads/avatars, reports and moderation dashboard: not started.
- Boot detail integration currently navigates to real filtered discussions; inline recent-discussion/review aggregation is deferred with later integration work.
- Comparison tools and Boot Fit Finder are still unimplemented. Phase 3 is not ready because real structured review/fit evidence does not exist.

Sprint 2.2 can be reviewed independently before starting Sprint 2.3. See [Sprint 2.1 foundation](phase-2-foundation.md) for auth/environment setup and [react-markdown security](https://github.com/remarkjs/react-markdown#security) for the renderer's documented safety model.

## Review fixes and regression coverage

The security integration suite holds request bodies open, then suspends accounts, demotes moderators or deletes sessions. Creates, edits, deletes and profile writes must return 401/403 without changing content. It also repeats 61 email requests from one address and verifies an unrelated address can still request a link. Direct SQL tests reject cross-generation entry inserts and changes to referenced parents. These fixtures live only in the disposable database.

Public detail reads use React request-scoped memoization for metadata/page deduplication; authorization reads remain uncached. Mobile categories scroll horizontally, preserving 44px targets while reducing the space before the first post; the mobile menu identifies its current route. Test cleanup is registered before database creation so setup failures are covered by the runner's after hook. Hard process termination can still require manual cleanup of an explicitly identified test database.

Latest verification of the review fixes: typecheck, lint, 85 unit tests, 22 integration tests and production build passed. Prisma validation, migration status and schema diff passed after applying the additive migration. Original local catalogue/account/post record counts were preserved. Browser automation was blocked by the tool URL policy on this verification run, so the mobile visual changes were not rechecked in-browser; earlier responsive checks apply to the previous layout.
