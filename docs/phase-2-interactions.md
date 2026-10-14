# Sprint 2.3 — Comments, replies and post voting

Historical sprint delivery notes. Structured reviews are now implemented in [Sprint 2.4](phase-2-reviews.md); use that document and the README for current verification and scope.

## Scope and setup

This sprint extends the existing Auth.js, PostgreSQL/Prisma and Clean Minimal community. No structured reviews, uploads, moderation dashboard or Fit Finder work is included. There are no new dependencies or required environment variables. Apply the additive `20261014010000_comments_and_post_votes` migration with `npm run db:deploy`; never reset an existing database. Existing posts receive actual initial score/count zero, because no Comment/PostVote rows existed before this migration. No community users or activity are seeded.

## Data and consistency

- Comment: post/optional author/optional parent, depth 0–2, plain-text content of 1–3,000 characters, version and timestamps. A composite self-FK includes post ID and parent depth; CHECK constraints require depth to increase by one. Parents cannot be in a different post or form cycles. A trigger makes the thread identity immutable. Author deletion sets the author reference to null, preserving thread structure.
- Delete removes content and sets deletedAt; replies remain beneath a tombstone. Deleted comments cannot be edited or receive new replies. Existing child branches remain readable. Unavailable/suspended/unverified authors are represented by a placeholder without their name or content. Only owners may edit/delete; moderators do not receive an extra comment-management feature in this sprint.
- Root comments and each parent's direct replies have independent chronological pagination (10/page, maximum page 1,000). Expanding a parent loads its branch. This bounds response sizes without flattening or orphaning replies. Deletion keeps the chronological position. New comments/replies return their actual page; the UI opens it after posting.
- PostVote: composite primary key (postId,userId), value -1 or +1, timestamps and cascading FKs. Desired value 0 removes the vote; repeated writes are idempotent. Vote identity is immutable.
- Post.score and Post.commentCount are transactionally maintained by PostgreSQL triggers, not client input. The count is all non-deleted stored comments, including unavailable-author placeholders; it includes replies. Score represents stored votes, including historical votes from subsequently suspended accounts. Suspension blocks new mutations; account deletion cascades votes and adjusts the score. These numbers are community activity, not boot ratings or verified claims.
- Popular sorts by score; Most Discussed by non-deleted commentCount. Both break ties by createdAt/id descending. Newest/Oldest and all existing filters remain intact. Indexed counters avoid aggregating every discussion on each feed request.
- Interaction writes acquire the existing account share lock, then a post update lock. This serializes writes per discussion and prevents hidden/deleted post races and counter deadlocks. Unique vote keys and trigger updates preserve exact sums under concurrent requests. Snapshot transactions keep list counts/pages and voting reads internally consistent.

## APIs

| Method | Route suffix after `/api/community/posts/[slug]` | Result |
|---|---|---|
| GET | `/comments?parent=<id>&page=1` | Root/direct-reply page; omitted parent selects roots |
| POST | `/comments` | `{content,parentCommentId?}` creates a comment/reply |
| PATCH | `/comments/[id]` | `{content,version}` updates own comment |
| DELETE | `/comments/[id]` | `{version}` removes text, preserves replies |
| GET | `/vote` | Actual net score and requesting user's vote (-1/0/1) |
| PUT | `/vote` | `{value:-1|0|1}` sets desired state, returns score/state |

Public reads return 404 for unavailable posts. Mutation bodies are strict Zod objects, capped at 16 KiB. Ownership, account verification/status, Origin and session are checked server-side, including session revalidation after body parsing. Comment creation allows ten attempts/15 minutes and 30 changes/minute; voting allows 60 attempts/minute per account. Invalid attempts consume limits. Public comment JSON exposes profile displayName/username only; account IDs, email, role and status are not serialized. Personalized reads use private/no-store cache headers. Plain comment text is React-escaped, not inserted as HTML; existing post Markdown safety remains unchanged.

## UI

Post detail includes voting with pressed states, pending/error feedback, login links, comment input, owner edit/delete confirmation, nested branches and per-branch pagination. Skeletons, empty messages, retry states and success messages are provided. Replies are at most two levels deep, with modest mobile indentation and 44px controls. New activity refreshes server-rendered counts; there is no realtime subscription. Expanded branches remain mounted during refresh.

## Validation and manual checks

