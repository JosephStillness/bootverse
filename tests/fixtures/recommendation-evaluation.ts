// Synthetic self-reports and invented product evidence for isolated QA only, never seed the app DB.
import {normalizeProfile} from '../../src/lib/recommendations/normalize';
import type {Candidate,Evidence,Preferences,Surface} from '../../src/lib/recommendations/types';
export const evaluationTime='2026-10-16T00:00:00.000Z';
const provenance={sourceKind:'MANUFACTURER' as const,sourceUrl:'https://www.nike.com/synthetic-qa-only',observedAt:'2026-10-15T12:00:00.000Z',validUntil:'2026-10-17T00:00:00.000Z'};
export function evaluationCandidates(count=7):Candidate[] {
 return Array.from({length:count},(_,i)=>{
  const outsole:Surface=(['AG','FG','TF'] as const)[i%3],id=`synthetic-${String(i).padStart(3,'0')}`;
  const evidence:Evidence[]=[{...provenance,id:id+'-surface',kind:'SURFACE',payload:{outsole,allowed:[outsole],denied:[]}},
   {...provenance,id:id+'-price',kind:'PRICE',payload:{entryId:id+'-entry',amount:String(150+i),currency:'AUD',size:null,sizeSystem:null}}];
  return {variantId:id,generationId:`generation-${i%2}`,generation:`Synthetic generation ${i%2}`,familyId:'synthetic-family',family:'Synthetic QA',brandId:'nike',brand:'Nike',tierId:`tier-${i%2}`,tier:i%2?'Pro':'Elite',outsole,
   entry:{id:id+'-entry',slug:id,colorwayId:id+'-colorway',colorway:`Synthetic colorway ${i}`},sample:false,evidence};
 });
}
const base={version:0,unit:'mm',leftLengthMm:'280',rightLengthMm:'280',leftWidthMm:'110',rightWidthMm:'110',footShape:'Wide',surface:'AG',budgetAmount:'200',currency:'AUD'};
export const evaluationScenarios:{id:string;description:string;preferences:Preferences}[]=[
 ['A','Wide self-report, 280/110 mm, AG, AUD200',{}],
 ['B','Narrow self-report, 265/90 mm, FG, AUD150',{leftLengthMm:'265',rightLengthMm:'265',leftWidthMm:'90',rightWidthMm:'90',footShape:'Narrow',surface:'FG',budgetAmount:'150'}],
 ['C','Regular self-report, 275/100 mm, TF, AUD100',{leftLengthMm:'275',rightLengthMm:'275',leftWidthMm:'100',rightWidthMm:'100',footShape:'Regular',surface:'TF',budgetAmount:'100'}],
 ['D','Asymmetrical feet',{leftLengthMm:'275',rightLengthMm:'282',leftWidthMm:'108',rightWidthMm:'100'}],
 ['E','High instep with no catalogue fit evidence',{instep:'High',fitSensation:'Structured'}],
 ['F','Missing width',{leftWidthMm:null,rightWidthMm:null}],
 ['G','No preferred brand or tier',{preferredBrands:[],preferredTiers:[]}],
 ['H','Budget below all verified offers',{budgetAmount:'50'}],
 ['I','Different currency; no exchange rate',{currency:'USD'}],
 ['J','No community reviews',{}],
].map(([id,description,patch])=>({id:String(id),description:String(description),preferences:normalizeProfile({...base,...patch as object})}));
