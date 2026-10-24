import { currentUser } from "@/lib/accounts/service";
import { listSources, saveSource } from "@/lib/product-data/service";
import { platformInput, platformFailure, noStore } from "@/lib/platform/http";
export async function GET(request: Request) {
  try { return Response.json(await listSources(await currentUser(), Object.fromEntries(new URL(request.url).searchParams)), { headers: noStore }); }
  catch (error) { return platformFailure(error); }
}
export async function POST(request: Request) {
  try { const x = await platformInput(request, "product-data", 60); if (x.limited) return x.limited; return Response.json(await saveSource(x.actor, x.input), { status: 201, headers: noStore }); }
  catch (error) { return platformFailure(error); }
}
