import "server-only";
import { ZodError } from "zod";
import { currentUser } from "@/lib/accounts/service";
import { AccessError, requireActiveUser } from "@/lib/accounts/authorization";
import { sameOriginRequest } from "@/lib/accounts/config";
import { limitedText, BodyTooLargeError } from "@/lib/accounts/request";
import { consumeLimit } from "@/lib/accounts/rate-limit";
import { CommunityError } from "./service";
export function communityFailure(error: unknown) {
  if (error instanceof AccessError || error instanceof CommunityError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof BodyTooLargeError)
    return Response.json({ error: "Post is too large." }, { status: 413 });
  if (error instanceof ZodError)
    return Response.json(
      {
        error: "Check your post or filter details.",
        fields: error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  return Response.json(
    { error: "Community services are unavailable. Please try again later." },
    { status: 503 },
  );
}
export async function mutationInput(request: Request, creating = false) {
  if (!sameOriginRequest(request))
    throw new AccessError(403, "Invalid request origin.");
  const actor = requireActiveUser(await currentUser());
  if (!(await consumeLimit(`posts:changes:${actor.id}`, 30, 60)))
    return {
      limited: Response.json(
        { error: "Too many changes. Try again in a minute." },
        { status: 429 },
      ),
    };
  if (creating && !(await consumeLimit(`posts:create:${actor.id}`, 5, 15 * 60)))
    return {
      limited: Response.json(
        {
          error:
            "Five publishing attempts are allowed per 15 minutes. Please wait before trying again.",
        },
        { status: 429 },
      ),
    };
  const body = await limitedText(request, 48 * 1024);
  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    throw new CommunityError(400, "Invalid JSON.");
  }
  return { actor: requireActiveUser(await currentUser()), input };
}
