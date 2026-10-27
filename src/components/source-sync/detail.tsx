'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, ReasonField, date, newRequestId, safeHref, send, words } from '@/components/product-review/shared';
import { AlertsPanel, ChangesPanel, JobsPanel, OffersPanel, type Alert, type Change, type Job, type Offer } from './panels';
import { HealthBadge, reasonText, type Health } from './shared';

type Policy = { prices: 'AUTO' | 'RECORD' | 'OFF'; availability: 'AUTO' | 'RECORD' | 'OFF'; availabilityLabels: Record<string, string> };
type Detail = {
  source: { id: string; name: string; type: string; baseUrl: string; authorizationStatus: string; permissionDocumented: boolean; authorizationCheckedAt: string | null; usageRestrictions: string | null; syncEnabled: boolean; adapterKey: string | null; syncIntervalMinutes: number | null; minIntervalMinutes: number; fieldPolicy: Policy; nextSyncAt: string | null; backoffUntil: string | null; lastSyncAttemptAt: string | null; lastSyncSuccessAt: string | null; syncFailureCount: number; lastSyncErrorCategory: string | null; updatedAt: string; health: Health; scheduled: string; manual: string; adapterRegistered: boolean };
  freshness: { priceFreshHours: number; stockFreshHours: number }; jobs: Job[]; alerts: Alert[]; changes: Change[]; changeCounts: Record<string, number>; offers: Offer[]; offerTotal: number; offersPage: number; offerPages: number;
};
type RunResult = { status: string; reason?: string; mode?: string; summary?: Record<string, unknown>; errorCategory?: string; preview?: { outcomes: Record<string, number>; changeCount: number; changes: { kind: string; severity: string; recordId: string; attribute: string | null }[]; offers: number; offersResolvable: number; rejected: number } };

