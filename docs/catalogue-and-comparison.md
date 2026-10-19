# Database catalogue and exact-variant comparison

Public product reads use `src/lib/boots/service.ts`. Home, catalogue, details, comparison, community references, review navigation and Finder all require published database entries. No runtime fallback imports fixture products. `data.ts` remains the validated sample source for local seeding/tests; fixed brand preference choices remain the current four supported brands.

Migration `20261017010000_catalogue_publication` adds `published` (preserves existing entries; default false for future inserts), a JSON specification object and a publication/order index. It never rewrites user content or private profiles. The specification JSON is an operator-curated boundary, not a user-writable API. Each optional `upper`, `weight`, `releaseDate` value must have `{status:"verified",value,sourceUrl,observedAt}` with a public HTTPS source. Invalid/unsupported documents fail closed to unknown; samples always remain unknown. This is stored provenance, not an independent verification of the source's truth. Do not populate production with synthetic claims.

Current scoped price offers come only from approved, parsed PRICE evidence on the exact variant and entry, valid at read time and observed within seven days. Show source, currency and size/system (or explicitly unspecified). Up to eight recent offers are shown; over-32 evidence retrieval fails closed. An offer is not availability or a guaranteed purchase price. Ratings/fit/endorsements never come from arbitrary specification JSON. Product photos remain absent until a sourced asset workflow is approved.

`GET /api/boots`: `q` (100 chars), `brand`, `silo`, `tier`, `surface`, `sort` (`featured`, `name-asc`, `name-desc`, `brand`), `page` (1–1000). Twelve entries per page; parameterized queries, literal wildcard escaping, deterministic ID tie-breaker, count/list snapshot transaction. “Catalogue order” is ID order, not editorial endorsement. Filter options and related-generation entries are bounded to 1,000 options / 100 entries respectively. Home uses a bounded feature selection and grouped counts, not the whole product list. Newly published products need no rebuild.

`/boots/[slug]`: unique stable slug resolves a published entry; a layout checks visibility before a child loading boundary can commit HTTP 200. Metadata and rendering share request memoization; there is no shared permanent product cache. Missing/unpublished pages return real 404. A slug rename changes its URL; no slug-history redirect system is claimed. Reviews share only the exact variant and public review navigation picks a published colorway. An old post can remain public after its linked product is unpublished, but the linked boot metadata disappears from its public DTO.

`/compare?boot=ENTRY_ID&boot=ENTRY_ID`: maximum four, bounded/validated IDs, duplicate exact variants collapse in request order. Colorways of one variant share a column; the first selected entry determines the shown colorway and scoped offers. Different tiers/outsoles/generations retain their IDs. Unknown attributes remain unknown. Selection is memory state across client navigation; share/reload uses the public URL. Keyboard-accessible comparison table scrolls inside its own labeled region on mobile. No private Finder inputs enter the URL.

Finder results include a server-projected catalogue identity only after candidate queries select published entries. The client checks all entry/variant/generation/colorway/brand/tier/outsole values before showing detail/review/compare actions; it no longer consults static fixtures. Stale results can become unavailable after unpublication: the destination enforces current visibility.

Review summaries now group each filter dimension separately with fixed bounds (200 displayed size/system pairs, four shapes, six surfaces, 601 legal ownership-month values reduced to three buckets). Size truncation is explicit and never changes review counts, averages or distributions. Variant-wide summaries are reused within the mounted list when only filters change; explicit retry/remount reloads them.

## Reusable browser regression environment

After `npm run build`, with the guarded `.local/development.env` and local PostgreSQL/S3 available, run `npm run test:browser:serve`. It refuses non-loopback service URLs, creates a new random local DB and private bucket, applies migrations **only there**, and imports samples plus clearly synthetic QA products/cohorts. It never writes to the profile's development database. Ports 3100 (app), 1026 (captured SMTP), 3111 (local mailbox redirect) must be free.

The synthetic `remediation@example.test` account has an unverified administrator fixture; the actual captured magic link must verify it before protected access. Use a separate browser automation profile. Sign in on `http://localhost:3100/login`, then visit `http://127.0.0.1:3111/signin` to consume the locally captured email without copying a token.

With the installed Playwright CLI and that authenticated browser session:

```sh
npm run test:browser -- catalogue
npm run test:browser -- profile
npm run test:browser -- admin
```

The runner defaults to session `remediation`; set `BOOTVERSE_BROWSER_SESSION`, `BOOTVERSE_BROWSER_URL` (localhost only), or `PLAYWRIGHT_CLI` for a different CLI installation. By default it uses the installed Codex Playwright wrapper. It treats both nonzero CLI exits and `### Error` output as failure. The profile test expects the fresh synthetic account to have no saved FootProfile. These tests do not publish real community content or modify the development database. Stop the environment with Ctrl-C; its own app, email, DB, objects and bucket are removed. A killed host/process may require an operator to inspect and remove abandoned `bootverse_browser_*` test resources, never a development/production database.
