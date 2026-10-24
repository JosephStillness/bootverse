import { currentUser } from "@/lib/accounts/service";
import { changePublication, inspectProduct } from "@/lib/product-data/service";
import { platformInput, platformFailure, noStore } from "@/lib/platform/http";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return Response.json(await inspectProduct(await currentUser(), (await params).id), { headers: noStore }); }
  catch (error) { return platformFailure(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const x = await platformInput(request, "product-data", 60); if (x.limited) return x.limited; return Response.json(await changePublication(x.actor, (await params).id, x.input), { headers: noStore }); }
  catch (error) { return platformFailure(error); }
}