export function DataSourceDetail({ id }: { id: string }) {
  const [data, setData] = useState<Detail>(), [error, setError] = useState(''), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0), [page, setPage] = useState(1), [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<'' | 'RUN' | 'PREVIEW'>(''), [busy, setBusy] = useState(false), [runError, setRunError] = useState(''), [result, setResult] = useState<RunResult>(), [requestId, setRequestId] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/data-sources/${encodeURIComponent(id)}?offersPage=${page}`, { signal: controller.signal })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? 'Source unavailable.'); setData(d); setError(''); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Source unavailable.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, page, refresh]);
  const reload = useCallback((message = '') => { setNotice(message); setLoading(true); setRefresh(n => n + 1); }, []);
  if (loading && !data) return <div className="skeleton h-64" role="status" aria-label="Loading source" />;
  if (error && !data) return <div role="alert" className="import-error"><p>{error}</p><Button type="button" variant="outline" onClick={() => reload()}>Retry</Button></div>;
  if (!data) return null;
  const s = data.source;
  async function run() {
    if (!dialog) return;
    setBusy(true); setRunError('');
    try {
      // The request ID is generated once per dialog, so a retried click cannot start a second run.
      const r = await fetch(`/api/admin/data-sources/${s.id}/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: dialog, requestId, confirmed: true }), signal: AbortSignal.timeout(300_000) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok && r.status !== 409) throw new Error(d.error ?? 'The run failed to start.');
      setResult(d); setDialog(''); reload(d.status === 'SKIPPED' ? `Not run: ${reasonText[d.reason] ?? d.reason}.` : `${dialog === 'PREVIEW' ? 'Preview' : 'Sync'} ${words(d.status)}.`);
    } catch (e) { setRunError(e instanceof Error ? e.message : 'The run failed.'); } finally { setBusy(false); }
  }
  return <div className="review-detail">
    <header className="review-head">
      <div>
        <p className="eyebrow">{words(s.type)} · {s.adapterKey ?? 'no adapter'}</p>
        <h1>{s.name}</h1>
        <p className="account-actions"><HealthBadge value={s.health} /><span className="review-meta">Schedule: {reasonText[s.scheduled] ?? s.scheduled} · Manual: {reasonText[s.manual] ?? s.manual}</span></p>
      </div>
      <nav className="account-actions" aria-label="Source links"><Link className="text-link" href="/admin/data-sources">All sources</Link><Link className="text-link" href="/admin/products/review?quality=sync_changes">Approval queue</Link></nav>
    </header>
    {notice && <p role="status" className="review-notice">{notice}</p>}
    {loading && <p role="status" className="import-note">Refreshing…</p>}
    <div className="import-layout">
      <div>
        {result && <RunSummary result={result} />}
        <JobsPanel jobs={data.jobs} />
        <ChangesPanel changes={data.changes} />
        <OffersPanel offers={data.offers} total={data.offerTotal} page={data.offersPage} pages={data.offerPages} freshness={data.freshness} onPage={p => { setLoading(true); setPage(p); }} />
      </div>
      <aside>
        <section className="import-panel" aria-labelledby="status-heading">
          <h2 id="status-heading">Status</h2>
          <dl className="review-facts">
            <div><dt>Authorization</dt><dd>{words(s.authorizationStatus)}{s.permissionDocumented ? ' · documented' : ' · not documented'}</dd></div>
            <div><dt>Last reviewed</dt><dd>{date(s.authorizationCheckedAt)}</dd></div>
            <div><dt>Last success</dt><dd>{date(s.lastSyncSuccessAt)}</dd></div>
            <div><dt>Last attempt</dt><dd>{date(s.lastSyncAttemptAt)}</dd></div>
            <div><dt>Next check</dt><dd>{s.syncEnabled ? date(s.nextSyncAt) : 'Not scheduled'}</dd></div>
            <div><dt>Failures</dt><dd>{s.syncFailureCount}{s.lastSyncErrorCategory ? ` · ${words(s.lastSyncErrorCategory)}` : ''}{s.backoffUntil && new Date(s.backoffUntil) > new Date() ? ` · backing off until ${date(s.backoffUntil)}` : ''}</dd></div>
          </dl>
          {safeHref(s.baseUrl) && <p className="review-meta">Registered origin: {new URL(s.baseUrl).hostname}. A reachable site does not imply permission.</p>}
          {s.usageRestrictions && <p className="review-meta">Usage restrictions: {s.usageRestrictions}</p>}
          <div className="review-actions">
            <Button type="button" variant="outline" disabled={busy || s.manual !== 'DUE'} onClick={() => { setDialog('PREVIEW'); setRequestId(newRequestId()); setRunError(''); }}>Preview changes</Button>
            <Button type="button" disabled={busy || s.manual !== 'DUE'} onClick={() => { setDialog('RUN'); setRequestId(newRequestId()); setRunError(''); }}>Run sync now</Button>
          </div>
          {s.manual !== 'DUE' && <p className="import-note">Manual runs are unavailable: {reasonText[s.manual] ?? s.manual}.</p>}
        </section>
        <ConfigForm source={s} onSaved={reload} />
        <AlertsPanel alerts={data.alerts} onDone={reload} />
      </aside>
    </div>
    <ConfirmDialog open={dialog !== ''} title={dialog === 'PREVIEW' ? 'Preview changes from this source?' : 'Run synchronization now?'} confirmLabel={dialog === 'PREVIEW' ? 'Fetch and preview' : 'Run sync'} busy={busy} onConfirm={run} onClose={() => !busy && setDialog('')}>
      <p>{dialog === 'PREVIEW' ? 'Fetches from the source once (counts toward its rate limit) and compares without changing anything.' : 'New products are created as private drafts and material changes go to the approval queue. Nothing is published automatically.'}</p>
      {runError && <p role="alert" className="import-error">{runError}</p>}
    </ConfirmDialog>
  </div>;
}

