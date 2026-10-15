import { currentUser } from "@/lib/accounts/service";
import { requestVerification } from "@/lib/platform/creators";
import { platformActor, noStore } from "@/lib/platform/http";
import { platformFailure } from "@/lib/platform/http";
export async function POST(r: Request) { try {
    const x = await platformActor(r, "creator:verification", 3);
    if (x.limited)
        return x.limited;
    return Response.json({ request: await requestVerification(await currentUser()) }, { headers: noStore });
}
catch (e) {
    return platformFailure(e);
} }
