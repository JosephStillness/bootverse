import { currentUser } from "@/lib/accounts/service";
import { listDataSources } from "@/lib/source-sync/service";
import { platformFailure, noStore } from "@/lib/platform/http";
export async function GET() {
  try { return Response.json(await listDataSources(await currentUser()), { headers: noStore }); }
  catch (error) { return platformFailure(error); }
}
