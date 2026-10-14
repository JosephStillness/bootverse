import { currentUser } from "@/lib/accounts/service";
import { votingState, setVote } from "@/lib/community/interactions";
import { mutationInput, communityFailure } from "@/lib/community/http";
type Context = { params: Promise<{ slug: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    return Response.json(
      await votingState((await params).slug, await currentUser()),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return communityFailure(error);
  }
}
export async function PUT(request: Request, { params }: Context) {
  try {
    const result = await mutationInput(request, false, "votes");
    if (result.limited) return result.limited;
    return Response.json(
      await setVote((await params).slug, result.actor, result.input),
    );
  } catch (error) {
    return communityFailure(error);
  }
}
