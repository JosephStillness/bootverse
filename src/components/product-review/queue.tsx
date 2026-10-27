'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, ReadinessBadge, ReasonField, StatusBadge, date, newRequestId, send, words, type Readiness } from './shared';

type Summary = { statuses: Record<string, number>; unresolvedConflicts: number; possibleDuplicates: number; missingAuthorizedImages: number; stagedImportMatches: number; sources: { id: string; name: string }[] };
type Row = {
  id: string; slug: string; status: string; version: number; sample: boolean; submittedAt: string | null; createdAt: string; fingerprint: string;
  identity: { brand?: string; family?: string; generation?: string; tier?: string; outsole: string | null; colorway?: string; sku: string[] };
  source: { id: string; name: string; type: string } | null; readiness: Readiness; counts: { blocking: number; warnings: number; information: number };
  conflicts: number; missingOptional: boolean; imageStatus: 'AUTHORIZED' | 'PENDING_OR_DENIED' | 'NONE'; topIssues: { code: string; severity: string; message: string }[];
};
type Queue = { records: Row[]; total: number; page: number; pages: number };
type Filters = { q: string; status: string; sourceId: string; quality: string; sort: string; page: number };
type PreviewResult = { id: string; slug?: string; status?: string; version?: number; fingerprint?: string; readiness?: Readiness; eligible?: boolean; blocking?: string[]; outcome?: string; message?: string };
type BulkResult = { results: { id: string; slug?: string; outcome: string; message: string }[]; counts: Record<string, number> };

const initial: Filters = { q: '', status: 'PENDING_REVIEW', sourceId: '', quality: '', sort: 'submitted_desc', page: 1 };
const statusOrder = ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED'];
const imageText = { AUTHORIZED: 'Authorized image', PENDING_OR_DENIED: 'Image not authorized', NONE: 'No image · placeholder' };

