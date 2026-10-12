import type { BootData, CatalogueBoot, UnknownAttribute } from "./types";
import { validateBootData } from "./validation";

const unknown: UnknownAttribute = {
  status: "unknown",
  reason: "Not verified for this sample entry.",
};
const specifications = {
  weight: unknown,
  upper: unknown,
  releaseDate: unknown,
  price: unknown,
  fit: unknown,
  rating: unknown,
  endorsements: unknown,
};

// These configurations are fictional fixtures, not manufacturer specifications.
export const bootData: BootData = {
  brands: [
    { id: "nike", name: "Nike" },
    { id: "adidas", name: "adidas" },
    { id: "puma", name: "PUMA" },
    { id: "mizuno", name: "Mizuno" },
  ],
  families: [
    { id: "mercurial", brandId: "nike", name: "Mercurial" },
    { id: "predator", brandId: "adidas", name: "Predator" },
    { id: "f50", brandId: "adidas", name: "F50" },
    { id: "future", brandId: "puma", name: "Future" },
    { id: "morelia", brandId: "mizuno", name: "Morelia" },
  ],
  generations: [
    { id: "mercurial-a", familyId: "mercurial", name: "Demo generation A" },
    { id: "mercurial-b", familyId: "mercurial", name: "Demo generation B" },
    { id: "predator-a", familyId: "predator", name: "Demo generation A" },
    { id: "f50-a", familyId: "f50", name: "Demo generation A" },
    { id: "future-a", familyId: "future", name: "Demo generation A" },
    { id: "morelia-a", familyId: "morelia", name: "Demo generation A" },
  ],
  tiers: [
    { id: "mercurial-a-elite", generationId: "mercurial-a", name: "Elite" },
    { id: "mercurial-b-pro", generationId: "mercurial-b", name: "Pro" },
    { id: "predator-a-academy", generationId: "predator-a", name: "Academy" },
    { id: "f50-a-elite", generationId: "f50-a", name: "Elite" },
    { id: "future-a-pro", generationId: "future-a", name: "Pro" },
    { id: "morelia-a-elite", generationId: "morelia-a", name: "Elite" },
  ],
  variants: [
    {
      id: "mercurial-elite-fg",
      tierModelId: "mercurial-a-elite",
      surface: "FG",
    },
    {
      id: "mercurial-elite-ag",
      tierModelId: "mercurial-a-elite",
      surface: "AG",
    },
    { id: "mercurial-pro-tf", tierModelId: "mercurial-b-pro", surface: "TF" },
    {
      id: "predator-academy-fg",
      tierModelId: "predator-a-academy",
      surface: "FG",
    },
    { id: "f50-elite-unknown", tierModelId: "f50-a-elite", surface: null },
    { id: "future-pro-ag", tierModelId: "future-a-pro", surface: "AG" },
    { id: "morelia-elite-sg", tierModelId: "morelia-a-elite", surface: "SG" },
  ],
  colorways: [
    {
      id: "volt",
      generationId: "mercurial-a",
      name: "Volt / Black",
      swatch: "#bbef49",
    },
    {
      id: "onyx",
      generationId: "mercurial-a",
      name: "Onyx / Silver",
      swatch: "#a7afaa",
    },
    {
      id: "ice",
      generationId: "mercurial-a",
      name: "Ice / White",
      swatch: "#c6dfdf",
    },
    {
      id: "blue",
      generationId: "mercurial-b",
      name: "Blue / White",
      swatch: "#8cc7ea",
    },
    {
      id: "red",
      generationId: "predator-a",
      name: "Red / Black",
      swatch: "#ed9284",
    },
    {
      id: "cloud",
      generationId: "f50-a",
      name: "Cloud / Silver",
      swatch: "#e3e6d6",
    },
    {
      id: "peach",
      generationId: "future-a",
      name: "Peach / Black",
      swatch: "#edb794",
    },
    {
      id: "white",
      generationId: "morelia-a",
      name: "White / Black",
      swatch: "#e8e9e3",
    },
  ],
  entries: [
    ["sample-mercurial-volt-fg", "mercurial-elite-fg", "volt"],
    ["sample-mercurial-onyx-fg", "mercurial-elite-fg", "onyx"],
    ["sample-mercurial-ice-ag", "mercurial-elite-ag", "ice"],
    ["sample-mercurial-blue-tf", "mercurial-pro-tf", "blue"],
    ["sample-predator-red-fg", "predator-academy-fg", "red"],
    ["sample-f50-cloud", "f50-elite-unknown", "cloud"],
    ["sample-future-peach-ag", "future-pro-ag", "peach"],
    ["sample-morelia-white-sg", "morelia-elite-sg", "white"],
  ].map(([id, outsoleVariantId, colorwayId]) => ({
    id,
    slug: id,
    outsoleVariantId,
    colorwayId,
    sample: true,
    specifications,
  })),
};

const errors = validateBootData(bootData);
if (errors.length)
  throw new Error(`Invalid boot fixtures: ${errors.join("; ")}`);

export const boots: CatalogueBoot[] = bootData.entries.map((entry) => {
  const variant = bootData.variants.find(
    (v) => v.id === entry.outsoleVariantId,
  )!;
  const tier = bootData.tiers.find((t) => t.id === variant.tierModelId)!;
  const generation = bootData.generations.find(
    (g) => g.id === tier.generationId,
  )!;
  const family = bootData.families.find((f) => f.id === generation.familyId)!;
  const brand = bootData.brands.find((b) => b.id === family.brandId)!;
  const colorway = bootData.colorways.find((c) => c.id === entry.colorwayId)!;
  return { ...entry, variant, tier, generation, family, brand, colorway };
});
export const surfaceLabels = {
  FG: "Firm ground",
  AG: "Artificial grass",
  SG: "Soft ground",
  TF: "Turf",
};
export const sampleDisclaimer =
  "All 8 entries are sample configurations. Names, tiers, surfaces, and colorways are illustrative and unverified. Artwork does not depict the listed products.";
