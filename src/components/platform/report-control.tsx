"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { reportReasons, type TargetKind } from "@/lib/platform/validation";
import { Button } from "@/components/ui/button";
export function ReportControl({ kind, id }: {
    kind: TargetKind;
    id: string;
}) {
    const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
    const path = usePathname();
    async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (busy)
        return; setBusy(true); setMessage(""); const f = new FormData(e.currentTarget); try {
        const r = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, reason: f.get("reason"), explanation: f.get("explanation") || null }) });
        const d = await r.json();
        setMessage(r.ok ? (d.report.duplicate ? "You already reported this content. Your existing report is unchanged." : "Report received. A moderator will review it.") : d.error ?? "Report could not be submitted.");
    }
    catch {
        setMessage("Connection lost. Please try again.");
    }
    finally {
        setBusy(false);
    } }
    return <details className="platform-disclosure"><summary>Report {kind.toLowerCase()}</summary><form method="post" onSubmit={submit} className="account-form"><label>Reason<select name="reason" className="community-select" disabled={busy}>{reportReasons.map(r => <option key={r} value={r}>{r.replaceAll("-", " ")}</option>)}</select></label><label>Explanation (optional)<textarea name="explanation" maxLength={1000} className="account-textarea" disabled={busy}/></label><p className="field-help">Reports do not automatically remove content. <Link className="text-link" href={`/login?callbackUrl=${encodeURIComponent(path)}`}>Sign in</Link> to report.</p><Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit report"}</Button><p role="status">{message}</p></form></details>;
}
