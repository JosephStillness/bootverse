import {rules,ascending} from "./config";
import {usableEvidence,provenance} from "./evidence";
import {commerce,surfaceEligibility} from "./eligibility";
import {score} from "./scoring";
import type {Candidate,Preferences,Result,EngineOutput} from "./types";
export function recommend(p:Preferences,candidates:Candidate[],asOf:string,limit=10):EngineOutput {
 const now=Date.parse(asOf);
 if(!Number.isFinite(now)||!Number.isInteger(limit)||limit<1||limit>rules.maxResults||candidates.length>rules.maxCandidates)throw Error("Invalid engine bounds or timestamp.");
 const unique=new Map<string,Candidate>();
 for(const c of candidates){if(c.evidence.length>rules.maxEvidencePerVariant)throw Error("Evidence bound exceeded.");const old=unique.get(c.variantId);if(old&&JSON.stringify(old)!==JSON.stringify(c))throw Error("Conflicting duplicate variant identity.");unique.set(c.variantId,c);}
 const eligible:Result[]=[],unverified:Result[]=[];let excluded=0;
 for(const c of unique.values()){
  const evidence=c.sample?[]:usableEvidence(c,now).filter(e=>(e.kind!=="PRICE"&&e.kind!=="AVAILABILITY")||e.payload.entryId===c.entry.id),surfaceStatus=surfaceEligibility(c,p,evidence),commercial=commerce(c,p,evidence);
  if(surfaceStatus==="incompatible"){excluded++;continue;}
  const ranking=score(c,p,evidence,commercial.budgetStatus);
  const unknowns=["Physical fit, interior dimensions and a validated size recommendation are unknown."];
  if(surfaceStatus==="unknown")unknowns.push("Exact-variant surface compatibility is unverified; this is not a recommendation.");
  if(!commercial.price)unknowns.push("No usable verified price for this colorway/size/currency scope.");
  if(commercial.availability==="unknown")unknowns.push("Availability unknown; a catalogue record is not an offer.");
  if(ranking.factors.some(f=>f.applicable&&f.match===null))unknowns.push("Some requested preference factors lack evidence.");
  const sources=[...new Map(evidence.map(e=>[e.id,provenance(e)])).values()];
  const reasons=[surfaceStatus==="compatible"?"Exact-variant manufacturer evidence supports the selected surface.":"Evidence is insufficient to establish surface eligibility.",...ranking.factors.filter(f=>f.applicable).map(f=>`${f.name}: ${f.match===null?"unknown":f.match===1?"match":f.match===0?"mismatch":"partial match"}. ${f.reason}`)];
  const result:Result={brandId:c.brandId,brand:c.brand,generation:c.generation,variantId:c.variantId,generationId:c.generationId,productName:`${c.brand} ${c.family} — ${c.generation}`,tier:c.tier,outsole:c.outsole,entry:c.entry,sample:c.sample,surfaceStatus,...commercial,...ranking,
   // Unverified products are never scored/ranked as recommendations, even for preferred brands.
   preferenceScore:surfaceStatus==="compatible"?ranking.preferenceScore:null,
   fitObservations:evidence.filter(e=>e.kind==="FIT").map(e=>({observation:e.kind==="FIT"?e.payload.observation:"",sourceKind:e.sourceKind,sourceUrl:e.sourceUrl})),
   physicalFit:"unknown",evidenceConfidence:sources.length===0?"none":surfaceStatus==="compatible"&&ranking.evidenceCoverage===100?"documented":"limited",
   reasons,unknowns,cautions:["Experimental preference ranking, not a scientifically validated fitting system or fit probability.","Check the exact boot and pitch requirements before play.",...(c.sample?["Fictional sample configuration; not verified manufacturer product data."]:[]),...(commercial.budgetStatus==="over"?["Current scoped price exceeds the supplied budget."]:[]),...(commercial.availability==="unavailable"?["Current scoped inventory reports unavailable."]:[]),"Position and self-reported foot shape/width do not award points; no statistical review fit learning is performed."],sources};
  (surfaceStatus==="compatible"?eligible:unverified).push(result);
 }
 eligible.sort((a,b)=>(b.preferenceScore??-1)-(a.preferenceScore??-1)||b.evidenceCoverage-a.evidenceCoverage||ascending(a.variantId,b.variantId));
 unverified.sort((a,b)=>ascending(a.variantId,b.variantId));
 return {ruleVersion:rules.version,asOf:new Date(now).toISOString(),eligible:eligible.slice(0,limit),unverified:unverified.slice(0,limit),counts:{evaluated:unique.size,eligible:eligible.length,unverified:unverified.length,excluded},truncated:eligible.length>limit||unverified.length>limit,
  notices:["Surface eligibility is a separate gate and contributes no ranking points.","Unknown factors are excluded from the score denominator; coverage is reported separately. A high score with low coverage is not strong fit evidence.",...(eligible.length===0?["No evidence-supported recommendations are currently available."]:[])]};
}
