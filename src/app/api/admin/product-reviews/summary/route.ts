import { currentUser } from "@/lib/accounts/service";
import { reviewDashboard } from "@/lib/product-review/service";
import { platformFailure, noStore } from "@/lib/platform/http";
export async function GET() {
  try { return Response.json(await reviewDashboard(await currentUser()), { headers: noStore }); }
  catch (error) { return platformFailure(error); }
}
