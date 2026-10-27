import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/lib/product-data/service";
import { publicAssets, publicTechnical } from "@/lib/enrichment/public";
import { stableJson } from "@/lib/data-import/preview";
import type { DuplicateOutcome, DuplicateRelation, ReviewFacts } from "./rules";

// Same ancestry shape as product-data/service; kept local so that module can import this one without a cycle.
const ancestry = { tier: { include: { generation: { include: { family: { include: { brand: true } } } } } } } as const;
const LIMIT = { identifiers: 200, images: 50, claims: 200, staged: 50 };
const DUPLICATE_LIMIT = 50;
const claimSource = { select: { name: true, type: true, status: true, authorizationStatus: true } } as const;
const imageInclude = { source: { select: { status: true, authorizationStatus: true, usageRestrictions: true } }, uploadedImage: { select: { width: true, height: true, state: true, status: true, productEntryId: true } } } as const;

type DuplicateRow = { entryId: string; candidateId: string; slug: string; status: string; sameFamily: boolean; sameGeneration: boolean; sameTier: boolean; sameSurface: boolean; sameColor: boolean; skuMatch: boolean };
// Normalized-name comparison mirrors D2 identityName(): trimmed, NFC, collapsed whitespace, case-folded.
const norm = (column: string) => Prisma.raw(`lower(regexp_replace(btrim(normalize(${column},NFC)),'\\s+',' ','g'))`);
export async function duplicateCandidates(tx: Tx, ids: string[]) {
  if (!ids.length) return new Map<string, ReviewFacts["duplicates"]>();
  const rows = await tx.$queryRaw<DuplicateRow[]>`
    WITH ident AS (
      SELECT e.id, e.slug, e.status::text AS status, b.id AS bid, ${norm("f.name")} AS fam, ${norm("g.name")} AS gen, ${norm("t.name")} AS tier, v.surface, ${norm("c.name")} AS color
      FROM "CatalogueEntry" e JOIN "BootVariant" v ON v.id=e."outsoleVariantId" JOIN "BootTier" t ON t.id=v."tierModelId"
      JOIN "BootGeneration" g ON g.id=e."generationId" JOIN "BootFamily" f ON f.id=g."familyId" JOIN "BootBrand" b ON b.id=f."brandId" JOIN "BootColorway" c ON c.id=e."colorwayId"
    ), me AS (SELECT * FROM ident WHERE id = ANY(${ids}::text[])),
    sku AS (
      SELECT DISTINCT a."entryId" AS a, b."entryId" AS b FROM "ProductIdentifier" a
      JOIN "ProductIdentifier" b ON b."brandId"=a."brandId" AND b.region=a.region AND lower(b.value)=lower(a.value) AND b."entryId"<>a."entryId"
      WHERE a."entryId" = ANY(${ids}::text[])
    )
    , pairs AS (
      SELECT me.id AS "entryId", o.id AS "candidateId", o.slug, o.status, (me.fam=o.fam) AS "sameFamily", (me.gen=o.gen) AS "sameGeneration", (me.tier=o.tier) AS "sameTier",
        (me.surface IS NOT DISTINCT FROM o.surface) AS "sameSurface", (me.color=o.color) AS "sameColor", EXISTS(SELECT 1 FROM sku WHERE sku.a=me.id AND sku.b=o.id) AS "skuMatch",
        -- Per-entry cap: a global LIMIT could give one entry every row and hide another entry's duplicates.
        row_number() OVER (PARTITION BY me.id ORDER BY o.id) AS rank
      FROM me JOIN ident o ON o.id<>me.id AND o.bid=me.bid AND ((o.fam=me.fam AND o.color=me.color) OR EXISTS(SELECT 1 FROM sku WHERE sku.a=me.id AND sku.b=o.id))
    )
    SELECT "entryId", "candidateId", slug, status, "sameFamily", "sameGeneration", "sameTier", "sameSurface", "sameColor", "skuMatch" FROM pairs WHERE rank <= ${DUPLICATE_LIMIT + 1} ORDER BY "entryId", "candidateId"`;
  const result = new Map<string, ReviewFacts["duplicates"]>();
  for (const r of rows) {
    const same = r.sameFamily && r.sameGeneration && r.sameTier && r.sameSurface && r.sameColor;
    const relation: DuplicateRelation = same ? "SAME_IDENTITY" : !r.sameGeneration ? "DIFFERENT_GENERATION" : !r.sameTier ? "DIFFERENT_TIER" : !r.sameSurface ? "DIFFERENT_OUTSOLE" : "CASE_ONLY_SKU";
    // Only a SKU match can reach CASE_ONLY_SKU here: name matches always share family and colorway.
    result.set(r.entryId, [...(result.get(r.entryId) ?? []), { candidateId: r.candidateId, slug: r.slug, status: r.status, relation, skuCaseCollision: r.skuMatch && relation.startsWith("DIFFERENT_") }]);
  }
  return result;
}

