import { currentUser } from "@/lib/accounts/service";
import { requireActiveUser } from "@/lib/accounts/authorization";
import { getOwnFootProfile, saveOwnFootProfile, deleteOwnFootProfile } from "@/lib/foot-profile/service";
import { platformInput, platformFailure, noStore } from "@/lib/platform/http";
import { consumeLimit } from "@/lib/accounts/rate-limit";

export async function GET(request: Request) {
  try {
    const actor = requireActiveUser(await currentUser());
    if (new URL(request.url).search) return Response.json({error:"This endpoint accepts no user or profile identifiers."},{status:400,headers:noStore});
    if (!await consumeLimit(`foot-profile:read:${actor.id}`,120,60)) return Response.json({error:"Too many requests. Please wait."},{status:429,headers:noStore});
    return Response.json({profile:await getOwnFootProfile(actor)},{headers:noStore});
  } catch (e) { return platformFailure(e); }
}
async function mutate(request: Request, deleting: boolean) {
  try {
    const x = await platformInput(request,"foot-profile:change",30);
    if(x.limited) { for(const [k,v] of Object.entries(noStore)) x.limited.headers.set(k,v); return x.limited; }
    if(new URL(request.url).search) return Response.json({error:"This endpoint accepts no user or profile identifiers."},{status:400,headers:noStore});
    return Response.json(deleting ? await deleteOwnFootProfile(x.actor,x.input) : {profile:await saveOwnFootProfile(x.actor,x.input)},{headers:noStore});
  } catch(e) { return platformFailure(e); }
}
// PUT replaces the optional fields and creates when version is zero. Existing versions prevent stale writes.
export async function PUT(request: Request) { return mutate(request,false); }
export async function DELETE(request: Request) { return mutate(request,true); }
