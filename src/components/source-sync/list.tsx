'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { date, words } from '@/components/product-review/shared';
import { HealthBadge, reasonText, type Health } from './shared';

type Source = {
  id: string; name: string; type: string; authorizationStatus: string; permissionDocumented: boolean; syncEnabled: boolean; adapterKey: string | null;
  syncIntervalMinutes: number | null; lastSyncAttemptAt: string | null; lastSyncSuccessAt: string | null; nextSyncAt: string | null; syncFailureCount: number;
  lastSyncErrorCategory: string | null; openAlerts: number; pendingChanges: number; health: Health; scheduled: string;
};
type Data = { sources: Source[]; fixturesEnabled: boolean; adapters: { key: string; kind: string; host: string | null }[] };

export function DataSourceList() {
  const [data, setData] = useState<Data>(), [error, setError] = useState(''), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/data-sources', { signal: controller.signal })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? 'Sources unavailable.'); setData(d); setError(''); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Sources unavailable.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  if (loading && !data) return <div className="skeleton h-48" role="status" aria-label="Loading data sources" />;
  if (error && !data) return <div role="alert" className="import-error"><p>{error}</p><Button type="button" variant="outline" onClick={() => { setLoading(true); setRefresh(n => n + 1); }}>Retry</Button></div>;
  if (!data) return null;
  const counts = data.sources.reduce<Record<string, number>>((n, s) => ({ ...n, [s.health]: (n[s.health] ?? 0) + 1 }), {});
  return <>
    <ul className="review-stats" aria-label="Source health">
      {(['HEALTHY', 'DEGRADED', 'FAILING', 'DISABLED', 'NEVER_SYNCHRONIZED'] as Health[]).map(h => <li key={h}><div><span>{words(h)}</span><strong>{counts[h] ?? 0}</strong></div></li>)}
      <li><Link href="/admin/products/review?quality=sync_changes" className="review-stat-link"><span>Pending source changes</span><strong>{data.sources.reduce((n, s) => n + s.pendingChanges, 0)}</strong></Link></li>
    </ul>
    <p className="import-note">
      Live feeds configured on this server: {data.adapters.filter(a => a.kind === 'http').length ? data.adapters.filter(a => a.kind === 'http').map(a => `${a.key} (${a.host})`).join(', ') : 'none — live synchronization is not active'}.
      {data.fixturesEnabled ? ' Synthetic fixture adapters are enabled in this environment (local testing only).' : ''}
    </p>
    {!data.sources.length ? <div role="status" className="review-empty"><h3>No active sources</h3><p>Register a source and document its access permission in the source registry first. Nothing is synchronized without it.</p></div> :
      <div className="review-table-wrap"><table className="review-table">
        <caption className="sr-only">Registered product data sources</caption>
        <thead><tr><th scope="col">Source</th><th scope="col">Health</th><th scope="col">Authorization</th><th scope="col">Last success</th><th scope="col">Next check</th><th scope="col">Attention</th></tr></thead>
        <tbody>{data.sources.map(s => <tr key={s.id}>
          <td data-label="Source"><Link className="text-link review-name" href={`/admin/data-sources/${s.id}`}>{s.name}</Link><span className="review-meta">{words(s.type)} · {s.adapterKey ?? 'no adapter'}{s.syncEnabled && s.syncIntervalMinutes ? ` · every ${s.syncIntervalMinutes} min` : ''}</span></td>
          <td data-label="Health"><HealthBadge value={s.health} /><span className="review-meta">{reasonText[s.scheduled] ?? s.scheduled}</span></td>
          <td data-label="Authorization">{words(s.authorizationStatus)}{s.permissionDocumented ? '' : ' · undocumented'}</td>
          <td data-label="Last success">{date(s.lastSyncSuccessAt)}<span className="review-meta">Attempted {date(s.lastSyncAttemptAt)}</span></td>
          <td data-label="Next check">{s.syncEnabled ? date(s.nextSyncAt) : '—'}</td>
          <td data-label="Attention">{s.syncFailureCount ? `${s.syncFailureCount} failure(s) · ${words(s.lastSyncErrorCategory ?? 'unknown')}` : 'No failures'}<span className="review-meta">{s.openAlerts} open alert(s) · {s.pendingChanges} change(s) awaiting review</span></td>
        </tr>)}</tbody>
      </table></div>}
  </>;
}
