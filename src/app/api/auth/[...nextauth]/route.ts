import { handlers } from "@/auth";
import { NextRequest } from "next/server";
import { authConfigured, sameOriginRequest } from "@/lib/accounts/config";
import { consumeLimit } from "@/lib/accounts/rate-limit";
import { limitedText, BodyTooLargeError } from "@/lib/accounts/request";

export const runtime = "nodejs";
async function handle(request: NextRequest, method: "GET" | "POST") {
  if (!authConfigured())
    return Response.json(
      { error: "Account services are not configured." },
      { status: 503 },
    );
  const origin = new URL(process.env.AUTH_URL!).origin;
  if (
    new URL(request.url).origin !== origin ||
    (method === "POST" && !sameOriginRequest(request))
  ) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    if (method === "POST" && !(await consumeLimit("auth:requests", 300, 60)))
      return Response.json(
        { error: "Too many requests. Try again later." },
        { status: 429 },
      );
    if (method === "POST") {
      const body = await limitedText(request, 8192);
      return await handlers.POST(
        new NextRequest(request.url, {
          method,
          headers: request.headers,
          body,
        }),
      );
    }
    if (request.url.length > 4096)
      return Response.json({ error: "Request is too large." }, { status: 413 });
    return await handlers.GET(request);
  } catch (error) {
    if (error instanceof BodyTooLargeError)
      return Response.json({ error: error.message }, { status: 413 });
    return Response.json(
      { error: "Account services are temporarily unavailable." },
      { status: 503 },
    );
  }
}
export function GET(request: NextRequest) {
  return handle(request, "GET");
}
export function POST(request: NextRequest) {
  return handle(request, "POST");
}
