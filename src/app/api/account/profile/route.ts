import { ZodError } from "zod";
import { currentUser, updateProfile } from "@/lib/accounts/service";
import { AccessError, requireActiveUser } from "@/lib/accounts/authorization";
import { sameOriginRequest } from "@/lib/accounts/config";
import { consumeLimit } from "@/lib/accounts/rate-limit";
import { limitedText, BodyTooLargeError } from "@/lib/accounts/request";

export async function PATCH(request: Request) {
  if (!sameOriginRequest(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const actor = requireActiveUser(await currentUser());
    if (!(await consumeLimit(`profile:${actor.id}`, 20, 60)))
      return Response.json(
        { error: "Too many updates. Try again in a minute." },
        { status: 429 },
      );
    const text = await limitedText(request, 4096);
    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      return Response.json({ error: "Invalid JSON." }, { status: 400 });
    }
    const profile = await updateProfile(actor, actor.id, input);
    return Response.json({ profile });
  } catch (error) {
    if (error instanceof BodyTooLargeError)
      return Response.json({ error: error.message }, { status: 413 });
    if (error instanceof AccessError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError)
      return Response.json(
        {
          error: "Check your profile details.",
          fields: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    )
      return Response.json(
        {
          error: "That username is already taken.",
          fields: { username: ["Choose another username."] },
        },
        { status: 409 },
      );
    return Response.json(
      { error: "Your profile could not be saved. Try again later." },
      { status: 503 },
    );
  }
}
