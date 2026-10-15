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
    return Response.json({ error: "Content is too large." }, { status: 413 });
  if (error instanceof ZodError)
    return Response.json(
      {
        error: "Check your content or filter details.",
        fields: error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  return Response.json(
    { error: "Community services are unavailable. Please try again later." },
    { status: 503 },
  );
}
export async function mutationInput(
  request: Request,
  creating = false,
  interaction?: "comments" | "votes" | "reviews" | "helpful",
) {
  if (!sameOriginRequest(request))
    throw new AccessError(403, "Invalid request origin.");
  const actor = requireActiveUser(await currentUser());
  if (
    !(await consumeLimit(
      `${interaction ?? "posts"}:changes:${actor.id}`,
      interaction === "votes" || interaction === "helpful" ? 60 : 30,
      60,
    ))
  )
    return {
      limited: Response.json(
        { error: "Too many changes. Try again in a minute." },
        { status: 429 },
      ),
    };
  if (
    creating &&
    !(await consumeLimit(
      `${interaction ?? "posts"}:create:${actor.id}`,
      interaction === "comments" ? 10 : 5,
      15 * 60,
    ))
  )
    return {
      limited: Response.json(
        {
          error:
            interaction === "comments"
              ? "Ten comment attempts are allowed per 15 minutes."
              : "Five publishing attempts are allowed per 15 minutes. Please wait before trying again.",
        },
        { status: 429 },
      ),
    };
  // Review character limits allow multi-byte text across several long fields.
  const body = await limitedText(
    request,
    interaction === "reviews" ? 64 * 1024 : interaction ? 16 * 1024 : 48 * 1024,
  );
  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    throw new CommunityError(400, "Invalid JSON.");
  }
  return { actor: requireActiveUser(await currentUser()), input };
}
