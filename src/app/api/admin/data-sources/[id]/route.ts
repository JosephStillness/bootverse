import { currentUser } from "@/lib/accounts/service";
import { dataSourceDetail, updateDataSource } from "@/lib/source-sync/service";
import { platformInput, platformFailure, noStore } from "@/lib/platform/http";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return Response.json(await dataSourceDetail(await currentUser(), (await params).id, Object.fromEntries(new URL(request.url).searchParams)), { headers: noStore }); }
  catch (error) { return platformFailure(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const x = await platformInput(request, "source-config", 30); if (x.limited) return x.limited; return Response.json(await updateDataSource(x.actor, (await params).id, x.input), { headers: noStore }); }
  catch (error) { return platformFailure(error); }
}