export function ReviewQueue() {
  const [filters, setFilters] = useState<Filters>(initial), [draft, setDraft] = useState(initial.q);
  const [queue, setQueue] = useState<Queue>(), [summary, setSummary] = useState<Summary>(), [loading, setLoading] = useState(true), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set()), [preview, setPreview] = useState<PreviewResult[]>(), [result, setResult] = useState<BulkResult>();
  const [dialog, setDialog] = useState<'' | 'APPROVE' | 'REJECT'>(''), [reason, setReason] = useState(''), [attest, setAttest] = useState(false), [busy, setBusy] = useState(false), [bulkError, setBulkError] = useState(''), [requestId, setRequestId] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined).map(([k, v]) => [k, String(v)]));
    Promise.all([fetch(`/api/admin/product-reviews?${params}`, { signal: controller.signal }), fetch('/api/admin/product-reviews/summary', { signal: controller.signal })])
      .then(async ([q, s]) => { const [qd, sd] = await Promise.all([q.json(), s.json()]); if (!q.ok) throw new Error(qd.error ?? 'Review queue unavailable.'); if (!s.ok) throw new Error(sd.error ?? 'Summary unavailable.'); setQueue(qd); setSummary(sd); setError(''); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Review queue unavailable.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, refresh]);

  const apply = useCallback((next: Partial<Filters>) => { setLoading(true); setSelected(new Set()); setPreview(undefined); setFilters(f => ({ ...f, page: 1, ...next })); }, []);
  const toggle = (id: string) => { setPreview(undefined); setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const allOnPage = !!queue?.records.length && queue.records.every(r => selected.has(r.id));

  async function runPreview() {
    setBusy(true); setBulkError(''); setResult(undefined);
    try { setPreview((await send<{ results: PreviewResult[] }>('/api/admin/product-reviews/bulk', { action: 'PREVIEW', items: [...selected].map(id => ({ id })) })).results); }
    catch (e) { setBulkError(e instanceof Error ? e.message : 'Preview failed.'); } finally { setBusy(false); }
  }
  function open(kind: 'APPROVE' | 'REJECT') { setDialog(kind); setReason(''); setAttest(false); setRequestId(newRequestId()); setBulkError(''); }
  async function commit() {
    if (!preview || !dialog) return;
    const items = (dialog === 'APPROVE' ? preview.filter(p => p.eligible) : preview.filter(p => p.fingerprint)).map(p => ({ id: p.id, version: p.version, reviewFingerprint: p.fingerprint }));
    setBusy(true); setBulkError('');
    try {
      // The same request ID is reused if the admin retries, so a repeated click cannot double-apply.
      setResult(await send<BulkResult>('/api/admin/product-reviews/bulk', { action: dialog, items, reason, confirmed: true, requestId, identityConfirmed: attest, evidenceChecked: attest }));
      setDialog(''); setPreview(undefined); setSelected(new Set()); setLoading(true); setRefresh(n => n + 1);
    } catch (e) { setBulkError(e instanceof Error ? e.message : 'Bulk change failed.'); } finally { setBusy(false); }
  }
  const eligible = preview?.filter(p => p.eligible).length ?? 0;
  const rejectable = preview?.filter(p => p.status === 'DRAFT' || p.status === 'PENDING_REVIEW').length ?? 0;

  return <>
    <section aria-labelledby="review-overview" className="review-overview">
      <h2 id="review-overview" className="sr-only">Overview</h2>
      {summary ? <ul className="review-stats">
        {statusOrder.map(s => <li key={s}><button type="button" aria-pressed={filters.status === s} onClick={() => apply({ status: s, quality: '' })}><span>{words(s)}</span><strong>{summary.statuses[s] ?? 0}</strong></button></li>)}
        <li><button type="button" aria-pressed={filters.quality === 'conflicts'} onClick={() => apply({ status: '', quality: 'conflicts' })}><span>Unresolved conflicts</span><strong>{summary.unresolvedConflicts}</strong></button></li>
        <li><div><span>Possible duplicate identities</span><strong>{summary.possibleDuplicates}</strong></div></li>
        <li><button type="button" aria-pressed={filters.quality === 'missing_image'} onClick={() => apply({ status: '', quality: 'missing_image' })}><span>Missing authorized image</span><strong>{summary.missingAuthorizedImages}</strong></button></li>
        <li><button type="button" aria-pressed={filters.quality === 'staged_proposals'} onClick={() => apply({ status: '', quality: 'staged_proposals' })}><span>Staged import matches</span><strong>{summary.stagedImportMatches}</strong></button></li>
      </ul> : <div className="review-stats-skeleton skeleton" aria-hidden="true" />}
      <p className="import-note">Counts are live database totals. “Possible duplicate identities” counts non-rejected records sharing a full normalized identity before administrator confirmation.</p>
    </section>

    <form className="review-filters" role="search" onSubmit={(e: FormEvent) => { e.preventDefault(); apply({ q: draft.trim() }); }}>
      <label>Search brand, model, colorway, SKU or slug<input type="search" value={draft} maxLength={100} onChange={e => setDraft(e.target.value)} /></label>
      <label>Status<select value={filters.status} onChange={e => apply({ status: e.target.value })}><option value="">All statuses</option>{statusOrder.map(s => <option key={s} value={s}>{words(s)}</option>)}</select></label>
      <label>Source<select value={filters.sourceId} onChange={e => apply({ sourceId: e.target.value })}><option value="">All sources</option>{summary?.sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Data quality<select value={filters.quality} onChange={e => apply({ quality: e.target.value })}><option value="">Any</option><option value="conflicts">Unresolved conflicts</option><option value="missing_image">No authorized image</option><option value="missing_sku">No SKU</option><option value="unknown_outsole">Unknown outsole</option><option value="staged_proposals">Staged import proposals</option></select></label>
      <label>Sort<select value={filters.sort} onChange={e => apply({ sort: e.target.value })}><option value="submitted_desc">Newest submission</option><option value="submitted_asc">Oldest submission</option><option value="created_desc">Newest created</option><option value="updated_desc">Recently updated</option></select></label>
      <Button type="submit" variant="outline">Search</Button>
    </form>

    <div className="review-bulk" role="region" aria-label="Bulk review">
      <p><strong>{selected.size}</strong> selected · up to 25 per batch.</p>
      <div className="account-actions">
        <Button type="button" variant="outline" disabled={!selected.size || selected.size > 25 || busy} onClick={runPreview}>Preview validation</Button>
        <Button type="button" disabled={!eligible || busy} onClick={() => open('APPROVE')}>Approve eligible ({eligible})</Button>
        <Button type="button" variant="destructive" disabled={!rejectable || busy} onClick={() => open('REJECT')}>Reject selected ({rejectable})</Button>
      </div>
      {bulkError && !dialog && <p role="alert" className="import-error">{bulkError}</p>}
      {preview && <div aria-live="polite"><h3>Validation preview</h3><p className="import-note">Blocked records are skipped, never approved. Each record is revalidated again when you confirm.</p>
        <ul className="review-outcomes">{preview.map(p => <li key={p.id} data-ok={p.eligible}><strong>{p.slug ?? p.id}</strong> · {p.status ? words(p.status) : p.message} {p.readiness && <ReadinessBadge value={p.readiness} status={p.status} />}{p.blocking?.length ? <ul>{p.blocking.slice(0, 3).map((b, i) => <li key={i}>{b}</li>)}</ul> : null}</li>)}</ul></div>}
      {result && <div role="status"><h3>Batch result</h3><p>{Object.entries(result.counts).map(([k, v]) => `${words(k)}: ${v}`).join(' · ')}</p>
        <ul className="review-outcomes">{result.results.map(r => <li key={r.id} data-ok={r.outcome === 'APPROVED' || r.outcome === 'REJECTED' || r.outcome === 'ALREADY_APPLIED'}><strong>{r.slug ?? r.id}</strong> · {words(r.outcome)} — {r.message}</li>)}</ul></div>}
    </div>

    {error && <div role="alert" className="import-error"><p>{error}</p><Button type="button" variant="outline" onClick={() => { setLoading(true); setRefresh(n => n + 1); }}>Retry</Button></div>}
    <div className="review-table-wrap" aria-busy={loading}>
      {loading && !queue ? <div className="skeleton h-48" aria-label="Loading review queue" /> : queue && !queue.records.length ? <div role="status" className="review-empty"><h3>No products match</h3><p>Try another status or clear the search. Imported and manually created drafts appear here; nothing is published automatically.</p><Button type="button" variant="outline" onClick={() => { setDraft(''); apply({ ...initial, status: '' }); }}>Show all products</Button></div> : queue && <table className="review-table">
        <caption className="sr-only">Products for review, page {queue.page} of {queue.pages}</caption>
        <thead><tr><th scope="col"><input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={() => { setPreview(undefined); setSelected(allOnPage ? new Set() : new Set(queue.records.map(r => r.id))); }} /></th><th scope="col">Product</th><th scope="col">Status</th><th scope="col">Validation</th><th scope="col">Source</th><th scope="col">Submitted</th></tr></thead>
        <tbody>{queue.records.map(r => <tr key={r.id}>
          <td><input type="checkbox" aria-label={`Select ${r.slug}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
          <td data-label="Product"><Link className="text-link review-name" href={`/admin/products/review/${r.id}`}>{r.identity.brand} {r.identity.family} {r.identity.generation}</Link><span className="review-variant">{r.identity.tier} · {r.identity.outsole ?? 'Unknown outsole'} · {r.identity.colorway}</span><span className="review-meta">{r.identity.sku.length ? `SKU ${r.identity.sku.join(', ')}` : 'No SKU'} · {imageText[r.imageStatus]}{r.sample ? ' · Sample' : ''}</span></td>
          <td data-label="Status"><StatusBadge value={r.status} /></td>
          <td data-label="Validation"><ReadinessBadge value={r.readiness} status={r.status} /><span className="review-meta">{r.counts.blocking} blocking · {r.counts.warnings} warnings{r.conflicts ? ` · ${r.conflicts} conflict${r.conflicts > 1 ? 's' : ''}` : ''}{r.missingOptional ? ' · optional specs missing' : ''}</span>{r.topIssues[0] && <span className="review-meta">{r.topIssues[0].message}</span>}</td>
          <td data-label="Source">{r.source ? `${r.source.name} · ${words(r.source.type)}` : 'No source'}</td>
          <td data-label="Submitted">{date(r.submittedAt)}</td>
        </tr>)}</tbody>
      </table>}
    </div>
    {queue && queue.pages > 1 && <nav className="account-actions" aria-label="Review queue pages"><Button type="button" variant="outline" disabled={filters.page <= 1 || loading} onClick={() => { setLoading(true); setFilters(f => ({ ...f, page: f.page - 1 })); }}>Previous</Button><span>Page {queue.page} of {queue.pages} · {queue.total} products</span><Button type="button" variant="outline" disabled={filters.page >= queue.pages || loading} onClick={() => { setLoading(true); setFilters(f => ({ ...f, page: f.page + 1 })); }}>Next</Button></nav>}

    <ConfirmDialog open={dialog !== ''} title={dialog === 'APPROVE' ? `Approve and publish ${eligible} product(s)?` : `Reject ${rejectable} product(s)?`} confirmLabel={dialog === 'APPROVE' ? 'Approve and publish' : 'Reject'} destructive={dialog === 'REJECT'} busy={busy} disabled={reason.trim().length < 10 || (dialog === 'APPROVE' && !attest)} onConfirm={commit} onClose={() => !busy && setDialog('')}>
      <p>{dialog === 'APPROVE' ? 'Only records that passed preview are sent. Each is revalidated and committed separately; blocked or changed records are skipped and reported.' : 'Rejected records are hidden from public pages and keep their full history. They can be reopened as drafts.'}</p>
      <ReasonField id="bulk-reason" value={reason} onChange={setReason} />
      {dialog === 'APPROVE' && <label className="review-check"><input type="checkbox" checked={attest} onChange={e => setAttest(e.target.checked)} /> I confirm each record’s exact identity (brand, family, generation, tier, outsole, colorway) and checked its critical evidence against the cited sources.</label>}
      {bulkError && <p role="alert" className="import-error">{bulkError}</p>}
    </ConfirmDialog>
  </>;
}
