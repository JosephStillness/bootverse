import {rules} from "./config";
import type {Candidate,Evidence,Preferences,Factor,FactorName} from "./types";
export function score(c:Candidate,p:Preferences,evidence:Evidence[],budgetStatus:string) {
 function fitFactor(attribute:"fitSensation"|"snugness",name:FactorName):Factor {
  const wanted=p[attribute];
  const claims=evidence.filter(e=>e.kind==="FIT"&&e.payload.attribute===attribute&&(e.sourceKind==="MANUFACTURER"||(e.sourceKind==="EDITORIAL"&&!!e.payload.methodology?.trim())));
  const values=new Set(claims.map(e=>e.kind==="FIT"?e.payload.value:""));
  return {name,weight:rules.weights[name],applicable:!!wanted,match:!wanted||values.size!==1?null:Number(values.has(wanted)),
   reason:!wanted?"Preference not supplied.":values.size!==1?"No unambiguous cited product preference evidence.":"Compared with a cited product description; this does not establish physical fit."};
 }
 const requested=[p.preferredBrands.length?Number(p.preferredBrands.includes(c.brandId)):null,p.preferredTiers.length?Number(p.preferredTiers.includes(c.tier)):null].filter((n):n is number=>n!==null);
 const factors:Factor[]=[
  {name:"budget",weight:rules.weights.budget,applicable:p.budgetAmount!==null,match:budgetStatus==="within"?1:budgetStatus==="near"?.5:budgetStatus==="over"?0:null,reason:budgetStatus==="unknown"?"No current, same-currency price for this colorway and size scope.":`Budget status: ${budgetStatus}.`},
  fitFactor("fitSensation","fit"),
  {name:"brandTier",weight:rules.weights.brandTier,applicable:requested.length>0,match:requested.length?requested.reduce((a,b)=>a+b,0)/requested.length:null,reason:"Only explicitly requested brand/tier identities are compared; no brand reputation or price premium is inferred."},
  fitFactor("snugness","other"),
 ];
 const applicable=factors.filter(f=>f.applicable),known=applicable.filter(f=>f.match!==null);
 const total=applicable.reduce((n,f)=>n+f.weight,0),covered=known.reduce((n,f)=>n+f.weight,0);
 const preferenceScore=covered?Math.round(known.reduce((n,f)=>n+f.weight*f.match!,0)/covered*10000)/100:null;
 const evidenceCoverage=total?Math.round(covered/total*1000000)/10000:0;
 return {factors,preferenceScore,evidenceCoverage};
}
