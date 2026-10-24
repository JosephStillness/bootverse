import {it,expect} from "vitest";
import {parseEvidence,usableEvidence} from "./evidence";
import type {Candidate} from "./types";
it("rejects malformed evidence/URLs without throwing or fetching untrusted locations",()=>{
 for(const sourceUrl of ["invalid","javascript:alert(1)","https://user:password@example.test","https://example.test?token=secret"]){expect(parseEvidence({id:"x",sourceKind:"MANUFACTURER",sourceUrl,observedAt:"2026-10-14T00:00:00Z",validUntil:"2026-10-30T00:00:00Z",kind:"SURFACE",payload:{outsole:"AG",allowed:["AG"],denied:[]}})).toBeNull();}
});
it("does not treat a country-specific price as a regionless Finder offer",()=>{
 const evidence={id:"synthetic-price",sourceKind:"RETAILER" as const,sourceUrl:"https://example.test/offer",observedAt:"2026-10-14T00:00:00Z",validUntil:"2026-10-30T00:00:00Z",kind:"PRICE" as const,payload:{entryId:"e",amount:"100",currency:"AUD",size:null,sizeSystem:null}};
 const candidate:Candidate={variantId:"v",generationId:"g",generation:"Synthetic",familyId:"f",family:"Synthetic",brandId:"b",brand:"Synthetic",tierId:"t",tier:"Elite",outsole:"AG",entry:{id:"e",slug:"e",colorwayId:"c",colorway:"Synthetic"},sample:false,evidence:[{...evidence,countryCode:"AU"}]};
 expect(usableEvidence(candidate,Date.parse("2026-10-15T00:00:00Z"))).toEqual([]);
 expect(usableEvidence({...candidate,evidence:[evidence]},Date.parse("2026-10-15T00:00:00Z"))).toHaveLength(1);
});
