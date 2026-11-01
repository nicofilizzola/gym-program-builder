import {test,expect} from '@playwright/test';
async function programFixture(page){
 await page.setViewportSize({width:1366,height:768});await page.goto('/');
 await page.evaluate(async()=>{
  const {mountProgramView}=await import('/src/program-view.js');document.body.innerHTML='<div id="fixture"></div>';window.changes=[];
  const program={name:'Week',mode:'simple',goals:{},workouts:['Press','Pull','Extra'].map((name,i)=>({id:String(i),name,day:null,goals:{},exercises:[]}))};
  window.programData=program;window.view=mountProgramView(document.querySelector('#fixture'),{program,templates:[],onChange:v=>window.changes.push(v)});
 });await page.evaluate(()=>document.fonts.ready);
}
test('Reorder menu retains focus for repeated keyboard movement',async({page})=>{
 await programFixture(page);
 const reorder=page.getByRole('button',{name:'Reorder Press',exact:true});await reorder.focus();
 for(let i=0;i<2;i++){
  await page.keyboard.press('Space');
  await page.getByRole('button',{name:'Move down',exact:true}).focus();await page.keyboard.press('Space');
  await expect(reorder).toBeFocused();
 }
 expect(await page.evaluate(()=>window.changes.at(-1).workouts.map(w=>w.name))).toEqual(['Pull','Extra','Press']);
});
test('queued scroll notifications do not dismiss a newly positioned Reorder popup',async({page})=>{
 await programFixture(page);await page.getByRole('button',{name:'Reorder Press',exact:true}).click();
 await expect(page.locator('.reorder-menu')).toBeVisible();
 // A scroll event queued by click/focus auto-scrolling arrives after positioning.
 await page.evaluate(()=>document.dispatchEvent(new Event('scroll')));
 await expect(page.locator('.reorder-menu')).toBeVisible();
 await page.getByRole('button',{name:'Move down',exact:true}).click();
 expect(await page.evaluate(()=>window.changes.at(-1).workouts.map(w=>w.name))).toEqual(['Pull','Press','Extra']);
 await page.getByRole('button',{name:'Reorder Press',exact:true}).click();await expect(page.locator('.reorder-menu')).toBeVisible();
 await page.evaluate(()=>{document.body.style.paddingBottom='1000px';window.scrollBy(0,100);});
 await expect(page.locator('.reorder-menu')).toBeHidden();await expect(page.getByRole('button',{name:'Reorder Press',exact:true})).toBeFocused();
});


test('pending touch hold is cancelled when the program view rerenders',async({browser})=>{
 const context=await browser.newContext({hasTouch:true}),page=await context.newPage();await programFixture(page);
 const b=await page.locator('[data-workout="0"] .workout-metadata p:first-child').boundingBox(),client=await context.newCDPSession(page);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+5,y:b.y+5}]});
 await page.evaluate(()=>window.view.update(window.programData));
 await page.waitForTimeout(400); // The old 350ms hold must never arm after teardown.
 await expect(page.locator('.is-hold-armed,.sort-drag-copy')).toHaveCount(0);
 expect(await page.evaluate(()=>window.changes.length)).toBe(0);
 await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await context.close();
});

test('an independent touch action works immediately after a touch drop',async({browser})=>{
 const context=await browser.newContext({hasTouch:true}),page=await context.newPage();await programFixture(page);
 const b=await page.locator('[data-workout="0"] .workout-metadata p:first-child').boundingBox(),client=await context.newCDPSession(page);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+5,y:b.y+5}]});
 await expect(page.locator('[data-workout="0"]')).toHaveClass(/is-hold-armed/);
 const target=await page.locator('[data-workout="2"]').boundingBox();
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:target.x+50,y:target.y+target.height-5}]});
 await expect(page.locator('.sort-drag-copy')).toBeVisible();await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 expect(await page.evaluate(()=>window.changes.map(p=>p.workouts.map(w=>w.name)))).toEqual([['Pull','Extra','Press']]);
 await page.locator('.workout-title').filter({hasText:'Press'}).tap();await expect(page.getByRole('button',{name:'Back to program',exact:true})).toBeVisible();
 await expect(page.locator('[data-template-name]')).toHaveValue('Press');await context.close();
});
