'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, ReasonField, date, newRequestId, safeHref, send, words, type Issue } from './shared';

type Source = { name: string; type: string; status: string; authorizationStatus: string };
type Claim = { id: string; version: number; attribute: string; value: unknown; status: string; basis: string; scope: 'ENTRY' | 'VARIANT'; sourceUrl: string; observedAt: string; reviewedAt: string | null; source: Source };
type Attr = { attribute: string; value: string; sourceName: string; sourceType: string; basis: string; sourceUrl: string };
type Snapshot = { slug: string; sample: boolean; identity: Record<string, string | null>; identifiers: string[]; attributes: Attr[]; images: { id: string; altText: string; attribution: string }[] };
export type ReviewData = {
  id: string; slug: string; status: string; version: number; sample: boolean; submittedAt: string | null; fingerprint: string;
  identity: { brand?: string; family?: string; generation?: string; tier?: string; outsole: string | null; manufacturerOutsole: string | null; colorway?: string; swatch: string | null; variantId: string; identifiers: { id: string; value: string; region: string }[]; reviewsOnVariant: number };
  source: { id: string; name: string; type: string; baseUrl: string; authorizationStatus: string; usageRestrictions: string | null; lastCheckedAt: string | null } | null;
  evaluation: { readiness: string; issues: Issue[]; dimensions: Record<string, 'PASS' | 'WARN' | 'FAIL'>; counts: { blocking: number; warnings: number; information: number } };
  claims: Claim[]; conflicts: { attribute: string; claims: Claim[] }[];
  images: { id: string; altText: string; attribution: string; sourceUrl: string; isPrimary: boolean; status: string; licenseStatus: string; rights: string; publicEligible: boolean; src: string | null; externalUrl: string | null; usageRestrictions: string | null }[];
  duplicates: { candidateId: string; slug: string; status: string; relation: string; skuCaseCollision?: boolean; detail: { variant: { surface: string | null; tier: { name: string; generation: { name: string } } }; colorway: { name: string } } | null }[];
  staged: { id: string; outcome: string; action: string; diagnostics: unknown; sourceUrl: string | null; createdAt: string; batch: { id: string; source: { name: string } } }[];
  published: { revision: number; snapshot: Snapshot; createdAt: string } | null; preview: Snapshot; previewChanged: boolean | null;
  proposed: { id: string; attribute: string; value: unknown; status: string; sourceName: string; sourceType: string; sourceUrl: string }[];
  history: { id: string; kind: string; fromStatus: string | null; toStatus: string | null; reason: string; createdAt: string; actor: { name: string | null } | null }[];
  revisions: { id: string; revision: number; reason: string; createdAt: string; actor: string | null }[];
  sources: { id: string; name: string; type: string }[];
  syncChanges: { id: string; kind: string; severity: string; disposition: string; attribute: string | null; previousValue: unknown; proposedValue: unknown; claimId: string | null; lastSeenAt: string; source: { name: string; type: string } }[];
};

const label = (attribute: string) => words(attribute.replace(/([A-Z])/g, '_$1'));
export function showValue(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    if (v.unknown === true) return 'Explicitly unknown';
    if ('amount' in v && 'unit' in v) return `${v.amount} ${v.unit} · ${v.sizeSystem} ${v.size}${v.method ? ` · ${v.method}` : ''}`;
    return JSON.stringify(value);
  }
  return Array.isArray(value) ? value.join(', ') : String(value);
}
function SourceLink({ url, children }: { url: string; children: React.ReactNode }) {
  const href = safeHref(url);
  return href ? <a className="text-link" href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>;
}

