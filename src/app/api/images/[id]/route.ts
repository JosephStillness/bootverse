import { currentUser } from "@/lib/accounts/service";
import { platformFailure } from "@/lib/platform/http";
import { readImage, deleteImage } from "@/lib/platform/images";
import { platformActor, noStore } from "@/lib/platform/http";
type Context = {
    params: Promise<{
        id: string;
    }>;
};
export const runtime = "nodejs";
export async function GET(_r: Request, { params }: Context) { try {
    const bytes = await readImage((await params).id, await currentUser());
    return new Response(new Uint8Array(bytes), { headers: { ...noStore, "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
}
catch (e) {
    return platformFailure(e);
} }
export async function DELETE(request: Request, { params }: Context) { try {
    const r = await platformActor(request, "images:delete", 40);
    if (r.limited)
        return r.limited;
    await deleteImage((await params).id, r.actor);
    return new Response(null, { status: 204 });
}
catch (e) {
    return platformFailure(e);
} }
