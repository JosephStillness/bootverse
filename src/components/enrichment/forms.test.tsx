import { it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EnrichmentWorkbench } from './workbench';
import { EvidencePanel } from './evidence-panel';
it('search and image presentation forms expose native submit controls', () => {
    const html = renderToStaticMarkup(<EnrichmentWorkbench />);
    expect(html.match(/<button[^>]*>Search products<\/button>/)?.[0]).toContain('type="submit"');
    const evidence = renderToStaticMarkup(<EvidencePanel claims={[]} images={[{ id: 'photo', altText: 'Synthetic photo', sortOrder: 0, isPrimary: false, status: 'UNVERIFIED', version: 1, licenseStatus: 'UNKNOWN', sourceUrl: 'https://example.test', uploadedImageId: null }]} onChange={() => { }}/>);
    expect(evidence.match(/<button[^>]*>Save image presentation<\/button>/)?.[0]).toContain('type="submit"');
});
