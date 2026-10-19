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
