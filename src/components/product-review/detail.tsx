'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, IssueList, ReadinessBadge, ReasonField, StatusBadge, date, newRequestId, safeHref, send, words, type Issue, type Readiness } from './shared';
import { ConflictsPanel, DuplicatesPanel, ImagesPanel, PreviewPanel, SpecificationsPanel, type ReviewData } from './evidence';

type Action = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN' | 'REOPEN' | 'ARCHIVE' | 'RESUBMIT';
// Mirrors the server lifecycle for display only; the server enforces every transition.
const actionsFor: Record<string, Action[]> = { DRAFT: ['SUBMIT', 'REJECT'], PENDING_REVIEW: ['APPROVE', 'RETURN', 'REJECT'], REJECTED: ['REOPEN'], PUBLISHED: ['ARCHIVE'], ARCHIVED: ['RESUBMIT'] };
const actionText: Record<Action, { label: string; title: string; body: string; destructive?: boolean }> = {
  SUBMIT: { label: 'Submit for review', title: 'Submit for review?', body: 'The product stays private. Identity and source blockers must be fixed first.' },
  APPROVE: { label: 'Approve and publish', title: 'Approve and publish?', body: 'The server revalidates immediately before publishing. If evidence changed since you opened this page, approval is refused.' },
  REJECT: { label: 'Reject', title: 'Reject this submission?', body: 'It is hidden from public pages and keeps its full history. It can be reopened as a draft later.', destructive: true },
  RETURN: { label: 'Return for correction', title: 'Return for correction?', body: 'The product goes back to draft. Describe what must be corrected.' },
  REOPEN: { label: 'Reopen as draft', title: 'Reopen as draft?', body: 'The product returns to draft for correction and resubmission.' },
  ARCHIVE: { label: 'Archive', title: 'Archive this product?', body: 'It is removed from the catalogue, search, comparison and Boot Fit Finder. Its URL, reviews and history are preserved.', destructive: true },
  RESUBMIT: { label: 'Resubmit for review', title: 'Resubmit for review?', body: 'The archived product returns to the approval queue with its original URL.' },
};
const groupOrder: Issue['severity'][] = ['BLOCKING_ERROR', 'WARNING', 'INFORMATION'];