function RunSummary({ result }: { result: RunResult }) {
  const p = result.preview, sum = result.summary ?? {};
  return <section className="import-panel" aria-labelledby="run-heading" role="status">
    <h2 id="run-heading">{result.mode === 'PREVIEW' ? 'Preview result' : 'Run result'}: {words(result.status)}</h2>
    {result.status === 'SKIPPED' ? <p>{reasonText[result.reason ?? ''] ?? result.reason}</p> : result.errorCategory ? <p>Failed: {words(result.errorCategory)}. Nothing was committed.</p> :
      p ? <><p>{Object.entries(p.outcomes).map(([k, v]) => `${words(k)}: ${v}`).join(' · ') || 'No product records'} · {p.changeCount} change(s) · {p.offersResolvable} of {p.offers} offers map to exact products · {p.rejected} rejected.</p>
        <ul className="review-outcomes">{p.changes.slice(0, 25).map((c, i) => <li key={i}>{words(c.kind)} · {words(c.severity)} · record {c.recordId}{c.attribute ? ` · ${c.attribute}` : ''}</li>)}</ul></> :
        <p>{String(sum.fetched ?? 0)} fetched · {String(sum.newProducts ?? 0)} new drafts · {String(sum.changes ?? 0)} changes ({String(sum.pendingReview ?? 0)} for review) · {String(sum.offersSeen ?? 0)} offers · {String(sum.rejected ?? 0)} rejected.</p>}
  </section>;
}

function ConfigForm({ source, onSaved }: { source: Detail['source']; onSaved: (message: string) => void }) {
  const [form, setForm] = useState({ syncEnabled: source.syncEnabled, adapterKey: source.adapterKey ?? '', syncIntervalMinutes: source.syncIntervalMinutes ?? 1440, minIntervalMinutes: source.minIntervalMinutes, prices: source.fieldPolicy.prices, availability: source.fieldPolicy.availability });
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function save() {
    setBusy(true); setError('');
    try {
      await send(`/api/admin/data-sources/${source.id}`, { expectedUpdatedAt: source.updatedAt, syncEnabled: form.syncEnabled, adapterKey: form.adapterKey || null, syncIntervalMinutes: form.syncIntervalMinutes, minIntervalMinutes: form.minIntervalMinutes, fieldPolicy: { prices: form.prices, availability: form.availability, availabilityLabels: source.fieldPolicy.availabilityLabels }, reason }, 'PATCH');
      setReason(''); onSaved('Synchronization settings saved and audited.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Settings not saved.'); } finally { setBusy(false); }
  }
  return <section className="import-panel" aria-labelledby="config-heading">
    <h2 id="config-heading">Synchronization settings</h2>
    <form className="review-correction" onSubmit={e => { e.preventDefault(); void save(); }}>
      <label className="review-check"><input type="checkbox" checked={form.syncEnabled} onChange={e => setForm(f => ({ ...f, syncEnabled: e.target.checked }))} /> Scheduled synchronization enabled</label>
      <label>Server adapter key<input value={form.adapterKey} onChange={e => setForm(f => ({ ...f, adapterKey: e.target.value.trim() }))} placeholder="http:feed-name" pattern="^(fixture|http):[a-z0-9-]{1,60}$" maxLength={80} /></label>
      <p className="import-note">Adapters and their credentials are configured on the server; URLs and keys are never entered here.</p>
      <label>Check every (minutes)<input type="number" min={5} max={43200} value={form.syncIntervalMinutes} onChange={e => setForm(f => ({ ...f, syncIntervalMinutes: Number(e.target.value) }))} /></label>
      <label>Provider minimum interval (minutes)<input type="number" min={5} max={43200} value={form.minIntervalMinutes} onChange={e => setForm(f => ({ ...f, minIntervalMinutes: Number(e.target.value) }))} /></label>
      <label>Prices<select value={form.prices} onChange={e => setForm(f => ({ ...f, prices: e.target.value as Policy['prices'] }))}><option value="RECORD">Monitor privately</option><option value="AUTO">Publish authorized prices automatically</option><option value="OFF">Ignore</option></select></label>
      <label>Stock<select value={form.availability} onChange={e => setForm(f => ({ ...f, availability: e.target.value as Policy['availability'] }))}><option value="RECORD">Monitor privately</option><option value="AUTO">Automatic (monitoring only; not shown publicly)</option><option value="OFF">Ignore</option></select></label>
      <ReasonField id="config-reason" value={reason} onChange={setReason} />
      {error && <p role="alert" className="import-error">{error}</p>}
      <Button type="submit" variant="outline" disabled={busy || reason.trim().length < 10}>{busy ? 'Saving…' : 'Save settings'}</Button>
    </form>
  </section>;
}
