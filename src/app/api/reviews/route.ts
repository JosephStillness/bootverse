import { listReviews, createReview } from "@/lib/reviews/service";
import { reviewQuery } from "@/lib/reviews/validation";
import { communityFailure, mutationInput } from "@/lib/community/http";
export async function GET(request: Request) {
  try {
    return Response.json(
      await listReviews(reviewQuery(new URL(request.url).searchParams)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return communityFailure(e);
  }
}
export async function POST(request: Request) {
  try {
    const r = await mutationInput(request, true, "reviews");
    if (r.limited) return r.limited;
    return Response.json(
      { review: await createReview(r.actor, r.input) },
      { status: 201 },
    );
  } catch (e) {
    return communityFailure(e);
  }
}
