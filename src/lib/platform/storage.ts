import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
export function uploadLimits() {
    const integer = (name: string, fallback: number, max: number) => { const n = Number(process.env[name] ?? fallback); if (!Number.isSafeInteger(n) || n < 1 || n > max)
        throw Error("Invalid storage limit configuration."); return n; };
    return { bytes: integer("UPLOAD_MAX_BYTES", 5 * 1024 * 1024, 10 * 1024 * 1024), quantity: integer("UPLOAD_MAX_PER_CONTENT", 4, 8), ownerQuantity: integer("UPLOAD_MAX_PER_USER", 100, 1000), ownerBytes: integer("UPLOAD_USER_QUOTA_BYTES", 100 * 1024 * 1024, 1024 * 1024 * 1024) };
}
export function storage() {
    const { S3_ENDPOINT: endpoint, S3_BUCKET: bucket, S3_ACCESS_KEY_ID: accessKeyId, S3_SECRET_ACCESS_KEY: secretAccessKey } = process.env;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey)
        throw Error("Image storage is not configured.");
    const u = new URL(endpoint);
    if (u.username || u.password || u.search || u.hash || (u.protocol !== "https:" && !(u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname))))
        throw Error("Unsafe storage endpoint configuration.");
    const client = new S3Client({ endpoint, region: process.env.S3_REGION ?? "us-east-1", forcePathStyle: true, credentials: { accessKeyId, secretAccessKey }, maxAttempts: 2 });
    return {
        async put(key: string, body: Buffer) { await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "image/webp", CacheControl: "private, no-store" }), { abortSignal: AbortSignal.timeout(20000) }); },
        async get(key: string) { const r = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: AbortSignal.timeout(20000) }); return r.Body?.transformToByteArray(); },
        async remove(key: string) { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: AbortSignal.timeout(20000) }); },
    };
}
