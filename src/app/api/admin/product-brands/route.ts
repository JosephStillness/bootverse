import { createBrand } from "@/lib/product-data/service";
import { platformInput, platformFailure, noStore } from "@/lib/platform/http";
export async function POST(request: Request) {
  try { const x = await platformInput(request, "product-data", 60); if (x.limited) return x.limited; return Response.json(await createBrand(x.actor, x.input), { status: 201, headers: noStore }); }
  catch (error) { return platformFailure(error); }
}
