import {test,expect} from '@playwright/test';
import {dragDestination} from './mobile-swipe-helper.js';
import {login,resetWorkouts,createLinkedTemplate,saveFinishedLog,openStartSheet} from './workout-helper.js';

test.use({viewport:{width:390,height:844},hasTouch:true});

const nav=page=>page.getByRole('navigation',{name:'Main'});

test('three tabs and workout pages under Home',async({page})=>{
 await login(page);await resetWorkouts(page);const {id}=await saveFinishedLog(page,{name:'Nav workout',startedAt:Date.now()});
 expect(await nav(page).locator('a:visible').allTextContents()).toEqual(['Home','Library','User']);
 const boxes=await nav(page).locator('a:visible').evaluateAll(links=>links.map(link=>link.getBoundingClientRect().width));expect(Math.max(...boxes)-Math.min(...boxes)).toBeLessThanOrEqual(1);
 await page.goto('/#/workouts/'+id);await expect(nav(page).getByRole('link',{name:'Home',exact:true})).toHaveAttribute('aria-current','page');
});
test('#/workouts opens Home at History',async({page})=>{
 await login(page);const length=await page.evaluate(()=>history.length);await page.evaluate(()=>location.hash='/workouts');
 await expect(page).toHaveURL(/#\/home$/);await expect(page.locator('.home-history h2')).toBeFocused();expect(await page.evaluate(()=>history.length)).toBe(length+1);
 const heading=await page.locator('.home-history h2').boundingBox(),header=await page.locator('.app-header').boundingBox();expect(Math.abs(heading.y-header.height)).toBeLessThanOrEqual(2);
 await page.goBack();await expect(page).toHaveURL(/#\/home$/);expect(await page.evaluate(()=>history.length)).toBe(length+1);
});
for(const reducedMotion of ['reduce','no-preference'])test('tapping Home on Home scrolls to the top, '+reducedMotion,async({page})=>{
 await page.emulateMedia({reducedMotion});await login(page);await resetWorkouts(page);
 for(let i=0;i<45;i++)await saveFinishedLog(page,{name:'Nav history '+i,startedAt:Date.now()-i*86400000});await page.reload();
 await expect.poll(()=>page.locator('.home-history .workout-history-row').count()).toBeGreaterThanOrEqual(30);await page.evaluate(()=>{scrollTo(0,2000);window.homeNode=document.querySelector('.workout-home');});
 const requests=[];page.on('request',request=>{if(request.url().includes('/api/'))requests.push(request.url());});
 const home=nav(page).getByRole('link',{name:'Home',exact:true});await home.click();if(reducedMotion==='reduce')expect(await page.evaluate(()=>scrollY)).toBe(0);
 await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);expect(await page.evaluate(()=>window.homeNode===document.querySelector('.workout-home'))).toBe(true);expect(requests).toEqual([]);await expect(home).toBeFocused();
});
test('a desktop Workouts page resized to a phone',async({page})=>{
 await page.setViewportSize({width:1366,height:768});await login(page);await page.goto('/#/workouts');await expect(page.getByRole('heading',{name:'Workouts',exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await expect(page).toHaveURL(/#\/workouts$/);await expect(nav(page).getByRole('link',{name:'Home',exact:true})).toHaveAttribute('aria-current','page');
 await dragDestination(page);await expect(page).toHaveURL(/#\/programs$/);
});
// Leave no active workout behind: its resume bar would change later specs' layout.
test.afterEach(async({page})=>{await resetWorkouts(page).catch(()=>{});});

test('tab bar navigates with short accessible names',async({page})=>{
 await login(page);
 for(const name of ['Home','Library','User'])await expect(nav(page).getByRole('link',{name,exact:true})).toBeVisible();
 const box=await nav(page).boundingBox();
 expect(box.y+box.height).toBeCloseTo(844,0);expect(box.height).toBeGreaterThanOrEqual(56);
 for(const link of await nav(page).locator('a:visible').all()){const b=await link.boundingBox();expect(b.width).toBeGreaterThanOrEqual(44);expect(b.height).toBeGreaterThanOrEqual(44);}
 await nav(page).getByRole('link',{name:'Home'}).click();
 await expect(nav(page).getByRole('link',{name:'Home'})).toHaveAttribute('aria-current','page');
 const header=await page.locator('.app-header').boundingBox();
 expect(header.height).toBeLessThanOrEqual(56);
});

test('resume bar stacks above the tab bar and both hide while typing',async({page})=>{
 await login(page);await resetWorkouts(page);
 await nav(page).getByRole('link',{name:'Home'}).click();
 await openStartSheet(page);
 await page.getByRole('button',{name:'Blank workout'}).click();
 const name=page.getByRole('textbox',{name:'Workout name'});await expect(name).toBeVisible();
 await nav(page).getByRole('link',{name:'Library'}).click();
 const bar=page.locator('.workout-bar');await expect(bar).toBeVisible();
 const barBox=await bar.boundingBox(),navBox=await nav(page).boundingBox();
 expect(barBox.y+barBox.height).toBeCloseTo(navBox.y,0);
 // The page reserves room for both bars, so its end stays above them.
 const padding=await page.evaluate(()=>parseFloat(getComputedStyle(document.body).paddingBottom));
 expect(padding).toBeCloseTo(barBox.height+navBox.height,0);

 await bar.getByRole('link',{name:'Resume'}).click();
 await name.tap();
 await expect.poll(async()=>(await nav(page).boundingBox()).y).toBeGreaterThanOrEqual(843);
 await name.blur();
 await expect.poll(async()=>(await nav(page).boundingBox()).y+56).toBeLessThanOrEqual(845);
});

test('a focused slider keeps the tab bar',async({page})=>{
 await login(page);
 await nav(page).getByRole('link',{name:'User',exact:true}).click();await page.getByRole('link',{name:'Training profile',exact:true}).click();
 await page.getByRole('slider').first().focus();
 await page.waitForTimeout(250);
 const box=await nav(page).boundingBox();expect(box.y+box.height).toBeCloseTo(844,0);
});

test('desktop keeps the full header labels',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 await login(page);
 await expect(nav(page).getByRole('link',{name:'Session templates',exact:true})).toBeVisible();
 await expect(nav(page).getByRole('link',{name:'Exercise catalog',exact:true})).toBeVisible();
});

test('the session editor volume panel stays pinned above the tab bar',async({page})=>{
 await login(page);
 await nav(page).getByRole('link',{name:'Library',exact:true}).click();await page.getByRole('navigation',{name:'Library sections'}).getByRole('link',{name:'Templates',exact:true}).click();
 await page.getByRole('button',{name:'New session template',exact:true}).click();
 const panel=page.locator('.panel');await expect(panel).toBeVisible();
 const panelBox=await panel.boundingBox(),navBox=await nav(page).boundingBox();
 expect(panelBox.y+panelBox.height).toBeCloseTo(navBox.y,0);
});

test('tapping a bottom control while typing activates it, not the returning tab bar',async({page})=>{
 await login(page);
 const {id}=await createLinkedTemplate(page,'Typing tap');
 const muscle=(await (await page.request.get('/api/documents/'+id)).json()).record.document.exercises[0].primaryMuscles[0];
 await page.goto('/#/templates/'+id);
 await page.getByLabel('Session template name').tap();
 await expect.poll(async()=>(await nav(page).boundingBox()).y).toBeGreaterThanOrEqual(843);
 const row=page.locator(`.volume-row[data-muscle="${muscle}"]`);
 const box=await row.boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
 await expect(row).toHaveAttribute('aria-pressed','true');
 await expect(page).toHaveURL(/#\/templates\//);
});

test('focus moved by script into a text field keeps the bars',async({page})=>{
 await login(page);
 const {id}=await createLinkedTemplate(page,'Scripted focus');
 await page.goto('/#/templates/'+id);
 await page.getByLabel('Session template name').evaluate(el=>el.focus());
 await page.waitForTimeout(250);
 expect((await nav(page).boundingBox()).y+56).toBeLessThanOrEqual(845);
 await page.getByLabel('Session template name').tap();
 await expect.poll(async()=>(await nav(page).boundingBox()).y).toBeGreaterThanOrEqual(843);
});
test('breakpoint navigation moves focus from hidden mobile Home to the heading',async({page})=>{
 await login(page);await expect(page.locator('#app')).toHaveAttribute('aria-busy','false');await page.locator('[data-nav=home]').focus();
 await page.setViewportSize({width:1440,height:900});await expect(page.locator('#app h1')).toBeFocused();
});
