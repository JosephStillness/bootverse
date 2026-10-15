import { decideVerification } from "@/lib/platform/moderation";
import { platformInput, noStore } from "@/lib/platform/http";
import { platformFailure } from "@/lib/platform/http";
export async function POST(r: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) { try {
    const x = await platformInput(r, "verification:decision", 30);
    if (x.limited)
        return x.limited;
    return Response.json(await decideVerification(x.actor, (await params).id, x.input), { headers: noStore });
}
catch (e) {
    return platformFailure(e);
} }
