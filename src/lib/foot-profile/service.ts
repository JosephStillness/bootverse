import "server-only";
import type { FootProfile } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { lockedActiveUser } from "@/lib/accounts/authorization-db";
import { requireActiveUser, type Principal } from "@/lib/accounts/authorization";
import { CommunityError } from "@/lib/community/service";
import { footProfileSchema, deleteFootProfileSchema } from "./validation";

function privateView(row: FootProfile) {
  return {
    unit: "mm" as const,
    revision: row.id,
    leftLengthMm: row.leftLengthMm?.toString() ?? null,
    rightLengthMm: row.rightLengthMm?.toString() ?? null,
    leftWidthMm: row.leftWidthMm?.toString() ?? null,
    rightWidthMm: row.rightWidthMm?.toString() ?? null,
    measuredOn: row.measuredOn?.toISOString().slice(0, 10) ?? null,
    measurementMethod: row.measurementMethod,
    footShape: row.footShape, instep: row.instep, arch: row.arch,
    toePreference: row.toePreference, heelPreference: row.heelPreference,
    snugness: row.snugness, fitSensation: row.fitSensation,
    primaryPosition: row.primaryPosition, secondaryPositions: row.secondaryPositions,
    surface: row.surface, budgetAmount: row.budgetAmount?.toString() ?? null,
    currency: row.currency, preferredBrands: row.preferredBrands, preferredTiers: row.preferredTiers,
    sizeWorn: row.sizeWorn?.toString() ?? null, sizeSystem: row.sizeSystem,
    allowFitFinder: row.allowFitFinder, fitFinderConsentAt: row.fitFinderConsentAt?.toISOString() ?? null,
    version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}
export type PrivateFootProfile = ReturnType<typeof privateView>;
// Owner-scoped normalized interface for a future Fit Finder. Never accepts another user's ID.
export async function getOwnFootProfile(actor: Principal | null): Promise<PrivateFootProfile | null> {
  return getDb().$transaction(async tx => {
    const user = await lockedActiveUser(tx, actor);
    const row = await tx.footProfile.findUnique({where:{userId:user.id}});
    return row ? privateView(row) : null;
  });
}
export async function saveOwnFootProfile(actor: Principal | null, input: unknown) {
  const data = footProfileSchema.parse(input), {id} = requireActiveUser(actor);
  return getDb().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${id} FOR UPDATE`;
    const user = await lockedActiveUser(tx, actor);
    const previous = await tx.footProfile.findUnique({where:{userId:user.id}});
    if ((previous?.version ?? 0) !== data.version || (previous?.id ?? null) !== data.revision) throw new CommunityError(409,"Your foot profile changed. Reload before saving to avoid overwriting newer changes.");
    const fields = {
      leftLengthMm:data.leftLengthMm, rightLengthMm:data.rightLengthMm, leftWidthMm:data.leftWidthMm, rightWidthMm:data.rightWidthMm,
      measurementMethod:data.measurementMethod, footShape:data.footShape, instep:data.instep, arch:data.arch,
      toePreference:data.toePreference, heelPreference:data.heelPreference, snugness:data.snugness, fitSensation:data.fitSensation,
      primaryPosition:data.primaryPosition, secondaryPositions:data.secondaryPositions, surface:data.surface,
      budgetAmount:data.budgetAmount, currency:data.currency, preferredBrands:data.preferredBrands, preferredTiers:data.preferredTiers,
      sizeWorn:data.sizeWorn, sizeSystem:data.sizeSystem, allowFitFinder:data.allowFitFinder,
    };
    // Consent applies only to future private fit matching, never to public sharing or advertising.
    const values = {...fields, measuredOn:data.measuredOn ? new Date(data.measuredOn+"T00:00:00.000Z") : null,
      fitFinderConsentAt:data.allowFitFinder ? previous?.fitFinderConsentAt ?? new Date() : null};
    const row = previous
      ? await tx.footProfile.update({where:{userId:user.id},data:{...values,version:{increment:1}}})
      : await tx.footProfile.create({data:{...values,userId:user.id}});
    return privateView(row);
  });
}
export async function deleteOwnFootProfile(actor: Principal | null, input: unknown) {
  const {version,revision} = deleteFootProfileSchema.parse(input), {id} = requireActiveUser(actor);
  return getDb().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${id} FOR UPDATE`;
    const user = await lockedActiveUser(tx, actor);
    const existing = await tx.footProfile.findUnique({where:{userId:user.id},select:{version:true,id:true}});
    if (existing && (existing.version !== version || existing.id !== revision)) throw new CommunityError(409,"Your foot profile changed. Reload before deleting.");
    await tx.footProfile.deleteMany({where:{userId:user.id}});
    return {deleted:true};
  });
}
