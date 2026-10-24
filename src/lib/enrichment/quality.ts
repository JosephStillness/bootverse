import { allAttributes } from '@/lib/product-data/validation';
import { isExplicitUnknown } from './observations';
export function freshnessPolicy(env: Record<string, string | undefined> = {}) {
    const days = (key: string, fallback: number) => { const n = Number(env[key]); return Number.isFinite(n) && n >= 1 && n <= 3650 ? n : fallback; };
    return { priceDays: days('PRODUCT_FRESHNESS_PRICE_DAYS', 7), stockDays: days('PRODUCT_FRESHNESS_STOCK_DAYS', 1), listingDays: days('PRODUCT_FRESHNESS_LISTING_DAYS', 90), technicalDays: days('PRODUCT_FRESHNESS_TECHNICAL_DAYS', 730), sourceDays: days('PRODUCT_FRESHNESS_SOURCE_DAYS', 90) };
}
type Claim = {
    attribute: string;
    value: unknown;
    status: string;
    observedAt: Date;
    sourceId: string | null;
    reviewedAt?: Date | null;
};
type Facts = {
    identityComplete: boolean;
    surfaceKnown: boolean;
    identityVerified: boolean;
    sourceAvailable: boolean;
    sourceCheckedAt: Date | null;
    claims: Claim[];
    images: {
        status: string;
        licenseStatus: string;
    }[];
    offers: {
        kind: string;
        observedAt: Date;
        validUntil: Date;
    }[];
};
export function qualityAssessment(f: Facts, now = new Date(), policy = freshnessPolicy()) {
    const age = (d: Date, days: number) => now.getTime() - d.getTime() > days * 86400000;
    const present = new Set(f.claims.filter(c => !isExplicitUnknown(c.value) && c.status !== 'REJECTED').map(c => c.attribute));
    const conflicts = f.claims.filter(c => c.status === 'CONFLICTED').length, images = f.images.filter(i => i.status === 'VERIFIED' && i.licenseStatus === 'GRANTED').length;
    const issues: string[] = [];
    if (!f.identityComplete)
        issues.push('identity_incomplete');
    if (!f.identityVerified)
        issues.push('identity_not_verified');
    if (!f.surfaceKnown)
        issues.push('outsole_unknown');
    if (!f.sourceAvailable)
        issues.push('source_unavailable');
    if (conflicts)
        issues.push('unresolved_conflict');
    if (!images)
        issues.push('no_authorized_image');
    if (!f.sourceCheckedAt)
        issues.push('source_check_missing');
    const stale = [...f.offers.filter(o => o.validUntil < now || age(o.observedAt, o.kind === 'AVAILABILITY' ? policy.stockDays : policy.priceDays)).map(o => ({ kind: o.kind, observedAt: o.observedAt.toISOString(), reason: 'Potentially stale; not evidence of falsehood.' })), ...f.claims.filter(c => age(c.observedAt, c.attribute === 'releaseDate' ? policy.listingDays : policy.technicalDays)).map(c => ({ kind: c.attribute, observedAt: c.observedAt.toISOString(), reason: 'Review freshness; historical construction may remain correct.' }))];
    if (f.sourceCheckedAt && age(f.sourceCheckedAt, policy.sourceDays))
        stale.push({ kind: 'SOURCE_URL', observedAt: f.sourceCheckedAt.toISOString(), reason: 'Source link has not recently been checked; no request was made.' });
    const missing = allAttributes.filter(a => !present.has(a));
    return { completeness: { identity: f.identityComplete, tierAndOutsole: f.surfaceKnown, technicalPresent: present.size, technicalTotal: allAttributes.length, missing, authorizedImages: images, sourceBackedClaims: f.claims.filter(c => !!c.sourceId).length }, verification: { reviewedClaims: f.claims.filter(c => !!c.reviewedAt).length, verifiedClaims: f.claims.filter(c => c.status === 'VERIFIED').length, unresolvedConflicts: conflicts, unverifiedIdentity: !f.identityVerified }, publication: { ready: f.identityComplete && f.identityVerified && f.sourceAvailable && f.surfaceKnown && conflicts === 0, blockers: issues.filter(i => ['identity_incomplete', 'identity_not_verified', 'source_unavailable', 'outsole_unknown', 'unresolved_conflict'].includes(i)) }, issues, stale };
}
