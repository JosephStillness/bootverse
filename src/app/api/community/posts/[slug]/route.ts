import {
  publicPost,
  editPost,
  deletePost,
  CommunityError,
} from "@/lib/community/service";
import { mutationInput, communityFailure } from "@/lib/community/http";
type Context = { params: Promise<{ slug: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    const post = await publicPost((await params).slug);
    if (!post) throw new CommunityError(404, "Post not found.");
    return Response.json(
      { post },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return communityFailure(error);
  }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    const result = await mutationInput(request);
    if (result.limited) return result.limited;
    return Response.json({
      post: await editPost((await params).slug, result.actor, result.input),
    });
  } catch (error) {
    return communityFailure(error);
  }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    const result = await mutationInput(request);
    if (result.limited) return result.limited;
    await deletePost((await params).slug, result.actor, result.input);
    return new Response(null, { status: 204 });
  } catch (error) {
    return communityFailure(error);
  }
}
