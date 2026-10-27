'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { date, safeHref, send, words } from '@/components/product-review/shared';
import { showValue } from '@/components/product-review/evidence';

export type Job = { id: string; trigger: string; entryPoint: string; mode: string; status: string; startedAt: string; completedAt: string | null; durationMs: number | null; summary: Record<string, unknown>; errorCategory: string | null; errorDetail: string | null; actor: string | null };
export type Alert = { id: string; kind: string; severity: string; message: string; status: string; occurrences: number; delivery: string; lastSeenAt: string };
export type Change = { id: string; kind: string; severity: string; outcome: string; disposition: string; attribute: string | null; recordId: string; previousValue: unknown; proposedValue: unknown; lastSeenAt: string; entry: { id: string; slug: string; status: string } | null };
export type Offer = { id: string; countryCode: string; size: string | null; sizeSystem: string | null; currency: string | null; amount: string | null; previousAmount: string | null; previousCurrency: string | null; availability: string; rawAvailability: string | null; status: string; lastObservedAt: string; missingSince: string | null; priceMissingSince: string | null; sourceUrl: string; priceFreshness: string; stockFreshness: string; entry: { id: string; slug: string; published: boolean } };

const n = (v: unknown) => typeof v === 'number' ? v : 0;
export function JobsPanel({ jobs }: { jobs: Job[] }) {
  return <section className="import-panel" aria-labelledby="jobs-heading">
    <h2 id="jobs-heading">Recent synchronization jobs</h2>
    {jobs.length ? <div className="review-table-wrap"><table className="review-table review-compact">
      <thead><tr><th scope="col">Started</th><th scope="col">Run</th><th scope="col">Result</th><th scope="col">Records</th></tr></thead>
      <tbody>{jobs.map(j => <tr key={j.id}>
        <td data-label="Started">{date(j.startedAt)}<span className="review-meta">{j.durationMs !== null ? `${j.durationMs} ms` : 'running'}</span></td>
        <td data-label="Run">{words(j.trigger)} · {j.entryPoint.replace('_', ' ')}{j.mode === 'PREVIEW' ? ' · preview' : ''}{j.actor ? <span className="review-meta">{j.actor}</span> : null}</td>
        <td data-label="Result">{words(j.status)}{j.errorDetail ? <span className="review-meta">{j.errorDetail}</span> : null}</td>
        <td data-label="Records">{n(j.summary.fetched)} fetched · {n(j.summary.rejected)} rejected<span className="review-meta">{n(j.summary.newProducts)} new · {n(j.summary.changes)} changes · {n(j.summary.pendingReview)} for review · {n(j.summary.offersSeen)} offers</span></td>
      </tr>)}</tbody>
    </table></div> : <p className="import-note">This source has never been synchronized.</p>}
  </section>;
}

