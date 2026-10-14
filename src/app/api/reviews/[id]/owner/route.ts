import { ownedReview } from "@/lib/reviews/service";
import { currentUser } from "@/lib/accounts/service";
import { communityFailure } from "@/lib/community/http";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(
      await ownedReview((await params).id, await currentUser()),
      { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
    );
  } catch (e) {
    return communityFailure(e);
  }
}
