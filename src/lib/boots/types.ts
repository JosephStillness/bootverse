export const surfaces = ["FG", "AG", "SG", "TF"] as const;
export type Surface = (typeof surfaces)[number];
export type UnknownAttribute = { status: "unknown"; reason: string };
export interface Brand {
  id: string;
  name: string;
}
export interface BootFamily {
  id: string;
  brandId: string;
  name: string;
}
export interface ModelGeneration {
  id: string;
  familyId: string;
  name: string;
}
export interface TierModel {
  id: string;
  generationId: string;
  name: string;
}
export interface OutsoleVariant {
  id: string;
  tierModelId: string;
  surface: Surface | null;
}
export interface Colorway {
  id: string;
  generationId: string;
  name: string;
  swatch: string;
}
export interface BootEntry {
  id: string;
  slug: string;
  outsoleVariantId: string;
  colorwayId: string;
  sample: true;
  specifications: {
    weight: UnknownAttribute;
    upper: UnknownAttribute;
    releaseDate: UnknownAttribute;
    price: UnknownAttribute;
    fit: UnknownAttribute;
    rating: UnknownAttribute;
    endorsements: UnknownAttribute;
  };
}
export interface BootData {
  brands: Brand[];
  families: BootFamily[];
  generations: ModelGeneration[];
  tiers: TierModel[];
  variants: OutsoleVariant[];
  colorways: Colorway[];
  entries: BootEntry[];
}
export interface CatalogueBoot extends BootEntry {
  brand: Brand;
  family: BootFamily;
  generation: ModelGeneration;
  tier: TierModel;
  variant: OutsoleVariant;
  colorway: Colorway;
}
