"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
type Video = {
    id: string;
    title: string;
    videoId: string;
    sponsorship: string | null;
};
export function VideoEmbed({ video }: {
    video: Video;
}) { const [loaded, setLoaded] = useState(false); if (!/^[\w-]{11}$/.test(video.videoId))
    return <p>Video unavailable.</p>; return <figure className="creator-video"><figcaption>{video.title}{video.sponsorship && <strong> · Sponsored: {video.sponsorship}</strong>}</figcaption>{loaded ? <iframe loading="lazy" src={`https://www.youtube-nocookie.com/embed/${video.videoId}?rel=0&playsinline=1`} title={video.title} sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/> : <Button variant="outline" onClick={() => setLoaded(true)}>Load YouTube player</Button>}<p className="field-help">Loading connects to YouTube. Only link videos you own or have permission to share. <a className="text-link" href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noopener noreferrer">Watch on YouTube</a></p></figure>; }
export function VideoPanel({ kind, id, editable = false }: {
    kind: "POST" | "REVIEW";
    id: string;
    editable?: boolean;
}) {
    const [rows, setRows] = useState<Video[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0), [loading, setLoading] = useState(true);
    useEffect(() => { const c = new AbortController(); fetch(`/api/videos?${new URLSearchParams({ kind, id })}`, { signal: c.signal }).then(async (r) => { const d = await r.json(); if (!r.ok)
        throw Error(d.error ?? "Videos unavailable."); setRows(d.videos); setError(""); }).catch(e => { if (!c.signal.aborted)
        setError(e.message); }).finally(() => { if (!c.signal.aborted)
        setLoading(false); }); return () => c.abort(); }, [kind, id, retry]);
    async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (busy)
        return; setBusy(true); setError(""); const form = e.currentTarget, f = new FormData(form); try {
        const r = await fetch("/api/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, title: f.get("title"), url: f.get("url"), sponsorship: f.get("sponsorship") || null }) });
        const d = await r.json();
        if (!r.ok)
            throw Error(d.fields ? Object.values(d.fields).flat().join(" ") : d.error ?? "Unable to add video.");
        form.reset();
        setRetry(n => n + 1);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Unable to add video.");
    }
    finally {
        setBusy(false);
    } }
    async function remove(videoId: string) { if (busy || !window.confirm("Remove this linked video?"))
        return; setBusy(true); try {
        const r = await fetch(`/api/videos/${videoId}`, { method: "DELETE" });
        if (!r.ok)
            throw Error("Video could not be removed.");
        setRetry(n => n + 1);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Removal failed.");
    }
    finally {
        setBusy(false);
    } }
    return <section className="platform-media" aria-label="Creator videos">{loading && <p role="status">Loading videos…</p>}{rows.map(v => <div key={v.id}><VideoEmbed video={v}/>{editable && <Button variant="outline" disabled={busy} onClick={() => remove(v.id)}>Remove video</Button>}</div>)}{editable && <details className="platform-disclosure"><summary>Link your relevant YouTube video</summary><p className="field-help"><Link href="/account/creator" className="text-link">Set up your creator profile</Link> first. Up to three videos per contribution. TikTok is supported as a profile link, not an embed.</p><form method="post" className="account-form" onSubmit={submit}><label>Video title<input name="title" minLength={3} maxLength={120} required disabled={busy}/></label><label>YouTube URL<input name="url" type="url" required maxLength={500} disabled={busy}/></label><label>Sponsor / paid partnership (leave empty if none)<input name="sponsorship" minLength={2} maxLength={120} disabled={busy}/></label><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Add video"}</Button></form></details>}{error && <div role="alert"><p>{error}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>Retry loading videos</Button></div>}</section>;
}
