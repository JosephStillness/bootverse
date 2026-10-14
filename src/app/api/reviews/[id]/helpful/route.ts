import { helpfulState, setHelpful } from "@/lib/reviews/service";
import { currentUser } from "@/lib/accounts/service";
import { communityFailure, mutationInput } from "@/lib/community/http";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    return Response.json(
      await helpfulState((await params).id, await currentUser()),
      { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
    );
  } catch (e) {
    return communityFailure(e);
  }
}
export async function PUT(request: Request, { params }: Context) {
  try {
    const r = await mutationInput(request, false, "helpful");
    if (r.limited) return r.limited;
    return Response.json(await setHelpful((await params).id, r.actor, r.input));
  } catch (e) {
    return communityFailure(e);
  }
}
