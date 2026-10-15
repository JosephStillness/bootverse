import { currentUser } from "@/lib/accounts/service";
import { adminData } from "@/lib/platform/moderation";
import { noStore } from "@/lib/platform/http";
import { platformFailure } from "@/lib/platform/http";
export async function GET(r: Request) { try {
    return Response.json(await adminData(await currentUser(), Object.fromEntries(new URL(r.url).searchParams)), { headers: noStore });
}
catch (e) {
    return platformFailure(e);
} }
