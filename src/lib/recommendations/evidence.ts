import {z} from "zod";
import {currencyCodes} from "@/lib/foot-profile/currencies";
import {manufacturerHosts,rules,ascending} from "./config";
import type {Candidate,Evidence,Preferences,Provenance} from "./types";
const surface=z.enum(["FG","AG","TF","SG","IN"]);
const safeUrl=z.url().refine(v=>{try {const u=new URL(v);return u.protocol==="https:"&&!u.username&&!u.password&&!Array.from(u.searchParams.keys()).some(k=>/token|secret|signature|api.?key/i.test(k));} catch {return false;}},"Use a public HTTPS evidence URL.");
const base={id:z.string().min(1).max(100),sourceKind:z.enum(["MANUFACTURER","RETAILER","MEASUREMENT","EDITORIAL","COMMUNITY"]),sourceUrl:safeUrl,observedAt:z.iso.datetime({offset:true}),validUntil:z.iso.datetime({offset:true}),countryCode:z.string().regex(/^[A-Z]{2}$/).nullable().optional()};
const scope={entryId:z.string().min(1).max(100),size:z.string().regex(/^\d{1,2}(\.\d{1,2})?$/).nullable(),sizeSystem:z.enum(["UK","US","EU","CM"]).nullable()};
export const evidenceSchema=z.discriminatedUnion("kind",[
 z.object({...base,kind:z.literal("SURFACE"),payload:z.object({outsole:surface,allowed:z.array(surface).max(5),denied:z.array(surface).max(5)}).strict()}),
 z.object({...base,kind:z.literal("PRICE"),payload:z.object({...scope,amount:z.string().regex(/^\d{1,7}(\.\d{1,2})?$/),currency:z.enum(currencyCodes)}).strict().refine(p=>(p.size===null)===(p.sizeSystem===null))}),
 z.object({...base,kind:z.literal("AVAILABILITY"),payload:z.object({...scope,size:scope.size.unwrap(),sizeSystem:scope.sizeSystem.unwrap(),available:z.boolean()}).strict()}),
 z.object({...base,kind:z.literal("FIT"),payload:z.object({attribute:z.enum(["fitSensation","snugness"]),value:z.string().min(1).max(40),observation:z.string().min(1).max(500),methodology:z.string().max(500).nullable()}).strict()}),
]);
export function parseEvidence(value:unknown):Evidence|null {const r=evidenceSchema.safeParse(value);return r.success?r.data:null;}
export function fresh(e:Provenance,asOf:number,days:number) {
 const observed=Date.parse(e.observedAt),until=Date.parse(e.validUntil);
 return Number.isFinite(observed)&&Number.isFinite(until)&&observed<=asOf&&until>asOf&&until>observed&&asOf-observed<=days*86400000;
}
export function manufacturerSource(e:Provenance,c:Candidate) {
 const host=new URL(e.sourceUrl).hostname.toLowerCase();
 return e.sourceKind==="MANUFACTURER"&&(manufacturerHosts[c.brandId]??[]).some(h=>host===h||host.endsWith("."+h));
}
export function usableEvidence(c:Candidate,asOf:number) {
 return c.evidence.map(parseEvidence).filter((e):e is Evidence=>!!e)
 .filter(e=>fresh(e,asOf,e.kind==="PRICE"?rules.priceMaxAgeDays:e.kind==="AVAILABILITY"?rules.inventoryMaxAgeDays:e.kind==="FIT"?rules.fitMaxAgeDays:rules.surfaceMaxAgeDays))
 .filter(e=>e.sourceKind!=="MANUFACTURER"||manufacturerSource(e,c))
 // Finder currently has no country input. Never substitute regional offer evidence.
 .filter(e=>!((e.kind==='PRICE'||e.kind==='AVAILABILITY')&&e.countryCode))
 .sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt)||ascending(a.id,b.id));
}
export function scopeMatches(scope:{entryId:string;size:string|null;sizeSystem:string|null},c:Candidate,p:Preferences) {
 if(scope.entryId!==c.entry.id)return false;
 if(p.sizeWorn&&p.sizeSystem)return scope.size!==null&&Number(scope.size)===Number(p.sizeWorn)&&scope.sizeSystem===p.sizeSystem;
 return scope.size===null&&scope.sizeSystem===null;
}
export function provenance(e:Evidence):Provenance {return {id:e.id,sourceKind:e.sourceKind,sourceUrl:e.sourceUrl,observedAt:e.observedAt,validUntil:e.validUntil};}
