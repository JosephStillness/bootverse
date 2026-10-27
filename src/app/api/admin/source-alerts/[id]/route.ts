import { updateAlert } from "@/lib/source-sync/service";
import { platformInput, platformFailure, noStore } from "@/lib/platform/http";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const x = await platformInput(request, "source-alert", 60); if (x.limited) return x.limited; return Response.json(await updateAlert(x.actor, (await params).id, x.input), { headers: noStore }); }
  catch (error) { return platformFailure(error); }
}
