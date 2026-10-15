import { moderate } from "@/lib/platform/moderation";
import { platformInput, noStore } from "@/lib/platform/http";
import { platformFailure } from "@/lib/platform/http";
export async function POST(r: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) { try {
    const x = await platformInput(r, "moderation", 60);
    if (x.limited)
        return x.limited;
    return Response.json(await moderate(x.actor, (await params).id, x.input), { headers: noStore });
}
catch (e) {
    return platformFailure(e);
} }
