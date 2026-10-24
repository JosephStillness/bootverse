import { z } from "zod";
import { text } from "@/lib/community/validation";
export const targetKinds = ["POST", "COMMENT", "REVIEW", "IMAGE", "CREATOR"] as const;
export type TargetKind = typeof targetKinds[number];
export const targetSchema = z.object({ kind: z.enum(targetKinds), id: text(1, 100) }).strict();
export const imageTargetSchema = z.object({ kind: z.enum(["POST", "REVIEW", "AVATAR", "COVER", "PRODUCT"]), id: text(1, 100) }).strict();
export type ImageTarget = z.infer<typeof imageTargetSchema>;
export const reportReasons = ["spam", "harassment", "offensive", "misleading-review", "copyright", "inappropriate-image", "other"] as const;
export const reportSchema = targetSchema.extend({ reason: z.enum(reportReasons), explanation: text(1, 1000).nullable().default(null) }).strict();
export function secureUrl(value: string, hosts?: readonly string[]) {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || u.port || u.hash || (hosts && !hosts.includes(u.hostname)))
        throw Error("Use a supported public HTTPS URL.");
    if (!hosts && (u.hostname === "localhost" || !u.hostname.includes(".") || /^[\d.]+$/.test(u.hostname) || u.hostname.includes(":")))
        throw Error("Use a public website URL.");
    return u.href;
}
function social(hosts?: readonly string[]) { return z.string().trim().max(500).transform((v, ctx) => { try {
    return secureUrl(v, hosts);
}
catch {
    ctx.addIssue({ code: "custom", message: "Use a valid HTTPS URL for this provider." });
    return z.NEVER;
} }).nullable().default(null); }
export const creatorSchema = z.object({ region: text(1, 80).nullable().default(null), specialization: text(2, 80), youtube: social(["youtube.com", "www.youtube.com"]), tiktok: social(["tiktok.com", "www.tiktok.com"]), instagram: social(["instagram.com", "www.instagram.com"]), website: social() }).strict();
export function youtubeId(value: string) {
    const u = new URL(secureUrl(value, ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]));
    const id = u.hostname === "youtu.be" ? u.pathname.slice(1) : u.pathname === "/watch" ? u.searchParams.get("v") : /^\/(shorts|embed)\/[^/]+$/.test(u.pathname) ? u.pathname.split("/")[2] : null;
    if (!id || !/^[\w-]{11}$/.test(id))
        throw Error("Use a valid YouTube video URL.");
    return id;
}
export const videoSchema = z.object({ kind: z.enum(["POST", "REVIEW"]), id: text(1, 100), url: z.string().max(500).transform((v, ctx) => { try {
        return youtubeId(v);
    }
    catch {
        ctx.addIssue({ code: "custom", message: "Use a valid YouTube video URL." });
        return z.NEVER;
    } }), title: text(3, 120), sponsorship: text(2, 120).nullable().default(null) }).strict();
export const moderationSchema = z.object({ action: z.enum(["HIDE", "RESTORE", "DISMISS"]), note: text(10, 1000) }).strict();
export const verificationDecisionSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]), note: text(30, 1000), ownershipConfirmed: z.boolean(), proofUrl: social(["youtube.com", "www.youtube.com", "tiktok.com", "www.tiktok.com", "instagram.com", "www.instagram.com"]) }).strict().refine(v => v.status !== "APPROVED" || (v.ownershipConfirmed && !!v.proofUrl), { message: "Approval requires checked ownership proof and a public proof URL." });
export const directoryQuery = z.object({ q: z.string().trim().max(100).default(""), specialization: z.string().trim().max(80).default(""), page: z.coerce.number().int().min(1).max(1000).default(1) });
export const adminQuery = z.object({ q: z.string().trim().max(100).default(""), kind: z.union([z.enum(targetKinds), z.literal("")]).default(""), status: z.enum(["OPEN", "ACTIONED", "DISMISSED", "ALL"]).default("OPEN"), page: z.coerce.number().int().min(1).max(1000).default(1) });
export function queryObject(params: URLSearchParams) { return Object.fromEntries(params); }
