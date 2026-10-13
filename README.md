# BootVerse

Phase 1 catalogue + Phase 2 Sprint 2.1 accounts and Sprint 2.2 community posts, built with Next.js App Router, TypeScript, Tailwind CSS, and customized shadcn/ui components.

## Run locally

Requires Node.js 22.12+ (tested with Node 24) and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. For a production preview, run `npm run build` followed by `npm start`.

## Included

- Light Geist-based Home, navbar, footer, catalogue, and eight boot detail pages.
- Functional brand/surface discovery links, desktop filter sidebar, and accessible mobile navigation/filter drawers.
- Search plus brand, product silo, tier, and outsole surface filters; name/brand sorting.
- Shareable URL state, browser back/forward support, and catalogue return context from details.
- Initial query-aware catalogue results rendered on the server.
- Loading skeletons, empty results with reset, error retry, and 404 handling.
- Keyboard accessible controls, visible focus, skip link, reduced motion support, responsive layouts, and locally bundled fonts/artwork.
- Unit tests for filtering, sorting, query parsing, and fixture identity validation.

## Sample data and product identity

**All eight entries are fictional sample configurations, not verified manufacturer records.** Familiar brand/silo names provide navigation context. Demo generations, tiers, surface assignments, and colorways are explicitly unverified. Weight, upper, release date, price, fit, rating, and player endorsements are explicitly unknown.

`Brand → BootFamily/silo → ModelGeneration → TierModel → OutsoleVariant → CatalogueEntry`

A catalogue entry associates an outsole variant with a colorway. Colorways are scoped to generations and can be shared across variants. Fixtures demonstrate colorway siblings, outsole siblings, and separate generations in the same family. Runtime validation rejects broken references, cross-generation colorways, duplicate identities, and unsupported sample claims.

The shared AI artwork is an unbranded concept, not a product photo; all placements are labeled. Its prompt and provenance are in [docs/artwork.md](docs/artwork.md).

## Structure

- `src/app`: App Router pages, metadata, loading/error/404 states, and theme.
- `src/components`: reusable catalogue, cards, navigation, notices, artwork, and shadcn/ui primitives.
- `src/lib/boots`: typed domain entities, normalized fixtures, joins, filters, validation, and tests.
- `docs/architecture.md`: PostgreSQL/Prisma, reviews, and Boot Fit Finder integration notes.

Sprint 2.1 adds Auth.js email registration/login, PostgreSQL/Prisma sessions, protected account settings, public profiles and server authorization. Account setup requires environment variables; the catalogue remains usable without them. Sprint 2.2 adds a real stored Community feed, post CRUD, safe Markdown, categories/tags, search, sorting and pagination, linked sample boots and public post history. Comments/voting, structured reviews, uploads and production cloud infrastructure are not implemented yet. See [Sprint 2.1 setup, security and verification](docs/phase-2-foundation.md).

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run test:watch` runs the unit tests interactively.

Validation: typecheck, lint, 83 unit tests, real HTTP/PostgreSQL/SMTP integration tests, and production build pass. Browser checks cover mobile/desktop layouts, combined filters, search, empty-state reset, and detail navigation. `npm audit --omit=dev` reports zero vulnerabilities. Full audit reports five high-severity findings in ESLint's transitive glob dependencies; its proposed fix downgrades the Next.js lint configuration, so that incompatible fix was not applied.

The redesign tokens, components, responsive rules, and scope are documented in [docs/design-system.md](docs/design-system.md).

For accounts/community: copy `.env.example` to `.env`, configure PostgreSQL/SMTP/secret/origin, run `npm run db:deploy` and `npm run db:catalogue`, then `npm run dev`. Local email capture: `npm run dev:mail`. Run `npm run build` then `npm run test:integration` with local PostgreSQL for the isolated auth lifecycle tests.

Community routes, API, migration, validation and remaining boundaries: [Sprint 2.2 notes](docs/phase-2-community.md). Current verification includes 83 unit tests and 18 real HTTP/PostgreSQL/SMTP integration tests.
