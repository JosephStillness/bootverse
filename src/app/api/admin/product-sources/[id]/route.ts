import { saveSource } from "@/lib/product-data/service";
import { platformInput, platformFailure, noStore } from "@/lib/platform/http";
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const x = await platformInput(request, "product-data", 60); if (x.limited) return x.limited; return Response.json(await saveSource(x.actor, x.input, (await params).id), { headers: noStore }); }
  catch (error) { return platformFailure(error); }
}
