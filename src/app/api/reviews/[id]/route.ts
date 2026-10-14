import { publicReview, editReview, deleteReview } from "@/lib/reviews/service";
import { communityFailure, mutationInput } from "@/lib/community/http";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    return Response.json(
      { review: await publicReview((await params).id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return communityFailure(e);
  }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    const r = await mutationInput(request, false, "reviews");
    if (r.limited) return r.limited;
    return Response.json({
      review: await editReview((await params).id, r.actor, r.input),
    });
  } catch (e) {
    return communityFailure(e);
  }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    const r = await mutationInput(request, false, "reviews");
    if (r.limited) return r.limited;
    await deleteReview((await params).id, r.actor, r.input);
    return new Response(null, { status: 204 });
  } catch (e) {
    return communityFailure(e);
  }
}
