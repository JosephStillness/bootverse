import type {ReviewAnalysis} from "./review-analysis";
export type Surface = "FG" | "AG" | "TF" | "SG" | "IN";
export type SourceKind = "MANUFACTURER" | "RETAILER" | "MEASUREMENT" | "EDITORIAL" | "COMMUNITY";
export type Provenance = {id:string;sourceKind:SourceKind;sourceUrl:string;observedAt:string;validUntil:string;countryCode?:string|null};
export type Evidence = Provenance & (
  | {kind:"SURFACE";payload:{outsole:Surface;allowed:Surface[];denied:Surface[]}}
  | {kind:"PRICE";payload:{entryId:string;amount:string;currency:string;sizeSystem:string|null;size:string|null}}
  | {kind:"AVAILABILITY";payload:{entryId:string;available:boolean;sizeSystem:string;size:string}}
  | {kind:"FIT";payload:{attribute:"fitSensation"|"snugness";value:string;observation:string;methodology:string|null}}
);
export interface Candidate {
  variantId:string;generationId:string;generation:string;familyId:string;family:string;
  brandId:string;brand:string;tierId:string;tier:string;outsole:Surface|null;
  entry:{id:string;slug:string;colorwayId:string;colorway:string};sample:boolean;evidence:Evidence[];
}
export interface Preferences {
  leftLengthMm:string|null;rightLengthMm:string|null;leftWidthMm:string|null;rightWidthMm:string|null;
  footShape:string|null;instep:string|null;fitSensation:string|null;snugness:string|null;surface:Surface|null;
  budgetAmount:string|null;currency:string|null;preferredBrands:string[];preferredTiers:string[];
  primaryPosition:string|null;sizeWorn:string|null;sizeSystem:string|null;
}
export type FactorName="budget"|"fit"|"brandTier"|"other";
export type Factor={name:FactorName;weight:number;applicable:boolean;match:number|null;reason:string};
export interface Result {
  catalogue?:{entryId:string;slug:string;variantId:string;generationId:string;colorwayId:string;brandId:string;tier:string;outsole:Surface|null};
  brandId:string;brand:string;generation:string;
  variantId:string;generationId:string;productName:string;tier:string;outsole:Surface|null;
  entry:Candidate["entry"];sample:boolean;surfaceStatus:"compatible"|"incompatible"|"unknown";
  budgetStatus:"within"|"near"|"over"|"unknown"|"not-requested";
  availability:"available"|"unavailable"|"unknown";price:{amount:string;currency:string;observedAt:string;entryId:string}|null;
  preferenceScore:number|null;evidenceCoverage:number;factors:Factor[];
  fitObservations:{observation:string;sourceKind:SourceKind;sourceUrl:string}[];
  reviewAnalysis?:ReviewAnalysis;
  physicalFit:"unknown";evidenceConfidence:"none"|"limited"|"documented";
  reasons:string[];unknowns:string[];cautions:string[];sources:Provenance[];
}
export interface EngineOutput {
  ruleVersion:string;asOf:string;eligible:Result[];unverified:Result[];
  counts:{evaluated:number;eligible:number;unverified:number;excluded:number};truncated:boolean;notices:string[];
}
