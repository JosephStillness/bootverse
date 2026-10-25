import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConflictsPanel, ImagesPanel, PreviewPanel, showValue, type ReviewData } from './evidence';
import { IssueList } from './shared';

// Synthetic review payload only.
const claim = (id: string, value: unknown, status: string) => ({ id, version: 1, attribute: 'upperMaterial', value, status, basis: 'REPORTED', scope: 'ENTRY' as const, sourceUrl: 'javascript:alert(1)', observedAt: '2026-10-01T00:00:00Z', reviewedAt: null, source: { name: '<b>Synthetic</b>', type: 'RETAILER', status: 'ACTIVE', authorizationStatus: 'GRANTED' } });
const data = {
  id: 'e', slug: 'synthetic', status: 'PUBLISHED', version: 1, sample: false, submittedAt: null, fingerprint: 'f',
  conflicts: [{ attribute: 'upperMaterial', claims: [claim('a', 'Knit', 'VERIFIED'), claim('b', 'Leather', 'CONFLICTED')] }], sources: [],
  images: [{ id: 'i', altText: 'Synthetic', attribution: 'Synthetic', sourceUrl: 'https://example.test', isPrimary: true, status: 'UNVERIFIED', licenseStatus: 'UNKNOWN', rights: 'PERMISSION_PENDING', publicEligible: false, src: null, externalUrl: 'https://example.test/x.webp', usageRestrictions: null }],
  preview: { slug: 'synthetic', sample: false, identity: { brand: 'B' }, identifiers: [], attributes: [], images: [] }, previewChanged: null,
} as unknown as ReviewData;

it('renders both conflicting values side by side without linking unsafe URLs or injecting HTML', () => {
  const html = renderToStaticMarkup(<ConflictsPanel data={data} onDone={() => {}} />);
  expect(html).toContain('Knit'); expect(html).toContain('Leather');
  expect(html).not.toContain('href="javascript:');
  expect(html).not.toContain('<b>Synthetic</b>');
  expect(html.match(/Select as supported value/g)).toHaveLength(2);
});
it('withholds external image previews until permission is confirmed and shows the placeholder policy', () => {
  const html = renderToStaticMarkup(<ImagesPanel data={data} />);
  expect(html).not.toContain('x.webp'); expect(html).toContain('Preview withheld');
  expect(renderToStaticMarkup(<PreviewPanel data={data} />)).toContain('Placeholder image');
});
it('labels issue severity in text, not colour alone', () => {
  const html = renderToStaticMarkup(<IssueList issues={[{ code: 'x', severity: 'BLOCKING_ERROR', dimension: 'IDENTITY', message: 'Tier missing' }]} />);
  expect(html).toContain('Blocking'); expect(html).toContain('Tier missing');
});
it('formats contextual weight values', () => {
  expect(showValue({ amount: 200, unit: 'g', size: '9', sizeSystem: 'UK' })).toBe('200 g · UK 9');
  expect(showValue({ unknown: true })).toBe('Explicitly unknown');
});