export function AlertsPanel({ alerts, onDone }: { alerts: Alert[]; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  async function act(id: string, action: 'ACKNOWLEDGE' | 'RESOLVE') {
    setBusy(id); setError('');
    try { await send(`/api/admin/source-alerts/${id}`, { action }, 'PATCH'); onDone(`Alert ${action === 'ACKNOWLEDGE' ? 'acknowledged' : 'resolved'}.`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Alert update failed.'); } finally { setBusy(''); }
  }
  return <section className="import-panel" aria-labelledby="alerts-heading">
    <h2 id="alerts-heading">Alerts</h2>
    <p className="import-note">Alerts are written to the structured application log. No email or external channel is configured, so delivery shows “Logged”, not “Delivered”.</p>
    {error && <p role="alert" className="import-error">{error}</p>}
    {alerts.length ? <ul className="review-history">{alerts.map(a => <li key={a.id}>
      <strong>{words(a.kind)}</strong> · {a.severity === 'PAGE' ? 'Page' : 'Ticket'} · {words(a.status)}<span className="review-meta">{date(a.lastSeenAt)} · seen {a.occurrences}× · delivery: {words(a.delivery)}</span>
      <p>{a.message}</p>
      {a.status !== 'RESOLVED' && <div className="account-actions">{a.status === 'OPEN' && <Button type="button" variant="outline" disabled={!!busy} onClick={() => act(a.id, 'ACKNOWLEDGE')}>Acknowledge</Button>}<Button type="button" variant="outline" disabled={!!busy} onClick={() => act(a.id, 'RESOLVE')}>Resolve</Button></div>}
    </li>)}</ul> : <p className="import-note">No alerts.</p>}
  </section>;
}

export function ChangesPanel({ changes }: { changes: Change[] }) {
  return <section className="import-panel" aria-labelledby="changes-heading">
    <h2 id="changes-heading">Detected changes</h2>
    <p className="import-note">Critical and material changes are decided in the <Link className="text-link" href="/admin/products/review?quality=sync_changes">approval queue</Link>. Nothing here changes public data on its own.</p>
    {changes.length ? <div className="review-table-wrap"><table className="review-table review-compact">
      <thead><tr><th scope="col">Change</th><th scope="col">Product</th><th scope="col">Previous → proposed</th><th scope="col">Status</th></tr></thead>
      <tbody>{changes.map(c => <tr key={c.id}>
        <td data-label="Change">{words(c.kind)}<span className="review-meta">{words(c.severity)}{c.attribute ? ` · ${c.attribute}` : ''}</span></td>
        <td data-label="Product">{c.entry ? <Link className="text-link" href={`/admin/products/review/${c.entry.id}`}>{c.entry.slug}</Link> : <span>Record {c.recordId}</span>}<span className="review-meta">{words(c.outcome)}</span></td>
        <td data-label="Previous → proposed"><span className="review-value">{c.previousValue === null ? '—' : showValue(c.previousValue)}</span><span className="review-value">→ {c.proposedValue === null ? '—' : showValue(c.proposedValue)}</span></td>
        <td data-label="Status">{words(c.disposition)}<span className="review-meta">Seen {date(c.lastSeenAt)}</span></td>
      </tr>)}</tbody>
    </table></div> : <p className="import-note">No changes detected yet.</p>}
  </section>;
}

export function OffersPanel({ offers, total, page, pages, onPage, freshness }: { offers: Offer[]; total: number; page: number; pages: number; onPage: (p: number) => void; freshness: { priceFreshHours: number; stockFreshHours: number } }) {
  return <section className="import-panel" aria-labelledby="offers-heading">
    <h2 id="offers-heading">Retail offers ({total})</h2>
    <p className="import-note">Prices are compared only within one currency, country and size. A listing missing from a feed is noted, never treated as sold out. Prices older than {freshness.priceFreshHours} h and stock older than {freshness.stockFreshHours} h are marked stale and are not presented as current.</p>
    {offers.length ? <div className="review-table-wrap"><table className="review-table review-compact">
      <thead><tr><th scope="col">Listing</th><th scope="col">Price</th><th scope="col">Availability</th><th scope="col">Observed</th></tr></thead>
      <tbody>{offers.map(o => <tr key={o.id}>
        <td data-label="Listing"><Link className="text-link" href={`/admin/products/review/${o.entry.id}`}>{o.entry.slug}</Link><span className="review-meta">{o.countryCode}{o.size ? ` · ${o.sizeSystem} ${o.size}` : ''}{o.entry.published ? '' : ' · product not public'}{o.status === 'REMOVED' ? ' · delisted by source' : ''}</span></td>
        <td data-label="Price">{o.amount ? `${o.currency} ${o.amount}` : 'No price'}{o.previousAmount ? <span className="review-meta">was {o.previousCurrency} {o.previousAmount}</span> : null}{o.priceMissingSince ? <span className="review-meta">price missing since {date(o.priceMissingSince)}</span> : null}{o.priceFreshness === 'STALE' ? <span className="review-meta"><strong>Stale</strong></span> : null}</td>
        <td data-label="Availability">{words(o.availability)}{o.rawAvailability ? <span className="review-meta">Source label: {o.rawAvailability}</span> : null}{o.stockFreshness === 'STALE' ? <span className="review-meta"><strong>Stale</strong></span> : null}</td>
        <td data-label="Observed">{date(o.lastObservedAt)}{o.missingSince ? <span className="review-meta">not in feed since {date(o.missingSince)}</span> : null}{safeHref(o.sourceUrl) && <a className="text-link review-meta" href={o.sourceUrl} target="_blank" rel="noopener noreferrer">Source listing</a>}</td>
      </tr>)}</tbody>
    </table></div> : <p className="import-note">No offers from this source.</p>}
    {pages > 1 && <nav className="account-actions" aria-label="Offer pages"><Button type="button" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button><span>Page {page} of {pages}</span><Button type="button" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button></nav>}
  </section>;
}
