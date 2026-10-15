"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { creatorSchema } from "@/lib/platform/validation";
import { ImageManager } from "./image-manager";
type Creator = {
    id: string;
    region: string | null;
    specialization: string;
    youtube: string | null;
    tiktok: string | null;
    instagram: string | null;
    website: string | null;
    verificationStatus: string;
    requests: {
        id: string;
        status: string;
        challenge: string;
        decisions: {
            status: string;
            note: string;
        }[];
    }[];
};
export function CreatorForm({ creator }: {
    creator: Creator | null;
}) {
    const router = useRouter(), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [fields, setFields] = useState<Record<string, string[] | undefined>>({});
    async function save(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (busy)
        return; setMessage(""); setFields({}); const f = new FormData(e.currentTarget), parsed = creatorSchema.safeParse(Object.fromEntries(Object.keys(creatorSchema.shape).map(k => [k, f.get(k) || null]))); if (!parsed.success) {
        setFields(parsed.error.flatten().fieldErrors);
        return;
    } setBusy(true); try {
        const r = await fetch("/api/creators/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
        const d = await r.json();
        if (!r.ok) {
            setFields(d.fields ?? {});
            throw Error(d.error ?? "Profile could not be saved.");
        }
        setMessage("Creator profile saved.");
        router.refresh();
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : "Save failed.");
    }
    finally {
        setBusy(false);
    } }
    async function apply() { if (busy)
        return; setBusy(true); try {
        const r = await fetch("/api/creators/me/verification", { method: "POST" }), d = await r.json();
        if (!r.ok)
            throw Error(d.error ?? "Application failed.");
        setMessage("Application submitted. Follow the ownership proof instructions below.");
        router.refresh();
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : "Application failed.");
    }
    finally {
        setBusy(false);
    } }
    return <><p className="field-help">Your existing <Link className="text-link" href="/account">member display name, username, avatar and biography</Link> are reused. Social links are public. Changing social links revokes verification until ownership is checked again.</p><form method="post" onSubmit={save} className="account-form">{Object.keys(creatorSchema.shape).map(k => <label key={k}>{k === "region" ? "Country or region (optional)" : k === "specialization" ? "Specialization" : `${k} URL (optional)`}<input name={k} type={["youtube", "tiktok", "instagram", "website"].includes(k) ? "url" : "text"} defaultValue={String(creator?.[k as keyof Creator] ?? "")} maxLength={k === "specialization" || k === "region" ? 80 : 500} required={k === "specialization"} disabled={busy} aria-invalid={!!fields[k]} aria-describedby={`creator-${k}-error`}/><span id={`creator-${k}-error`} role="alert" className="field-error">{fields[k]?.[0]}</span></label>)}<Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save creator profile"}</Button></form><p role="status">{message}</p>{creator && <><h2>Cover image</h2><ImageManager kind="COVER" id={creator.id} editable/><h2>Creator ownership verification</h2><p>Status: {creator.verificationStatus.toLowerCase()}</p><p className="field-help">An administrator must see your unique challenge on one of your submitted public social profiles. Verification checks account ownership, not review accuracy or purchase history. Never submit passwords or private account screenshots.</p>{creator.verificationStatus !== "APPROVED" && <Button variant="outline" disabled={busy} onClick={apply}>Request verification</Button>}{creator.requests.map(r => <section key={r.id} className="account-security"><h3>Application: {r.status.toLowerCase()}</h3>{r.status === "PENDING" && <><p>Add this exact challenge to the public bio/description of a submitted social profile, then leave it there until review:</p><code className="review-text">{r.challenge}</code></>}{r.decisions.map((d, i) => <p key={i}>{d.status.toLowerCase()}: {d.note}</p>)}</section>)}</>}</>;
}
