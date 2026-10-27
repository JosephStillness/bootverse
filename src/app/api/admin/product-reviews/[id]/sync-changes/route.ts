import { resolveSyncChange } from "@/lib/product-review/service";
import { platformInput, platformFailure, noStore } from "@/lib/platform/http";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const x = await platformInput(request, "product-review", 120); if (x.limited) return x.limited;
    return Response.json(await resolveSyncChange(x.actor, (await params).id, x.input), { headers: noStore });
  } catch (error) { return platformFailure(error); }
}
