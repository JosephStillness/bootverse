import "server-only";
import { recordRevision } from "@/lib/product-review/facts";
import {compareClaims} from "@/lib/enrichment/observations";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { lockedActiveUser } from "@/lib/accounts/authorization-db";
import { requireActiveUser, AccessError, type Principal } from "@/lib/accounts/authorization";
import { CommunityError } from "@/lib/community/service";
import { sourceSchema, brandSchema, productDraftSchema, identifierSchema, claimSchema, decisionSchema, productImageSchema, offerSchema, registryQuery, dataId, assessProduct, canTransitionClaim } from "./validation";

export type Tx = Prisma.TransactionClient;
export function requireAdmin(actor: Principal | null) {
  const user = requireActiveUser(actor);
  if (user.role !== "ADMIN") throw new AccessError(403, "Administrator access is required.");
  return user;
}
export async function adminTx<T>(actor: Principal | null, run: (tx: Tx, user: Principal) => Promise<T>) {
  requireAdmin(actor);
  try {
    return await getDb().$transaction(async tx => run(tx, requireAdmin(await lockedActiveUser(tx, actor))));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") throw new CommunityError(409, "This identity, SKU or primary image already exists. Review the existing record.");
      if (error.code === "P2003") throw new CommunityError(400, "The referenced source or product identity is invalid or still in use.");
      if (error.code === "P2025") throw new CommunityError(404, "Product data record not found.");
      if (error.code === "P2034") throw new CommunityError(409, "Concurrent change. Reload and review the current record.");
    }
    throw error;
  }
}
const versionSchema = z.number().int().positive();
export async function audit(tx: Tx, user: Principal, key: string, action: string, note: string) {
  await tx.moderationAction.create({ data: { actorId: user.id, targetKey: key, action, note } });
}
export async function activeSource(tx: Tx, id: string, brandId?: string) {
  const source = await tx.productSource.findUnique({ where: { id } });
  if (!source || source.status !== "ACTIVE" || source.authorizationStatus === "DENIED") throw new CommunityError(400, "An active, attributed source is required.");
  if (source.type === "MANUFACTURER" && brandId && source.brandId !== brandId) throw new CommunityError(400, "Manufacturer source belongs to a different brand.");
  return source;
}
export const ancestry = { tier: { include: { generation: { include: { family: { include: { brand: true } } } } } } } as const;
export async function lockProduct(tx: Tx, id: string) {
  const entry = await tx.catalogueEntry.findUnique({ where: { id: dataId.parse(id) }, select: { outsoleVariantId: true } });
  if (!entry) throw new CommunityError(404, "Product not found.");
  await tx.$queryRaw`SELECT id FROM "BootVariant" WHERE id=${entry.outsoleVariantId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "CatalogueEntry" WHERE id=${id} FOR UPDATE`;
}
async function snapshot(tx: Tx, id: string) {
  const entry = await tx.catalogueEntry.findUnique({ where: { id }, include: { variant: { include: ancestry }, colorway: true, source: true, identifiers: { take: 201, orderBy: { id: "asc" } }, productImages: { take: 51, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } });
  if (!entry) throw new CommunityError(404, "Product not found.");
  const claims = await tx.productClaim.findMany({ where: { OR: [{ entryId: id }, { variantId: entry.outsoleVariantId }] }, include: { source: { select: { name: true, type: true, status: true, authorizationStatus: true } } }, take: 201, orderBy: { id: "asc" } });
  const generation = entry.variant.tier.generation, family = generation.family;
  const quality = assessProduct({ brandId: family.brandId, familyId: family.id, generationId: generation.id, tierId: entry.variant.tierModelId, tierName: entry.variant.tier.name, variantId: entry.outsoleVariantId, colorwayId: entry.colorwayId, surface: entry.variant.surface, source: entry.source, claims, hasIdentifier: entry.identifiers.length > 0, hasImage: entry.productImages.some(i => i.status === "VERIFIED" && i.licenseStatus === "GRANTED") });
  if (family.brand.status !== "ACTIVE") quality.errors.push("inactive_brand");
  if (claims.some(c => c.status === "VERIFIED" && (c.source.status !== "ACTIVE" || c.source.authorizationStatus === "DENIED"))) quality.errors.push("unavailable_claim_source");
  const candidates = await tx.$queryRaw<{ duplicate: boolean }[]>`SELECT EXISTS (
    SELECT 1 FROM "ProductIdentifier" a JOIN "ProductIdentifier" b ON b."brandId"=a."brandId" AND b.region=a.region AND lower(b.value)=lower(a.value) AND b."entryId"<>a."entryId" WHERE a."entryId"=${id}
  ) AS duplicate`;
  if (candidates[0].duplicate) quality.warnings.push("possible_case_variant_sku");
  if (entry.identifiers.length > 200 || entry.productImages.length > 50) quality.errors.push("record_limit");
  quality.ready = quality.errors.length === 0;
  return { ...entry, claims, quality };
}
export async function inspectProduct(actor: Principal | null, id: string) { return adminTx(actor, tx => snapshot(tx, dataId.parse(id))); }
export async function listProducts(actor: Principal | null, input: unknown) {
  const q = registryQuery.parse(input), value = q.q.replace(/[\\%_]/g, "\\$&");
  return adminTx(actor, async tx => {
    const where = { ...(q.status ? { status: q.status } : {}), ...(q.q ? { slug: { contains: value, mode: "insensitive" as const } } : {}) };
    const total = await tx.catalogueEntry.count({ where });
    const records = await tx.catalogueEntry.findMany({ where, select: { id: true, slug: true, status: true, published: true, sample: true, version: true, createdAt: true, source: { select: { id: true, name: true } }, variant: { select: { id: true, surface: true, tier: { select: { name: true } } } } }, take: 25, skip: (q.page - 1) * 25, orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
    return { records, total, page: q.page, pages: Math.ceil(total / 25) };
  });
}
export async function listSources(actor: Principal | null, input: unknown) {
  const q = registryQuery.omit({ status: true }).extend({ status: z.enum(["ACTIVE", "ARCHIVED"]).optional() }).parse(input);
  return adminTx(actor, async tx => {
    const where = { ...(q.status ? { status: q.status } : {}), ...(q.q ? { name: { contains: q.q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const } } : {}) };
    const total = await tx.productSource.count({ where });
    return { records: await tx.productSource.findMany({ where, take: 25, skip: (q.page - 1) * 25, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }), total, page: q.page, pages: Math.ceil(total / 25) };
  });
}
export async function saveSource(actor: Principal | null, input: unknown, id?: string) {
  const { version, ...data } = sourceSchema.safeExtend({ version: versionSchema.optional() }).parse(input);
  if ((!!id && version === undefined) || (!id && version !== undefined)) throw new CommunityError(400, "Updates require the current source version; creation does not accept one.");
  return adminTx(actor, async (tx, user) => {
    if (id) {
      await tx.$queryRaw`SELECT id FROM "ProductSource" WHERE id=${dataId.parse(id)} FOR UPDATE`;
      const previous = await tx.productSource.findUnique({ where: { id } });
      if (!previous) throw new CommunityError(404, "Source not found.");
      if (previous.version !== version) throw new CommunityError(409, "This source changed. Reload its current version.");
      if (previous.baseUrl !== data.baseUrl || previous.brandId !== (data.brandId ?? null) || previous.type !== data.type) {
        const linked = await tx.productSource.findUnique({ where: { id }, select: { _count: { select: { entries: true, claims: true, identifiers: true, images: true, offers: true, imports: true, sourceRecords: true } } } });
        if (linked && Object.values(linked._count).some(n => n > 0)) throw new CommunityError(409, "A referenced source cannot change origin or manufacturer. Register a new source.");
      }
    }
    const permission = ["GRANTED", "NOT_REQUIRED"].includes(data.authorizationStatus);
    const values = { ...data, brandId: data.brandId ?? null, permissionNotes: data.permissionNotes ?? null, permissionUrl: data.permissionUrl ?? null, usageRestrictions: data.usageRestrictions ?? null, checkedById: permission ? user.id : null, authorizationCheckedAt: permission ? new Date() : null, lastCheckedAt: data.lastCheckedAt ? new Date(data.lastCheckedAt) : null };
    const row = id ? await tx.productSource.update({ where: { id }, data: { ...values, version: { increment: 1 } } }) : await tx.productSource.create({ data: values });
    await audit(tx, user, `SOURCE:${row.id}`, id ? "UPDATE_SOURCE" : "CREATE_SOURCE", "Source metadata saved; permission remains a documented administrator attestation.");
    return row;
  });
}
export async function createBrand(actor: Principal | null, input: unknown) {
  const data = brandSchema.parse(input);
  return adminTx(actor, async (tx, user) => {
    const matches = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "BootBrand" WHERE lower(normalize(btrim(name),NFC))=lower(normalize(${data.name},NFC)) LIMIT 1`;
    if (matches.length) throw new CommunityError(409, "A brand with this normalized name already exists.");
    const row = await tx.bootBrand.create({ data: { id: crypto.randomUUID(), ...data } });
    await audit(tx, user, `BRAND:${row.id}`, "CREATE_BRAND", "Brand registry identity created without product or performance claims."); return row;
  });
}
export async function createProduct(actor: Principal | null, input: unknown) {
  const data = productDraftSchema.parse(input);
  return adminTx(actor, async (tx, user) => {
    const variant = await tx.bootVariant.findUnique({ where: { id: data.variantId }, include: ancestry });
    const colorway = await tx.bootColorway.findUnique({ where: { id: data.colorwayId } });
    if (!variant || !colorway || variant.generationId !== colorway.generationId) throw new CommunityError(400, "Choose a variant and colorway from the same generation.");
    await activeSource(tx, data.sourceId, variant.tier.generation.family.brandId);
    const row = await tx.catalogueEntry.create({ data: { id: crypto.randomUUID(), slug: data.slug, outsoleVariantId: variant.id, generationId: variant.generationId, colorwayId: colorway.id, sourceId: data.sourceId, sample: data.sample } });
    await audit(tx, user, `PRODUCT:${row.id}`, "CREATE_PRODUCT", "Created an attributed draft; not automatically published."); return row;
  });
}
export async function addProductRecord(actor: Principal | null, id: string, input: unknown) {
  const envelope = z.object({ kind: z.enum(["identifier", "claim", "image", "offer"]), data: z.unknown() }).strict().parse(input);
  return adminTx(actor, async (tx, user) => {
    await lockProduct(tx, id);
    const entry = await tx.catalogueEntry.findUnique({ where: { id }, include: { variant: { include: ancestry } } });
    if (!entry) throw new CommunityError(404, "Product not found.");
    const brandId = entry.variant.tier.generation.family.brandId;
    if (envelope.kind === "identifier") {
      const data = identifierSchema.parse(envelope.data); await activeSource(tx, data.sourceId, brandId);
      const row = await tx.productIdentifier.create({ data: { ...data, entryId: id, brandId } });
      await audit(tx, user, `PRODUCT:${id}`, "REGISTER_SKU", "Added a source-attributed, manufacturer/region-scoped identifier; no construction merge."); return row;
    }
    if (envelope.kind === "claim") {
      const data = claimSchema.parse(envelope.data); await activeSource(tx, data.sourceId, brandId);
      if ((data.entryId && data.entryId !== id) || (data.variantId && data.variantId !== entry.outsoleVariantId)) throw new CommunityError(400, "Claim target does not match this product.");
      const row = await tx.productClaim.create({ data: { ...data, observedAt: new Date(data.observedAt), value: data.value } });
      await audit(tx, user, `CLAIM:${row.id}`, "CREATE_CLAIM", "New immutable observation; verification starts UNVERIFIED."); return row;
    }
    if (envelope.kind === "image") {
      const data = productImageSchema.parse(envelope.data); await activeSource(tx, data.sourceId, brandId);
      if (data.uploadedImageId) {
        const image = await tx.uploadedImage.findFirst({ where: { id: data.uploadedImageId, ownerId: user.id, state: "READY", status: "PUBLISHED" }, select: { id: true,productEntryId:true } });
        if (image?.productEntryId&&image.productEntryId!==id)throw new AccessError(403,"This upload belongs to another product.");
        if (!image) throw new AccessError(403, "Choose your own ready upload. Storage paths are never accepted.");
      }
      const row = await tx.productImage.create({ data: { ...data, entryId: id } });
      await audit(tx, user, `IMAGE_METADATA:${row.id}`, "PRODUCT_IMAGE", "Registered image metadata only; no third-party image was downloaded."); return row;
    }
    const data = offerSchema.parse(envelope.data), source = await activeSource(tx, data.sourceId, brandId);
    if (!["MANUFACTURER", "RETAILER", "PRODUCT_FEED", "AFFILIATE_FEED"].includes(source.type)) throw new CommunityError(400, "Offers require an identified manufacturer, retailer or product feed.");
    const scope = { entryId: id, size: data.size, sizeSystem: data.sizeSystem };
    const common = { variantId: entry.outsoleVariantId, entryId: id, sourceId: data.sourceId, countryCode: data.countryCode, sourceUrl: data.sourceUrl, sourceKind: source.type === "MANUFACTURER" ? "MANUFACTURER" : "RETAILER", observedAt: new Date(data.observedAt), validUntil: new Date(data.validUntil) };
    const row = await tx.recommendationEvidence.create({ data: { ...common, kind: "PRICE", payload: { ...scope, amount: data.amount, currency: data.currency } } });
    if (data.available !== undefined) await tx.recommendationEvidence.create({ data: { ...common, kind: "AVAILABILITY", payload: { ...scope, available: data.available } } });
    await audit(tx, user, `PRODUCT:${id}`, "REGISTER_OFFER", "Stored exact-entry, expiring offer evidence; approval remains false."); return row;
  });
}
export async function decideRecord(actor: Principal | null, kind: "claim" | "image", id: string, input: unknown) {
  const data = decisionSchema.safeExtend({ version: versionSchema }).parse(input);
  return adminTx(actor, async (tx, user) => {
    dataId.parse(id);
    // All decisions for shared construction evidence serialize on the same variant.
    const record = kind === "claim" ? await tx.productClaim.findUnique({ where: { id } }) : await tx.productImage.findUnique({ where: { id } });
    if (!record) throw new CommunityError(404, "Evidence record not found.");
    const entryId = record.entryId;
    const variantId = "variantId" in record ? record.variantId : null;
    if (entryId) await lockProduct(tx, entryId);
    else if (variantId) await tx.$queryRaw`SELECT id FROM "BootVariant" WHERE id=${variantId} FOR UPDATE`;
    const current = kind === "claim" ? await tx.productClaim.findUniqueOrThrow({ where: { id } }) : await tx.productImage.findUniqueOrThrow({ where: { id } });
    if (current.version !== data.version || !canTransitionClaim(current.status, data.status)) throw new CommunityError(409, "Stale version or invalid verification transition.");
    const source = await activeSource(tx, current.sourceId);
    if (data.status === "VERIFIED") {
      if (source.type === "MANUFACTURER" && new URL(current.sourceUrl).hostname !== new URL(source.baseUrl).hostname) throw new CommunityError(400, "Manufacturer evidence URL must match its registered origin.");
      if (kind === "claim" && "attribute" in current) {
        const conflict = await tx.productClaim.findMany({ where: { id: { not: id }, attribute: current.attribute, status: "VERIFIED", ...(current.entryId ? { OR: [{ entryId: current.entryId }, { variantId: (await tx.catalogueEntry.findUniqueOrThrow({ where: { id: current.entryId }, select: { outsoleVariantId: true } })).outsoleVariantId }] } : { OR: [{ variantId: current.variantId }, { entry: { outsoleVariantId: current.variantId! } }] }) }, select: { value: true }, take: 201 });
        if (conflict.length > 200 || conflict.some(c => compareClaims(current.attribute,c.value,current.value)==="CONFLICT")) throw new CommunityError(409, "Conflicting verified observations require explicit conflict review.");
      }
      if (kind === "image" && "licenseStatus" in current && current.licenseStatus !== "GRANTED") throw new CommunityError(400, "Image use requires documented permission.");
    }
    const decision = { status: data.status, reviewedAt: data.status === "VERIFIED" ? new Date() : null, version: { increment: 1 } };
    const result = kind === "claim" ? await tx.productClaim.update({ where: { id }, data: { ...decision, reviewerId: user.id, reviewNote: data.note } }) : await tx.productImage.update({ where: { id }, data: decision });
    await audit(tx, user, `${kind === "claim" ? "CLAIM" : "IMAGE_METADATA"}:${id}`, "VERIFY_PRODUCT", `${current.status} → ${data.status}: ${data.note}`);
    // D4 revision history: record when this decision changes what a published page shows.
    const affected = entryId ? [entryId] : (await tx.catalogueEntry.findMany({ where: { outsoleVariantId: variantId!, status: "PUBLISHED" }, select: { id: true }, take: 100 })).map(e => e.id);
    await recordRevision(tx, affected, user.id, `Evidence decision ${current.status} → ${data.status}: ${data.note}`, null);
    // D5: a verify/reject decision answers the source-sync change that proposed this observation.
    if (kind === "claim" && (data.status === "VERIFIED" || data.status === "REJECTED")) await tx.sourceSyncChange.updateMany({ where: { claimId: id, disposition: "PENDING_REVIEW" }, data: { disposition: "RESOLVED", resolvedById: user.id, resolvedAt: new Date() } });
    return result;
  });
}
