export const surfaces = ["FG", "AG", "SG", "TF", "IN", "MG", "OTHER"] as const;
export type Surface = (typeof surfaces)[number];
export type UnknownAttribute = { status: "unknown"; reason: string };
export type ProductAttribute = UnknownAttribute | {status:"verified";value:string;sourceUrl:string;observedAt:string;legacy?:true;provenance?:{sourceName:string;sourceType:string;basis:string;reviewedAt:string}};
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
  sample: boolean;
  specifications: {
    weight: ProductAttribute;
    upper: ProductAttribute;
    releaseDate: ProductAttribute;
    price: ProductAttribute;
    fit: ProductAttribute;
    rating: ProductAttribute;
    endorsements: ProductAttribute;
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
  offers?:{amount:string;currency:string;size:string|null;sizeSystem:string|null;sourceUrl:string;observedAt:string;countryCode?:string|null}[];
  brand: Brand;
  family: BootFamily;
  generation: ModelGeneration;
  tier: TierModel;
  variant: OutsoleVariant;
  colorway: Colorway;
}
