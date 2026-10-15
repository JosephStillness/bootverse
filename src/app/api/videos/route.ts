import { addVideo, videos } from "@/lib/platform/creators";
import { videoSchema } from "@/lib/platform/validation";
import { platformInput, noStore } from "@/lib/platform/http";
import { platformFailure } from "@/lib/platform/http";
export async function GET(r: Request) { try {
    const q = videoSchema.pick({ kind: true, id: true }).parse(Object.fromEntries(new URL(r.url).searchParams));
    return Response.json({ videos: await videos(q.kind, q.id) }, { headers: noStore });
}
catch (e) {
    return platformFailure(e);
} }
export async function POST(r: Request) { try {
    const x = await platformInput(r, "videos", 15);
    if (x.limited)
        return x.limited;
    return Response.json({ video: await addVideo(x.actor, x.input) }, { status: 201, headers: noStore });
}
catch (e) {
    return platformFailure(e);
} }
