import {test,expect} from '@playwright/test';
import {programFixture,frames,report} from './program-analysis-helper.js';
const toggle=page=>page.getByRole('button',{name:'AI review',exact:true});
async function populated(page,{extra=0,name='Full body — deliberate hypertrophy emphasis with shared sessions'}={}){
 const result=await programFixture(page);
 await page.evaluate(async({program,template,extra,name})=>{
  const {createApiClient}=await import('/src/api-client.js'),api=createApiClient();
  const muscles=['Chest','Lats','Side delts','Glutes','Hamstrings','Calves'];
  await api.update({id:template.id,revision:template.revision,document:{...template.document,name,exercises:muscles.map((m,i)=>({name:['Bench press','Chest-supported row','Cable lateral raise','Hip thrust','Seated leg curl','Standing calf raise'][i],sets:3,repRange:{min:8,max:12},restSeconds:i<2?180:90,primaryMuscles:[m],secondaryMuscles:i===0?['Triceps']:i===1?['Biceps']:[]}))}});
  const days=[0,1,3,4,6,null,...Array.from({length:extra},(_,i)=>i%2?null:i%7)];
  await api.update({id:program.id,revision:program.revision,document:{...program.document,goals:{Chest:18,Lats:18,Glutes:18},workouts:days.map((day,i)=>({id:'pop-'+i,templateId:template.id,day}))}});
 },{...result,extra,name});
 await page.reload();await expect(page.locator('.workout-item')).toHaveCount(6+extra);return result;
}
const box=(page,selector)=>page.locator(selector).first().evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,top:r.top,left:r.left};});
const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const near=(actual,expected)=>expect(Math.abs(actual-expected)).toBeLessThanOrEqual(1);
test('AI review sits at the far right of the program header',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await programFixture(page);
 await expect(toggle(page)).toBeVisible();await expect(page.getByRole('button',{name:'Analyze program'})).toHaveCount(0);
 expect(await page.locator('.program-file-actions button').last().getAttribute('data-program-review')).not.toBeNull();
 const exportBox=await page.getByRole('button',{name:'Export program',exact:true}).boundingBox(),toggleBox=await toggle(page).boundingBox();
 expect(toggleBox.x-(exportBox.x+exportBox.width)).toBeGreaterThanOrEqual(15);
 const dockId=await page.locator('.review-dock').getAttribute('id');expect(dockId).toBeTruthy();await expect(toggle(page)).toHaveAttribute('aria-controls',dockId);
});
test('unavailable AI review explains itself',async({page})=>{
 await page.route('**/api/analysis',route=>route.fulfill({json:{enabled:false}}));await programFixture(page);
 await expect(toggle(page)).toHaveAttribute('aria-disabled','true');await toggle(page).dispatchEvent('click');
 await expect(page.locator('.analysis-unavailable')).toHaveText('AI review is not configured yet.');
 expect(await toggle(page).evaluate(el=>getComputedStyle(el).opacity)).toBe('0.65');
 await page.emulateMedia({reducedMotion:'no-preference'});await toggle(page).hover();
 expect(await toggle(page).evaluate(el=>getComputedStyle(el,'::before').animationName)).toBe('none');
});
const longReport=report+'\n'+Array.from({length:80},(_,i)=>'Detail '+(i+1)+': the shared template affects several occurrences.').join('\n');
const reportScroll=page=>page.locator('.analysis-scroll').evaluate(el=>el.scrollTop);
test('the full-screen review keeps its reading position when closed and reopened',async({page})=>{
 await page.route('**/api/analysis/program',route=>route.fulfill({contentType:'text/event-stream',body:frames(longReport)}));
 await page.setViewportSize({width:1000,height:700});await programFixture(page);
 await toggle(page).click();await expect(page.locator('dialog.analysis-modal')).toBeVisible();await expect(page.locator('.analysis-status')).toHaveText('Analysis complete');
 await page.locator('.analysis-scroll').evaluate(el=>{el.scrollTop=300;});await expect.poll(()=>reportScroll(page)).toBe(300);await page.waitForTimeout(50);
 await page.keyboard.press('Escape');await expect(page.locator('dialog.analysis-modal')).toBeHidden();await expect(toggle(page)).toBeFocused();
 await toggle(page).click();await expect(page.locator('dialog.analysis-modal')).toBeVisible();
 await expect.poll(async()=>Math.abs(await reportScroll(page)-300)).toBeLessThanOrEqual(1);
});
test('a review closed in the dock reopens full screen at the same reading position',async({page})=>{
 await page.route('**/api/analysis/program',route=>route.fulfill({contentType:'text/event-stream',body:frames(longReport)}));
 await page.setViewportSize({width:1440,height:900});await programFixture(page);
 await toggle(page).click();await expect(page.locator('.analysis-status')).toHaveText('Analysis complete');
 await page.locator('.analysis-scroll').evaluate(el=>{el.scrollTop=300;});await expect.poll(()=>reportScroll(page)).toBe(300);await page.waitForTimeout(50);
 await toggle(page).click();await expect(page.locator('.review-dock')).not.toHaveClass(/is-open/);
 await page.setViewportSize({width:1000,height:700});await expect(toggle(page)).toHaveAttribute('aria-controls',await page.locator('dialog.analysis-modal').getAttribute('id'));
 await toggle(page).click();await expect(page.locator('dialog.analysis-modal')).toBeVisible();
 await expect.poll(async()=>Math.abs(await reportScroll(page)-300)).toBeLessThanOrEqual(1);
 await page.keyboard.press('Escape');await page.setViewportSize({width:1440,height:900});
 await expect(toggle(page)).toHaveAttribute('aria-controls',await page.locator('.review-dock').getAttribute('id'));
 await expect(page.locator('.review-dock')).toHaveAttribute('aria-labelledby',await page.locator('.analysis-title').getAttribute('id'));
});
test('dock opens beside the program at desktop sizes',async({page})=>{
 await page.route('**/api/analysis/program',route=>route.fulfill({contentType:'text/event-stream',body:frames(report)}));await populated(page);
 for(const [w,h] of [[1280,800],[1366,768],[1440,900],[1920,1080]]){
  await page.setViewportSize({width:w,height:h});await page.evaluate(()=>scrollTo(0,0));
  if(await toggle(page).getAttribute('aria-expanded')!=='true')await toggle(page).click();
  await expect(page.locator('.analysis-status')).toHaveText('Analysis complete');
  await expect.poll(async()=>(await box(page,'.review-dock')).width).toBeCloseTo(w>=1600?360:340,0);
  const dock=await box(page,'.review-dock'),header=await box(page,'.app-header');
  near(dock.right,w);expect(dock.bottom).toBeLessThanOrEqual(h+1);expect(dock.top).toBeGreaterThanOrEqual(header.bottom-1);
  expect((await box(page,'.panel')).right).toBeLessThanOrEqual(dock.left+1);expect(await noOverflow(page)).toBe(true);
  for(const figure of await page.locator('.body-map svg').all())expect((await figure.boundingBox()).height).toBeGreaterThanOrEqual(180);
  expect((await box(page,'.review-dock .analysis-footer')).bottom).toBeLessThanOrEqual(h+1);
  await page.screenshot({path:`.superpowers/sdd/2026-11-01-program-review-dock/dock-${w}.png`});
  await toggle(page).click();await expect.poll(async()=>(await box(page,'.panel')).right).toBeCloseTo(w-24,0);
 }
});
const cardRows=page=>page.locator('.week-agenda .workout-item').evaluateAll(cards=>cards.map(card=>{const t=card.querySelector('h3').getBoundingClientRect(),a=card.querySelector('.item-actions').getBoundingClientRect();return {height:card.getBoundingClientRect().height,offset:Math.abs((t.top+t.height/2)-(a.top+a.height/2))};}));
test('week agenda cards keep actions beside the title with the dock open and closed',async({page})=>{
 await page.route('**/api/analysis/program',route=>route.fulfill({contentType:'text/event-stream',body:frames(report)}));
 await page.setViewportSize({width:1366,height:768});await populated(page,{name:'Upper A'});
 await toggle(page).click();await expect(page.locator('.analysis-status')).toHaveText('Analysis complete');await expect.poll(async()=>(await box(page,'.review-dock')).width).toBe(340);
 for(const card of await cardRows(page)){expect(card.offset).toBeLessThanOrEqual(8);expect(card.height).toBeLessThanOrEqual(64);}
 await toggle(page).click();await page.setViewportSize({width:1440,height:900});await expect.poll(async()=>(await box(page,'.review-dock')).width).toBe(0);
 for(const card of await cardRows(page)){expect(card.offset).toBeLessThanOrEqual(8);expect(card.height).toBeLessThanOrEqual(64);}
});
test('week agenda day labels fit their column at default and 200% text',async({page})=>{
 await page.setViewportSize({width:1366,height:768});await populated(page,{name:'Upper A'});
 const labels=()=>page.locator('.week-agenda .day-section').evaluateAll(days=>days.map(day=>{const h=day.querySelector('h2'),list=day.querySelector('.workout-list');return {text:h.textContent.trim(),floated:getComputedStyle(h).float==='left',scroll:h.scrollWidth,client:h.clientWidth,gap:list.getBoundingClientRect().left-h.getBoundingClientRect().right};}));
 for(const [w,h,big] of [[1366,768,false],[1440,900,false],[1920,1080,false],[1920,1080,true]]){
  await page.setViewportSize({width:w,height:h});if(big)await page.addStyleTag({content:'html{font-size:200%!important}'});
  const all=await labels();expect(all.map(l=>l.text)).toContain('Unscheduled');
  for(const label of all){expect(label.floated,`${label.text} at ${w}${big?' 200%':''}`).toBe(true);expect(label.scroll).toBeLessThanOrEqual(label.client);expect(label.gap).toBeGreaterThanOrEqual(8);}
 }
});
test('review snapshot and status scroll with the report in the dock and full screen',async({page})=>{
 await page.route('**/api/analysis/program',route=>route.fulfill({contentType:'text/event-stream',body:frames(report)}));
 await page.setViewportSize({width:1440,height:900});await programFixture(page);
 await toggle(page).click();await expect(page.locator('.analysis-status')).toHaveText('Analysis complete');
 for(const selector of ['.analysis-snapshot','.analysis-status','.analysis-stale'])await expect(page.locator(`.review-dock .analysis-scroll ${selector}`)).toHaveCount(1);
 await expect(page.locator('.review-dock .analysis-scroll .analysis-status')).toHaveAttribute('role','status');
 await page.setViewportSize({width:1279,height:900});await expect(page.locator('dialog.analysis-modal')).toBeVisible();
 for(const selector of ['.analysis-snapshot','.analysis-status'])await expect(page.locator(`dialog.analysis-modal .analysis-scroll ${selector}`)).toHaveCount(1);
});
test('dock stays within the viewport while the page scrolls',async({page})=>{
 await page.route('**/api/analysis/program',route=>route.fulfill({contentType:'text/event-stream',body:frames(report)}));
 await page.setViewportSize({width:1366,height:768});await populated(page,{extra:6});
 await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await toggle(page).click();await expect(page.locator('.analysis-status')).toHaveText('Analysis complete');
 await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 expect((await box(page,'.review-dock')).top).toBeGreaterThanOrEqual(-1);expect((await box(page,'.review-dock .analysis-footer')).bottom).toBeLessThanOrEqual(769);
 await page.evaluate(()=>scrollTo(0,0));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const header=await box(page,'.app-header');expect((await box(page,'.review-dock')).top).toBeGreaterThanOrEqual(header.bottom-1);expect((await box(page,'.review-dock .analysis-footer')).bottom).toBeLessThanOrEqual(769);
});
test('a short program keeps its header under the breadcrumbs with the dock closed, open and closed again',async({page})=>{
 await page.route('**/api/analysis/program',route=>route.fulfill({contentType:'text/event-stream',body:frames(report)}));
 await page.setViewportSize({width:1920,height:1080});await programFixture(page);
 const check=async()=>{const crumbs=await box(page,'.breadcrumbs'),program=await box(page,'.program-page');expect(program.top-crumbs.bottom).toBeLessThanOrEqual(1);expect(crumbs.height).toBeLessThan(60);expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);};
 await check();
 await toggle(page).click();await expect(page.locator('.analysis-status')).toHaveText('Analysis complete');await check();
 await page.getByRole('button',{name:'Close AI review',exact:true}).click();await expect(page.locator('.review-dock')).not.toHaveClass(/is-open/);await check();
});
test('crossing 1280px while open keeps the report scroll position and focus',async({page})=>{
 const long=report+'\n'+Array.from({length:40},(_,i)=>'Detail '+(i+1)+': the shared template affects several occurrences.').join('\n');
 await page.route('**/api/analysis/program',route=>route.fulfill({contentType:'text/event-stream',body:frames(long)}));
 await page.setViewportSize({width:1440,height:900});await programFixture(page);
 await toggle(page).click();await expect(page.locator('.analysis-status')).toHaveText('Analysis complete');
 const scroll=page.locator('.analysis-scroll');await scroll.evaluate(el=>{el.scrollTop=200;});await expect.poll(()=>scroll.evaluate(el=>el.scrollTop)).toBe(200);
 await page.waitForTimeout(50);const again=page.getByRole('button',{name:'Analyze again',exact:true});await again.focus();
 await page.setViewportSize({width:1279,height:900});await expect(page.locator('dialog.analysis-modal')).toBeVisible();
 await expect(again).toBeFocused();expect(Math.abs(await scroll.evaluate(el=>el.scrollTop)-200)).toBeLessThanOrEqual(1);
 await page.setViewportSize({width:1440,height:900});await expect(page.locator('.review-dock')).toHaveClass(/is-open/);
 await expect(again).toBeFocused();expect(Math.abs(await scroll.evaluate(el=>el.scrollTop)-200)).toBeLessThanOrEqual(1);await expect(page.locator('.analysis-report')).toContainText('Detail 40');
});
test('program context opens over the open dock without closing it',async({page})=>{
 await page.route('**/api/analysis/program',route=>route.fulfill({contentType:'text/event-stream',body:frames(report)}));
 await page.setViewportSize({width:1440,height:900});await programFixture(page);
 await toggle(page).click();await expect(page.locator('.analysis-status')).toHaveText('Analysis complete');await expect(page.locator('.analysis-report')).toContainText('Effort is unknown.');const text=await page.locator('.analysis-report').textContent();
 const context=page.getByRole('button',{name:'Program context',exact:true});await context.click();await expect(page.locator('dialog.program-context-surface')).toHaveJSProperty('open',true);
 await page.getByLabel('Goals and priorities',{exact:true}).fill('Prioritize delts');
 await expect(page.locator('.review-dock .analysis-stale')).toBeVisible();await expect(page.locator('.review-dock')).toHaveClass(/is-open/);
 await page.keyboard.press('Escape');await expect(page.locator('dialog.program-context-surface')).toHaveJSProperty('open',false);
 await expect(page.locator('.review-dock')).toHaveClass(/is-open/);await expect(page.locator('.analysis-report')).toHaveText(text);await expect(context).toBeFocused();
});
test('leaving the program discards a streaming review and its column',async({page})=>{
 let release;const held=new Promise(resolve=>release=resolve);
 await page.route('**/api/analysis/program',async route=>{await held;await route.abort().catch(()=>{});});
 await page.setViewportSize({width:1440,height:900});await programFixture(page);
 const failed=[];page.on('requestfailed',request=>{if(request.url().includes('/api/analysis/program'))failed.push(request.url());});
 await toggle(page).click();await expect(page.locator('.analysis-status')).toHaveText(/Preparing analysis|Analyzing program/);
 await page.locator('.workout-title').first().click();await expect(page).toHaveURL(/workouts\//);await expect(page.getByLabel('Session template name')).toBeVisible();
 await expect.poll(()=>failed.length).toBeGreaterThan(0);await expect(page.locator('.review-dock')).toHaveCount(0);
 await page.getByRole('navigation',{name:'Breadcrumb'}).getByRole('link').last().click();
 await expect(toggle(page)).toHaveAttribute('aria-expanded','false');await expect(page.locator('.review-dock')).not.toHaveClass(/is-open/);
 await expect.poll(async()=>(await box(page,'.panel')).right).toBeCloseTo(1440-24,0);
 release();
});
test('dock layout survives long names and 200% text',async({page})=>{
 await page.route('**/api/analysis/program',route=>route.fulfill({contentType:'text/event-stream',body:frames(report)}));
 await page.setViewportSize({width:1366,height:768});await populated(page,{name:'Supercalifragilisticexpialidocious'.repeat(4)});
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');await toggle(page).click();await expect(page.locator('.analysis-status')).toHaveText('Analysis complete');
 expect(await noOverflow(page)).toBe(true);
 for(const name of ['AI review','Close AI review','Analyze again']){const button=page.getByRole('button',{name,exact:true});await button.scrollIntoViewIfNeeded();await expect(button).toBeInViewport();}
 await page.screenshot({path:'.superpowers/sdd/2026-11-01-program-review-dock/dock-200text.png'});
});
test.describe('motion',()=>{
 test.use({reducedMotion:'no-preference'});
 test('dock column animates open and closed without animating the first render',async({page})=>{
  await page.route('**/api/analysis/program',route=>route.fulfill({contentType:'text/event-stream',body:frames(report)}));
  await page.setViewportSize({width:1440,height:900});await programFixture(page);
  const animations=()=>page.evaluate(()=>document.getAnimations().map(a=>{const t=a.effect?.target;return {property:a.transitionProperty||'',duration:a.effect?.getTiming().duration,route:t?.classList?.contains('program-route')||false,inDock:Boolean(t?.closest?.('.review-dock')),content:Boolean(t?.matches?.('.review-dock > .analysis-content'))};}));
  expect((await animations()).filter(a=>a.route||a.inDock)).toEqual([]);
  await toggle(page).click();const running=await animations();
  expect(running.some(a=>a.route&&a.property==='grid-template-columns'&&a.duration===180)).toBe(true);
  expect(running.some(a=>a.content&&a.property==='opacity')).toBe(true);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));const mid=(await box(page,'.review-dock')).width;expect(mid).toBeLessThan(340);
  await toggle(page).click();await expect.poll(async()=>(await box(page,'.review-dock')).width).toBe(0);
  await page.waitForTimeout(300);expect((await box(page,'.review-dock')).width).toBe(0);await expect(page.locator('.review-dock')).not.toHaveClass(/is-open/);
  expect(await page.locator('.review-dock').evaluate(el=>el.inert)).toBe(true);await expect(toggle(page)).toBeFocused();await expect(toggle(page)).toHaveAttribute('aria-expanded','false');
 });
 test('AI review has a warm identity, a hover sweep and a generating breath',async({page})=>{
  let release;const held=new Promise(resolve=>release=resolve);
  await page.route('**/api/analysis/program',async route=>{await held;await route.fulfill({contentType:'text/event-stream',body:frames(report)});});
  await page.setViewportSize({width:1440,height:900});await programFixture(page);
  const style=(prop,pseudo)=>toggle(page).evaluate((el,[p,ps])=>getComputedStyle(el,ps||null)[p],[prop,pseudo]);
  const svg=prop=>page.locator('[data-program-review] > svg').evaluate((el,p)=>getComputedStyle(el)[p],prop);
  const closed=await style('backgroundImage');expect(closed).toContain('linear-gradient');
  expect(await svg('animationName')).toBe('none');expect(await style('animationName','::before')).toBe('none');
  await expect.poll(()=>page.locator('[data-export]').evaluate(el=>!el.closest('[inert]'))).toBe(true);
  await page.mouse.move(0,0);await page.locator('.program-file-actions button').nth(-2).focus();await page.keyboard.press('Tab');await expect(toggle(page)).toBeFocused();
  expect(await style('outlineStyle')).toBe('solid');expect(await style('animationName','::before')).toBe('none');
  await page.evaluate(()=>document.activeElement.blur());
  await toggle(page).hover();
  expect(await style('animationName','::before')).toBe('ai-light-sweep');expect(await style('animationIterationCount','::before')).toBe('1');expect(await style('animationDuration','::before')).toBe('0.45s');
  await toggle(page).click();await expect(toggle(page)).toHaveAttribute('aria-expanded','true');
  expect(await style('backgroundImage')).not.toBe(closed);
  await expect(toggle(page)).toHaveClass(/is-generating/);
  expect(await svg('animationName')).toBe('ai-sparkle-breathe');expect(await svg('animationDuration')).toBe('1.6s');
  release();await expect(page.locator('.analysis-status')).toHaveText('Analysis complete');
  await expect(toggle(page)).not.toHaveClass(/is-generating/);expect(await svg('animationName')).toBe('none');
 });
});
test('AI review motion is disabled with reduced motion',async({page})=>{
 let release;const held=new Promise(resolve=>release=resolve);
 await page.route('**/api/analysis/program',async route=>{await held;await route.fulfill({contentType:'text/event-stream',body:frames(report)});});
 await page.setViewportSize({width:1440,height:900});await programFixture(page);
 const style=(prop,pseudo)=>toggle(page).evaluate((el,[p,ps])=>getComputedStyle(el,ps||null)[p],[prop,pseudo]);
 const svg=prop=>page.locator('[data-program-review] > svg').evaluate((el,p)=>getComputedStyle(el)[p],prop);
 expect(await style('backgroundImage')).toContain('linear-gradient');expect(await style('transitionDuration')).toBe('0s');
 await toggle(page).hover();expect(await style('animationName','::before')).toBe('none');
 await toggle(page).click();await expect(toggle(page)).toHaveClass(/is-generating/);
 expect(await svg('animationName')).toBe('none');expect(await style('backgroundImage')).toContain('linear-gradient');
 release();await expect(page.locator('.analysis-status')).toHaveText('Analysis complete');
});
test.describe('hybrid input',()=>{
 test.use({hasTouch:true,viewport:{width:1366,height:768}});
 test('AI review and dock controls keep 44px targets',async({page})=>{
  await page.route('**/api/analysis/program',route=>route.fulfill({contentType:'text/event-stream',body:frames(report)}));await programFixture(page);
  const t=await toggle(page).boundingBox();expect(t.width).toBeGreaterThanOrEqual(44);expect(t.height).toBeGreaterThanOrEqual(44);
  await toggle(page).click();await expect(page.locator('.analysis-status')).toHaveText('Analysis complete');
  for(const name of ['Close AI review','Analyze again'])expect((await page.getByRole('button',{name,exact:true}).boundingBox()).height).toBeGreaterThanOrEqual(44);
 });
});
