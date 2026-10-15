"use client";
import Image from "next/image";
import { useEffect, useRef, useState, useId, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import type { ImageTarget } from "@/lib/platform/validation";
import { ReportControl } from "./report-control";
type Stored = {
    id: string;
    width: number;
    height: number;
    status: string;
    state: string;
};
type Preview = {
    file: File;
    url: string;
};
export function ImageManager({ kind, id, editable = false }: {
    kind: ImageTarget["kind"];
    id: string;
    editable?: boolean;
}) {
    const inputId = useId(), queue = useRef<Preview[]>([]), lock = useRef(false);
    const [selected, setSelected] = useState<Preview[]>([]), [images, setImages] = useState<Stored[]>([]), [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState(""), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0), [limits, setLimits] = useState({ bytes: 5 * 1024 * 1024, quantity: 4 });
    const endpoint = `/api/images?${new URLSearchParams({ kind, id })}`;
    useEffect(() => { const c = new AbortController(); fetch(endpoint, { signal: c.signal }).then(async (r) => { const d = await r.json(); if (!r.ok)
        throw Error(d.error ?? "Images are unavailable."); setImages(d.images); setLimits(d.limits); setError(""); }).catch(e => { if (!c.signal.aborted)
        setError(e.message); }).finally(() => { if (!c.signal.aborted)
        setLoading(false); }); return () => c.abort(); }, [endpoint, retry]);
    useEffect(() => () => { queue.current.forEach(x => URL.revokeObjectURL(x.url)); }, []);
    function pick(files: FileList | File[] | null) { if (!files || busy)
        return; setError(""); const available = (kind === "AVATAR" || kind === "COVER" ? 1 : limits.quantity) - images.length - selected.length; if (files.length > available) {
        setError(`Select at most ${Math.max(0, available)} more images. Remove existing images to replace them.`);
        return;
    } const next: Preview[] = []; for (const file of Array.from(files)) {
        if (file.size > limits.bytes) {
            next.forEach(x => URL.revokeObjectURL(x.url));
            setError(`Each image must be at most ${Math.round(limits.bytes / 1024 / 1024)} MB.`);
            return;
        }
        next.push({ file, url: URL.createObjectURL(file) });
    } queue.current = [...queue.current, ...next]; setSelected(queue.current); }
    function removePreview(index: number) { URL.revokeObjectURL(queue.current[index].url); queue.current = queue.current.filter((_, i) => i !== index); setSelected(queue.current); }
    async function upload() { if (lock.current)
        return; lock.current = true; setBusy(true); setError(""); try {
        for (const x of [...queue.current]) {
            setProgress(0);
            await new Promise<void>((resolve, reject) => { const xhr = new XMLHttpRequest(); xhr.open("POST", endpoint); xhr.timeout = 60000; xhr.upload.onprogress = e => { if (e.lengthComputable)
                setProgress(Math.round(e.loaded / e.total * 100)); }; xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300)
                resolve();
            else {
                let message = "Upload failed. Storage may not be configured.";
                try {
                    message = JSON.parse(xhr.responseText).error ?? message;
                }
                catch { }
                reject(Error(message));
            } }; xhr.onerror = () => reject(Error("Connection lost during upload.")); xhr.ontimeout = () => reject(Error("Upload timed out. Refresh before retrying to check whether it completed.")); xhr.send(x.file); });
            URL.revokeObjectURL(x.url);
            queue.current = queue.current.filter(p => p !== x);
            setSelected([...queue.current]);
            setRetry(n => n + 1);
        }
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
    }
    finally {
        setBusy(false);
        lock.current = false;
    } }
    async function remove(id: string) { if (lock.current || !window.confirm("Remove this image?"))
        return; lock.current = true; setBusy(true); setError(""); try {
        const r = await fetch(`/api/images/${id}`, { method: "DELETE" });
        if (!r.ok)
            throw Error("Unable to remove image.");
        setRetry(x => x + 1);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Removal failed.");
    }
    finally {
        setBusy(false);
        lock.current = false;
    } }
    function drop(e: DragEvent) { e.preventDefault(); pick(e.dataTransfer.files); }
    return <section className="platform-media" aria-label={`${kind.toLowerCase()} images`}>
    {loading && <p role="status">Loading images…</p>}
    {!loading && !error && !images.length && !editable && <p className="field-help">No photos shared yet.</p>}
    <div className="platform-image-grid">{images.map((image, i) => <figure key={image.id}>{image.state === "READY" ? <Image src={`/api/images/${image.id}`} alt={`Community photo ${i + 1}`} width={image.width} height={image.height} unoptimized loading="lazy"/> : <p>Image processing did not finish. Remove it and retry.</p>}{image.status === "HIDDEN" && <figcaption>Hidden by moderation</figcaption>}{editable ? <Button variant="outline" disabled={busy} onClick={() => remove(image.id)}>Remove image {i + 1}</Button> : <ReportControl kind="IMAGE" id={image.id}/>}</figure>)}</div>
    {editable && <div className="upload-zone" onDragOver={e => e.preventDefault()} onDrop={drop}><label htmlFor={inputId}>Choose photos or drop them here</label><input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" multiple={kind === "POST" || kind === "REVIEW"} disabled={busy} onChange={e => { pick(e.currentTarget.files); e.currentTarget.value = ""; }}/><p className="field-help">JPEG, PNG or WebP. Metadata is removed. Photos attach to this saved content. Remove an existing avatar/cover to replace it.</p><div className="platform-image-grid">{selected.map((x, i) => <figure key={x.url}><Image src={x.url} alt={`Selected photo ${i + 1}`} width={240} height={180} unoptimized/><Button variant="outline" disabled={busy} onClick={() => removePreview(i)}>Remove selected photo {i + 1}</Button></figure>)}</div>{selected.length > 0 && <Button disabled={busy} onClick={upload}>{busy ? "Uploading / processing…" : "Upload selected photos"}</Button>}{busy && <progress aria-label="Upload progress" value={progress} max={100}/>}</div>}
    {error && <div role="alert"><p>{error}</p><Button variant="outline" onClick={() => { setLoading(true); setRetry(x => x + 1); }}>Retry loading images</Button></div>}
  </section>;
}
