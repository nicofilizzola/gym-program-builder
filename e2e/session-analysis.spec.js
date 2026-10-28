import {test,expect} from '@playwright/test';
const report='Assessment\nYour pressing session prioritizes chest.\nStrengths\n- Bench press provides a clear starting point.\nImprovements\n1. Exercise 1: Bench — consider more rest if performance drops.\nLimits\nEffort and technique are unknown. <img src=x onerror=alert(1)>';
const frames=text=>`event: start\ndata: {"requestId":"a","promptVersion":"v1"}\n\nevent: delta\ndata: ${JSON.stringify({text})}\n\nevent: complete\ndata: {}\n\n`;
async function fixture(page,{enabled=true,invalid=false}={}){
 await page.goto('/');await page.evaluate(async({enabled,invalid})=>{
  const {mountSessionEditor}=await import('/src/session-editor.js');document.body.innerHTML='<div id="fixture"></div>';
  window.editor=mountSessionEditor(document.querySelector('#fixture'),{analysisEnabled:enabled,workout:{name:'Upper A',goals:{},exercises:[{name:invalid?'':'Bench',sets:3,restSeconds:180,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:['Triceps']}]}});
 },{enabled,invalid});
}
test('analysis sends unsaved edits, renders safe report, preserves on reopen and detects changes',async({page})=>{
 let calls=0,sent;await page.route('**/api/analysis',route=>{calls++;sent=route.request().postDataJSON();return route.fulfill({contentType:'text/event-stream',body:frames(report)});});
 await fixture(page);await page.getByLabel('Session template name').fill('Unsaved');await page.getByRole('button',{name:'Analyze',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Session analysis',exact:true})).toBeVisible();await expect(page.locator('.analysis-status')).toHaveText('Analysis complete');expect(sent.workout.name).toBe('Unsaved');expect(calls).toBe(1);
 await expect(page.locator('.analysis-report h3')).toHaveText(['Assessment','Strengths','Improvements','Limits']);await expect(page.locator('.analysis-report img')).toHaveCount(0);await expect(page.locator('.analysis-report')).toContainText('<img');
 await page.getByRole('button',{name:'Close session analysis'}).click();await expect(page.locator('.analysis-panel:visible')).toHaveCount(0);await page.getByRole('button',{name:'View analysis',exact:true}).click();expect(calls).toBe(1);
 await page.getByLabel('Session template name').fill('Changed');await expect(page.locator('.analysis-stale')).toBeVisible();await page.getByLabel('Session template name').fill('Unsaved');await expect(page.locator('.analysis-stale')).toBeHidden();
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'View analysis',exact:true})).toBeFocused();
});
test('invalid collapsed exercise focuses its first invalid field without a request',async({page})=>{
 let calls=0;await page.route('**/api/analysis',route=>{calls++;return route.abort();});await fixture(page,{invalid:true});await page.getByRole('button',{name:'Analyze',exact:true}).click();await expect(page.getByLabel('Exercise name',{exact:true})).toBeFocused();expect(calls).toBe(0);await expect(page.locator('#file-message')).toContainText('Exercise 1');
});
test('analysis is absent by default and explains disabled configuration',async({page})=>{
 await fixture(page,{enabled:false});await expect(page.locator('[data-analyze]')).toBeHidden();
 await fixture(page,{enabled:null});await expect(page.locator('[data-analyze]')).toHaveAttribute('aria-disabled','true');await page.locator('[data-analyze]').dispatchEvent('click');await expect(page.locator('.analysis-unavailable')).toBeVisible();
});
async function controlled(page){
 await fixture(page,{enabled:false});await page.evaluate(async()=>{
  const {mountAnalysisPanel}=await import('/src/analysis-panel.js');const anchor=document.querySelector('[data-analyze]');anchor.hidden=false;
  window.analysisCalls=[];window.analysisWorkout={name:'Push',goals:{},exercises:[{name:'Bench',sets:3,restSeconds:180,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:['Triceps']}]};
  window.analysisPanel=mountAnalysisPanel({anchor,getWorkout:()=>window.analysisWorkout,request:(snapshot,options)=>new Promise(resolve=>window.analysisCalls.push({snapshot,...options,resolve}))});
 });
}
test('streaming survives close, Stop retains partial output and stale callbacks cannot replace retry',async({page})=>{
 await controlled(page);await page.locator('[data-analyze]').click();await page.evaluate(()=>window.analysisCalls[0].onEvent({type:'delta',text:'Assessment\nFirst finding'}));await expect(page.locator('.analysis-report')).toContainText('First finding');
 await page.getByRole('button',{name:'Close session analysis'}).click();await expect(page.locator('[data-analyze]')).toHaveText('Analyzing');expect(await page.evaluate(()=>window.analysisCalls[0].signal.aborted)).toBe(false);
 await page.locator('[data-analyze]').click();expect(await page.evaluate(()=>window.analysisCalls.length)).toBe(1);await page.getByRole('button',{name:'Stop',exact:true}).click();await expect(page.locator('.analysis-status')).toContainText('incomplete');expect(await page.evaluate(()=>window.analysisCalls[0].signal.aborted)).toBe(true);
 await page.getByRole('button',{name:'Analyze again',exact:true}).click();await page.evaluate(()=>{window.analysisCalls[0].onEvent({type:'delta',text:'STALE'});window.analysisCalls[1].onEvent({type:'delta',text:'Assessment\nNewest finding'});window.analysisCalls[1].onEvent({type:'complete'});});await expect(page.locator('.analysis-report')).toHaveText('AssessmentNewest finding');
 await page.evaluate(()=>{window.analysisPanel.destroy();window.analysisCalls[1].onEvent({type:'delta',text:'late'});});await expect(page.locator('.analysis-panel')).toHaveCount(0);
});
test('streaming respects reader scroll and breakpoint changes without losing content or focus',async({page})=>{
 await controlled(page);await page.locator('[data-analyze]').click();await page.evaluate(()=>window.analysisCalls[0].onEvent({type:'delta',text:'Assessment\n'+Array(80).fill('A detailed exercise observation.').join('\n')}));
 const scroll=page.locator('.analysis-scroll');await expect.poll(()=>scroll.evaluate(e=>e.scrollTop)).toBeGreaterThan(100);
 await scroll.evaluate(e=>{e.scrollTop=0;e.dispatchEvent(new Event('scroll'));});await page.evaluate(()=>window.analysisCalls[0].onEvent({type:'delta',text:'\nMore details'}));await expect(page.getByRole('button',{name:'Jump to latest'})).toBeVisible();expect(await scroll.evaluate(e=>e.scrollTop)).toBe(0);
 await page.getByRole('button',{name:'Jump to latest'}).click();await expect.poll(()=>scroll.evaluate(e=>e.scrollTop)).toBeGreaterThan(100);await page.getByRole('button',{name:'Stop',exact:true}).focus();
 await page.setViewportSize({width:390,height:844});await expect(page.locator('dialog.analysis-panel')).toBeVisible();await expect(page.getByRole('button',{name:'Stop',exact:true})).toBeFocused();await expect(page.locator('.analysis-report')).toContainText('More details');
 await page.setViewportSize({width:1440,height:900});await expect(page.locator('section.analysis-panel')).toBeVisible();await expect(page.getByRole('button',{name:'Stop',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('[data-analyze]')).toBeFocused();
});
test('closing motion retains nodes, reverses rapidly and prevents stale hide callbacks',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await controlled(page);await page.locator('[data-analyze]').click();await page.getByRole('button',{name:'Close session analysis'}).click();
 expect(await page.locator('section.analysis-panel').evaluate(e=>e.matches(':popover-open')&&e.inert)).toBe(true);
 await page.locator('[data-analyze]').click();await expect(page.locator('.analysis-title')).toBeFocused();await page.waitForTimeout(230);await expect(page.locator('section.analysis-panel')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('.analysis-panel:visible')).toHaveCount(0);
});
test('error Retry sends latest session and external replacement marks existing report stale',async({page})=>{
 let calls=0;await page.route('**/api/analysis',r=>{calls++;return calls===1?r.fulfill({status:429,json:{error:{code:'RATE_LIMIT',message:'Please retry shortly.'}}}):r.fulfill({contentType:'text/event-stream',body:frames(report)});});await fixture(page);await page.locator('[data-analyze]').click();await expect(page.locator('.analysis-status')).toHaveText('Please retry shortly.');await page.getByLabel('Session template name').fill('Changed');await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.locator('.analysis-status')).toHaveText('Analysis complete');await expect(page.locator('.analysis-snapshot')).toHaveText('Changed');
 await page.evaluate(()=>window.editor.setWorkout({name:'Imported',goals:{},exercises:[{name:'Row',sets:3,repRange:{min:8,max:12},restSeconds:120,primaryMuscles:['Lats'],secondaryMuscles:[]}]}));await expect(page.locator('.analysis-stale')).toBeVisible();expect(calls).toBe(2);
});
test('mobile sheet contains focus and restores trigger with reduced motion',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.route('**/api/analysis',r=>r.fulfill({contentType:'text/event-stream',body:frames(report)}));await fixture(page);await page.locator('[data-analyze]').click();await expect(page.locator('dialog.analysis-panel')).toBeVisible();await expect(page.locator('.analysis-title')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('[data-analyze]')).toBeFocused();
});
test('populated analysis layouts retain readable figures, controls and wrapping across viewports',async({page})=>{
 await page.route('**/api/analysis',r=>r.fulfill({contentType:'text/event-stream',body:frames(report)}));await fixture(page);
 await page.evaluate(()=>window.editor.setWorkout({name:'Upper body · Chest and back emphasis',goals:{Chest:8,Lats:6,Triceps:4},exercises:['Bench press — paused barbell variation','Chest-supported dumbbell row','Incline dumbbell press','Wide-grip lat pulldown','Cable lateral raise','Overhead cable triceps extension'].map((name,i)=>({name,sets:i<2?4:3,repRange:{min:8,max:12},restSeconds:i<4?180:90,primaryMuscles:[i%2?'Lats':'Chest'],secondaryMuscles:['Triceps']}))}));
 await page.locator('[data-analyze]').click();await expect(page.locator('.analysis-status')).toHaveText('Analysis complete');
 for(const [width,height]of [[1366,768],[1440,900],[1920,1080],[768,1024],[390,844]]){
  await page.setViewportSize({width,height});await expect(page.locator('.analysis-title')).toBeVisible();const box=await page.locator('.analysis-panel:visible').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);expect(box.y+box.height).toBeLessThanOrEqual(height+1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`.superpowers/sdd/2026-10-28-session-analysis/analysis-${width}.png`});
 }
 await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>document.documentElement.style.fontSize='200%');await expect(page.locator('.analysis-title')).toBeVisible();await expect(page.getByRole('button',{name:'Analyze again',exact:true})).toBeInViewport();await page.screenshot({path:'.superpowers/sdd/2026-10-28-session-analysis/analysis-200text.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test.describe('hybrid input',()=>{
 test.use({hasTouch:true,viewport:{width:1366,height:768}});
 test('analysis controls retain 44px targets on hybrid desktop',async({page})=>{
  await controlled(page);await page.locator('[data-analyze]').tap();for(const selector of ['[data-analyze]','.analysis-close','.analysis-stop']){const box=await page.locator(selector).boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);expect(box.width).toBeGreaterThanOrEqual(44);}
 });
});
