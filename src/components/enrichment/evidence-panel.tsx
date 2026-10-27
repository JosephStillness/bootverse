'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { canTransitionClaim, claimStates } from '@/lib/product-data/validation';
export type Evidence = {
    id: string;
    attribute: string;
    value: unknown;
    status: typeof claimStates[number];
    version: number;
    sourceUrl: string;
    sourceRevision: string | null;
    observedAt: string;
    originalObservation: unknown;
    source: {
        name: string;
        type: string;
    };
};
export type Asset = {
    permissionUrl?:string|null;permissionNotes?:string|null;
    id: string;
    altText: string;
    sortOrder: number;
    isPrimary: boolean;
    status: typeof claimStates[number];
    version: number;
    licenseStatus: string;
    sourceUrl: string;
    uploadedImageId: string | null;
};
export function EvidencePanel({ claims, images, onChange }: {
    claims: Evidence[];
    images: Asset[];
    onChange: () => void;
}) {
    const [note, setNote] = useState(''), [checked, setChecked] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [page, setPage] = useState(1);
    async function mutate(path: string, body: unknown) { setBusy(true); setError(''); try {
        const r = await fetch(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
        const d = await r.json();
        if (!r.ok)
            throw Error(d.error ?? 'Change failed.');
        onChange();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Change failed.');
    }
    finally {
        setBusy(false);
    } }
    return <section className="import-panel"><h2>Evidence & conflicts</h2><p>Observations are immutable. Corrections add another observation. Source verification does not certify physical fit or independent measurement.</p><label htmlFor="evidence-note">Decision note (at least 10 characters)</label><textarea id="evidence-note" value={note} onChange={e => setNote(e.target.value)} maxLength={1000}/><label><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}/> I checked this observation or asset against its cited source and permissions.</label>{error && <p role="alert">{error}</p>}<ul className="enrichment-claims">{claims.slice((page - 1) * 25, page * 25).map(c => <li key={c.id}><strong>{c.attribute} · {c.status.replaceAll('_', ' ')}</strong><pre>{JSON.stringify(c.value, null, 2)}</pre><a href={c.sourceUrl} className="text-link" target="_blank" rel="noopener noreferrer">{c.source.name} · {c.source.type}</a><p>Observed {c.observedAt.slice(0, 10)}{c.sourceRevision ? ` · revision ${c.sourceRevision}` : ''}</p><details><summary>Original observation & normalization</summary><pre>{JSON.stringify(c.originalObservation, null, 2)}</pre></details><div className="account-actions">{claimStates.filter(s => canTransitionClaim(c.status, s)).map(status => <Button key={status} variant="outline" disabled={busy || note.trim().length < 10 || (status === 'VERIFIED' && !checked)} onClick={() => mutate(`/api/admin/product-claims/${c.id}`, { version: c.version, status, note, sourceChecked: checked })}>{status.replaceAll('_', ' ')}</Button>)}</div></li>)}</ul>{!claims.length && <p>No structured observations yet.</p>}<nav aria-label="Evidence pagination" className="account-actions"><Button variant="outline" disabled={page === 1} onClick={() => setPage(n => n - 1)}>Previous evidence</Button><span>Page {page}</span><Button variant="outline" disabled={page * 25 >= claims.length} onClick={() => setPage(n => n + 1)}>Next evidence</Button></nav><h3>Product assets</h3>{images.map(image => <div className="import-row" key={image.id}><p>{image.altText} · {image.status} · rights: {image.licenseStatus}</p><a href={image.sourceUrl} className="text-link" target="_blank" rel="noopener noreferrer">Asset source</a><form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void mutate(`/api/admin/product-images/${image.id}/presentation`, { version: image.version, altText: f.get('altText'), sortOrder: Number(f.get('sortOrder')), isPrimary: f.get('primary') === 'on' }); }}><label>Alt text<input name="altText" defaultValue={image.altText} required maxLength={300}/></label><label>Order<input name="sortOrder" type="number" min="0" max="1000" defaultValue={image.sortOrder} required/></label><label><input name="primary" type="checkbox" defaultChecked={image.isPrimary}/> Primary product image</label><Button type="submit" variant="outline" disabled={busy}>Save image presentation</Button></form><details><summary>Update usage permission</summary><p>Saving rights returns the asset to UNVERIFIED and removes it from public display until checked again. The original decision remains in audit history.</p><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void mutate(`/api/admin/product-images/${image.id}/rights`,{version:image.version,licenseStatus:f.get('licenseStatus'),permissionUrl:String(f.get('permissionUrl'))||null,permissionNotes:String(f.get('permissionNotes'))||null,note:f.get('note')});}}><label>Permission status<select name="licenseStatus" defaultValue={image.licenseStatus}><option value="UNKNOWN">Unknown</option><option value="GRANTED">Granted</option><option value="DENIED">Denied</option></select></label><label>Permission reference<input name="permissionUrl" type="url" defaultValue={image.permissionUrl??''} maxLength={2000}/></label><label>Permission evidence<textarea name="permissionNotes" defaultValue={image.permissionNotes??''} maxLength={1000}/></label><label>Reason for rights update<textarea name="note" minLength={10} maxLength={1000} required/></label><Button type="submit" variant="outline" disabled={busy}>Save permission for review</Button></form></details><div className="account-actions">{claimStates.filter(s => canTransitionClaim(image.status, s)).map(status => <Button key={status} variant="outline" disabled={busy || note.trim().length < 10 || (status === 'VERIFIED' && (!checked || image.licenseStatus !== 'GRANTED'))} onClick={() => mutate(`/api/admin/product-images/${image.id}`, { version: image.version, status, note, sourceChecked: checked })}>{status.replaceAll('_', ' ')}</Button>)}</div></div>)}{!images.length && <p>No product asset metadata.</p>}</section>;
}
