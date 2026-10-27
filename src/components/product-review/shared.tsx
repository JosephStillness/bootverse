'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export type Issue = { code: string; severity: 'BLOCKING_ERROR' | 'WARNING' | 'INFORMATION'; dimension: string; message: string; ref?: string };
export type Readiness = 'READY_FOR_REVIEW' | 'NEEDS_CORRECTION' | 'BLOCKED' | 'READY_FOR_APPROVAL';

/** JSON request with a timeout. Throws the server's human-readable message on failure. */
export async function send<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const response = await fetch(path, { method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'The request failed. Nothing was changed.');
  return data as T;
}
export const newRequestId = () => crypto.randomUUID();
export const words = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
export const date = (value: string | Date | null | undefined) => value ? new Date(value).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
export const safeHref = (url: string | null | undefined) => url && /^https:\/\//.test(url) ? url : null;

const readinessText: Record<Readiness, string> = { READY_FOR_APPROVAL: 'Ready for approval', READY_FOR_REVIEW: 'Ready for review', NEEDS_CORRECTION: 'Needs correction', BLOCKED: 'Blocked' };
export function ReadinessBadge({ value, status }: { value: Readiness; status?: string }) {
  // Published/archived records have nothing to submit; say what the checks found instead.
  const text = value === 'READY_FOR_REVIEW' && (status === 'PUBLISHED' || status === 'ARCHIVED') ? 'Checks pass' : readinessText[value];
  return <span className="review-pill" data-tone={value === 'BLOCKED' ? 'bad' : value === 'NEEDS_CORRECTION' ? 'warn' : 'ok'}>{text}</span>;
}
export function StatusBadge({ value }: { value: string }) {
  return <span className="review-pill" data-tone="neutral">{words(value)}</span>;
}
const severityText = { BLOCKING_ERROR: 'Blocking', WARNING: 'Warning', INFORMATION: 'Info' } as const;
export function IssueList({ issues, empty = 'No issues.' }: { issues: Issue[]; empty?: string }) {
  if (!issues.length) return <p className="import-note">{empty}</p>;
  return <ul className="review-issues">{issues.map((issue, n) => (
    <li key={`${issue.code}-${issue.ref ?? n}`} data-severity={issue.severity}>
      <span className="review-severity">{severityText[issue.severity]}</span>
      <span>{issue.message}<span className="review-code"> · {issue.dimension.toLowerCase().replaceAll('_', ' ')} · {issue.code}</span></span>
    </li>
  ))}</ul>;
}

/** Native modal dialog: traps focus, closes on Escape, returns focus to the opener. */
export function ConfirmDialog({ open, title, children, confirmLabel, busy, disabled, destructive, onConfirm, onClose }: { open: boolean; title: string; children: ReactNode; confirmLabel: string; busy?: boolean; disabled?: boolean; destructive?: boolean; onConfirm: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  return <dialog ref={ref} className="review-dialog" aria-labelledby="review-dialog-title" onClose={onClose} onCancel={e => { if (busy) e.preventDefault(); }}>
    <form method="dialog" onSubmit={e => { e.preventDefault(); if (!busy && !disabled) onConfirm(); }}>
      <h2 id="review-dialog-title">{title}</h2>
      {children}
      <div className="account-actions">
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button type="submit" variant={destructive ? 'destructive' : 'default'} disabled={busy || disabled}>{busy ? 'Working…' : confirmLabel}</Button>
      </div>
    </form>
  </dialog>;
}

export function ReasonField({ id, value, onChange, label = 'Reason (recorded in audit history)' }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  const short = value.trim().length > 0 && value.trim().length < 10;
  return <>
    <label htmlFor={id}>{label}</label>
    <textarea id={id} value={value} onChange={e => onChange(e.target.value)} minLength={10} maxLength={2000} required aria-describedby={`${id}-help`} aria-invalid={short} />
    <p id={`${id}-help`} className="import-note">{short ? 'Use at least 10 characters.' : 'At least 10 characters. Private: never shown on public pages.'}</p>
  </>;
}
