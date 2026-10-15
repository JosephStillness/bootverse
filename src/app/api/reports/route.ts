import { reportContent } from "@/lib/platform/moderation";
import { platformInput, noStore } from "@/lib/platform/http";
import { platformFailure } from "@/lib/platform/http";
export async function POST(r: Request) { try {
    const x = await platformInput(r, "reports", 10);
    if (x.limited)
        return x.limited;
    const report = await reportContent(x.actor, x.input);
    return Response.json({ report }, { status: report.duplicate ? 200 : 201, headers: noStore });
}
catch (e) {
    return platformFailure(e);
} }
