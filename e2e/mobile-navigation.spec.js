import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate} from './workout-helper.js';

test.use({viewport:{width:390,height:844},hasTouch:true});

const nav=page=>page.getByRole('navigation',{name:'Main'});
// Leave no active workout behind: its resume bar would change later specs' layout.
test.afterEach(async({page})=>{await resetWorkouts(page).catch(()=>{});});

test('tab bar navigates with short accessible names',async({page})=>{
 await login(page);
 for(const name of ['Programs','Templates','Home','History','Catalog'])await expect(nav(page).getByRole('link',{name,exact:true})).toBeVisible();
 const box=await nav(page).boundingBox();
 expect(box.y+box.height).toBeCloseTo(844,0);expect(box.height).toBeGreaterThanOrEqual(56);
 for(const link of await nav(page).getByRole('link').all()){const b=await link.boundingBox();expect(b.width).toBeGreaterThanOrEqual(44);expect(b.height).toBeGreaterThanOrEqual(44);}
 await nav(page).getByRole('link',{name:'History'}).click();
 await expect(nav(page).getByRole('link',{name:'History'})).toHaveAttribute('aria-current','page');
 const header=await page.locator('.app-header').boundingBox();
 expect(header.height).toBeLessThanOrEqual(56);
});

test('resume bar stacks above the tab bar and both hide while typing',async({page})=>{
 await login(page);await resetWorkouts(page);
 await nav(page).getByRole('link',{name:'History'}).click();
 await page.getByRole('button',{name:'Start workout'}).first().click();
 await page.getByRole('button',{name:'Blank workout'}).click();
 const name=page.getByRole('textbox',{name:'Workout name'});await expect(name).toBeVisible();
 await nav(page).getByRole('link',{name:'Programs'}).click();
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
 await page.getByRole('button',{name:'Profile'}).click();
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
 await nav(page).getByRole('link',{name:'Templates'}).click();
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
