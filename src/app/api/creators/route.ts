import { creators } from "@/lib/platform/creators";
import { queryObject } from "@/lib/platform/validation";
import { platformFailure } from "@/lib/platform/http";
export async function GET(r: Request) { try {
    return Response.json(await creators(queryObject(new URL(r.url).searchParams)), { headers: { "Cache-Control": "no-store" } });
}
catch (e) {
    return platformFailure(e);
} }
