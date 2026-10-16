import {z} from 'zod';
import {footProfileBaseSchema,footProfileSchema,measurementKeys} from '@/lib/foot-profile/validation';
import type {PrivateFootProfile} from '@/lib/foot-profile/service';
import {boots} from '@/lib/boots/data';
import {normalizeProfile} from './normalize';
import type {Result} from './types';

const finderFields={unit:true,leftLengthMm:true,rightLengthMm:true,leftWidthMm:true,rightWidthMm:true,footShape:true,instep:true,fitSensation:true,snugness:true,primaryPosition:true,surface:true,budgetAmount:true,currency:true,preferredBrands:true,preferredTiers:true,sizeWorn:true,sizeSystem:true} as const;
const finderBase=footProfileBaseSchema.pick(finderFields);
export const finderPreferencesSchema=finderBase.superRefine((values,ctx)=>{
 const parsed=footProfileSchema.safeParse({...values,version:0});
 if(!parsed.success)for(const issue of parsed.error.issues)ctx.addIssue({code:'custom',path:issue.path,message:issue.message});
 if(values.surface===null)ctx.addIssue({code:'custom',path:['surface'],message:'Choose the surface you plan to play on.'});
});
export type FinderValues=z.output<typeof finderBase>;
export function emptyFinder():FinderValues {return finderBase.parse({});}
export function finderFromProfile(profile:PrivateFootProfile):FinderValues {
 return finderBase.parse(Object.fromEntries(Object.keys(finderFields).map(key=>[key,profile[key as keyof PrivateFootProfile]])));
}
export function saveFinderPayload(values:FinderValues,existing:Partial<PrivateFootProfile>|null) {
 const normalized=normalizeProfile({...values,version:0});
 const changed=!!existing&&measurementKeys.some(key=>normalized[key]!==existing[key]);
 // Project only profile input fields; timestamps and identifiers never become client-controlled metadata.
 return footProfileBaseSchema.parse({
  ...Object.fromEntries(Object.keys(footProfileBaseSchema.shape).map(key=>[key,existing?.[key as keyof PrivateFootProfile]])),
  ...values,version:existing?.version??0,revision:existing?.revision??null,allowFitFinder:true,
  ...(changed?{measuredOn:null,measurementMethod:null}:{}),
 });
}
export const defaultRefinements={brand:'',tier:'',outsole:'',budget:'all',quality:'',reviews:'all'};
export type Refinements=typeof defaultRefinements;
export function filterResults(results:Result[],filters:Refinements) {
 return results.filter(r=>(!filters.brand||r.brandId===filters.brand)&&(!filters.tier||r.tier===filters.tier)&&(!filters.outsole||r.outsole===filters.outsole)
  &&(filters.budget==='all'||filters.budget==='within'&&r.budgetStatus==='within'||filters.budget==='near'&&(r.budgetStatus==='within'||r.budgetStatus==='near'))
  &&(!filters.quality||r.reviewAnalysis?.quality===filters.quality)
  &&(filters.reviews==='all'||r.reviewAnalysis?.counts.eligible!==null&&r.reviewAnalysis?.counts.eligible!==undefined&&r.reviewAnalysis.counts.eligible>=5));
}
export function catalogueReference(result:Result) {
 return boots.find(boot=>boot.id===result.entry.id&&boot.slug===result.entry.slug&&boot.variant.id===result.variantId&&boot.generation.id===result.generationId&&boot.colorwayId===result.entry.colorwayId&&boot.brand.id===result.brandId&&boot.tier.name===result.tier&&boot.variant.surface===result.outsole)??null;
}

export const finderStepKeys:readonly (readonly string[])[]=[
 ['unit','leftLengthMm','rightLengthMm','leftWidthMm','rightWidthMm','footShape','instep'],
 ['surface','primaryPosition','fitSensation','snugness','preferredBrands','preferredTiers','sizeWorn','sizeSystem'],
 ['budgetAmount','currency'],
];
export function finderStepErrors(values:FinderValues,step:number):Record<string,string[]> {
 const result=finderPreferencesSchema.safeParse(values);
 if(result.success)return {};
 return Object.fromEntries(Object.entries(result.error.flatten().fieldErrors).filter(([key])=>step===3||finderStepKeys[step]?.includes(key)));
}
