import { triggerDataSource } from "@/lib/source-sync/service";
import { revalidatePublicCatalogue } from "@/lib/product-review/revalidate";
import { platformInput, platformFailure, noStore } from "@/lib/platform/http";
// Manual trigger. Per-admin rate limit here; per-source minimum interval, backoff and locking are enforced by the runner.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const x = await platformInput(request, "source-sync", 10); if (x.limited) return x.limited;
    const result = await triggerDataSource(x.actor, (await params).id, x.input);
    if (result.status === "SUCCEEDED" && result.mode === "RUN" && Number(result.summary.publishedPrices ?? 0) > 0) revalidatePublicCatalogue();
    return Response.json(result, { status: result.status === "SKIPPED" ? 409 : 200, headers: noStore });
  } catch (error) { return platformFailure(error); }
}
