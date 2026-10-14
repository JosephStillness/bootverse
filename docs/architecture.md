# BootVerse foundation

## Product identity

Brand → BootFamily (the product silo) → ModelGeneration → TierModel → OutsoleVariant → CatalogueEntry (one colorway on one variant).

Each entity has a stable ID. A family is not a purchasable boot. A generation is not a tier. A tier name is scoped to its generation; it is not a universal performance score. A surface code belongs to an outsole variant, not a colorway. Two colorways share an outsole variant; two surfaces share a tier model. The fixtures deliberately demonstrate both relationships.

All eight entries are fictional sample configurations using familiar brand and silo names for navigation. Their generations, tiers, surface assignments, and colorway names are demo data, not verified manufacturer records. Technical attributes use a discriminated `unknown` state. No price, rating, fit, or endorsement claims are inferred. Artwork is unbranded AI concept imagery, not a product photo.

## Current boundaries

- Home and boot detail bodies are statically generated. Catalogue is rendered at request time to include query-specific listings in initial HTML.
- A client catalogue component owns search, filters, and sort, persisted in shareable URL query parameters. Its options come from the supplied records. A validated return URL preserves catalogue context when opening details.
- Typed fixtures and validation live in `src/lib/boots`; UI consumes joined catalogue records.
- Pure filtering and validation functions have unit tests. Runtime fixture validation fails loudly for broken identities.
- Sprint 2.1 adds PostgreSQL/Prisma, Auth.js verified-email accounts, database sessions, public profiles and owner/role guards. See `docs/phase-2-foundation.md` for setup and boundaries. Sprint 2.2 adds server-rendered community posts/feed and normalized database catalogue identities for FK-backed links; Phase 1 catalogue rendering remains fixture-backed. Recommendations, analytics and cloud services remain unimplemented. See `docs/phase-2-community.md`. Sprint 2.3 adds Comment/PostVote, bounded per-branch threads, DB-maintained activity counters and activity sorting; see `docs/phase-2-interactions.md`. Sprint 2.4 adds exact-variant BootReview/ReviewHelpfulVote with consent-aware public projections; see `docs/phase-2-reviews.md`.

## Catalogue integration with PostgreSQL and Prisma

Translate the identity chain into separate tables with foreign keys. Keep unique generation slugs within families, tier labels within generations, and outsole codes within tier models. Catalogue entries should have unique `(outsoleVariantId, colorwayId)` pairs. Colorways can belong to a generation and be reused across its variants; enforce that both sides reference the same generation. Keep source URL, verification status, and observation date beside factual attributes, with nullable values for unverified fields. Preserve stable IDs and route slugs.

Replace the fixture joins at the server data boundary with Prisma queries returning the same UI record shape. Add pagination and database-backed filtering when catalogue size warrants it. Validate external data before it enters the domain. Do not add a generic repository layer until a real second data source needs it.

## Structured reviews (Sprint 2.4)

BootReview references the existing BootVariant: generation, tier and outsole stay separate; colorways of that exact variant share reviews. PostgreSQL enforces one review per author/variant, immutable identity, 1–5 criteria and server-derived equal-weight totals. Public aggregation excludes hidden/inactive/unverified authors; null averages mean not yet rated. Foot measurements and shape are owner-only unless explicit display consent is stored; public shape filtering honors the same rule. ReviewHelpfulVote is unique per review/member and owner-forbidden. These observations remain community opinions, never manufacturer or experimental facts. See the Sprint 2.4 notes for APIs, migrations and validation.

## Later Boot Fit Finder

Fit observations need explicit size system, worn size, foot measurements, width, surface, and source/provenance. Scope fit evidence to the appropriate generation and tier. Model unknown separately from negative evidence. A future finder should explain its inputs, limitations, and confidence; it must not derive fit from brand or silo alone. No scoring or recommendation code exists in Phase 1.
