import {prohibitedPairs,rules} from "./config";
import {manufacturerSource,scopeMatches} from "./evidence";
import type {Candidate,Evidence,Preferences,Result} from "./types";
export function surfaceEligibility(c:Candidate,p:Preferences,evidence:Evidence[]):Result["surfaceStatus"] {
 if(c.sample||!c.outsole||!p.surface)return "unknown";
 if(prohibitedPairs.has(`${c.outsole}:${p.surface}`))return "incompatible";
 const records=evidence.filter(e=>e.kind==="SURFACE"&&manufacturerSource(e,c)&&e.payload.outsole===c.outsole);
 if(records.some(e=>e.kind==="SURFACE"&&e.payload.denied.includes(p.surface!)))return "incompatible";
 return records.some(e=>e.kind==="SURFACE"&&e.payload.allowed.includes(p.surface!))?"compatible":"unknown";
}
export function moneyCents(value:string) {const [whole,part=""]=value.split(".");return Number(whole)*100+Number(part.padEnd(2,"0"));}
export function commerce(c:Candidate,p:Preferences,evidence:Evidence[]) {
 const prices=evidence.filter((e):e is Extract<Evidence,{kind:"PRICE"}>=>e.kind==="PRICE"&&(e.sourceKind==="MANUFACTURER"||e.sourceKind==="RETAILER")&&scopeMatches(e.payload,c,p));
 // Preserve original currency. A different currency is never compared numerically.
 const price=prices.find(e=>!p.currency||e.payload.currency===p.currency) ?? prices[0];
 let status:Result["budgetStatus"]=p.budgetAmount===null?"not-requested":"unknown";
 if(p.budgetAmount!==null&&price&&price.payload.currency===p.currency){
  const amount=moneyCents(price.payload.amount),budget=moneyCents(p.budgetAmount);
  status=amount<=budget?"within":amount<=Math.floor(budget*rules.nearBudgetRatio)?"near":"over";
 }
 const stock=p.sizeWorn&&p.sizeSystem?evidence.find(e=>e.kind==="AVAILABILITY"&&(e.sourceKind==="MANUFACTURER"||e.sourceKind==="RETAILER")&&scopeMatches(e.payload,c,p)):undefined;
 return {budgetStatus:status,price:price?{amount:price.payload.amount,currency:price.payload.currency,observedAt:price.observedAt,entryId:c.entry.id}:null,
  availability:(stock?.kind==="AVAILABILITY"?(stock.payload.available?"available":"unavailable"):"unknown") as Result["availability"]};
}
