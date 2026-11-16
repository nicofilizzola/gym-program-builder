import {test,expect} from '@playwright/test';
import {login,resetWorkouts,saveFinishedLog,createLinkedTemplate,headers} from './workout-helper.js';
import {answerNextConfirmation} from './confirmation-helper.js';
import {createWorkoutLog} from '../src/workout-log.js';
test.use({viewport:{width:390,height:844},hasTouch:true});
const main=page=>page.getByRole('navigation',{name:'Main'});
const back=(page,label)=>page.getByRole('link',{name:'Back to '+label,exact:true});
const reservation=page=>page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--tab-bar-height').trim());
async function deepLink(page,hash){await page.goto('/?nested-entry='+crypto.randomUUID()+hash);}
async function ready(page){await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');}
async function nested(page,label,href){await expect(page.locator('#shell')).toBeVisible();await expect(back(page,label)).toBeVisible();await ready(page);await expect(main(page)).toBeHidden();await expect(main(page).getByRole('link')).toHaveCount(0);expect(await reservation(page)).toBe('0px');await expect(back(page,label)).toHaveAttribute('href',href);}
async function root(page){await ready(page);await expect(main(page)).toBeVisible();expect(await main(page).getByRole('link').allTextContents()).toEqual(['Home','Library','User']);const boxes=await main(page).getByRole('link').evaluateAll(nodes=>nodes.map(node=>({width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height})));expect(Math.max(...boxes.map(b=>b.width))-Math.min(...boxes.map(b=>b.width))).toBeLessThanOrEqual(1);for(const box of boxes){expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}expect(await reservation(page)).not.toBe('0px');}
async function fixture(page){
 const data=await page.evaluate(async()=>{const {createApiClient}=await import('/src/api-client.js'),api=createApiClient();const reference=await api.createReference({id:crypto.randomUUID(),name:'Nested reference',exerciseType:'compound',equipment:'Barbell'});const variant=await api.createCatalog({id:crypto.randomUUID(),familyId:reference.id,entry:{name:'Nested variant',primaryMuscles:['Chest'],secondaryMuscles:[]}});const template=await api.create({id:crypto.randomUUID(),kind:'template',document:{name:'Nested template',exercises:[],goals:{}}});const program=await api.create({id:crypto.randomUUID(),kind:'program',document:{name:'Nested program',mode:'schedule',goals:{},workouts:[{id:'w',templateId:template.id,day:0}]}});return {reference,variant,template,program};});
 return {...data,workout:await saveFinishedLog(page,{name:'Nested finished workout',startedAt:Date.now()})};
}
test.afterEach(async({page})=>{await resetWorkouts(page).catch(()=>{});});

// Replace only the browser inset value: the production selectors and ownership remain under test.
async function bottomInset(page,inset){await page.route('**/style.css*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/env\(safe-area-inset-bottom(?:\s*,\s*0px)?\)/g,inset+'px')});});}
for(const inset of [0,20])test('bottom reservations change even when Resume height does not, inset '+inset,async({page})=>{
 await bottomInset(page,inset);await login(page);await resetWorkouts(page);await page.reload();
 const name='Geometry workout '+crypto.randomUUID(),{id}=await createLinkedTemplate(page,name);await page.goto('/#/templates/'+id);await nested(page,'Templates','#/templates');expect(await page.evaluate(()=>parseFloat(getComputedStyle(document.body).paddingBottom))).toBe(0);expect(await page.locator('#app').evaluate(n=>parseFloat(getComputedStyle(n).minHeight))).toBe(844);
 await back(page,'Templates').click();await page.getByRole('button',{name:'Start workout '+name,exact:true}).click();await expect(page.locator('.workout-focus')).toBeVisible();
 await back(page,'Home').click();await main(page).getByRole('link',{name:'Library',exact:true}).click();await page.getByRole('navigation',{name:'Library sections'}).getByRole('link',{name:'Templates',exact:true}).click();
 const bar=page.locator('.workout-bar');await expect(bar).toBeVisible();
 async function geometry(isRoot){
  await ready(page);await expect(bar).toHaveClass(/is-open/);
  const b=await bar.boundingBox(),n=isRoot?await main(page).boundingBox():null;
  expect(b.y+b.height).toBeCloseTo(isRoot?n.y:844,0);
  expect(await page.evaluate(()=>parseFloat(getComputedStyle(document.body).paddingBottom))).toBeCloseTo(b.height+(n?.height??0),0);
  expect(await page.locator('#app').evaluate(n=>parseFloat(getComputedStyle(n).minHeight))).toBeCloseTo(844-(n?.height??0),0);
  expect(await bar.evaluate(n=>parseFloat(getComputedStyle(n).paddingBottom))).toBe(8+(isRoot?0:inset));
  if(isRoot)expect(n.height).toBeCloseTo(56+inset,0);else await expect(main(page)).toBeHidden();
  return b.height;
 }
 const rootHeight=await geometry(true);await page.getByRole('link',{name,exact:true}).click();const nestedHeight=await geometry(false);expect(nestedHeight-rootHeight).toBe(inset);
 const panel=page.locator('.panel');await panel.scrollIntoViewIfNeeded();const p=await panel.boundingBox();expect(p.y+p.height).toBeCloseTo(844,0);expect(await panel.evaluate(n=>parseFloat(getComputedStyle(n).paddingBottom))).toBeGreaterThanOrEqual(12+inset);
 await back(page,'Templates').click();await geometry(true);
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');await expect.poll(async()=>(await main(page).boundingBox()).height).toBeGreaterThan(56+inset);
 const enlarged=(await main(page).boundingBox()).height;await page.getByRole('link',{name,exact:true}).click();await expect(main(page)).toBeHidden();await back(page,'Templates').click();expect((await main(page).boundingBox()).height).toBe(enlarged);
 await page.evaluate(()=>document.documentElement.style.fontSize='');await expect.poll(async()=>(await main(page).boundingBox()).height).toBeCloseTo(56+inset,0);
 await page.route('**/api/documents?kind=template',route=>route.fulfill({status:503,json:{error:{message:'Refresh unavailable'}}}));await main(page).getByRole('link',{name:'User',exact:true}).click();await main(page).getByRole('link',{name:'Library',exact:true}).click();
 const feedback=page.locator('.root-page-feedback');await expect(feedback).toContainText("Couldn't refresh");await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));const f=await feedback.boundingBox(),b=await bar.boundingBox();expect(f.y+f.height).toBeLessThanOrEqual(b.y-7);await page.unroute('**/api/documents?kind=template');
 await bar.getByRole('link',{name:'Resume',exact:true}).click();await expect(page.locator('.workout-focus')).toBeVisible();expect(await page.evaluate(()=>parseFloat(getComputedStyle(document.body).paddingBottom))).toBe(0);
 await back(page,'Home').click();await main(page).getByRole('link',{name:'User',exact:true}).click();await page.route('**/api/workouts',route=>route.fulfill({status:503,json:{error:{message:'History unavailable'}}}));await main(page).getByRole('link',{name:'Home',exact:true}).click();await expect(page.locator('.home-history-status')).toContainText(/Couldn't (refresh|load)/);expect(await page.locator('.home-history-status').evaluate(n=>Boolean(n.closest('.home-history'))&&getComputedStyle(n).position==='static')).toBe(true);await expect(page.locator('.root-page-feedback')).toHaveCount(0);
});

test('typing restore cannot resurrect nested tabs',async({page})=>{
 await login(page);await resetWorkouts(page);await page.goto('/#/catalog');
 const search=page.getByRole('searchbox',{name:'Search catalog',exact:true});await search.focus();await expect(page.locator('body')).not.toHaveClass(/is-typing/);await expect(main(page)).toBeVisible();
 const padding=await page.evaluate(()=>getComputedStyle(document.body).paddingBottom);await search.tap();await search.press('a');await expect(page.locator('body')).toHaveClass(/is-typing/);expect(await page.evaluate(()=>getComputedStyle(document.body).paddingBottom)).toBe(padding);
 await search.fill('');const lower=page.locator('.reference-toggle').nth(2);await lower.evaluate(n=>scrollTo(0,scrollY+n.getBoundingClientRect().top+n.getBoundingClientRect().height/2-innerHeight+24));const lowerBox=await lower.boundingBox();expect(lowerBox.y+lowerBox.height/2).toBeGreaterThan(788);await page.touchscreen.tap(lowerBox.x+lowerBox.width/2,lowerBox.y+lowerBox.height/2);await expect(lower).toHaveAttribute('aria-expanded','true');await expect(page.locator('body')).not.toHaveClass(/is-typing/);await expect(page).toHaveURL(/#\/catalog$/);await page.evaluate(()=>scrollTo(0,0));
 await page.getByRole('link',{name:'Manage tags',exact:true}).tap();await nested(page,'Exercises','#/catalog');
 const field=page.getByRole('textbox').first();await field.tap();await expect(page.locator('body')).toHaveClass(/is-typing/);await field.blur();await expect(main(page)).toBeHidden();expect(await reservation(page)).toBe('0px');
 // A user press followed by blur leaves the 700ms click grace pending until this parent link activates.
 await field.tap();await field.evaluate(n=>{n.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));n.blur();});await back(page,'Exercises').tap();await root(page);await expect(page).toHaveURL(/#\/catalog$/);await expect(page.locator('body')).not.toHaveClass(/is-typing/);
 await page.goto('/#/profile');await page.getByRole('slider').first().focus();await expect(main(page)).toBeHidden();const note=page.getByRole('textbox',{name:'Training background and approach',exact:true});await note.focus();await expect(main(page)).toBeHidden();expect(await page.evaluate(()=>parseFloat(getComputedStyle(document.body).paddingBottom))).toBe(0);
});

for(const reducedMotion of ['reduce','no-preference'])test('hidden-tab geometry refits active Focus at 660px, '+reducedMotion,async({page})=>{
 await page.emulateMedia({reducedMotion});await page.setViewportSize({width:390,height:660});await login(page);await resetWorkouts(page);const {id}=await createLinkedTemplate(page,'Geometry Focus');const {record:template}=await (await page.request.get('/api/documents/'+id)).json();
 const make=()=>createWorkoutLog({id:crypto.randomUUID(),now:new Date(),makeId:()=>crypto.randomUUID(),template});const past=make();past.status='finished';past.startedAt=new Date(Date.now()-86400000).toISOString();past.finishedAt=new Date(Date.now()-82800000).toISOString();for(const e of past.exercises)for(const s of e.sets)Object.assign(s,{weightKg:60,reps:10,done:true});
 expect((await page.request.put('/api/workouts/'+past.id,{headers,data:{revision:0,log:past}})).ok()).toBe(true);const log=make();Object.assign(log.exercises[0],{brand:'Hammer',focusTags:['Upper chest']});expect((await page.request.put('/api/workouts/'+log.id,{headers,data:{revision:0,log}})).ok()).toBe(true);await page.goto('/#/workouts/'+log.id);
 const feed=page.locator('.focus-feed'),card=feed.locator('.focus-card').first(),reps=page.getByLabel(`Set 1 reps, ${log.exercises[0].name}`,{exact:true});await expect(feed.locator('.log-last-time').first()).toBeVisible();await expect(feed.locator('.log-best').first()).toBeVisible();await expect(feed.locator('.focus-tags').first()).toContainText('Hammer');
 await expect(main(page)).toBeHidden();await expect(main(page).getByRole('link')).toHaveCount(0);
 await expect.poll(async()=>{const f=await feed.boundingBox(),t=await page.locator('.focus-toolbar').boundingBox(),d=await card.locator('.log-done').boundingBox();return {complete:d.y>=f.y-1&&d.y+d.height<=f.y+f.height+1,atBottom:Math.abs(660-(t.y+t.height))<=2};}).toEqual({complete:true,atBottom:true});
 await reps.fill('invalid');await reps.evaluate(n=>{window.savedReps=n;n.setSelectionRange(1,4);n.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));});const viewed=await card.getAttribute('data-set-id');const writes=[];page.on('request',r=>{if(r.method()==='PUT'&&r.url().includes('/api/workouts/'))writes.push(r.url());});
 for(const size of [{width:390,height:600},{width:760,height:660},{width:761,height:660},{width:760,height:660},{width:390,height:660}]){await page.setViewportSize(size);await page.evaluate(()=>visualViewport.dispatchEvent(new Event('resize')));await expect(reps).toBeFocused();await expect(reps).toHaveValue('invalid');expect(await reps.evaluate(n=>({same:n===window.savedReps,start:n.selectionStart,end:n.selectionEnd}))).toEqual({same:true,start:1,end:4});}
 await expect(card).toHaveClass(/is-viewed/);expect(await card.getAttribute('data-set-id')).toBe(viewed);expect(writes).toEqual([]);await expect(card.locator('.log-done')).toHaveAttribute('aria-pressed','false');await expect(main(page)).toBeHidden();await reps.evaluate(n=>n.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'invalid'})));
});

