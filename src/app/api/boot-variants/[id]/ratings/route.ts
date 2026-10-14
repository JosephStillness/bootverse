import { reviewSummary } from "@/lib/reviews/service";
import { communityFailure } from "@/lib/community/http";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(await reviewSummary((await params).id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return communityFailure(e);
  }
}
