import { deleteVideo } from "@/lib/platform/creators";
import { platformActor } from "@/lib/platform/http";
import { platformFailure } from "@/lib/platform/http";
export async function DELETE(r: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) { try {
    const x = await platformActor(r, "videos:delete", 30);
    if (x.limited)
        return x.limited;
    await deleteVideo(x.actor, (await params).id);
    return new Response(null, { status: 204 });
}
catch (e) {
    return platformFailure(e);
} }
