import { getDb } from "@/lib/db";
import { currentUser } from "@/lib/accounts/service";
import { AccessError, requireActiveUser } from "@/lib/accounts/authorization";
import { sameOriginRequest } from "@/lib/accounts/config";

export async function DELETE(request: Request) {
  if (!sameOriginRequest(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const actor = requireActiveUser(await currentUser());
    await getDb().session.deleteMany({ where: { userId: actor.id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof AccessError)
      return Response.json({ error: error.message }, { status: error.status });
    return Response.json(
      { error: "Sessions could not be revoked. Try again later." },
      { status: 503 },
    );
  }
}