export async function loadFacts(tx: Tx, ids: string[], now = new Date()) {
  const entries = await tx.catalogueEntry.findMany({
    where: { id: { in: ids } },
    include: {
      variant: { include: ancestry }, colorway: true, source: true,
      identifiers: { take: LIMIT.identifiers + 1, orderBy: { id: "asc" }, include: { source: { select: { status: true, authorizationStatus: true } } } },
      productImages: { take: LIMIT.images + 1, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }], include: imageInclude },
      _count: { select: { sourceRecords: true } },
    },
  });
  const variantIds = [...new Set(entries.map(e => e.outsoleVariantId))];
  const [claims, duplicates, decisions, staged, syncChanges] = await Promise.all([
    tx.productClaim.findMany({ where: { OR: [{ entryId: { in: ids } }, { variantId: { in: variantIds } }] }, include: { source: claimSource }, orderBy: { id: "asc" }, take: ids.length * (LIMIT.claims + 1) }),
    duplicateCandidates(tx, ids),
    tx.productReviewDecision.findMany({ where: { entryId: { in: ids }, kind: "DUPLICATE_RESOLUTION" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: ids.length * 20, select: { entryId: true, details: true } }),
    tx.productImportRow.findMany({ where: { entryId: { in: ids }, action: { in: ["STAGE", "QUARANTINE"] } }, select: { id: true, entryId: true }, orderBy: { id: "asc" }, take: ids.length * (LIMIT.staged + 1) }),
    tx.sourceSyncChange.findMany({ where: { entryId: { in: ids }, disposition: "PENDING_REVIEW", kind: { not: "NEW_PRODUCT" } }, select: { id: true, entryId: true, kind: true, severity: true }, orderBy: { id: "asc" }, take: ids.length * (LIMIT.staged + 1) }),
  ]);
  const map = new Map<string, { facts: ReviewFacts; entry: typeof entries[number]; claims: typeof claims }>();
  for (const e of entries) {
    const scoped = claims.filter(c => c.entryId === e.id || c.variantId === e.outsoleVariantId);
    const own = decisions.filter(d => d.entryId === e.id).map(d => d.details as { outcome?: DuplicateOutcome; candidateIds?: string[]; importRowIds?: string[] });
    const latest = own[0];
    const acknowledged = new Set(own.flatMap(d => d.importRowIds ?? []));
    const rows = staged.filter(r => r.entryId === e.id);
    const t = e.variant.tier, g = t.generation, f = g.family, b = f.brand;
    map.set(e.id, {
      entry: e, claims: scoped,
      facts: {
        entry: { id: e.id, slug: e.slug, status: e.status, sample: e.sample, version: e.version },
        brand: { id: b.id, name: b.name, status: b.status }, family: { id: f.id, name: f.name }, generation: { id: g.id, name: g.name }, tier: { id: t.id, name: t.name },
        variant: { id: e.variant.id, surface: e.variant.surface, manufacturerOutsole: e.variant.manufacturerOutsole }, colorway: { id: e.colorway.id, name: e.colorway.name, swatch: e.colorway.swatch },
        source: e.source && { id: e.source.id, version: e.source.version, type: e.source.type, status: e.source.status, authorizationStatus: e.source.authorizationStatus, brandId: e.source.brandId, usageRestrictions: e.source.usageRestrictions },
        identifiers: e.identifiers.slice(0, LIMIT.identifiers).map(s => ({ id: s.id, value: s.value, region: s.region, source: s.source })),
        sourceRecordCount: e._count.sourceRecords,
        claims: scoped.slice(0, LIMIT.claims),
        images: e.productImages.slice(0, LIMIT.images),
        duplicates: (duplicates.get(e.id) ?? []).slice(0, DUPLICATE_LIMIT),
        duplicateDecision: latest?.outcome ? { outcome: latest.outcome, candidateIds: latest.candidateIds ?? [] } : null,
        stagedProposals: rows.filter(r => !acknowledged.has(r.id)).length,
        syncChanges: syncChanges.filter(c => c.entryId === e.id).slice(0, LIMIT.staged).map(({ id, kind, severity }) => ({ id, kind, severity })),
        overflow: e.identifiers.length > LIMIT.identifiers || e.productImages.length > LIMIT.images || scoped.length > LIMIT.claims || rows.length > LIMIT.staged || syncChanges.filter(c => c.entryId === e.id).length > LIMIT.staged || (duplicates.get(e.id)?.length ?? 0) > DUPLICATE_LIMIT,
        now,
      },
    });
  }
  return map;
}

