import type { BootData } from "./types";
import { surfaces } from "./types";

/** Validate fixture identities before joining records or rendering pages. */
export function validateBootData(data: BootData): string[] {
  const errors: string[] = [];
  for (const [name, records] of Object.entries(data)) {
    const ids = new Set<string>();
    for (const record of records) {
      if (!record.id.trim() || ids.has(record.id))
        errors.push(`${name}: missing or duplicate id ${record.id}`);
      ids.add(record.id);
    }
  }
  const has = (records: { id: string }[], id: string) =>
    records.some((record) => record.id === id);
  for (const family of data.families)
    if (!has(data.brands, family.brandId))
      errors.push(`Unknown brand: ${family.id}`);
  for (const generation of data.generations)
    if (!has(data.families, generation.familyId))
      errors.push(`Unknown family: ${generation.id}`);
  for (const tier of data.tiers)
    if (!has(data.generations, tier.generationId))
      errors.push(`Unknown generation: ${tier.id}`);
  for (const variant of data.variants) {
    if (!has(data.tiers, variant.tierModelId))
      errors.push(`Unknown tier: ${variant.id}`);
    if (variant.surface !== null && !surfaces.includes(variant.surface))
      errors.push(`Invalid surface: ${variant.id}`);
  }
  for (const colorway of data.colorways) {
    if (!has(data.generations, colorway.generationId))
      errors.push(`Unknown colorway generation: ${colorway.id}`);
    if (colorway.swatch !== null && !/^#[0-9a-f]{6}$/i.test(colorway.swatch))
      errors.push(`Invalid swatch: ${colorway.id}`);
  }
  const slugs = new Set<string>();
  const combinations = new Set<string>();
  for (const entry of data.entries) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) || slugs.has(entry.slug))
      errors.push(`Invalid or duplicate slug: ${entry.slug}`);
    slugs.add(entry.slug);
    if (entry.sample !== true)
      errors.push(`Entry must be labeled sample: ${entry.id}`);
    const variant = data.variants.find((v) => v.id === entry.outsoleVariantId);
    const colorway = data.colorways.find((c) => c.id === entry.colorwayId);
    const tier = data.tiers.find((t) => t.id === variant?.tierModelId);
    if (!variant) errors.push(`Unknown variant: ${entry.id}`);
    if (!colorway) errors.push(`Unknown colorway: ${entry.id}`);
    if (tier && colorway && tier.generationId !== colorway.generationId)
      errors.push(`Colorway generation mismatch: ${entry.id}`);
    const combination = `${entry.outsoleVariantId}:${entry.colorwayId}`;
    if (combinations.has(combination))
      errors.push(`Duplicate variant/colorway: ${entry.id}`);
    combinations.add(combination);
    for (const attribute of [
      "weight",
      "upper",
      "releaseDate",
      "price",
      "fit",
      "rating",
      "endorsements",
    ] as const) {
      const value = entry.specifications[attribute];
      if (!value || value.status !== "unknown" || !value.reason?.trim())
        errors.push(`Unverified sample attribute: ${entry.id}.${attribute}`);
    }
  }
  return errors;
}
