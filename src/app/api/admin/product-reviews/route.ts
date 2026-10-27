import { currentUser } from "@/lib/accounts/service";
import { listReviewQueue } from "@/lib/product-review/service";
import { platformFailure, noStore } from "@/lib/platform/http";
export async function GET(request: Request) {
  try { return Response.json(await listReviewQueue(await currentUser(), Object.fromEntries(new URL(request.url).searchParams)), { headers: noStore }); }
  catch (error) { return platformFailure(error); }
}
