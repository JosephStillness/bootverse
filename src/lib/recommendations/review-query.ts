import 'server-only';
import type {Prisma} from '@/generated/prisma/client';
import {analyzeReviews,analysisRules,type AnalysisReview} from './review-analysis';
import type {Preferences,Result} from './types';

export async function attachReviewAnalysis(tx:Prisma.TransactionClient,results:Result[],profile:Preferences,viewerId:string) {
 const variantIds=results.filter(r=>!r.sample).map(r=>r.variantId);
 const rows=variantIds.length?await tx.bootReview.findMany({
  where:{variantId:{in:variantIds},authorId:{not:viewerId},status:'PUBLISHED',shareFootInfo:true,analysisConsent:true,analysisConsentAt:{not:null},sponsorship:null,
   author:{status:'ACTIVE',emailVerified:{not:null},profile:{isNot:null}}},
  orderBy:[{variantId:'asc'},{id:'asc'}],take:analysisRules.maxReviews+1,
  select:{id:true,authorId:true,variantId:true,status:true,shareFootInfo:true,analysisConsent:true,analysisConsentAt:true,
   footLengthCm:true,footWidthCm:true,footShape:true,reviewInstep:true,reviewFitSensation:true,sizeWorn:true,sizeSystem:true,
   fit:true,comfort:true,widthObservation:true,toeRoomCategory:true,heelLockdownCategory:true,breakInCategory:true,sponsorship:true,
   author:{select:{status:true,emailVerified:true,profile:{select:{id:true}}}}},
 }):[];
 const overflow=rows.length>analysisRules.maxReviews;
 const grouped=new Map<string,AnalysisReview[]>();
 if(!overflow)for(const row of rows){
  const converted:AnalysisReview={...row,footLengthCm:row.footLengthCm===null?null:Number(row.footLengthCm),footWidthCm:row.footWidthCm===null?null:Number(row.footWidthCm)};
  const group=grouped.get(row.variantId)??[];group.push(converted);grouped.set(row.variantId,group);
 }
 return results.map(result=>({...result,reviewAnalysis:analyzeReviews(result.variantId,profile,grouped.get(result.variantId)??[],
  result.sample?'Sample catalogue configurations are excluded from genuine product fit analysis.':overflow?'Review scan limit reached; all cohort summaries are withheld rather than using a biased partial sample.':undefined)}));
}
