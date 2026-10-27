import { bulkReview } from "@/lib/product-review/service";
import { revalidatePublicCatalogue } from "@/lib/product-review/revalidate";
import { platformInput, platformFailure, noStore } from "@/lib/platform/http";
export async function POST(request: Request) {
  try {
    const x = await platformInput(request, "product-review-bulk", 20); if (x.limited) return x.limited;
    const result = await bulkReview(x.actor, x.input);
    if ("counts" in result && result.counts?.APPROVED) revalidatePublicCatalogue();
    return Response.json(result, { headers: noStore });
  } catch (error) { return platformFailure(error); }
}
