import {cmToMm,reviewerSimilarity,type MatchingProfile} from './similarity';
import {widthObservations} from '@/lib/reviews/validation';
import {ascending} from './config';
export const analysisRules={version:'3.3.0',minimumGroup:5,maxReviews:2000,moderateSample:10,strongerSample:30} as const;
export interface AnalysisReview {
 id:string;authorId:string;variantId:string;status:string;
 author:{status:string;emailVerified:Date|null;profile:unknown|null};
 shareFootInfo:boolean;analysisConsent:boolean;analysisConsentAt:Date|null;
 sizeWorn:string;sizeSystem:string;footLengthCm:number|null;footWidthCm:number|null;footShape:string|null;
 reviewInstep:string|null;reviewFitSensation:string|null;fit:number;comfort:number;widthObservation:string|null;
 toeRoomCategory:string|null;heelLockdownCategory:string|null;breakInCategory:string|null;sponsorship:string|null;
}
type Profile=MatchingProfile&{sizeWorn:string|null;sizeSystem:string|null};
export type EvidenceQuality='Insufficient Evidence'|'Limited Evidence'|'Moderate Evidence'|'Stronger Evidence';
function rounded(n:number){return Math.round(n*10)/10;}
function count(n:number){return n===0||n>=analysisRules.minimumGroup?n:null;}
function distribution(values:(string|number|null)[]) {
 const cells:Record<string,number>={};
 for(const value of values) {const key=value===null?'not-reported':String(value);cells[key]=(cells[key]??0)+1;}
 // Withhold the entire table: publishing the other cells would reveal a suppressed remainder.
 if(Object.values(cells).some(n=>n<analysisRules.minimumGroup))return null;
 return Object.fromEntries(Object.entries(cells).sort(([a],[b])=>ascending(a,b)));
}
function summary(rows:AnalysisReview[]) {
 if(rows.length<analysisRules.minimumGroup)return null;
 return {count:rows.length,fitMean:rounded(rows.reduce((n,r)=>n+r.fit,0)/rows.length),comfortMean:rounded(rows.reduce((n,r)=>n+r.comfort,0)/rows.length),
  fitDistribution:distribution(rows.map(r=>r.fit)),widthDistribution:distribution(rows.map(r=>r.widthObservation)),
  toeRoom:distribution(rows.map(r=>r.toeRoomCategory)),heelLockdown:distribution(rows.map(r=>r.heelLockdownCategory)),breakIn:distribution(rows.map(r=>r.breakInCategory))};
}
export function eligibleReview(row:AnalysisReview,variantId:string) {
 return row.variantId===variantId&&row.status==='PUBLISHED'&&row.author.status==='ACTIVE'&&row.author.emailVerified!==null&&row.author.profile!==null
  &&row.shareFootInfo&&row.analysisConsent&&row.analysisConsentAt!==null
  // Disclosed paid/sponsored reviews remain public, but are excluded from this independent evidence pool.
  &&!row.sponsorship&&Number.isInteger(row.fit)&&row.fit>=1&&row.fit<=5&&Number.isInteger(row.comfort)&&row.comfort>=1&&row.comfort<=5
  &&(row.widthObservation===null||widthObservations.includes(row.widthObservation as typeof widthObservations[number]));
}
function sameSize(p:Profile,r:AnalysisReview) {
 return p.sizeWorn!==null&&p.sizeSystem!==null&&p.sizeSystem===r.sizeSystem&&/^\d+(?:\.\d+)?$/.test(p.sizeWorn)&&/^\d+(?:\.\d+)?$/.test(r.sizeWorn)&&Number(p.sizeWorn)>0&&Number(p.sizeWorn)===Number(r.sizeWorn);
}
export function analyzeReviews(variantId:string,profile:Profile,input:AnalysisReview[],unavailable?:string) {
 if(input.length>analysisRules.maxReviews)unavailable='Review scan limit reached; cohort analysis is withheld.';
 const warnings=[
  'Self-reported community experience; reviewer similarity is not a probability of shoe fit. No fit is guaranteed.',
  'Experimental ±5 mm search bands; larger length and width across both feet, with no automatic size conversion.',
  'Reviews without valid paired dimensions remain eligible for overall ratings, but cannot enter the similar cohort.',
  'Groups and distribution cells under five are withheld; no reviewer identities or raw measurements are returned.',
 ];
 const seenAuthors=new Set<string>(),seenReviews=new Set<string>();
 const rows=(unavailable?[]:input).filter(r=>eligibleReview(r,variantId)).sort((a,b)=>ascending(a.id,b.id)).filter(r=>{
  if(seenAuthors.has(r.authorId)||seenReviews.has(r.id))return false;seenAuthors.add(r.authorId);seenReviews.add(r.id);return true;
 });
 const matches=rows.map(row=>({row,match:reviewerSimilarity(profile,{lengthMm:cmToMm(row.footLengthCm,'length'),widthMm:cmToMm(row.footWidthCm,'width'),footShape:row.footShape,instep:row.reviewInstep,fitSensation:row.reviewFitSensation})})).filter(x=>sameSize(profile,x.row)&&x.match.similar);
 const remainder=rows.length-matches.length;
 // Prevent subtracting a similar cohort from overall totals to expose a small complementary cohort.
 const releaseSimilar=count(matches.length)!==null&&(remainder===0||remainder>=analysisRules.minimumGroup);
 const overall=unavailable?null:summary(rows),similar=releaseSimilar?summary(matches.map(x=>x.row)):null;
 const similarity=similar?{meanScore:Math.round(matches.reduce((n,x)=>n+x.match.score!,0)/matches.length/10)*10,completeness:rounded(matches.reduce((n,x)=>n+x.match.completeness,0)/matches.length)}:null;
 const conflicts:string[]=[];
 if(similar?.fitDistribution){const ratings=Object.keys(similar.fitDistribution).map(Number);if(Math.max(...ratings)-Math.min(...ratings)>=2)conflicts.push('Similar reviewers report materially different fit satisfaction.');}
 if(similar?.widthDistribution&&['too-narrow','slightly-narrow'].some(k=>similar.widthDistribution![k])&&['slightly-wide','too-wide'].some(k=>similar.widthDistribution![k]))conflicts.push('Similar reviewers report both narrow and wide experiences.');
 let quality:EvidenceQuality='Insufficient Evidence';
 if(similar) {
  quality='Limited Evidence';
  if(matches.length>=analysisRules.moderateSample&&similar.fitDistribution&&similar.widthDistribution&&!similar.widthDistribution['not-reported']&&conflicts.length===0&&similarity!.completeness>=0.8)quality='Moderate Evidence';
  if(quality==='Moderate Evidence'&&matches.length>=analysisRules.strongerSample&&similarity!.completeness>=0.9)quality='Stronger Evidence';
 }
 if(!profile.sizeWorn||!profile.sizeSystem)warnings.push('Save a worn size and its system to compare same-size reviewers. Overall summaries may include different sizes.');
 if(!similar)warnings.push('No publishable comparable cohort. Review counts may be zero, too small, or withheld to protect a small complementary group.');
 if(similar&&Object.values({fit:similar.fitDistribution,width:similar.widthDistribution,toe:similar.toeRoom,heel:similar.heelLockdown,breakIn:similar.breakIn}).some(x=>x===null))warnings.push('Some breakdowns are withheld because they contain small cells. Missing observations are never inferred from prose.');
 if(unavailable)warnings.push(unavailable);
 return {policyVersion:analysisRules.version,variantId,scope:profile.sizeWorn&&profile.sizeSystem?{sizeWorn:profile.sizeWorn,sizeSystem:profile.sizeSystem}:null,
  counts:{eligible:unavailable?null:count(rows.length),similar:unavailable?null:releaseSimilar?count(matches.length):null},overall,similar,similarity,quality,conflicts,warnings,
  explanation:similar?`${similar.count} independent, opted-in same-size reviewers have comparable reported dimensions. Mean fit satisfaction ${similar.fitMean}/5 and comfort ${similar.comfortMean}/5. Experiences are observational and may differ from yours.`:'No publishable comparable reviews are available for this exact variant. Physical fit remains unverified.'};
}
export type ReviewAnalysis=ReturnType<typeof analyzeReviews>;