export function ReviewDetail({ id }: { id: string }) {
  const [data, setData] = useState<ReviewData>(), [error, setError] = useState(''), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0), [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<Action | ''>(''), [reason, setReason] = useState(''), [attest, setAttest] = useState(false), [busy, setBusy] = useState(false), [actionError, setActionError] = useState(''), [requestId, setRequestId] = useState('');
  const [note, setNote] = useState(''), [noteBusy, setNoteBusy] = useState(false), [noteError, setNoteError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/product-reviews/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? 'Review unavailable.'); setData(d); setError(''); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Review unavailable.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, refresh]);
  const reload = useCallback((message = '') => { setNotice(message); setLoading(true); setRefresh(n => n + 1); }, []);

  if (loading && !data) return <div className="skeleton h-64" role="status" aria-label="Loading product review" />;
  if (error && !data) return <div role="alert" className="import-error"><p>{error}</p><Button type="button" variant="outline" onClick={() => reload()}>Retry</Button></div>;
  if (!data) return null;
  const blocking = data.evaluation.issues.filter(i => i.severity === 'BLOCKING_ERROR').length;

  function open(action: Action) { setDialog(action); setReason(''); setAttest(false); setActionError(''); setRequestId(newRequestId()); }
  async function confirm() {
    if (!dialog || !data) return;
    setBusy(true); setActionError('');
    try {
      await send(`/api/admin/product-reviews/${data.id}/transitions`, { action: dialog, version: data.version, reason, reviewFingerprint: data.fingerprint, requestId, identityConfirmed: attest, evidenceChecked: attest });
      const done = actionText[dialog].label; setDialog(''); reload(`${done}: saved and recorded in history.`);
    } catch (e) { setActionError(e instanceof Error ? e.message : 'The change failed.'); } finally { setBusy(false); }
  }
  async function saveNote() {
    if (!data) return;
    setNoteBusy(true); setNoteError('');
    try { await send(`/api/admin/product-reviews/${data.id}/notes`, { note, version: data.version, requestId: newRequestId() }); setNote(''); reload('Review note saved privately.'); }
    catch (e) { setNoteError(e instanceof Error ? e.message : 'Note not saved.'); } finally { setNoteBusy(false); }
  }
  const id_ = data.identity;
  return <div className="review-detail">
    <header className="review-head">
      <div>
        <p className="eyebrow">{id_.brand} · {data.slug}</p>
        <h1>{id_.family} {id_.generation} {id_.tier}</h1>
        <p className="review-variant">{id_.outsole ?? 'Unknown outsole'}{id_.manufacturerOutsole ? ` (manufacturer: ${id_.manufacturerOutsole})` : ''} · {id_.colorway}{data.sample ? ' · Sample record' : ''}</p>
        <p className="account-actions"><StatusBadge value={data.status} /><ReadinessBadge value={data.evaluation.readiness as Readiness} status={data.status} /><span className="review-meta">Version {data.version} · Submitted {date(data.submittedAt)}</span></p>
      </div>
      <nav className="account-actions" aria-label="Product links">
        <Link className="text-link" href="/admin/products/review">Back to queue</Link>
        <Link className="text-link" href="/admin/products/enrich">Edit evidence &amp; images</Link>
        {data.status === 'PUBLISHED' && <Link className="text-link" href={`/boots/${data.slug}`}>Public page</Link>}
      </nav>
    </header>
    {notice && <p role="status" className="review-notice">{notice}</p>}
    {loading && <p role="status" className="import-note">Refreshing…</p>}

    <div className="import-layout">
      <div>
        <section className="import-panel" aria-labelledby="identity-heading">
          <h2 id="identity-heading">Product identity</h2>
          <dl className="review-facts">
            <div><dt>Brand</dt><dd>{id_.brand ?? 'Missing'}</dd></div><div><dt>Family</dt><dd>{id_.family ?? 'Missing'}</dd></div>
            <div><dt>Generation</dt><dd>{id_.generation ?? 'Missing'}</dd></div><div><dt>Tier</dt><dd>{id_.tier ?? 'Missing'}</dd></div>
            <div><dt>Outsole</dt><dd>{id_.outsole ?? 'Unknown'}</dd></div><div><dt>Colorway</dt><dd>{id_.swatch && <span className="review-swatch" style={{ background: /^#[0-9a-f]{6}$/i.test(id_.swatch) ? id_.swatch : 'transparent' }} aria-hidden="true" />}{id_.colorway ?? 'Missing'}</dd></div>
            <div><dt>SKU</dt><dd>{id_.identifiers.length ? id_.identifiers.map(s => `${s.value} (${s.region})`).join(', ') : 'None recorded'}</dd></div>
            <div><dt>Exact variant</dt><dd><code>{id_.variantId}</code> · {id_.reviewsOnVariant} community review(s)</dd></div>
          </dl>
          <h3>Primary source</h3>
          {data.source ? <p>{safeHref(data.source.baseUrl) ? <a className="text-link" href={data.source.baseUrl} target="_blank" rel="noopener noreferrer">{data.source.name}</a> : data.source.name} · {words(data.source.type)} · permission {words(data.source.authorizationStatus)}{data.source.lastCheckedAt ? ` · checked ${date(data.source.lastCheckedAt)}` : ' · link never checked'}{data.source.usageRestrictions ? ` · restrictions: ${data.source.usageRestrictions}` : ''}</p> : <p>No registered source.</p>}
          <p className="import-note">A reachable URL does not prove authorization or accuracy. Registry permission is an administrator attestation.</p>
        </section>
        <SpecificationsPanel data={data} />
        <ConflictsPanel data={data} onDone={reload} />
        <DuplicatesPanel data={data} onDone={reload} />
        <ImagesPanel data={data} />
        <PreviewPanel data={data} />
      </div>
      <aside>
        <section className="import-panel" aria-labelledby="actions-heading">
          <h2 id="actions-heading">Decision</h2>
          <p>{blocking ? `${blocking} blocking issue(s) must be resolved before approval.` : data.status === 'PENDING_REVIEW' ? 'No blocking issues. Review warnings, then approve.' : 'No blocking issues.'}</p>
          <div className="review-actions">{(actionsFor[data.status] ?? []).map(a => <Button key={a} type="button" variant={a === 'APPROVE' ? 'default' : actionText[a].destructive ? 'destructive' : 'outline'} disabled={busy || (a === 'APPROVE' && data.evaluation.readiness !== 'READY_FOR_APPROVAL') || ((a === 'SUBMIT' || a === 'RESUBMIT') && data.evaluation.readiness === 'BLOCKED')} onClick={() => open(a)}>{actionText[a].label}</Button>)}</div>
        </section>
        <section className="import-panel" aria-labelledby="validation-heading">
          <h2 id="validation-heading">Validation report</h2>
          <ul className="review-dimensions">{Object.entries(data.evaluation.dimensions).map(([d, v]) => <li key={d} data-state={v}><span>{words(d)}</span><span>{v === 'PASS' ? 'Pass' : v === 'WARN' ? 'Warnings' : 'Blocked'}</span></li>)}</ul>
          {groupOrder.map(s => { const items = data.evaluation.issues.filter(i => i.severity === s); return items.length ? <details key={s} open={s !== 'INFORMATION'}><summary>{s === 'BLOCKING_ERROR' ? 'Blocking errors' : s === 'WARNING' ? 'Warnings' : 'Information'} ({items.length})</summary><IssueList issues={items} /></details> : null; })}
          <p className="import-note">Readiness is rule-based. It is not an accuracy score and does not replace checking sources.</p>
        </section>
        <section className="import-panel" aria-labelledby="notes-heading">
          <h2 id="notes-heading">Review notes</h2>
          <ReasonField id="review-note" value={note} onChange={setNote} label="Private note" />
          {noteError && <p role="alert" className="import-error">{noteError}</p>}
          <Button type="button" variant="outline" disabled={noteBusy || note.trim().length < 10} onClick={saveNote}>{noteBusy ? 'Saving…' : 'Save review note'}</Button>
        </section>
        <section className="import-panel" aria-labelledby="history-heading">
          <h2 id="history-heading">History</h2>
          {data.history.length ? <ol className="review-history">{data.history.map(h => <li key={h.id}><strong>{words(h.kind)}</strong>{h.fromStatus && ` · ${words(h.fromStatus)} → ${words(h.toStatus ?? '')}`}<span className="review-meta">{date(h.createdAt)} · {h.actor?.name ?? 'Removed account'}</span><p>{h.reason}</p></li>)}</ol> : <p className="import-note">No review decisions yet.</p>}
          <h3>Published revisions</h3>
          {data.revisions.length ? <ol className="review-history">{data.revisions.map(r => <li key={r.id}><strong>Revision {r.revision}</strong><span className="review-meta">{date(r.createdAt)} · {r.actor ?? 'Removed account'}</span><p>{r.reason}</p></li>)}</ol> : <p className="import-note">Never published.</p>}
        </section>
      </aside>
    </div>

    <ConfirmDialog open={dialog !== ''} title={dialog ? actionText[dialog].title : ''} confirmLabel={dialog ? actionText[dialog].label : ''} destructive={!!dialog && actionText[dialog].destructive} busy={busy} disabled={reason.trim().length < 10 || (dialog === 'APPROVE' && !attest)} onConfirm={confirm} onClose={() => !busy && setDialog('')}>
      {dialog && <p>{actionText[dialog].body}</p>}
      {dialog === 'APPROVE' && data.evaluation.counts.warnings > 0 && <p className="import-note">{data.evaluation.counts.warnings} warning(s) remain; they do not block publication.</p>}
      <ReasonField id="decision-reason" value={reason} onChange={setReason} />
      {dialog === 'APPROVE' && <label className="review-check"><input type="checkbox" checked={attest} onChange={e => setAttest(e.target.checked)} /> I confirm the exact identity — {id_.brand} {id_.family} {id_.generation} {id_.tier} {id_.outsole} {id_.colorway} — and checked critical evidence against its cited sources.</label>}
      {actionError && <p role="alert" className="import-error">{actionError}</p>}
    </ConfirmDialog>
  </div>;
}