/** What the public product page shows (or would show once published). Never includes private notes or pending evidence. */
export async function publicSnapshot(tx: Tx, id: string) {
  const e = await tx.catalogueEntry.findUniqueOrThrow({ where: { id }, include: { variant: { include: ancestry }, colorway: true, identifiers: { take: LIMIT.identifiers, orderBy: { id: "asc" } }, productImages: { take: LIMIT.images + 1, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }], include: imageInclude } } });
  const claims = await tx.productClaim.findMany({ where: { OR: [{ entryId: id }, { variantId: e.outsoleVariantId }] }, take: LIMIT.claims + 1, orderBy: { id: "asc" }, select: { entryId: true, variantId: true, attribute: true, value: true, status: true, basis: true, sourceId: true, sourceUrl: true, observedAt: true, reviewedAt: true, source: claimSource } });
  const t = e.variant.tier, g = t.generation;
  const snapshot = {
    slug: e.slug, sample: e.sample,
    identity: { brand: g.family.brand.name, family: g.family.name, generation: g.name, tier: t.name, outsole: e.variant.surface, colorway: e.colorway.name },
    identifiers: e.identifiers.map(s => `${s.region}:${s.value}`),
    // The public detail page shows extended evidence and gallery only for non-sample records.
    attributes: e.sample ? [] : publicTechnical(claims, id, e.outsoleVariantId).map(({ observedAt, reviewedAt, ...rest }) => { void observedAt; void reviewedAt; return rest; }),
    images: e.sample || e.productImages.length > LIMIT.images ? [] : publicAssets(e.productImages).map(i => ({ id: i.id, altText: i.altText, attribution: i.attribution })),
  };
  return { snapshot, hash: createHash("sha256").update(stableJson(snapshot)).digest("hex"), status: e.status };
}

/** Append a revision when the public view of a published product changes (or always on approval). */
export async function recordRevision(tx: Tx, entryIds: string[], actorId: string, reason: string, decisionId: string | null, force = false) {
  const created: string[] = [];
  for (const id of [...new Set(entryIds)].sort()) {
    const current = await publicSnapshot(tx, id);
    if (current.status !== "PUBLISHED") continue;
    const last = await tx.productRevision.findFirst({ where: { entryId: id }, orderBy: { revision: "desc" }, select: { revision: true, snapshotHash: true } });
    if (!force && last?.snapshotHash === current.hash) continue;
    await tx.productRevision.create({ data: { entryId: id, revision: (last?.revision ?? 0) + 1, snapshot: current.snapshot, snapshotHash: current.hash, actorId, decisionId, reason: reason.slice(0, 2000) } });
    created.push(id);
  }
  return created;
}
