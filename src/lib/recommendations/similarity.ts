import {measurementLimits} from '@/lib/foot-profile/validation';

export const similarityRules = {
 lengthBandMm:5, widthBandMm:5, minScore:50,
 weights:{length:0.4,width:0.4,shape:0.1,instep:0.05,sensation:0.05},
} as const;
export type MatchingProfile = {
 leftLengthMm:string|null;rightLengthMm:string|null;leftWidthMm:string|null;rightWidthMm:string|null;
 footShape:string|null;instep:string|null;fitSensation:string|null;
};
export type ReviewerMeasurements = {lengthMm:number|null;widthMm:number|null;footShape:string|null;instep:string|null;fitSensation:string|null};
function measurement(value:number|null,kind:'length'|'width') {
 const {min,max}=measurementLimits[kind];
 return value!==null&&Number.isFinite(value)&&value>=min&&value<=max?value:null;
}
export function cmToMm(value:number|null,kind:'length'|'width') {
 return value===null?null:measurement(Math.round(value*100)/10,kind);
}
function mm(value:string|null,kind:'length'|'width') {
 return value!==null&&/^\d+(?:\.\d{1,2})?$/.test(value)?measurement(Number(value),kind):null;
}
function trait(value:string|null) {
 const normalized=value?.toLowerCase();
 return !normalized||normalized==='unsure'?null:normalized==='average'?'regular':normalized;
}
export function reviewerSimilarity(profile:MatchingProfile,review:ReviewerMeasurements,config:{lengthBandMm:number;widthBandMm:number;minScore:number}=similarityRules) {
 const lengths=[mm(profile.leftLengthMm,'length'),mm(profile.rightLengthMm,'length')];
 const widths=[mm(profile.leftWidthMm,'width'),mm(profile.rightWidthMm,'width')];
 const length=measurement(review.lengthMm,'length'),width=measurement(review.widthMm,'width');
 if(lengths.includes(null)||widths.includes(null)||length===null||width===null) return {similar:false,score:null,completeness:0};
 if(!Number.isFinite(config.lengthBandMm)||!Number.isFinite(config.widthBandMm)||config.lengthBandMm<=0||config.widthBandMm<=0||!Number.isFinite(config.minScore)||config.minScore<0||config.minScore>100) throw Error('Invalid similarity configuration.');
 // Both parties report maximum length and maximum width across both feet; no shape is inferred.
 const dl=Math.abs(Math.max(...lengths as number[])-length),dw=Math.abs(Math.max(...widths as number[])-width);
 const w=similarityRules.weights;
 let total=w.length*Math.max(0,1-dl/config.lengthBandMm)+w.width*Math.max(0,1-dw/config.widthBandMm),known:number=w.length+w.width;
 for(const [a,b,weight] of [[profile.footShape,review.footShape,w.shape],[profile.instep,review.instep,w.instep],[profile.fitSensation,review.fitSensation,w.sensation]] as const) {
  const x=trait(a),y=trait(b);if(x&&y){known+=weight;total+=weight*Number(x===y);}
 }
 const score=Math.round(100*total/known);
 return {similar:dl<=config.lengthBandMm&&dw<=config.widthBandMm&&score>=config.minScore,score,completeness:Math.round(known*100)/100};
}
