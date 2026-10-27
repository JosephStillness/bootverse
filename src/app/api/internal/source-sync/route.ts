import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { limitedText } from "@/lib/accounts/request";
import { consumeLimit } from "@/lib/accounts/rate-limit";
import { verifySchedulerRequest } from "@/lib/source-sync/scheduler-auth";
import { runDueSources, sweep } from "@/lib/source-sync/runner";
import { revalidatePublicCatalogue } from "@/lib/product-review/revalidate";
import { serviceFailure } from "@/lib/observability/failure";

const noStore = { "Cache-Control": "no-store" };
// Future cloud scheduler hook (e.g. EventBridge → signed HTTPS call). Disabled unless SYNC_SCHEDULER_SECRET is set.
export async function POST(request: Request) {
  try {
    const body = await limitedText(request, 1024);
    const auth = verifySchedulerRequest(process.env.SYNC_SCHEDULER_SECRET, { timestamp: request.headers.get("x-bootverse-timestamp"), nonce: request.headers.get("x-bootverse-nonce"), signature: request.headers.get("x-bootverse-signature") }, body);
    if (!auth.ok) return Response.json({ error: auth.status === 404 ? "Not found." : "Unauthorized." }, { status: auth.status, headers: noStore });
    try { await getDb().schedulerNonce.create({ data: { nonce: auth.nonce } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Replayed request." }, { status: 409, headers: noStore }); throw error; }
    if (!await consumeLimit("internal-scheduler", 30, 15 * 60)) return Response.json({ error: "Too many requests." }, { status: 429, headers: noStore });
    const { action } = z.object({ action: z.enum(["due", "sweep"]) }).strict().parse(JSON.parse(body));
    if (action === "sweep") return Response.json(await sweep(), { headers: noStore });
    const results = await runDueSources({ entryPoint: "internal_endpoint" });
    if (results.some(r => r.status === "SUCCEEDED" && r.mode === "RUN" && Number(r.summary.publishedPrices ?? 0) > 0)) revalidatePublicCatalogue();
    return Response.json({ results: results.map(r => ({ sourceId: r.sourceId, status: r.status, ...("jobId" in r ? { jobId: r.jobId } : {}), ...("reason" in r ? { reason: r.reason } : {}), ...("errorCategory" in r ? { errorCategory: r.errorCategory } : {}) })) }, { headers: noStore });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid request." }, { status: 400, headers: noStore });
    return serviceFailure(Response.json({ error: "Scheduler run failed." }, { status: 503, headers: noStore }), error);
  }
}
