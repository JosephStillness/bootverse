import assert from 'node:assert/strict';

// Run only on the disposable QA environment described in the remediation report.
// The caller supplies an authenticated Playwright Page; no tokens are read by these tests.
export async function finderProfileRecovery(page, base='http://localhost:3100') {
 const path='**/api/account/foot-profile';
 await page.goto(base+'/boot-fit-finder');
 await page.getByText('No saved foot profile.',{exact:false}).waitFor();
 let held;
 await page.route(path,route=>{held=route;});
 await page.reload();
 await page.getByText('Loading your private saved profile…',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Continue manually without saving'}).click();
 await page.getByLabel('Left foot length (mm)',{exact:true}).fill('270');
 await held.fulfill({json:{profile:null}}).catch(()=>{}); // Expected: the original fetch was canceled.
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Back',exact:true}).click();
 assert.equal(await page.getByLabel('Left foot length (mm)',{exact:true}).inputValue(),'270');
 assert.match(await page.locator('.finder-preload').textContent(),/Saving is disabled/);
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.locator('#finder-surface').selectOption('AG');
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
 const save=page.getByRole('checkbox',{name:'Save these preferences privately',exact:false});assert.equal(await save.isDisabled(),true);assert.equal(await save.isChecked(),false);
 await page.unroute(path);

 // A never-resolving request reaches the real ten-second deadline and releases the wizard.
 await page.route(path,route=>{held=route;});
 await page.reload();
 await page.getByText('Your saved profile could not be loaded.',{exact:false}).waitFor({timeout:14_000});
 await page.unroute(path);
 await page.getByRole('button',{name:'Retry profile loading'}).click();
 await page.getByText('No saved foot profile.',{exact:false}).waitFor();
 await held.abort().catch(()=>{});

 for(const status of ['network',401]){
  await page.route(path,route=>status==='network'?route.abort('failed'):route.fulfill({status:401,json:{error:'Sign in required'}}));
  await page.reload();
  await page.getByText('Your saved profile could not be loaded.',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Continue manually without saving'}).click();
  await page.getByLabel('Left foot length (mm)',{exact:true}).waitFor();
  assert.match(await page.locator('.finder-preload').textContent(),/Saving is disabled/);
  await page.unroute(path);
 }
 // Unmount cancels the old read and must not change a later page.
 await page.route(path,route=>{held=route;});
 await page.reload();await page.getByText('Loading your private saved profile…',{exact:true}).waitFor();
 await page.goto(base+'/boots');await page.getByRole('heading',{name:'Explore boots.'}).waitFor();
 await held.fulfill({json:{profile:null}}).catch(()=>{});await page.unroute(path);
 assert.equal(new URL(page.url()).pathname,'/boots');
 return 'PASS: profile success, held request/manual escape, stale completion, real timeout, retry, network error, expired-session response and unmount';
}

export async function catalogueComparison(page,base='http://localhost:3100'){
 await page.setViewportSize({width:1440,height:900});await page.goto(base+'/boots');
 await page.waitForFunction(()=>document.querySelectorAll('.boot-card').length===12);
 await page.getByRole('searchbox',{name:'Search boots'}).fill('Synthetic QA');
 await page.waitForFunction(()=>document.querySelectorAll('.boot-card').length===7);
 await page.locator('#desktop-brand').selectOption('nike');await page.locator('#desktop-silo').selectOption('mercurial');
 await page.locator('#desktop-tier').selectOption('Elite');await page.locator('#desktop-surface').selectOption('AG');await page.locator('#sort').selectOption('name-desc');
 await page.waitForFunction(()=>document.querySelectorAll('.boot-card').length===1);
 assert.match(await page.locator('.boot-card-link').getAttribute('href'),/qa-product-1/);
 await page.getByRole('button',{name:'Compare this variant',exact:true}).click();
 await page.locator('#desktop-surface').selectOption('FG');
 await page.waitForFunction(()=>document.querySelector('.boot-card-link')?.getAttribute('href')?.includes('qa-product-0'));
 await page.getByRole('button',{name:'Compare this variant',exact:true}).click();await page.getByRole('link',{name:'Compare selected boots'}).click();
 await page.getByRole('table').waitFor();assert.match(await page.getByRole('table').textContent(),/qa-variant-1/);
 await page.getByRole('link',{name:'Remove Mercurial AG',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.comparison-table thead th').length===2);
 assert.match(await page.getByRole('complementary',{name:'Selected boot variants'}).textContent(),/1 of 4/);
 await page.getByRole('button',{name:'Clear selection'}).click();await page.getByRole('heading',{name:'Your shortlist is empty.'}).waitFor();
 return 'PASS: database filters/search/sorting and exact comparison/removal/clear';
}

export async function adminFilterRecovery(page,base='http://localhost:3100'){
 await page.goto(base+'/admin');await page.getByRole('heading',{name:'Moderation desk.'}).waitFor();
 await page.getByRole('button',{name:'Filter reports'}).waitFor();
 await page.getByText('Loading moderation queue…',{exact:true}).waitFor({state:'hidden'});
 let requests=0;const count=request=>{if(new URL(request.url()).pathname==='/api/admin')requests++;};page.on('request',count);
 const filter=page.getByRole('button',{name:'Filter reports'});
 await filter.click();await filter.click();
 assert.equal(await page.getByText('Loading moderation queue…',{exact:true}).count(),0);
 assert.equal(requests,0); // Exact original bug: unchanged criteria must not fabricate a pending request.
 await page.getByLabel('Search reason or explanation').fill('unmatched-qa-search');await filter.click();
 await page.waitForURL(url=>url.searchParams.get('q')==='unmatched-qa-search');
 await page.getByText('Loading moderation queue…',{exact:true}).waitFor({state:'hidden'});
 await page.getByText('No reports in this view.',{exact:true}).waitFor();
 assert.equal(new URL(page.url()).searchParams.get('q'),'unmatched-qa-search');
 await page.goBack();await page.waitForFunction(()=>document.querySelector('input[name="q"]')?.value==='');assert.equal(await page.getByLabel('Search reason or explanation').inputValue(),'');
 await page.getByRole('button',{name:'Reset filters'}).click();
 await page.waitForURL(url=>!url.searchParams.get('q'));
 await page.getByText('Loading moderation queue…',{exact:true}).waitFor({state:'hidden'});
 await page.route('**/api/admin?**',route=>route.fulfill({status:503,json:{error:'Synthetic QA failure'}}));
 await page.getByRole('button',{name:'Refresh dashboard'}).click();await page.getByText('Synthetic QA failure',{exact:true}).waitFor();
 assert.equal(await page.getByText('Loading moderation queue…',{exact:true}).count(),0);
 await page.unroute('**/api/admin?**');await page.getByRole('button',{name:'Refresh dashboard'}).click();
 await page.getByText('Loading moderation queue…',{exact:true}).waitFor({state:'hidden'});
 page.off('request',count);
 return 'PASS: identical/changed/reset filters, repeated submit, history, empty/error/retry';
}

export async function productDataProvenance(page,base='http://localhost:3100'){
 // Mutations are allowed only in the owned browser QA fixture environment.
 assert.equal(new URL(base).origin,'http://localhost:3100');
 const request=async(method,path,data)=>{
  const response=await page.request.fetch(base+path,{method,data,headers:{Origin:base}});
  assert.equal(response.ok(),true);return response.json();
 };
 const sourceInput={name:'Synthetic nguồn '+('A'.repeat(95)),type:'MANUAL_RESEARCH',baseUrl:'https://example.test',accessMethod:'Manual QA fixture only'};
 const source=await request('POST','/api/admin/product-sources',sourceInput);
 const value='Synthetic D1 text <svg onload=alert(1)> is plain text';
 const claim=await request('POST','/api/admin/products/qa-product-0/records',{kind:'claim',data:{entryId:'qa-product-0',sourceId:source.id,sourceUrl:'https://example.test/spec',observedAt:new Date(Date.now()-60000).toISOString(),attribute:'upperMaterial',value,basis:'REPORTED'}});
 const decision={note:'Synthetic browser QA source check only.',sourceChecked:true};
 await request('PATCH','/api/admin/product-claims/'+claim.id,{...decision,status:'PENDING_REVIEW',version:1});
 await request('PATCH','/api/admin/product-claims/'+claim.id,{...decision,status:'VERIFIED',version:2});
 await page.goto(base+'/boots/qa-product-0');
 await page.getByText(value,{exact:true}).waitFor();
 assert.match(await page.locator('#specifications').textContent(),/not independent scientific certification/);
 assert.equal(await page.locator('#specifications svg[onload]').count(),0);
 for(const width of [320,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 const link=page.locator('#specifications').getByRole('link').first();await link.focus();
 assert.equal(await link.evaluate(el=>el===document.activeElement),true);
 assert.equal(await link.getAttribute('rel'),'noopener noreferrer');
 await request('PUT','/api/admin/product-sources/'+source.id,{...sourceInput,version:source.version,status:'ARCHIVED'});
 await page.reload();assert.equal(await page.getByText(value,{exact:true}).count(),0);
 assert.match(await page.locator('#specifications').textContent(),/No unambiguous, source-checked claim/);
 return 'PASS: admin source/claim workflow, escaped provenance, 320/768/1024/1440 layouts, keyboard source link and source revocation';
}

export async function productImportWorkflow(page,base='http://localhost:3100'){
 assert.equal(new URL(base).origin,'http://localhost:3100');
 await page.goto(base+'/admin/products/import');await page.getByRole('heading',{name:'Import with provenance.'}).waitFor();
 await page.getByLabel('Registered source').selectOption('qa-import-source');
 await page.getByLabel('Product data file').setInputFiles('public/data-import/synthetic-template.csv');
 await page.getByText('Selected: synthetic-template.csv · CSV',{exact:true}).waitFor();
 const validate=page.getByRole('button',{name:'Validate & preview'});await validate.click();await page.getByRole('heading',{name:'2. Inspect preview'}).waitFor();
 assert.match(await page.getByRole('region',{name:'Import preview'}).textContent(),/NEW RECORD/);
 const execute=page.getByRole('button',{name:'Execute import',exact:true});assert.equal(await execute.isDisabled(),true);
 await page.getByRole('checkbox',{name:'I reviewed this preview.',exact:false}).check();
 await execute.click();
 await page.getByText('Import completed. No product was automatically published.',{exact:true}).waitFor();
 await page.getByRole('region',{name:'Import batch report'}).getByText('SUCCEEDED',{exact:true}).waitFor();
 const catalogue=await (await page.request.get(base+'/api/boots?q=Synthetic%20Example')).json();assert.equal(catalogue.total,0);
 await validate.click();await page.getByRole('region',{name:'Import preview'}).getByText('Row 2 · EXACT MATCH',{exact:true}).waitFor();
 assert.match(await page.getByRole('region',{name:'Import preview'}).textContent(),/NOOP/);
 for(const width of [320,768,1024,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.getByLabel('Registered source').focus();await page.keyboard.press('Tab');assert.equal(await page.getByLabel('Product data file').evaluate(el=>el===document.activeElement),true);
 assert.equal(new URL(page.url()).search,'');
 const reportLink=page.getByRole('link',{name:'Download CSV report',exact:true});const response=await page.request.get(base+await reportLink.getAttribute('href'));assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/text\/csv/);
 const guest=await page.context().browser().newContext();try{const tab=await guest.newPage();await tab.goto(base+'/admin/products/import');await tab.waitForURL(url=>url.pathname==='/login');assert.equal(new URL(tab.url()).pathname,'/login');}finally{await guest.close();}
 return 'PASS: CSV upload/source selection, mandatory preview and confirmation, draft persistence, repeat no-op, private report, guest protection and responsive keyboard flow';
}

export async function productEnrichmentWorkflow(page,base='http://localhost:3100'){
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/admin/products/enrich');
 await page.getByRole('heading',{name:'Evidence before claims.'}).waitFor();
 await page.getByLabel('Search product slugs').fill('qa-product-0');await page.getByRole('button',{name:'Search products',exact:true}).click();
 await page.getByRole('button',{name:'qa-product-0',exact:true}).click();await page.getByText('Exact variant: qa-variant-0',{exact:false}).waitFor();
 await page.getByLabel('Authorized source',{exact:true}).selectOption('qa-import-source');
 await page.getByLabel('Evidence URL',{exact:true}).fill('https://example.test/d3-browser');
 await page.getByLabel('Observed at (your local time)',{exact:true}).fill('2026-10-01T12:00');
 await page.getByLabel('Document/source revision (optional)',{exact:true}).fill('synthetic-browser-doc-1');
 await page.getByLabel('Attribute',{exact:true}).selectOption('heelStructure');
 await page.getByLabel('Observed value',{exact:true}).fill('Synthetic D3 browser heel observation');
 await page.getByRole('button',{name:'Preview enrichment',exact:true}).click();
 await page.getByRole('region',{name:'Enrichment preview'}).waitFor();
 await page.getByRole('checkbox',{name:'I reviewed this exact preview',exact:false}).check();
 await page.getByRole('button',{name:'Save draft enrichment',exact:true}).click();
 await page.getByText('Draft observations saved.',{exact:false}).waitFor();
 await page.reload();await page.getByLabel('Search product slugs').fill('qa-product-0');await page.getByRole('button',{name:'Search products',exact:true}).click();
 await page.getByRole('button',{name:'qa-product-0',exact:true}).click();await page.getByText('heelStructure · UNVERIFIED',{exact:true}).waitFor();
 await page.getByLabel('Decision note (at least 10 characters)').fill('Synthetic owned QA evidence checked, not a real specification');
 await page.getByRole('button',{name:'PENDING REVIEW',exact:true}).click();await page.getByText('heelStructure · PENDING REVIEW',{exact:true}).waitFor();
 await page.getByLabel('Decision note (at least 10 characters)').fill('Synthetic owned QA evidence checked, not a real specification');
 await page.getByRole('checkbox',{name:'I checked this observation',exact:false}).check();await page.getByRole('button',{name:'VERIFIED',exact:true}).click();await page.getByText('heelStructure · VERIFIED',{exact:true}).waitFor();
 for(const width of [320,768,1024,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.setViewportSize({width:1440,height:1000});await page.getByLabel('Search product slugs').focus();await page.keyboard.press('Tab');assert.equal(await page.getByRole('button',{name:'Search products',exact:true}).evaluate(e=>e===document.activeElement),true);
 await page.getByLabel('Authorized source',{exact:true}).selectOption('qa-import-source');
 await page.getByText('Upload authorized product photos',{exact:true}).click();
 await page.getByRole('checkbox',{name:'I have permission to store these files',exact:false}).check();
 const picker=page.getByLabel('Choose photos or drop them here',{exact:true});await picker.setInputFiles('tests/fixtures/synthetic-product.png');await page.getByRole('button',{name:'Remove selected photo 1',exact:true}).click();await picker.setInputFiles('tests/fixtures/synthetic-product.png');await page.getByRole('button',{name:'Upload selected photos',exact:true}).click();await page.getByRole('button',{name:'Use image 1',exact:true}).waitFor();
 const imageSrc=await page.getByRole('img',{name:'Community photo 1',exact:true}).getAttribute('src');await page.getByRole('button',{name:'Use image 1',exact:true}).click();
 await page.getByLabel('Evidence URL',{exact:true}).fill('https://example.test/d3-browser-photo');await page.getByLabel('Observed at (your local time)',{exact:true}).fill('2026-10-01T12:00');await page.getByRole('checkbox',{name:'Include technical observation',exact:true}).uncheck();await page.getByText('Attach image metadata',{exact:true}).click();await page.getByRole('checkbox',{name:'Include product asset',exact:true}).check();await page.getByLabel('Image attribution',{exact:true}).fill('Synthetic owned QA image');await page.getByLabel('Alt text',{exact:true}).fill('Synthetic browser product photo');await page.getByRole('checkbox',{name:'Primary image (only if none exists)',exact:true}).check();
 await page.getByRole('button',{name:'Preview enrichment',exact:true}).click();await page.getByRole('region',{name:'Enrichment preview'}).waitFor();await page.getByRole('checkbox',{name:'I reviewed this exact preview',exact:false}).check();await page.getByRole('button',{name:'Save draft enrichment',exact:true}).click();await page.getByText('Synthetic browser product photo · UNVERIFIED · rights: UNKNOWN',{exact:true}).waitFor();
 const guest=await page.context().browser().newContext();try{assert.equal((await guest.request.get(base+imageSrc)).status(),404);}finally{await guest.close();}
 await page.getByText('Update usage permission',{exact:true}).click();await page.getByRole('combobox',{name:'Permission status',exact:true}).selectOption('GRANTED');await page.getByLabel('Permission reference',{exact:true}).fill('https://example.test/owned-fixture-license');await page.getByLabel('Permission evidence',{exact:true}).fill('Synthetic solid-color fixture generated for isolated QA; no third-party photograph');await page.getByLabel('Reason for rights update',{exact:true}).fill('Synthetic owned QA license documented, not a real boot photo');await page.getByRole('button',{name:'Save permission for review',exact:true}).click();await page.getByText('Synthetic browser product photo · UNVERIFIED · rights: GRANTED',{exact:true}).waitFor();
 const assetCard=page.locator('section.import-panel').filter({has:page.getByRole('heading',{name:'Evidence & conflicts',exact:true})}).locator('.import-row').filter({hasText:'Synthetic browser product photo'});
 for(const status of ['PENDING REVIEW','VERIFIED']){await page.getByLabel('Decision note (at least 10 characters)').fill('Synthetic owned QA asset source and licensing checked');await page.getByRole('checkbox',{name:'I checked this observation',exact:false}).check();await assetCard.getByRole('button',{name:status,exact:true}).click();await page.getByText('Synthetic browser product photo · '+status.replaceAll(' ','_')+' · rights: GRANTED',{exact:true}).waitFor();}
 await page.goto(base+'/boots/qa-product-0');await page.getByText('Synthetic D3 browser heel observation',{exact:true}).waitFor();await page.getByRole('img',{name:'Synthetic browser product photo',exact:true}).waitFor();assert.match(await page.getByRole('heading',{name:'Source observations'}).textContent(),/Source observations/);
 await page.goto(base+'/admin/products/enrich');await page.getByRole('heading',{name:'Evidence before claims.'}).waitFor();
 return 'PASS: persisted enrichment after reload, explicit evidence review, authorized upload/preview removal, licensed image review and sourced public projection, exact variant, keyboard and 320/768/1024/1440 layout';
}

export async function productReviewWorkflow(page,base='http://localhost:3100'){
 // Mutations are allowed only in the owned, disposable browser QA environment.
 assert.equal(new URL(base).origin,'http://localhost:3100');
 const noOverflow=async()=>{for(const width of [320,768,1024,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}await page.setViewportSize({width:1440,height:1000});};
 await page.setViewportSize({width:1440,height:1000});
 assert.equal((await page.request.get(base+'/boots/qa-review-draft')).status(),404);
 await page.goto(base+'/admin/products/review');
 await page.getByRole('heading',{name:'Approval queue.'}).waitFor();
 await page.getByRole('button',{name:/^Draft\s*\d+$/}).click();
 await page.getByRole('link',{name:/Synthetic QA generation/}).first().waitFor();
 await page.getByRole('checkbox',{name:'Select qa-review-blocked'}).check();
 await page.getByRole('button',{name:'Preview validation',exact:true}).click();
 await page.getByRole('heading',{name:'Validation preview'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Approve eligible (0)'}).isDisabled(),true);
 await noOverflow();
 await page.screenshot({path:'output/playwright/d4-review-queue-desktop.png',fullPage:true});
 await page.setViewportSize({width:375,height:900});await page.screenshot({path:'output/playwright/d4-review-queue-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'/admin/products/review/qa-review-blocked');
 await page.getByText('Blocked',{exact:true}).first().waitFor();
 assert.equal(await page.getByRole('button',{name:'Submit for review',exact:true}).isDisabled(),true);
 await page.getByText('The outsole category is unknown',{exact:false}).waitFor();
 await page.goto(base+'/admin/products/review/qa-review-draft');
 await page.getByRole('heading',{name:'Decision'}).waitFor();
 const decide=async(button,confirm,reason)=>{
  await page.getByRole('button',{name:button,exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  assert.equal(await dialog.getByRole('button',{name:confirm,exact:true}).isDisabled(),true);
  await dialog.getByLabel('Reason (recorded in audit history)').fill(reason);
  return dialog;
 };
 let dialog=await decide('Submit for review','Submit for review','Synthetic browser QA submission only.');
 await dialog.getByRole('button',{name:'Submit for review',exact:true}).click();
 await page.getByText('Submit for review: saved and recorded in history.',{exact:true}).waitFor();
 dialog=await decide('Approve and publish','Approve and publish','Synthetic browser QA approval; fixture only.');
 assert.equal(await dialog.getByRole('button',{name:'Approve and publish',exact:true}).isDisabled(),true,'attestation required');
 await dialog.getByRole('checkbox',{name:/I confirm the exact identity/}).check();
 await dialog.getByRole('button',{name:'Approve and publish',exact:true}).click();
 await page.getByText('Approve and publish: saved and recorded in history.',{exact:true}).waitFor();
 await page.getByRole('link',{name:'Public page',exact:true}).waitFor();
 await page.getByText('Revision 1',{exact:true}).waitFor();
 // Keyboard: open the archive confirmation, then Escape cancels without changing anything.
 await page.getByRole('button',{name:'Archive',exact:true}).focus();await page.keyboard.press('Enter');
 await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');
 await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal(await page.getByRole('button',{name:'Archive',exact:true}).evaluate(el=>el===document.activeElement),true,'focus returns to the opener');
 await noOverflow();
 await page.screenshot({path:'output/playwright/d4-review-detail-desktop.png',fullPage:true});
 await page.setViewportSize({width:375,height:900});await page.screenshot({path:'output/playwright/d4-review-detail-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
 assert.equal((await page.request.get(base+'/boots/qa-review-draft')).status(),200);
 // Archive through the UI: removes it from public pages while keeping its URL identity and history.
 dialog=await decide('Archive','Archive','Synthetic browser QA archive; restores catalogue fixtures.');
 await dialog.getByRole('button',{name:'Archive',exact:true}).click();
 await page.getByText('Archive: saved and recorded in history.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Resubmit for review',exact:true}).waitFor();
 assert.equal((await page.request.get(base+'/boots/qa-review-draft')).status(),404);
 return 'PASS: queue filters/bulk preview, blocked identity, submit, attested approval, public visibility, revision, keyboard dialog, archive, 320/768/1024/1440 layouts';
}

export async function productSyncWorkflow(page,base='http://localhost:3100'){
 // Owned disposable QA environment only; the feed is a local synthetic fixture.
 assert.equal(new URL(base).origin,'http://localhost:3100');
 const noOverflow=async()=>{for(const width of [320,768,1024,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}await page.setViewportSize({width:1440,height:1000});};
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'/admin/data-sources');
 await page.getByRole('heading',{name:'Data sources.'}).waitFor();
 await page.getByText('live synchronization is not active',{exact:false}).waitFor();
 await page.getByRole('link',{name:'Synthetic QA feed',exact:true}).click();
 await page.getByRole('heading',{name:'Synthetic QA feed',exact:true}).waitFor();
 await page.getByText('Disabled',{exact:true}).first().waitFor();
 // Manual run: confirmation dialog, then a real fixture sync.
 await page.getByRole('button',{name:'Run sync now',exact:true}).click();
 let dialog=page.getByRole('dialog');await dialog.waitFor();
 await dialog.getByRole('button',{name:'Run sync',exact:true}).click();
 await page.getByRole('heading',{name:'Run result: Succeeded'}).waitFor();
 await page.getByText('1 new drafts',{exact:false}).waitFor();
 await page.getByRole('cell',{name:/New product/}).first().waitFor();
 await page.getByText('AUD 199.95',{exact:false}).waitFor();
 // Provider minimum interval now blocks another manual fetch, and the UI says why.
 assert.equal(await page.getByRole('button',{name:'Preview changes',exact:true}).isDisabled(),true);
 await page.getByText('Provider minimum interval has not elapsed',{exact:false}).first().waitFor();
 // Enable the schedule with an audited reason.
 await page.getByRole('checkbox',{name:'Scheduled synchronization enabled'}).check();
 await page.getByLabel('Reason (recorded in audit history)').fill('Synthetic browser QA schedule only.');
 await page.getByRole('button',{name:'Save settings',exact:true}).click();
 await page.getByText('Synchronization settings saved and audited.',{exact:true}).waitFor();
 await noOverflow();
 await page.screenshot({path:'output/playwright/d5-source-detail-desktop.png',fullPage:true});
 await page.setViewportSize({width:375,height:900});await page.screenshot({path:'output/playwright/d5-source-detail-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
 // The approval queue opens pre-filtered to source changes; the new draft is private.
 await page.getByRole('link',{name:'Approval queue',exact:true}).click();
 await page.getByRole('heading',{name:'Approval queue.'}).waitFor();
 assert.equal(await page.getByRole('button',{name:/^Pending source changes/}).getAttribute('aria-pressed'),'true');
 assert.equal((await page.request.get(base+'/api/boots?q=Synthetic%20QA%20sync')).ok(),true);
 assert.equal((await (await page.request.get(base+'/api/boots?q=Synthetic%20QA%20sync')).json()).total,0);
 await page.goto(base+'/admin/data-sources');await page.getByRole('heading',{name:'Data sources.'}).waitFor();
 await noOverflow();
 await page.screenshot({path:'output/playwright/d5-sources-desktop.png',fullPage:true});
 return 'PASS: source list/detail, confirmed manual fixture sync, draft-only new product, offer display, min-interval enforcement, audited schedule enablement, D4 deep link, 320/768/1024/1440 layouts';
}
