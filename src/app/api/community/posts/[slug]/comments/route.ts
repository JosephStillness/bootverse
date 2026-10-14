import { currentUser } from "@/lib/accounts/service";
import { listComments, createComment } from "@/lib/community/interactions";
import { mutationInput, communityFailure } from "@/lib/community/http";
type Context = { params: Promise<{ slug: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const query = new URL(request.url).searchParams;
    return Response.json(
      await listComments(
        (await params).slug,
        { parent: query.get("parent"), page: query.get("page") ?? 1 },
        await currentUser(),
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return communityFailure(error);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    const result = await mutationInput(request, true, "comments");
    if (result.limited) return result.limited;
    return Response.json(
      {
        comment: await createComment(
          (await params).slug,
          result.actor,
          result.input,
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return communityFailure(error);
  }
}
