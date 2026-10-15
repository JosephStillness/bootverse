import sharp from "sharp";
export async function processImage(input: Buffer, maxBytes: number) {
    if (!input.length || input.length > maxBytes)
        throw Error("Image exceeds the upload limit.");
    const jpeg = input[0] === 255 && input[1] === 216 && input[2] === 255;
    const png = input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp = input.toString("ascii", 0, 4) === "RIFF" && input.toString("ascii", 8, 12) === "WEBP";
    if (!jpeg && !png && !webp)
        throw Error("Choose a JPEG, PNG or WebP image.");
    try {
        const image = sharp(input, { limitInputPixels: 20000000, failOn: "warning" });
        const meta = await image.metadata();
        if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || (meta.pages ?? 1) > 1)
            throw Error("Unsupported image.");
        const { data, info } = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).timeout({ seconds: 5 }).toBuffer({ resolveWithObject: true });
        return { buffer: data, width: info.width, height: info.height };
    }
    catch {
        throw Error("Image is malformed, animated, or too large to process safely.");
    }
}
