"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams,useRouter } from "next/navigation";
import { adminQuery } from "@/lib/platform/validation";
import type { adminData } from "@/lib/platform/moderation";
import { Button } from "@/components/ui/button";
import {AdminFilters} from "./admin-filters";
type Data = Awaited<ReturnType<typeof adminData>>;
export function DecisionForm({ endpoint, verification = false, links = [], done }: {
    endpoint: string;
    verification?: boolean;
    links?: string[];
    done: () => void;
}) {
    const [busy, setBusy] = useState(false), [error, setError] = useState("");
    async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (busy)
        return; const f = new FormData(e.currentTarget); if (!window.confirm("Record this moderation decision? This changes content visibility or creator verification."))
        return; setBusy(true); setError(""); const input = verification ? { status: f.get("action"), note: f.get("note"), ownershipConfirmed: f.get("confirmed") === "on", proofUrl: f.get("proofUrl") || null } : { action: f.get("action"), note: f.get("note") }; try {
        const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }), d = await r.json();
        if (!r.ok)
            throw Error(d.fields ? Object.values(d.fields).flat().join(" ") : d.error ?? "Decision failed.");
        done();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Decision failed.");
    }
    finally {
        setBusy(false);
    } }
    return <form method="post" className="account-form" onSubmit={submit}><label>Decision<select name="action" className="community-select" disabled={busy}>{(verification ? ["REJECTED", "APPROVED"] : ["DISMISS", "HIDE", "RESTORE"]).map(a => <option key={a}>{a}</option>)}</select></label>{verification && <><label>Public profile checked<select name="proofUrl" className="community-select" disabled={busy}><option value="">No ownership proof checked</option>{links.map(u => <option key={u}>{u}</option>)}</select></label><label className="review-consent"><input name="confirmed" type="checkbox" disabled={busy}/>I opened the submitted public profile and verified its exact challenge. A URL alone is insufficient.</label></>}<label>Decision notes<textarea name="note" className="account-textarea" minLength={verification ? 30 : 10} maxLength={1000} required disabled={busy}/></label><Button type="submit" disabled={busy}>{busy ? "Recording…" : "Record decision"}</Button>{error && <p role="alert">{error}</p>}</form>;
}
export function AdminDashboard() {
    const params=useSearchParams(),router=useRouter();
    const parsed=adminQuery.safeParse(Object.fromEntries(params));
    const filters=parsed.success?parsed.data:adminQuery.parse({});
    const [data,setData]=useState<Data>(),[error,setError]=useState(""),[completed,setCompleted]=useState(""),[retry,setRetry]=useState(0),[success,setSuccess]=useState("");
    function setFilters(next: typeof filters | ((previous: typeof filters)=>typeof filters)){const f=typeof next==="function"?next(filters):next;const nextQuery=new URLSearchParams({...f,page:String(f.page)}).toString();if(nextQuery!==query)router.push(`/admin?${nextQuery}`,{scroll:false});}
    const query = new URLSearchParams({ ...filters, page: String(filters.page) }).toString();
    const requestKey=`${query}:${retry}`,loading=completed!==requestKey;
    useEffect(() => { const c = new AbortController(); fetch(`/api/admin?${query}`, { signal: AbortSignal.any([c.signal,AbortSignal.timeout(15_000)]) }).then(async (r) => { const d = await r.json(); if(c.signal.aborted)return; if (!r.ok)
        throw Error(d.error ?? "Dashboard unavailable."); setData(d); setError(""); }).catch(e => { if (!c.signal.aborted)
        setError(e.message); }).finally(() => { if (!c.signal.aborted)
        setCompleted(requestKey); }); return () => c.abort(); }, [query, retry, requestKey]);
    const refresh = () => { setSuccess("Decision recorded."); setRetry(n => n + 1); };
    return <><p role="status">{success}</p>{loading && <p role="status">Loading moderation queue…</p>}{error && <p role="alert">{error}</p>}<Button variant="outline" onClick={() => setRetry(n => n + 1)}>Refresh dashboard</Button>{data && <><dl className="review-criteria">{Object.entries(data.overview).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><h2>Reports ({data.total})</h2><AdminFilters filters={filters} onApply={setFilters}/>{!data.reports.length && <p>No reports in this view.</p>}{data.reports.map(r => <article className="review-card" key={r.id}><h3>{r.targetKey}</h3><p>{r.reason} · {r.status} · {new Date(r.createdAt).toLocaleDateString("en-GB", { timeZone: "UTC" })}</p><p className="review-text">{r.explanation}</p><details><summary>Review reported content</summary><p className="review-text">{r.post?.content ?? r.comment?.content ?? r.review?.experience ?? r.creator?.specialization ?? "Image: inspect the protected image preview below."}</p>{r.review && <div className="review-text"><p>Pros: {r.review.pros}</p><p>Cons: {r.review.cons}</p></div>}{r.creator && <p className="review-text">{r.creator.user.profile?.displayName}: {r.creator.user.profile?.bio}</p>}{(r.post?.images ?? r.review?.images ?? r.creator?.images ?? []).map((image,i)=><a key={image.id} className="text-link" href={`/api/images/${image.id}`} target="_blank" rel="noopener noreferrer">Inspect attached image {i+1}</a>)}{r.targetKey.startsWith("IMAGE:") && <a className="text-link" target="_blank" rel="noopener noreferrer" href={`/api/images/${r.targetKey.slice(6)}`}>Open protected image preview</a>}</details><DecisionForm endpoint={`/api/admin/reports/${r.id}`} done={refresh}/></article>)}<h2>Creator verification applications</h2>{!data.verification.length && <p>No pending applications in this view, or administrator access is required.</p>}{data.verification.map(r => <article className="review-card" key={r.id}><h3>{r.creator.user.profile?.displayName} (@{r.creator.user.profile?.username})</h3><p>Public bio must contain this exact challenge:</p><code className="review-text">{r.challenge}</code>{[r.youtube, r.tiktok, r.instagram].filter((x): x is string => !!x).map(u => <a className="text-link review-text" target="_blank" rel="noopener noreferrer" href={u} key={u}>{u}</a>)}<DecisionForm endpoint={`/api/admin/verification/${r.id}`} verification links={[r.youtube, r.tiktok, r.instagram].filter((x): x is string => !!x)} done={refresh}/></article>)}<h2>Creator verification decision history</h2>{data.verificationHistory.map(h=><article className="review-card" key={h.id}><p>{h.status} · @{h.request.creator.user.profile?.username}</p><time dateTime={String(h.createdAt)}>{new Date(h.createdAt).toISOString()}</time><p className="review-text">{h.note}</p>{h.proofUrl&&<a className="text-link review-text" href={h.proofUrl} target="_blank" rel="noopener noreferrer">Public proof profile</a>}</article>)}<h2>Moderation audit history</h2>{!data.history.length && <p>No moderation decisions recorded yet.</p>}{data.history.map(h => <article className="review-card" key={h.id}><p>{h.action} · {h.targetKey} · {h.actor?.profile?.username ?? "Former moderator"}</p><time dateTime={String(h.createdAt)}>{new Date(h.createdAt).toISOString()}</time><p className="review-text">{h.note}</p></article>)}<nav aria-label="Admin pagination" className="account-actions"><Button variant="outline" disabled={filters.page === 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>Previous</Button><span>Page {filters.page}</span><Button variant="outline" disabled={filters.page >= Math.max(data.pages, data.auditPages, data.verificationPages)} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Next</Button></nav></>}</>;
}