test('all roots retain three equal tabs and Library sections',async({page})=>{
 await login(page);for(const hash of ['#/home','#/programs','#/templates','#/catalog','#/user']){await page.goto('/'+hash);await root(page);if(['#/programs','#/templates','#/catalog'].includes(hash))await expect(page.getByRole('navigation',{name:'Library sections'}).getByRole('link')).toHaveText(['Programs','Templates','Exercises']);}
});
test('every nested type enters from its parent and returns after fresh deep links',async({page})=>{
 await login(page);const f=await fixture(page);
 const matrix=[
  {hash:'#/programs/'+f.program.id,parent:'#/programs',label:'Programs',enter:()=>page.getByRole('link',{name:'Nested program',exact:true}).click()},
  {hash:`#/programs/${f.program.id}/workouts/w`,parent:'#/programs/'+f.program.id,label:'Nested program',enter:()=>page.locator('[data-workout-title="w"]').click()},
  {hash:'#/templates/'+f.template.id,parent:'#/templates',label:'Templates',enter:()=>page.getByRole('link',{name:'Nested template',exact:true}).click()},
  {hash:'#/catalog/references/'+f.reference.id,parent:'#/catalog',label:'Exercises',enter:()=>page.evaluate(hash=>location.hash=hash,'#/catalog/references/'+f.reference.id)},
  {hash:`#/catalog/references/${f.reference.id}/variants/${f.variant.id}`,parent:'#/catalog/references/'+f.reference.id,label:'Nested reference',enter:()=>page.evaluate(hash=>location.hash=hash,`#/catalog/references/${f.reference.id}/variants/${f.variant.id}`)},
  {hash:'#/catalog/tags',parent:'#/catalog',label:'Exercises',enter:()=>page.getByRole('link',{name:'Manage tags',exact:true}).click()},
  {hash:'#/profile',parent:'#/user',label:'User',enter:()=>page.getByRole('link',{name:'Training profile',exact:true}).click()},
  {hash:'#/workouts/'+f.workout.id,parent:'#/home',label:'Home',enter:()=>page.getByRole('link',{name:'Nested finished workout',exact:true}).click()}
 ];
 for(const row of matrix){
  await test.step(row.hash,async()=>{await page.goto('/'+row.parent);await ready(page);await row.enter();await expect(page).toHaveURL(new RegExp(row.hash+'$'));await nested(page,row.label,row.parent);await back(page,row.label).click();await expect(page).toHaveURL(new RegExp(row.parent+'$'));await deepLink(page,row.hash);await nested(page,row.label,row.parent);await back(page,row.label).click();await expect(page).toHaveURL(new RegExp(row.parent+'$'));});
 }
 await page.goto('/#/catalog/tags?kind=focus&q=Chest');await nested(page,'Exercises','#/catalog');
});
test('committed chrome survives blocked failed superseded and auth navigation',async({page})=>{
 await login(page);const f=await fixture(page);await page.goto('/#/templates/'+f.template.id);await nested(page,'Templates','#/templates');
 await back(page,'Templates').focus();await back(page,'Templates').evaluate(node=>window.sourceBack=node);await page.getByLabel('Session template name').evaluate(node=>window.sourceField=node);
 let release,seen;let held=new Promise(r=>release=r),requested=new Promise(r=>seen=r);
 await page.route('**/api/documents/'+f.program.id,async route=>{seen();await held;await route.fulfill({status:503,json:{error:{message:'Required load unavailable'}}});});
 await page.evaluate(hash=>location.hash=hash,'#/programs/'+f.program.id);await requested;
 expect(await back(page,'Templates').evaluate(node=>node===window.sourceBack)).toBe(true);await expect(main(page)).toBeHidden();expect(await reservation(page)).toBe('0px');release();await ready(page);await expect(page).toHaveURL(new RegExp('#/templates/'+f.template.id+'$'));await expect(back(page,'Templates')).toBeFocused();expect(await page.getByLabel('Session template name').evaluate(node=>node===window.sourceField)).toBe(true);
 await page.unroute('**/api/documents/'+f.program.id);
 await page.goto('/#/profile');await page.route('**/api/profile',r=>r.request().method()==='PUT'?r.fulfill({status:503,json:{error:{message:'Save unavailable'}}}):r.continue());
 const field=page.getByRole('textbox',{name:'Training background and approach',exact:true});await field.fill('Keep my training background');await field.blur();await expect(page.getByTestId('save-status')).toHaveText('Couldn’t save');await answerNextConfirmation(page,false);await back(page,'User').click();await expect(field).toHaveValue('Keep my training background');await nested(page,'User','#/user');await expect(page).toHaveURL(/#\/profile$/);
 await page.unroute('**/api/profile');await page.locator('#retry-save').click();await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await back(page,'User').click();await root(page);
 held=new Promise(r=>release=r);requested=new Promise(r=>seen=r);await page.route('**/api/documents/'+f.template.id,async route=>{seen();await held;await route.continue();});
 await page.evaluate(hash=>location.hash=hash,'#/templates/'+f.template.id);await requested;await expect(main(page)).toBeVisible();expect(await reservation(page)).not.toBe('0px');await page.goBack();await ready(page);release();await page.waitForResponse('**/api/documents/'+f.template.id);await ready(page);await expect(page).toHaveURL(/#\/user$/);await root(page);await page.goForward();await nested(page,'Templates','#/templates');
 await back(page,'Templates').click();await root(page);await page.unroute('**/api/documents/'+f.template.id);
 held=new Promise(r=>release=r);requested=new Promise(r=>seen=r);await page.route('**/api/documents/'+f.template.id,async route=>{seen();await held;await route.continue();});await page.evaluate(hash=>location.hash=hash,'#/templates/'+f.template.id);await requested;
 await page.request.post('/api/auth/logout',{headers,data:{}});await page.evaluate(()=>location.hash='#/profile');await expect(page.getByLabel('Password',{exact:true})).toBeVisible();await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await root(page);await expect(page).toHaveURL(/#\/templates$/);const obsolete=page.waitForResponse('**/api/documents/'+f.template.id);release();await obsolete;await root(page);await expect(page).toHaveURL(/#\/templates$/);
});
test('missing records unknown routes and initial load failures keep available parents',async({page})=>{
 await login(page);const f=await fixture(page);
 await page.goto('/#/templates/'+f.template.id);await nested(page,'Templates','#/templates');await page.evaluate(()=>location.hash='#/catalog/references/missing');await nested(page,'Exercises','#/catalog');await expect(page.locator('#app').getByRole('alert')).toContainText('unavailable');
 for(const [hash,label,href] of [['#/programs/missing','Programs','#/programs'],['#/templates/missing','Templates','#/templates'],[`#/programs/${f.program.id}/workouts/missing`,'Nested program','#/programs/'+f.program.id],['#/programs/missing/workouts/missing','Programs','#/programs'],['#/catalog/references/missing','Exercises','#/catalog'],[`#/catalog/references/${f.reference.id}/variants/missing`,'Nested reference','#/catalog/references/'+f.reference.id],['#/catalog/references/missing/variants/missing','Exercises','#/catalog'],['#/workouts/missing','Home','#/home'],['#/unrelated/deep/route','Home','#/home']]){
  await deepLink(page,hash);await nested(page,label,href);await expect(page.locator('#app').getByRole('alert')).toContainText(/not found|unavailable|could not be opened/i);await back(page,label).click();await expect(page).toHaveURL(new RegExp(href+'$'));
 }
 await page.route('**/api/documents/'+f.template.id,route=>route.fulfill({status:503,json:{error:{message:'Unavailable'}}}));await deepLink(page,'#/templates/'+f.template.id);await nested(page,'Templates','#/templates');await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();await page.unroute('**/api/documents/'+f.template.id);await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByLabel('Session template name')).toHaveValue('Nested template');
 await page.route('**/api/documents?kind=program',route=>route.fulfill({status:503,json:{error:{message:'Root unavailable'}}}));await deepLink(page,'#/programs');await root(page);await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();
 await page.unroute('**/api/documents?kind=program');await page.setViewportSize({width:1200,height:900});await page.goto('/#/unrelated/deep/route');await expect(page.locator('#app').getByRole('alert')).toHaveText('Page not found. Choose Programs or Session templates.');await expect(page.getByRole('navigation',{name:'Breadcrumb'})).toBeHidden();await expect(main(page)).toBeVisible();
});
test('finished log unsaved reps keep the parent chrome and draft when leave is declined',async({page})=>{
 await login(page);await resetWorkouts(page);const {id}=await saveFinishedLog(page,{name:'Nested unsaved log',startedAt:Date.now()});await page.goto('/#/workouts/'+id);await nested(page,'Home','#/home');
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();await page.getByRole('combobox',{name:'Exercise',exact:true}).fill('curl');await page.getByRole('listbox',{name:'Exercise suggestions'}).getByRole('option').first().click();
 const error=page.locator('.log-exercise').last().locator('.log-set-error');await expect(error).toHaveText('Enter reps');await error.evaluate(node=>window.draftError=node);await back(page,'Home').evaluate(node=>window.logParent=node);
 await answerNextConfirmation(page,false);await back(page,'Home').click();await nested(page,'Home','#/home');await expect(page).toHaveURL(new RegExp('#/workouts/'+id+'$'));await expect(error).toHaveText('Enter reps');expect(await error.evaluate(node=>node===window.draftError)).toBe(true);expect(await back(page,'Home').evaluate(node=>node===window.logParent)).toBe(true);
});
test('active workouts keep Home outside the logger and retain it through recap',async({page})=>{
 await login(page);await resetWorkouts(page);await page.reload();await createLinkedTemplate(page,'Nested active workout');await page.goto('/#/templates');await page.getByRole('button',{name:'Start workout Nested active workout',exact:true}).click();await nested(page,'Home','#/home');await back(page,'Home').evaluate(node=>window.activeParent=node);await expect(page.locator('.logger-status')).toHaveText('Saved');const hash=await page.evaluate(()=>location.hash);
 await back(page,'Home').click();await root(page);await page.getByRole('button',{name:'Resume workout',exact:true}).click();await nested(page,'Home','#/home');await deepLink(page,hash);await nested(page,'Home','#/home');
 const reps=page.locator('input[data-field="reps"]').first();await reps.fill('8');await page.getByRole('button',{name:/^Mark set 1 done,/}).first().click();await page.getByRole('button',{name:'Finish',exact:true}).click();await page.getByRole('dialog',{name:'Finish workout?'}).getByRole('button',{name:'Finish workout',exact:true}).click();await expect(page.locator('.workout-recap')).toBeVisible();await nested(page,'Home','#/home');await back(page,'Home').click();await root(page);
});
test('committed desktop route survives resize and hidden navigation transfers focus',async({page})=>{
 await page.setViewportSize({width:1200,height:900});await login(page);await page.goto('/#/profile');await ready(page);await main(page).getByRole('link',{name:'Programs',exact:true}).focus();await page.setViewportSize({width:760,height:844});await nested(page,'User','#/user');await expect(back(page,'User')).toBeFocused();await expect(page).toHaveURL(/#\/profile$/);
 await page.setViewportSize({width:761,height:844});await expect(main(page)).toBeVisible();expect(await reservation(page)).toBe('0px');await expect(page.getByRole('navigation',{name:'Breadcrumb'})).toBeHidden();await page.setViewportSize({width:375,height:700});await nested(page,'User','#/user');await page.screenshot({path:test.info().outputPath('nested-mobile-profile.png')});await page.setViewportSize({width:700,height:375});await nested(page,'User','#/user');
});
test('chrome changes only with the 75/100ms content swap and reduced motion is immediate',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await login(page);await page.goto('/#/user');await ready(page);
 await page.evaluate(()=>{window.motion=[];window.chrome=[];const original=Element.prototype.animate;Element.prototype.animate=function(frames,options){if(this.id==='app')window.motion.push({duration:options.duration,easing:options.easing,nested:document.documentElement.hasAttribute('data-mobile-nested'),parent:!!document.querySelector('.breadcrumb-parent')});return original.call(this,frames,options);};window.chromeObserver=new MutationObserver(()=>window.chrome.push({nested:document.documentElement.hasAttribute('data-mobile-nested'),parent:!!document.querySelector('.breadcrumb-parent'),animations:document.querySelector('nav[aria-label="Main"]').getAnimations().length}));window.chromeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-mobile-nested']});});
 await page.getByRole('link',{name:'Training profile',exact:true}).click();await nested(page,'User','#/user');expect(await page.evaluate(()=>window.motion)).toEqual([{duration:75,easing:'ease-out',nested:false,parent:false},{duration:100,easing:'ease-out',nested:true,parent:true}]);expect(await page.evaluate(()=>window.chrome)).toEqual([{nested:true,parent:true,animations:0}]);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.motion=[]);await back(page,'User').click();await root(page);expect(await page.evaluate(()=>window.motion)).toEqual([]);
 await page.addInitScript(()=>{window.initialMotion=[];const original=Element.prototype.animate;Element.prototype.animate=function(frames,options){if(this.id==='app')window.initialMotion.push(options.duration);return original.call(this,frames,options);};});await page.emulateMedia({reducedMotion:'no-preference'});await deepLink(page,'#/profile');await nested(page,'User','#/user');expect(await page.evaluate(()=>window.initialMotion)).toEqual([]);
});
test('navigation geometry callback observes committed state and visible size changes only',async({page})=>{
 await login(page);await page.goto('/#/user');await ready(page);
 await page.evaluate(async()=>{
  const {mountMobileNavigation}=await import('/src/mobile-navigation.js'),{createMobileNavigationState}=await import('/src/mobile-navigation-state.js');
  const nav=document.querySelector('nav[aria-label="Main"]').cloneNode(true);nav.querySelectorAll('svg,.mobile-nav-indicator').forEach(node=>node.remove());document.querySelector('nav[aria-label="Main"]').replaceWith(nav);document.querySelector('#app').innerHTML='<h1>Geometry fixture</h1>';
  window.geometryEvents=[];window.hiddenMeasurements=0;const measure=nav.getBoundingClientRect.bind(nav);nav.getBoundingClientRect=()=>{if(!nav.getClientRects().length)window.hiddenMeasurements++;return measure();};
  window.geometryNav=mountMobileNavigation(nav,{state:createMobileNavigationState(),onNavigate:()=>{},onGeometryChange(...args){window.geometryEvents.push({args:args.length,nested:document.documentElement.hasAttribute('data-mobile-nested'),height:getComputedStyle(document.documentElement).getPropertyValue('--tab-bar-height').trim()});}});
 });
 await page.evaluate(()=>new Promise(requestAnimationFrame));await page.evaluate(()=>{window.geometryEvents=[];window.geometryNav.commit('#/profile');});expect(await page.evaluate(()=>window.geometryEvents)).toEqual([{args:0,nested:true,height:'0px'}]);await expect(main(page)).toBeHidden();expect(await page.evaluate(()=>window.hiddenMeasurements)).toBe(0);
 await page.setViewportSize({width:380,height:844});await page.evaluate(()=>new Promise(requestAnimationFrame));expect(await page.evaluate(()=>window.geometryEvents.length)).toBe(1);
 await page.evaluate(()=>window.geometryNav.commit('#/user'));await expect(main(page)).toBeVisible();await page.evaluate(()=>new Promise(requestAnimationFrame));await page.evaluate(()=>window.geometryEvents=[]);await page.setViewportSize({width:375,height:844});await expect.poll(()=>page.evaluate(()=>window.geometryEvents.length)).toBe(1);expect(await page.evaluate(()=>window.geometryEvents.every(event=>event.args===0&&!event.nested&&event.height!=='0px'))).toBe(true);
 await page.evaluate(()=>window.geometryNav.destroy());await page.setViewportSize({width:370,height:844});await page.evaluate(()=>new Promise(requestAnimationFrame));expect(await page.evaluate(()=>window.geometryEvents.length)).toBe(1);
});
