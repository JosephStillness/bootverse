import { currentUser } from "@/lib/accounts/service";
import { requireActiveUser } from "@/lib/accounts/authorization";
import { ownCreator, saveCreator } from "@/lib/platform/creators";
import { platformInput, noStore } from "@/lib/platform/http";
import { platformFailure } from "@/lib/platform/http";
export async function GET() { try {
    return Response.json({ creator: await ownCreator(requireActiveUser(await currentUser())) }, { headers: noStore });
}
catch (e) {
    return platformFailure(e);
} }
export async function POST(r: Request) { try {
    const x = await platformInput(r, "creator:edit");
    if (x.limited)
        return x.limited;
    return Response.json({ creator: await saveCreator(x.actor, x.input) }, { headers: noStore });
}
catch (e) {
    return platformFailure(e);
} }
