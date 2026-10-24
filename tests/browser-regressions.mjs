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
