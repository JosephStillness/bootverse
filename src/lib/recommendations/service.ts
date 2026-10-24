import "server-only";
import {z} from "zod";
import {getDb} from "@/lib/db";
import {requireActiveUser,AccessError,type Principal} from "@/lib/accounts/authorization";
import {lockedActiveUser} from "@/lib/accounts/authorization-db";
import {getOwnFootProfile} from "@/lib/foot-profile/service";
import {CommunityError} from "@/lib/community/service";
import {normalizeProfile} from "./normalize";
import {parseEvidence} from "./evidence";
import {recommend} from "./engine";
import {attachReviewAnalysis} from "./review-query";
import {rules} from "./config";
import {finderFromProfile} from "./finder";
import type {Candidate,Evidence,Preferences} from "./types";
import {recommendationRequest} from "./request";
export {recommendationRequest} from "./request";
const surface=z.enum(["FG","AG","TF","SG","IN"]);
export async function recommendForUser(actor:Principal|null,input:unknown) {
 const {limit,preferences:provided}=recommendationRequest.parse(input);
 requireActiveUser(actor);
 const profile=provided?null:await getOwnFootProfile(actor);
 let preferences:Preferences;
 if(provided)preferences=normalizeProfile({...provided,version:0});
 else {
  if(!profile)throw new CommunityError(409,"Save a private foot profile before using the recommendation preview. Optional fields may remain empty.");
  if(!profile.allowFitFinder||!profile.fitFinderConsentAt)throw new AccessError(403,"Enable private Boot Fit Finder use in your foot profile before running this preview.");
  preferences=normalizeProfile({...finderFromProfile(profile),version:0});
 }
 return getDb().$transaction(async tx=>{
  const user=await lockedActiveUser(tx,actor);
  // Saved mode rechecks consent and concurrency; transient inputs are explicitly consented and never persisted.
  if(profile){
   const current=await tx.footProfile.findUnique({where:{userId:user.id},select:{id:true,version:true,allowFitFinder:true,fitFinderConsentAt:true}});
   if(!current?.allowFitFinder||!current.fitFinderConsentAt)throw new AccessError(403,"Private Fit Finder consent is required.");
   if(current.id!==profile.revision||current.version!==profile.version)throw new CommunityError(409,"Your foot profile changed. Please retry with its current settings.");
  }
  const asOf=new Date();
  const rows=await tx.bootVariant.findMany({where:{entries:{some:{published:true}}},orderBy:{id:"asc"},take:rules.maxCandidates+1,
   select:{id:true,generationId:true,surface:true,tier:{select:{id:true,name:true,generation:{select:{id:true,name:true,family:{select:{id:true,name:true,brand:{select:{id:true,name:true}}}}}}}},
    entries:{where:{published:true},orderBy:[{sample:"asc"},{id:"asc"}],take:1,select:{id:true,slug:true,sample:true,colorwayId:true,colorway:{select:{name:true}}}},
    recommendationEvidence:{where:{approved:true,observedAt:{lte:asOf},validUntil:{gt:asOf},OR:[{sourceId:null},{source:{status:'ACTIVE',authorizationStatus:{not:'DENIED'}}}]},orderBy:[{observedAt:"desc"},{id:"asc"}],take:rules.maxEvidencePerVariant+1,select:{id:true,kind:true,sourceKind:true,sourceUrl:true,observedAt:true,validUntil:true,payload:true,countryCode:true}}}});
  let clippedEvidence=false,invalidEvidence=0;
  const candidates:Candidate[]=rows.slice(0,rules.maxCandidates).map(row=>{
   const entry=row.entries[0],family=row.tier.generation.family;
   const evidence:Evidence[]=[];
   let malformed=false;
   if(row.recommendationEvidence.length>rules.maxEvidencePerVariant)clippedEvidence=true;
   else for(const e of row.recommendationEvidence){const parsed=parseEvidence({...e,observedAt:e.observedAt.toISOString(),validUntil:e.validUntil.toISOString()});if(parsed)evidence.push(parsed);else {invalidEvidence++;malformed=true;}}
   if(malformed)evidence.length=0;
   return {variantId:row.id,generationId:row.generationId,generation:row.tier.generation.name,familyId:family.id,family:family.name,brandId:family.brand.id,brand:family.brand.name,tierId:row.tier.id,tier:row.tier.name,
    outsole:surface.safeParse(row.surface).success?row.surface as Candidate["outsole"]:null,
    entry:{id:entry.id,slug:entry.slug,colorwayId:entry.colorwayId,colorway:entry.colorway.name},sample:entry.sample,evidence};
  });
  const result=recommend(preferences,candidates,asOf.toISOString(),limit);
  const analysis=await attachReviewAnalysis(tx,[...result.eligible,...result.unverified],preferences,user.id);
  const enriched=analysis.map(r=>({...r,catalogue:{entryId:r.entry.id,slug:r.entry.slug,variantId:r.variantId,generationId:r.generationId,colorwayId:r.entry.colorwayId,brandId:r.brandId,tier:r.tier,outsole:r.outsole}}));
  return {...result,eligible:enriched.slice(0,result.eligible.length),unverified:enriched.slice(result.eligible.length),truncated:result.truncated||rows.length>rules.maxCandidates||clippedEvidence,
   notices:[...result.notices,...(rows.length>rules.maxCandidates?[`Candidate scan limited to ${rules.maxCandidates} variants in stable ID order; results are not exhaustive.`]:[]),...(clippedEvidence?["Evidence limit reached for at least one variant; it was left unverified rather than partially assessing potentially conflicting sources."]:[]),...(invalidEvidence?["Malformed product evidence left its variant unverified. Product data needs operator review."]:[])]};
 },{isolationLevel:"RepeatableRead"});
}
