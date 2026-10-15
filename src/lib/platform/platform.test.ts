import { describe, it, expect } from "vitest";
import { youtubeId, creatorSchema, reportSchema, verificationDecisionSchema } from "./validation";
import { processImage } from "./image-processing";
import sharp from "sharp";
describe("creator and moderation boundaries", () => {
    it("accepts canonical YouTube IDs from supported URL forms", () => {
        for (const url of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://youtube.com/shorts/dQw4w9WgXcQ"])
            expect(youtubeId(url)).toBe("dQw4w9WgXcQ");
    });
    it.each(["https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ", "javascript:alert(1)", "http://youtube.com/watch?v=dQw4w9WgXcQ", "https://user@youtube.com/watch?v=dQw4w9WgXcQ", "https://tiktok.com/@test", "https://youtube.com/watch?v=../bad"])("rejects unsafe video URL %s", url => expect(() => youtubeId(url)).toThrow());
    it("allows international creator context but rejects forged verification and unsafe links", () => {
        const base = { specialization: "Đánh giá giày", region: "Việt Nam", youtube: null, tiktok: null, instagram: null, website: null };
        expect(creatorSchema.parse(base).region).toBe("Việt Nam");
        expect(creatorSchema.safeParse({ ...base, website: "javascript:alert(1)" }).success).toBe(false);
        expect(creatorSchema.safeParse({ ...base, youtube: "https://youtube.com.evil.test/@test" }).success).toBe(false);
        expect(creatorSchema.safeParse({ ...base, verificationStatus: "APPROVED" }).success).toBe(false);
    });
    it("requires a valid reason and explicit proof confirmation", () => {
        expect(reportSchema.safeParse({ kind: "POST", id: "p", reason: "made-up" }).success).toBe(false);
        expect(verificationDecisionSchema.safeParse({ status: "APPROVED", note: "Checked", ownershipConfirmed: false, proofUrl: "https://youtube.com/@test" }).success).toBe(false);
    });
});
describe("image processing", () => {
    it("decodes supported signatures and strips metadata by re-encoding", async () => {
        const source = await sharp({ create: { width: 20, height: 20, channels: 3, background: "red" } }).jpeg().withMetadata({ exif: { IFD0: { Artist: "Private test metadata" } } }).toBuffer();
        const output = await processImage(source, 1024 * 1024);
        const meta = await sharp(output.buffer).metadata();
        expect(meta.format).toBe("webp");
        expect(meta.exif).toBeUndefined();
        expect(output.width).toBe(20);
    });
    it("rejects spoofed, malformed, oversized and excessive-pixel inputs", async () => {
        await expect(processImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 1000)).rejects.toThrow();
        await expect(processImage(Buffer.from([255, 216, 255, 0]), 1000)).rejects.toThrow();
        await expect(processImage(Buffer.alloc(1001), 1000)).rejects.toThrow();
        const bomb = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: "white" } }).png().toBuffer();
        await expect(processImage(bomb, 5 * 1024 * 1024)).rejects.toThrow();
    });
});