Run actual scripts: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:integration`; also `npx prisma validate` and `npx prisma migrate status`. Integration tests use a newly generated local disposable database and SMTP sink, never the development data.

The new interaction suite checks auth/Origin, lengths and forged fields, stored comment persistence and privacy, ownership/stale edits, cross-post/depth validation, deletion with replies, independent pagination, direct SQL parenting constraints, voting switch/remove/repeat, concurrent uniqueness and score sums, real activity sorting, hidden posts, rate limits and full post cascade deletion. Earlier foundation/post/security regression tests remain included.

Manual checklist (use a disposable environment):
1. Sign in, create a post, comment and reply two levels deep; confirm a third level is unavailable.
2. Refresh and check author, text, count, replies and timestamps.
3. Edit your comment; from a second account verify owner actions are absent and API requests are denied.
4. Delete a parent with replies; text/name disappear but child branches remain accessible.
5. Create more than ten roots and more than ten direct replies; navigate both pagers independently.
6. Upvote, switch to downvote, click again to remove; refresh and confirm score and pressed state.
7. Verify Popular/Most Discussed ordering in the feed, then test anonymously and at mobile/desktop widths.
8. Simulate a disconnected API and verify retry/error feedback without losing an unsaved draft.

## Limits and next sprint

JavaScript is required for comments and voting. Pagination is chronological and offset-based, not realtime; extremely large branches beyond 10,000 items need cursor pagination before growing further. Mutations serialize per post, suitable for the current community scale; measure contention before adding high-volume interaction architecture. Full external SMTP, HTTPS/proxy deployment, assistive-technology and load testing remain separate checks. The previously documented development-only braces advisory has no upstream patch; runtime dependencies are unaffected.

Sprint 2.4 structured reviews must wait for successful Sprint 2.3 verification. This sprint adds no fit measurements, ratings or review aggregation.

## Completed verification and changed files

PASS: Prisma validation, five applied migrations, read-only schema diff (no drift), TypeScript, ESLint, 89 unit tests (five files), 30 integration tests, production build and runtime dependency audit (zero vulnerabilities). Development User/Profile/Post/CatalogueEntry counts and content hashes matched the pre-migration snapshot; new development Comment/PostVote tables remained empty. Full dependency installation still reports the five linked development-only braces advisories documented in the foundation notes.

Browser QA ran against a separate disposable production preview: verified-email sign-in/return link, safe literal HTML text, create/edit/refresh persistence, replies up to depth two, upvote/switch/remove/refresh, parent deletion retaining expanded replies, cancel focus restoration and focus remaining within the parent thread after deletion. It also verified independent root/reply page 2 and automatic navigation to the new item's page. No document horizontal overflow was found at 375/768/1024/1440px. QA fixtures are explicitly temporary and removed with the disposable database. Full assistive-technology/cross-browser and production deployment checks remain unperformed.

The first build stalled while duplicate dependency artifacts were present; `npm ci` restored exactly the existing lockfile and the subsequent build passed. Duplicate ignored generated route-type copies were removed. One earlier fixed-window rate-limit assertion crossed a minute boundary; the test now allows the legitimate reset and requires the limit within a two-window burst. These repairs did not change the application rate-limit policy.

Main changed files:
- `prisma/schema.prisma`, additive comments/votes migration.
- `src/lib/community/interactions.ts`, `interactions-validation.ts`, `http.ts`, `service.ts`, `validation.ts`.
- Comments/vote API routes beneath `src/app/api/community/posts/[slug]`.
- `src/components/community/comments.tsx`, `vote-controls.tsx`, `post-card.tsx`; `src/components/ui/sheet.tsx` adds an optional final-focus target without changing other drawers' defaults.
- Community feed/detail pages and `src/app/globals.css`.
- `tests/interactions.integration.ts`, interaction unit tests and existing auth/security/community regression suites.
- README, architecture and sprint notes.

Sprint 2.3 checklist: PASS for comment CRUD/storage/privacy; PASS for same-post bounded replies and deletion context; PASS for root/branch pagination; PASS for voting, uniqueness/concurrency and real sorting; PASS for auth/ownership/Origin/validation/rate limits; PASS for tested responsive UI and automated checks. Sprint 2.4 is ready for local implementation after review of these changes; it has not been started. This is not a production deployment sign-off.
