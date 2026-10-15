import { currentUser } from "@/lib/accounts/service";
import { platformFailure } from "@/lib/platform/http";
import { imageTargetSchema, listImages, uploadImage, imageBytes } from "@/lib/platform/images";
import { platformActor, noStore } from "@/lib/platform/http";
import { uploadLimits } from "@/lib/platform/storage";
export const runtime = "nodejs";
export async function GET(request: Request) { try {
    return Response.json({ images: await listImages(imageTargetSchema.parse(Object.fromEntries(new URL(request.url).searchParams)), await currentUser()), limits: uploadLimits() }, { headers: noStore });
}
catch (e) {
    return platformFailure(e);
} }
export async function POST(request: Request) { try {
    const r = await platformActor(request, "images", 20);
    if (r.limited)
        return r.limited;
    const target = imageTargetSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const bytes = await imageBytes(request, uploadLimits().bytes);
    return Response.json({ image: await uploadImage(await currentUser(), target, bytes) }, { status: 201, headers: noStore });
}
catch (e) {
    return platformFailure(e);
} }
