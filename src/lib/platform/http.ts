import "server-only";
import { communityFailure } from "@/lib/community/http";
import { currentUser } from "@/lib/accounts/service";
import { requireActiveUser, AccessError } from "@/lib/accounts/authorization";
import { sameOriginRequest } from "@/lib/accounts/config";
import { limitedText } from "@/lib/accounts/request";
import { consumeLimit } from "@/lib/accounts/rate-limit";
import { CommunityError } from "@/lib/community/service";
export async function platformActor(request: Request, scope: string, limit = 20) {
    if (!sameOriginRequest(request))
        throw new AccessError(403, "Invalid request origin.");
    const actor = requireActiveUser(await currentUser());
    if (!await consumeLimit(`${scope}:${actor.id}`, limit, 15 * 60))
        return { limited: Response.json({ error: "Too many requests. Please wait." }, { status: 429 }) };
    return { actor, limited: undefined };
}
export async function platformInput(request: Request, scope: string, limit = 20) {
    const auth = await platformActor(request, scope, limit);
    if (auth.limited)
        return auth;
    const body = await limitedText(request, 32 * 1024);
    let input: unknown;
    try {
        input = JSON.parse(body);
    }
    catch {
        throw new CommunityError(400, "Invalid JSON.");
    }
    return { actor: requireActiveUser(await currentUser()), input, limited: undefined };
}
export const noStore = { "Cache-Control": "private, no-store", "Vary": "Cookie" };

export function platformFailure(error: unknown) {
  const response = communityFailure(error);
  for (const [key,value] of Object.entries(noStore)) response.headers.set(key,value);
  return response;
}
