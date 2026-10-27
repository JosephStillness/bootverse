import { resolveConflict } from "@/lib/product-review/service";
import { revalidatePublicCatalogue } from "@/lib/product-review/revalidate";
import { platformInput, platformFailure, noStore } from "@/lib/platform/http";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const x = await platformInput(request, "product-review", 120); if (x.limited) return x.limited;
    const result = await resolveConflict(x.actor, (await params).id, x.input);
    if (result.publicChanged) revalidatePublicCatalogue();
    return Response.json(result, { headers: noStore });
  } catch (error) { return platformFailure(error); }
}
