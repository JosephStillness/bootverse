import {it,expect} from "vitest";
import {parseEvidence} from "./evidence";
it("rejects malformed evidence/URLs without throwing or fetching untrusted locations",()=>{
 for(const sourceUrl of ["invalid","javascript:alert(1)","https://user:password@example.test","https://example.test?token=secret"]){expect(parseEvidence({id:"x",sourceKind:"MANUFACTURER",sourceUrl,observedAt:"2026-10-14T00:00:00Z",validUntil:"2026-10-30T00:00:00Z",kind:"SURFACE",payload:{outsole:"AG",allowed:["AG"],denied:[]}})).toBeNull();}
});
