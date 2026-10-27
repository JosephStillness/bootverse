'use client';
export type Health = 'HEALTHY' | 'DEGRADED' | 'FAILING' | 'DISABLED' | 'NEVER_SYNCHRONIZED';
const healthText: Record<Health, string> = { HEALTHY: 'Healthy', DEGRADED: 'Degraded', FAILING: 'Failing', DISABLED: 'Disabled', NEVER_SYNCHRONIZED: 'Never synchronized' };
export function HealthBadge({ value }: { value: Health }) {
  return <span className="review-pill" data-tone={value === 'FAILING' ? 'bad' : value === 'DEGRADED' ? 'warn' : value === 'HEALTHY' ? 'ok' : 'neutral'}>{healthText[value]}</span>;
}
// Plain-language eligibility reasons, derived server-side from real records.
export const reasonText: Record<string, string> = {
  DUE: 'Eligible to run', NOT_DUE: 'Not due yet', DISABLED: 'Scheduled sync is off', NOT_AUTHORIZED: 'Automated access is not documented as permitted',
  AUTHORIZATION_REVIEW_DUE: 'Authorization review is overdue', NO_ADAPTER: 'No server adapter is configured', BACKOFF: 'Backing off after a failure or rate limit',
  MIN_INTERVAL: 'Provider minimum interval has not elapsed', SOURCE_ARCHIVED: 'Source is archived', ALREADY_RUNNING: 'A sync is already running',
  DUPLICATE_REQUEST: 'This request was already processed', SOURCE_NOT_FOUND: 'Source not found',
};