export function SpecificationsPanel({ data }: { data: ReviewData }) {
  const published = data.published?.snapshot.attributes ?? [];
  const attributes = [...new Set([...published.map(a => a.attribute), ...data.preview.attributes.map(a => a.attribute), ...data.claims.map(c => c.attribute)])].sort();
  return <section className="import-panel" aria-labelledby="spec-heading">
    <h2 id="spec-heading">Specifications</h2>
    <p className="import-note">“Published” is the last approved public revision. “Current verified” is what the page shows now or on approval. Proposed values stay private until verified.</p>
    {attributes.length ? <div className="review-table-wrap"><table className="review-table review-compact">
      <thead><tr><th scope="col">Attribute</th><th scope="col">Published</th><th scope="col">Current verified</th><th scope="col">Proposed / pending</th></tr></thead>
      <tbody>{attributes.map(a => {
        const was = published.filter(x => x.attribute === a), now = data.preview.attributes.filter(x => x.attribute === a), pending = data.proposed.filter(p => p.attribute === a);
        const changed = data.published && was.map(x => x.value).join('|') !== now.map(x => x.value).join('|');
        return <tr key={a} data-changed={!!changed}>
          <th scope="row" data-label="Attribute">{label(a)}{changed ? <span className="review-meta">Changed since publication</span> : null}</th>
          <td data-label="Published">{was.length ? was.map((x, i) => <span key={i} className="review-value">{x.value}</span>) : '—'}</td>
          <td data-label="Current verified">{now.length ? now.map((x, i) => <span key={i} className="review-value">{x.value}<span className="review-meta"><SourceLink url={x.sourceUrl}>{x.sourceName}</SourceLink> · {words(x.sourceType)} · {words(x.basis)}</span></span>) : 'Unknown'}</td>
          <td data-label="Proposed / pending">{pending.length ? pending.map(p => <span key={p.id} className="review-value">{showValue(p.value)}<span className="review-meta">{words(p.status)} · <SourceLink url={p.sourceUrl}>{p.sourceName}</SourceLink> · {words(p.sourceType)}</span></span>) : '—'}</td>
        </tr>;
      })}</tbody>
    </table></div> : <p>No structured specifications yet. Missing optional values show as unknown and do not block publication.</p>}
  </section>;
}

