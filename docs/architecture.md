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
- No accounts, writes, database, community, reviews, recommendations, analytics, or cloud services.

## Later PostgreSQL and Prisma

Translate the identity chain into separate tables with foreign keys. Keep unique generation slugs within families, tier labels within generations, and outsole codes within tier models. Catalogue entries should have unique `(outsoleVariantId, colorwayId)` pairs. Colorways can belong to a generation and be reused across its variants; enforce that both sides reference the same generation. Keep source URL, verification status, and observation date beside factual attributes, with nullable values for unverified fields. Preserve stable IDs and route slugs.

Replace the fixture joins at the server data boundary with Prisma queries returning the same UI record shape. Add pagination and database-backed filtering when catalogue size warrants it. Validate external data before it enters the domain. Do not add a generic repository layer until a real second data source needs it.

## Later reviews

Review records should identify the specific tier and outsole variant, with an optional colorway reference. Never aggregate reviews across a whole family as if generations and tiers were interchangeable. Add author identity, moderation, ownership permissions, surface/use context, and published status before accepting user content. Show aggregate counts and uncertainty alongside ratings; distinguish measured facts from subjective reports.

## Later Boot Fit Finder

Fit observations need explicit size system, worn size, foot measurements, width, surface, and source/provenance. Scope fit evidence to the appropriate generation and tier. Model unknown separately from negative evidence. A future finder should explain its inputs, limitations, and confidence; it must not derive fit from brand or silo alone. No scoring or recommendation code exists in Phase 1.
