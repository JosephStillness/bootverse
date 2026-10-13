import { listPosts, createPost } from "@/lib/community/service";
import { feedQuery } from "@/lib/community/validation";
import { communityFailure, mutationInput } from "@/lib/community/http";
export async function GET(request: Request) {
  try {
    return Response.json(
      await listPosts(feedQuery(new URL(request.url).searchParams)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return communityFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const result = await mutationInput(request, true);
    if (result.limited) return result.limited;
    const post = await createPost(result.actor, result.input);
    return Response.json({ post }, { status: 201 });
  } catch (error) {
    return communityFailure(error);
  }
}
