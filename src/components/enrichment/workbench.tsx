'use client';
import { useEffect, useState,useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ImageManager } from '@/components/platform/image-manager';
import { ImportReport } from '@/components/data-import/import-report';
import { allAttributes } from '@/lib/product-data/validation';
import type { qualityAssessment } from '@/lib/enrichment/quality';
import type { EnrichmentPlan } from '@/lib/enrichment/plan';
import { EvidencePanel, type Evidence, type Asset } from './evidence-panel';
type Product = {
    id: string;
    slug: string;
    variant: {
        id: string;
        surface: string | null;
        tier: {
            name: string;
        };
    };
};
type Inspection = {
    entry: {
        id: string;
        slug: string;
        outsoleVariantId: string;
        productImages: Asset[];
    };
    batches:{id:string;status:string;startedAt:string}[];
    audit:{id:string;action:string;note:string;details:unknown;createdAt:string}[];
    claims: Evidence[];
    quality: ReturnType<typeof qualityAssessment>;
};
type Source = {
    id: string;
    name: string;
    authorizationStatus: string;
};
type Preview = EnrichmentPlan & {
    ticket: string | null;
};
export function EnrichmentWorkbench() {
    const errorRef=useRef<HTMLParagraphElement>(null);
    const [query, setQuery] = useState(''), [applied, setApplied] = useState(''), [page, setPage] = useState(1), [pages, setPages] = useState(0), [products, setProducts] = useState<Product[]>([]), [sources, setSources] = useState<Source[]>([]), [sourceId, setSourceId] = useState(''), [selected, setSelected] = useState(''), [inspection, setInspection] = useState<Inspection>(), [refresh, setRefresh] = useState(0), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(''), [preview, setPreview] = useState<Preview>(), [request, setRequest] = useState<unknown>(), [intent, setIntent] = useState(''), [confirmed, setConfirmed] = useState(false), [batch, setBatch] = useState(''), [storageConsent, setStorageConsent] = useState(false), [uploadId, setUploadId] = useState(''), [attribute, setAttribute] = useState<string>('upperMaterial'), [unknown, setUnknown] = useState(false);
    useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
    useEffect(() => { const c = new AbortController(); fetch(`/api/admin/products?${new URLSearchParams({ q: applied, page: String(page) })}`, { signal: AbortSignal.any([c.signal,AbortSignal.timeout(15000)]) }).then(async (r) => { const d = await r.json(); if (!r.ok)
        throw Error(d.error ?? 'Product list unavailable.'); if (c.signal.aborted)
        return; setProducts(d.records); setPages(d.pages); setError(''); }).catch(e => { if (!c.signal.aborted)
        setError(e.message); }).finally(() => { if (!c.signal.aborted)
        setLoading(false); }); return () => c.abort(); }, [applied, page, refresh]);
    useEffect(() => { const c = new AbortController(); fetch('/api/admin/product-imports', { signal: AbortSignal.any([c.signal,AbortSignal.timeout(15000)]) }).then(async (r) => { const d = await r.json(); if (!r.ok)
        throw Error(d.error ?? 'Sources unavailable.'); setSources(d.sources); }).catch(e => { if (!c.signal.aborted)
        setError(e.message); }); return () => c.abort(); }, []);
    useEffect(() => { if (!selected)
        return; const c = new AbortController(); fetch(`/api/admin/products/${selected}/enrichment`, { signal: AbortSignal.any([c.signal,AbortSignal.timeout(15000)]) }).then(async (r) => { const d = await r.json(); if (!r.ok)
        throw Error(d.error ?? 'Evidence unavailable.'); if (!c.signal.aborted)
        setInspection(d); }).catch(e => { if (!c.signal.aborted)
        setError(e.message); }); return () => c.abort(); }, [selected, refresh]);
    async function validate(input: unknown) { setBusy(true); setError(''); setSuccess(''); setPreview(undefined); setConfirmed(false); try {
        const r = await fetch('/api/admin/product-enrichments/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(30000) });
        const d = await r.json();
        if (!r.ok)
            throw Error(d.error ?? 'Preview failed.');
        setRequest(input);
        setPreview(d);
        setIntent(crypto.randomUUID());
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Preview failed.');
    }
    finally {
        setBusy(false);
    } }
    async function execute() { if (!preview?.ticket || !confirmed)
        return; setBusy(true); setError(''); try {
        const r = await fetch('/api/admin/product-enrichments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request, ticket: preview.ticket, idempotencyKey: intent, confirmed: true }), signal: AbortSignal.timeout(150000) });
        const d = await r.json();
        if (!r.ok)
            throw Error(d.error ?? 'Save failed.');
        setBatch(d.id);
        setSuccess('Draft observations saved. Verification and publication remain separate.');
        setPreview(undefined);
        setInspection(undefined);
        setLoading(true);
        setRefresh(n => n + 1);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed. Retry the same intent if the result is uncertain.');
    }
    finally {
        setBusy(false);
    } }
    function formPreview(form: HTMLFormElement) {
        if (!inspection)
            return;
        try {
            const f = new FormData(form), sourceUrl = String(f.get('sourceUrl')), observedAt = new Date(String(f.get('observedAt'))).toISOString(), value = unknown ? null : ['weight', 'additionalFeatures'].includes(attribute) ? JSON.parse(String(f.get('value'))) : String(f.get('value'));
            const images = f.get('attachImage') === 'on' ? [{ ...(uploadId ? { uploadedImageId: uploadId } : { externalUrl: String(f.get('externalUrl')) }), sourceUrl, attribution: String(f.get('attribution')), altText: String(f.get('altText')), licenseStatus: String(f.get('licenseStatus')), permissionUrl: String(f.get('permissionUrl')) || null, permissionNotes: String(f.get('permissionNotes')) || null, isPrimary: f.get('isPrimary') === 'on', sortOrder: 0 }] : [];
            void validate({ sourceId, rows: [{ entryId: inspection.entry.id, variantId: inspection.entry.outsoleVariantId, sourceUrl, observedAt, sourceRevision: String(f.get('sourceRevision')) || null, specifications: f.get('includeObservation') === 'on' ? [{ attribute, value, basis: String(f.get('basis')) }] : [], images }] });
        }
        catch {
            setError('Use a valid observation time and JSON for weights or feature lists.');
        }
    }
    return <div className="enrichment-columns"><div><section className="import-panel"><h2>1. Find an exact product</h2><form onSubmit={e => { e.preventDefault(); setApplied(query); setPage(1); setLoading(true); setRefresh(n => n + 1); }}><label htmlFor="enrich-search">Search product slugs</label><input id="enrich-search" type="search" value={query} onChange={e => setQuery(e.target.value)} maxLength={100}/><Button type="submit" disabled={busy}>Search products</Button></form>{loading ? <p role="status">Loading products…</p> : !products.length ? <p>No matching products. Import attributed drafts first.</p> : <ul className="enrichment-claims">{products.map(p => <li key={p.id}><Button variant="outline" disabled={busy} aria-pressed={selected === p.id} onClick={() => { if(selected===p.id)return;setInspection(undefined); setPreview(undefined); setUploadId(''); setSelected(p.id); }}>{p.slug}</Button><p>{p.variant.tier.name} · {p.variant.surface ?? 'Unknown outsole'} · {p.variant.id}</p></li>)}</ul>}<nav aria-label="Product search pages" className="account-actions"><Button variant="outline" disabled={page === 1 || busy} onClick={() => { setLoading(true); setPage(n => n - 1); }}>Previous products</Button><span>Page {page}</span><Button variant="outline" disabled={page >= pages || busy} onClick={() => { setLoading(true); setPage(n => n + 1); }}>Next products</Button></nav><Link className="text-link" href="/admin/products/import">Open import workspace</Link></section>
 <section className="import-panel"><h2>2. Add source-backed observations</h2><p>Choose a documented source. Unknown specifications stay unknown; no URL is downloaded.</p><label htmlFor="enrich-source">Authorized source</label><select id="enrich-source" value={sourceId} disabled={busy} onChange={e => { setSourceId(e.target.value); setPreview(undefined); }}><option value="">Select source</option>{sources.map(s => <option key={s.id} value={s.id} disabled={!['GRANTED', 'NOT_REQUIRED'].includes(s.authorizationStatus)}>{s.name} · {s.authorizationStatus}</option>)}</select>{!sources.length && <p>Register source access and permissions through the D1 source registry API first.</p>}
 {selected && !inspection && <p role="status">Loading product evidence…</p>}{inspection && <><p><strong>{inspection.entry.slug}</strong><br />Exact variant: {inspection.entry.outsoleVariantId}</p><form onSubmit={e => { e.preventDefault(); formPreview(e.currentTarget); }} onChange={() => setPreview(undefined)}><label htmlFor="enrich-url">Evidence URL</label><input id="enrich-url" name="sourceUrl" type="url" required maxLength={2000}/><label htmlFor="enrich-time">Observed at (your local time)</label><input id="enrich-time" name="observedAt" type="datetime-local" required/><label htmlFor="enrich-revision">Document/source revision (optional)</label><input id="enrich-revision" name="sourceRevision" maxLength={200}/><label><input name="includeObservation" type="checkbox" defaultChecked/> Include technical observation</label><label htmlFor="enrich-attribute">Attribute</label><select id="enrich-attribute" value={attribute} onChange={e => setAttribute(e.target.value)}>{allAttributes.map(a => <option key={a}>{a}</option>)}</select><label><input type="checkbox" checked={unknown} onChange={e => setUnknown(e.target.checked)}/> Source explicitly says this attribute is unknown</label><label htmlFor="enrich-value">Observed value</label><textarea id="enrich-value" name="value" disabled={unknown} maxLength={4000} aria-describedby="enrich-value-help"/><p id="enrich-value-help" className="field-help">Weights use JSON: amount, unit (g/oz/kg), size, sizeSystem, and method when measured. Additional features use a JSON string list. Other values are text.</p><label htmlFor="enrich-basis">Evidence basis</label><select id="enrich-basis" name="basis"><option value="REPORTED">Source report</option><option value="MEASURED">Independently measured (describe method)</option><option value="COMMUNITY">Community report</option><option value="EXPERT">Expert opinion</option></select><details><summary>Attach image metadata</summary><label><input name="attachImage" type="checkbox"/> Include product asset</label><p>{uploadId ? `Selected private upload: ${uploadId}` : 'Choose an uploaded image below or enter an authorized external asset URL.'}</p>{uploadId && <Button type="button" variant="outline" onClick={() => { setUploadId(''); setPreview(undefined); }}>Clear image selection</Button>}<label>External image URL<input name="externalUrl" type="url" disabled={!!uploadId} maxLength={2000}/></label><label>Image attribution<input name="attribution" maxLength={300}/></label><label>Alt text<input name="altText" maxLength={300}/></label><label>Usage rights<select name="licenseStatus"><option value="UNKNOWN">Unknown — restricted review only</option><option value="GRANTED">Permission granted</option><option value="DENIED">Permission denied — never public</option></select></label><label>Permission reference URL<input name="permissionUrl" type="url" maxLength={2000}/></label><label>Permission/license notes<textarea name="permissionNotes" maxLength={1000}/></label><label><input name="isPrimary" type="checkbox"/> Primary image (only if none exists)</label></details><Button type="submit" disabled={busy || !sourceId}>{busy ? 'Working…' : 'Preview enrichment'}</Button></form><details><summary>Upload authorized product photos</summary><label><input type="checkbox" checked={storageConsent} onChange={e => setStorageConsent(e.target.checked)}/> I have permission to store these files for review. Public reuse requires documented licensing and verification.</label>{storageConsent && <ImageManager key={selected} kind="PRODUCT" id={selected} editable onSelect={id => { setUploadId(id); setPreview(undefined); }}/>}</details></>}
 <details><summary>Batch enrichment from a D2-format dataset</summary><p>CSV/JSON uses the D2 schema. Only exact existing source-record/SKU identities are accepted; new or ambiguous products are rejected. Maximum 1,000 rows.</p><label>CSV column mapping (JSON, optional)<textarea id="enrich-mapping" defaultValue="{}" aria-label="Batch CSV column mapping"/></label><label htmlFor="enrich-file">Authorized dataset</label><input id="enrich-file" type="file" accept=".csv,.json" disabled={busy || !sourceId} onChange={async (e) => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (!file)
        return; if (file.size > 10 * 1024 * 1024) {
        setError('Maximum file size is 10 MiB.');
        return;
    } setBusy(true); try {
        const mapping = JSON.parse((document.getElementById('enrich-mapping') as HTMLTextAreaElement).value);
        const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
        await validate({ sourceId, feed: { format: file.name.toLowerCase().endsWith('.csv') ? 'CSV' : 'JSON', content, mapping } });
    }
    catch {
        setError('Use valid UTF-8 and a JSON column mapping.');
    }
    finally {
        setBusy(false);
    } }}/></details></section></div>
 <div>{error && <p ref={errorRef} tabIndex={-1} role="alert" className="import-panel">{error}</p>}{success && <p role="status" className="import-panel">{success}</p>}{inspection && <section className="import-panel"><h2>Data quality & freshness</h2><p>{inspection.quality.completeness.technicalPresent} / {inspection.quality.completeness.technicalTotal} technical attributes have observations. {inspection.quality.verification.verifiedClaims} verified claims. Completeness does not establish correctness or fit.</p><p>Publication assessment: {inspection.quality.publication.ready ? 'requirements met' : 'needs review'} (no publication action here).</p><ul>{inspection.quality.issues.map(i => <li key={i}>{i.replaceAll('_', ' ')}</li>)}</ul><details><summary>Missing optional attributes</summary><p>{inspection.quality.completeness.missing.join(', ') || 'None'}</p></details><details><summary>Potentially stale observations ({inspection.quality.stale.length})</summary><ul>{inspection.quality.stale.map((s, i) => <li key={i}>{s.kind} · {s.observedAt.slice(0, 10)} · {s.reason}</li>)}</ul></details><details><summary>Recent enrichment & audit history</summary><ul>{inspection.batches.map(b=><li key={b.id}><Button variant="outline" onClick={()=>setBatch(b.id)}>Open {b.startedAt.slice(0,10)} · {b.status} report</Button></li>)}</ul><ul>{inspection.audit.map(a=><li key={a.id}>{a.createdAt.slice(0,19)} UTC · {a.action}: {a.note}{a.details?<details><summary>Decision history</summary><pre>{JSON.stringify(a.details,null,2)}</pre></details>:null}</li>)}</ul><p>Latest 20 batches/actions. Full batch history is in the import workspace.</p></details></section>}
 {preview && <section className="import-panel" aria-label="Enrichment preview"><h2>3. Review proposed changes</h2><p>{preview.summary.observations} new observations · {preview.summary.conflicts} conflicts · {preview.summary.assets} assets · {preview.summary.noops} no-op rows</p><p>Conflicts retain the incoming evidence in a restricted state. Existing verified values, identity and publication are unchanged.</p>{preview.rows.slice(0, 50).map(r => <details className="import-row" key={r.row}><summary>Row {r.row} · {r.entryId}{r.errors.length ? ' · INVALID' : ''}</summary><pre>{JSON.stringify(r, null, 2)}</pre></details>)}{preview.rows.length > 50 && <p>Showing the first 50 rows. Full row outcomes are available in the saved report.</p>}<label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)}/> I reviewed this exact preview and want to save draft evidence.</label><Button disabled={busy || !confirmed || !preview.ready || !preview.ticket} onClick={execute}>{busy ? 'Saving…' : 'Save draft enrichment'}</Button></section>}
 {inspection && <EvidencePanel key={inspection.entry.id} claims={inspection.claims} images={inspection.entry.productImages} onChange={() => { setPreview(undefined); setInspection(undefined); setLoading(true); setRefresh(n => n + 1); }}/>}{batch && <ImportReport key={batch} id={batch}/>}</div></div>;
}
