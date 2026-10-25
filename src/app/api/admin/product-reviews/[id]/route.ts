import { currentUser } from "@/lib/accounts/service";
import { reviewDetail } from "@/lib/product-review/service";
import { platformFailure, noStore } from "@/lib/platform/http";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return Response.json(await reviewDetail(await currentUser(), (await params).id), { headers: noStore }); }
  catch (error) { return platformFailure(error); }
}