export function ConflictsPanel({ data, onDone }: { data: ReviewData; onDone: (message: string) => void }) {
  const [reason, setReason] = useState(''), [checked, setChecked] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [correcting, setCorrecting] = useState(''), [form, setForm] = useState({ sourceId: '', sourceUrl: '', observedAt: '', basis: 'REPORTED', value: '', target: 'ENTRY' });
  if (!data.conflicts.length) return <section className="import-panel" aria-labelledby="conflict-heading"><h2 id="conflict-heading">Conflicts</h2><p>No contradictory or unresolved evidence. Weights for different sizes or methods are not treated as contradictions.</p></section>;
  async function resolve(attribute: string, action: string, claimId?: string, correction?: unknown) {
    const group = data.conflicts.find(g => g.attribute === attribute)!;
    setBusy(true); setError('');
    try {
      await send(`/api/admin/product-reviews/${data.id}/conflicts`, { attribute, action, ...(claimId ? { claimId } : {}), ...(correction ? { correction } : {}), claimVersions: Object.fromEntries(group.claims.map(c => [c.id, c.version])), reason, sourceChecked: checked, requestId: newRequestId() });
      setReason(''); setChecked(false); setCorrecting(''); onDone(`${label(attribute)}: ${words(action)} recorded. Contradicting evidence is kept in history.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Resolution failed.'); } finally { setBusy(false); }
  }
  function correctionValue(attribute: string) {
    if (attribute !== 'weight' && attribute !== 'additionalFeatures') return form.value.trim();
    try { return JSON.parse(form.value); } catch { return form.value.trim(); }
  }
  const canDecide = reason.trim().length >= 10 && !busy;
  return <section className="import-panel" aria-labelledby="conflict-heading">
    <h2 id="conflict-heading">Conflicts ({data.conflicts.length})</h2>
    <p>Compare original values and sources. Selecting a value never deletes the others: contradicting observations are marked rejected and stay in history. The newest source is not trusted automatically, and retailer claims remain source-reported.</p>
    <ReasonField id="conflict-reason" value={reason} onChange={setReason} label="Reason for this resolution" />
    <label className="review-check"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} /> I checked the supporting value against its cited source.</label>
    {error && <p role="alert" className="import-error">{error}</p>}
    {data.conflicts.map(group => <div key={group.attribute} className="review-conflict">
      <h3>{label(group.attribute)}</h3>
      <div className="review-compare">{group.claims.map(c => <article key={c.id} data-status={c.status}>
        <p className="review-value">{showValue(c.value)}</p>
        <dl className="review-facts"><div><dt>Status</dt><dd>{words(c.status)}</dd></div><div><dt>Source</dt><dd><SourceLink url={c.sourceUrl}>{c.source.name}</SourceLink> · {words(c.source.type)}</dd></div><div><dt>Basis</dt><dd>{words(c.basis)}</dd></div><div><dt>Observed</dt><dd>{date(c.observedAt)}</dd></div><div><dt>Scope</dt><dd>{c.scope === 'VARIANT' ? 'Shared construction (all colorways)' : 'This colorway only'}</dd></div></dl>
        {c.status !== 'REJECTED' && <div className="account-actions">
          <Button type="button" disabled={!canDecide || !checked} onClick={() => resolve(group.attribute, 'SELECT', c.id)}>Select as supported value</Button>
          {c.status !== 'CONFLICTED' && <Button type="button" variant="outline" disabled={!canDecide} onClick={() => resolve(group.attribute, 'UNRESOLVED', c.id)}>Mark unresolved</Button>}
          <Button type="button" variant="destructive" disabled={!canDecide} onClick={() => resolve(group.attribute, 'REJECT_OBSERVATION', c.id)}>Reject observation</Button>
        </div>}
      </article>)}</div>
      {correcting === group.attribute ? <form className="review-correction" onSubmit={e => { e.preventDefault(); void resolve(group.attribute, 'CORRECTION', undefined, { ...form, value: correctionValue(group.attribute), observedAt: form.observedAt ? new Date(form.observedAt).toISOString() : '' }); }}>
        <p className="import-note">A correction adds a new, attributed observation and selects it. Weight uses JSON, e.g. {'{"amount":200,"unit":"g","size":"9","sizeSystem":"UK"}'}.</p>
        <label>Source<select required value={form.sourceId} onChange={e => setForm(f => ({ ...f, sourceId: e.target.value }))}><option value="">Choose a registered source</option>{data.sources.map(s => <option key={s.id} value={s.id}>{s.name} · {words(s.type)}</option>)}</select></label>
        <label>Source URL<input type="url" required value={form.sourceUrl} onChange={e => setForm(f => ({ ...f, sourceUrl: e.target.value }))} /></label>
        <label>Observed<input type="datetime-local" required value={form.observedAt} onChange={e => setForm(f => ({ ...f, observedAt: e.target.value }))} /></label>
        <label>Basis<select value={form.basis} onChange={e => setForm(f => ({ ...f, basis: e.target.value }))}><option value="REPORTED">Reported by source</option><option value="MEASURED">Measured</option><option value="EXPERT">Expert</option><option value="COMMUNITY">Community</option></select></label>
        <label>Applies to<select value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))}><option value="ENTRY">This colorway only</option><option value="VARIANT">Shared construction</option></select></label>
        <label>Corrected value<input required value={form.value} maxLength={1000} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} /></label>
        <div className="account-actions"><Button type="submit" disabled={!canDecide || !checked}>Add documented correction</Button><Button type="button" variant="outline" onClick={() => setCorrecting('')}>Cancel</Button></div>
      </form> : <Button type="button" variant="outline" onClick={() => setCorrecting(group.attribute)}>Add a documented correction</Button>}
    </div>)}
  </section>;
}

const outcomeText = { CONFIRM_NEW: 'Confirm distinct product', LINK_EXISTING: 'Link to existing exact product', REJECT_DUPLICATE: 'Reject as duplicate', INVESTIGATE: 'Flag for investigation' } as const;
export function DuplicatesPanel({ data, onDone }: { data: ReviewData; onDone: (message: string) => void }) {
  const [outcome, setOutcome] = useState<keyof typeof outcomeText | ''>(''), [target, setTarget] = useState(''), [rows, setRows] = useState<string[]>([]), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [requestId, setRequestId] = useState('');
  const exact = data.duplicates.filter(d => d.relation === 'SAME_IDENTITY' && d.status !== 'REJECTED');
  const neverPublished = data.status === 'DRAFT' || data.status === 'PENDING_REVIEW';
  async function commit() {
    if (!outcome) return;
    setBusy(true); setError('');
    try { await send(`/api/admin/product-reviews/${data.id}/duplicates`, { outcome, version: data.version, reviewFingerprint: data.fingerprint, reason, importRowIds: rows, requestId, ...(outcome === 'LINK_EXISTING' ? { targetEntryId: target } : {}) }); setOutcome(''); onDone(`${outcomeText[outcome]}: recorded.`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Decision failed.'); } finally { setBusy(false); }
  }
  const choose = (o: keyof typeof outcomeText) => { setOutcome(o); setReason(''); setError(''); setRequestId(newRequestId()); setTarget(exact[0]?.candidateId ?? ''); };
  return <section className="import-panel" aria-labelledby="dup-heading">
    <h2 id="dup-heading">Duplicates & staged proposals</h2>
    {data.duplicates.length ? <ul className="review-dups">{data.duplicates.map(d => <li key={d.candidateId} data-risk={d.relation === 'SAME_IDENTITY' || d.relation === 'CASE_ONLY_SKU'}>
      <Link className="text-link" href={`/admin/products/review/${d.candidateId}`}>{d.slug}</Link> · {words(d.status)} · <strong>{words(d.relation)}</strong>{d.skuCaseCollision ? ' · SKU differs only by case' : ''}
      {d.detail && <span className="review-meta">{d.detail.variant.tier.generation.name} · {d.detail.variant.tier.name} · {d.detail.variant.surface ?? 'Unknown outsole'} · {d.detail.colorway.name}</span>}
    </li>)}</ul> : <p>No similar products found.</p>}
    <p className="import-note">Different tiers (Elite/Pro), outsoles (FG/AG) and generations are always separate products and are never merged. Nothing is merged automatically.</p>
    {data.staged.length > 0 && <fieldset className="review-staged"><legend>Staged import proposals for this product</legend>{data.staged.map(r => <label key={r.id} className="review-check"><input type="checkbox" checked={rows.includes(r.id)} onChange={e => setRows(x => e.target.checked ? [...x, r.id] : x.filter(y => y !== r.id))} /> {words(r.outcome)} from {r.batch.source.name} · {date(r.createdAt)} · {Array.isArray(r.diagnostics) ? r.diagnostics.join(', ') : ''}</label>)}<p className="import-note">Checked proposals are marked resolved by your decision; their original rows are kept.</p></fieldset>}
    <div className="account-actions">
      <Button type="button" variant="outline" onClick={() => choose('CONFIRM_NEW')}>{outcomeText.CONFIRM_NEW}</Button>
      <Button type="button" variant="outline" disabled={!exact.length || !neverPublished} onClick={() => choose('LINK_EXISTING')}>{outcomeText.LINK_EXISTING}</Button>
      <Button type="button" variant="outline" disabled={!neverPublished} onClick={() => choose('REJECT_DUPLICATE')}>{outcomeText.REJECT_DUPLICATE}</Button>
      <Button type="button" variant="outline" onClick={() => choose('INVESTIGATE')}>{outcomeText.INVESTIGATE}</Button>
    </div>
    <ConfirmDialog open={!!outcome} title={outcome ? `${outcomeText[outcome]}?` : ''} confirmLabel={outcome ? outcomeText[outcome] : ''} destructive={outcome === 'REJECT_DUPLICATE' || outcome === 'LINK_EXISTING'} busy={busy} disabled={reason.trim().length < 10 || (outcome === 'LINK_EXISTING' && !target)} onConfirm={commit} onClose={() => !busy && setOutcome('')}>
      <p>{outcome === 'LINK_EXISTING' ? 'This draft is rejected and its source-record mappings point to the existing product, so future imports update that product. No claims, images or reviews are moved or deleted.' : outcome === 'REJECT_DUPLICATE' ? 'This draft is rejected and kept in history.' : outcome === 'CONFIRM_NEW' ? 'Records that this product is distinct from every current candidate. A new candidate later requires a new decision.' : 'Approval stays blocked until a later decision.'}</p>
      {outcome === 'LINK_EXISTING' && <label>Existing exact product<select value={target} onChange={e => setTarget(e.target.value)}>{exact.map(d => <option key={d.candidateId} value={d.candidateId}>{d.slug} · {words(d.status)}</option>)}</select></label>}
      <ReasonField id="duplicate-reason" value={reason} onChange={setReason} />
      {error && <p role="alert" className="import-error">{error}</p>}
    </ConfirmDialog>
  </section>;
}

const rightsText: Record<string, string> = { PERMISSION_CONFIRMED: 'Permission confirmed', PERMISSION_PENDING: 'Permission pending', PERMISSION_DENIED: 'Permission denied', LICENSE_RESTRICTED: 'Licence restricted' };
export function ImagesPanel({ data }: { data: ReviewData }) {
  return <section className="import-panel" aria-labelledby="img-heading">
    <h2 id="img-heading">Images</h2>
    <p className="import-note">Only images with confirmed permission are public. Without one, the page shows a neutral placeholder; no manufacturer image is substituted. Edit alt text, order, primary image and rights in the <Link className="text-link" href="/admin/products/enrich">evidence editor</Link>.</p>
    {data.images.length ? <ul className="review-images">{data.images.map(i => <li key={i.id}>
      {/* Uploaded files are served by the private image API (admin-only before publication). External files are only displayed once permission is confirmed. */}
      {i.src || (i.externalUrl && i.publicEligible) ? <Image src={i.src ?? i.externalUrl!} alt={i.altText} unoptimized referrerPolicy="no-referrer" width={160} height={120} /> : <div className="review-image-placeholder">Preview withheld until permission is confirmed</div>}
      <p><strong>{rightsText[i.rights] ?? words(i.rights)}</strong>{i.isPrimary ? ' · Primary' : ''} · {i.publicEligible ? 'Shown publicly' : 'Not public'}</p>
      <p className="review-meta">Alt: {i.altText} · Attribution: {i.attribution} · <SourceLink url={i.sourceUrl}>source</SourceLink>{i.usageRestrictions ? ` · Restrictions: ${i.usageRestrictions}` : ''}</p>
    </li>)}</ul> : <p>No image metadata. The public page will use the placeholder.</p>}
  </section>;
}

export function PreviewPanel({ data }: { data: ReviewData }) {
  const p = data.preview;
  return <section className="import-panel" aria-labelledby="preview-heading">
    <h2 id="preview-heading">Public preview</h2>
    <p className="import-note">What the public product page shows {data.status === 'PUBLISHED' ? 'now' : 'once approved'}. Private notes, pending evidence and moderation details are never included.{data.previewChanged ? ' This differs from the last published revision.' : ''}</p>
    <p><strong>{Object.values(p.identity).filter(Boolean).join(' · ')}</strong>{p.sample ? ' · labeled sample' : ''}</p>
    <p>URL: /boots/{p.slug}</p>
    {p.attributes.length ? <dl className="review-facts">{p.attributes.map((a, n) => <div key={n}><dt>{label(a.attribute)}</dt><dd>{a.value} <span className="review-meta">{a.sourceName} · {words(a.sourceType)} · {a.basis === 'MEASURED' ? 'measured by the source; not independent certification' : 'source-reported, not independently tested'}</span></dd></div>)}</dl> : <p>No verified technical attributes; specifications show as unknown.</p>}
    <p>{p.images.length ? `${p.images.length} authorized image(s).` : 'Placeholder image.'}</p>
  </section>;
}

/** D5: changes proposed by scheduled source sync. Evidence-backed ones resolve when the observation is decided above. */
export function SyncChangesPanel({ data, onDone }: { data: ReviewData; onDone: (message: string) => void }) {
  const [target, setTarget] = useState<{ id: string; action: 'ACKNOWLEDGE' | 'DISMISS' } | null>(null), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [requestId, setRequestId] = useState('');
  const changes = data.syncChanges ?? [];
  if (!changes.length) return null;
  async function commit() {
    if (!target) return;
    setBusy(true); setError('');
    try { await send(`/api/admin/product-reviews/${data.id}/sync-changes`, { changeId: target.id, action: target.action, reason, version: data.version, requestId }); setTarget(null); onDone(`Source change ${target.action === 'ACKNOWLEDGE' ? 'acknowledged' : 'dismissed'}.`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Decision failed.'); } finally { setBusy(false); }
  }
  return <section className="import-panel" aria-labelledby="sync-heading">
    <h2 id="sync-heading">Source changes</h2>
    <p className="import-note">Proposed by scheduled synchronization. Specification changes are decided by verifying or rejecting the observation above; identity, SKU and image notices are acknowledged or dismissed here. Dismissed changes are not raised again.</p>
    <ul className="review-dups">{changes.map(c => <li key={c.id} data-risk={c.disposition === 'PENDING_REVIEW' && c.severity === 'CRITICAL'}>
      <strong>{words(c.kind)}</strong> · {words(c.severity)} · {words(c.disposition)}{c.attribute ? ` · ${c.attribute}` : ''}
      <span className="review-meta">{c.source.name} · {words(c.source.type)} · last seen {date(c.lastSeenAt)}</span>
      <span className="review-value">{c.previousValue === null ? '—' : showValue(c.previousValue)} → {c.proposedValue === null ? '—' : showValue(c.proposedValue)}</span>
      {c.disposition === 'PENDING_REVIEW' && !c.claimId && <div className="account-actions"><Button type="button" variant="outline" onClick={() => { setTarget({ id: c.id, action: 'ACKNOWLEDGE' }); setReason(''); setRequestId(newRequestId()); }}>Acknowledge</Button><Button type="button" variant="outline" onClick={() => { setTarget({ id: c.id, action: 'DISMISS' }); setReason(''); setRequestId(newRequestId()); }}>Dismiss</Button></div>}
    </li>)}</ul>
    <ConfirmDialog open={!!target} title={target?.action === 'DISMISS' ? 'Dismiss this source change?' : 'Acknowledge this source change?'} confirmLabel={target?.action === 'DISMISS' ? 'Dismiss' : 'Acknowledge'} busy={busy} disabled={reason.trim().length < 10} onConfirm={commit} onClose={() => !busy && setTarget(null)}>
      <p>{target?.action === 'DISMISS' ? 'The proposed value is ignored and will not be raised again for this source. No catalogue data changes.' : 'Records that you have handled this change (for example by editing the record). No catalogue data changes automatically.'}</p>
      <ReasonField id="sync-reason" value={reason} onChange={setReason} />
      {error && <p role="alert" className="import-error">{error}</p>}
    </ConfirmDialog>
  </section>;
}
