import { changeComment } from "@/lib/community/interactions";
import { mutationInput, communityFailure } from "@/lib/community/http";
type Context = { params: Promise<{ slug: string; id: string }> };
async function change(
  request: Request,
  { params }: Context,
  deleting: boolean,
) {
  try {
    const result = await mutationInput(request, false, "comments");
    if (result.limited) return result.limited;
    const { slug, id } = await params;
    await changeComment(slug, id, result.actor, result.input, deleting);
    return new Response(null, { status: 204 });
  } catch (error) {
    return communityFailure(error);
  }
}
export const PATCH = (request: Request, context: Context) =>
  change(request, context, false);
export const DELETE = (request: Request, context: Context) =>
  change(request, context, true);
