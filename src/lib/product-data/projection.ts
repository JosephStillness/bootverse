import { productSpecifications } from "@/lib/boots/product";
import { claimSchema } from "./validation";
import type { ProductAttribute } from "@/lib/boots/types";

export type SourcedClaim = {
  entryId: string | null; variantId: string | null; attribute: string; value: unknown;
  status: string; basis: string; sourceId: string; sourceUrl: string; observedAt: Date; reviewedAt: Date | null;
  source: { name: string; type: string; status: string; authorizationStatus: string };
};
export function sourcedSpecifications(sample: boolean, legacy: unknown, entryId: string, variantId: string, claims: SourcedClaim[]) {
  const result = productSpecifications(sample, legacy);
  if (sample) return result;
  for (const key of ["upper", "weight", "releaseDate"] as const) if (result[key].status === "verified") result[key] = { ...result[key], legacy: true };
  const relevant = claims.filter(c => c.entryId === entryId || (c.entryId === null && c.variantId === variantId));
  for (const [attribute, key] of [["upperMaterial", "upper"], ["weight", "weight"], ["releaseDate", "releaseDate"]] as const) {
    const rows = relevant.filter(c => c.attribute === attribute);
    if (!rows.length && claims.length <= 32) continue;
    result[key] = { status: "unknown", reason: "No unambiguous, source-checked claim is available for this configuration." };
    if (claims.length > 32 || rows.some(c => c.status === "CONFLICTED")) continue;
    const checked = rows.filter(c => c.status === "VERIFIED" && c.reviewedAt && c.source.status === "ACTIVE" && c.source.authorizationStatus !== "DENIED");
    if (!checked.length || new Set(checked.map(c => JSON.stringify(c.value))).size !== 1) continue;
    const row = checked[0];
    const parsed = claimSchema.safeParse({ ...(row.entryId ? { entryId: row.entryId } : { variantId: row.variantId }), sourceId: row.sourceId, sourceUrl: row.sourceUrl, observedAt: row.observedAt.toISOString(), attribute: row.attribute, basis: row.basis, value: row.value });
    if (!parsed.success) continue;
    const value = parsed.data.attribute === "weight" ? `${parsed.data.value.amount} ${parsed.data.value.unit} · ${parsed.data.value.sizeSystem} ${parsed.data.value.size}${parsed.data.value.method ? ` · ${parsed.data.value.method}` : ""}` : String(parsed.data.value);
    const projected: ProductAttribute = { status: "verified", value, sourceUrl: row.sourceUrl, observedAt: row.observedAt.toISOString(), provenance: { sourceName: row.source.name, sourceType: row.source.type, basis: row.basis, reviewedAt: row.reviewedAt!.toISOString() } };
    result[key] = projected;
  }
  return result;
}
