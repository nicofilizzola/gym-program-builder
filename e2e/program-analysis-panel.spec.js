import {test,expect} from '@playwright/test';
async function fixture(page,{width=1440,height=900}={}){
 await page.setViewportSize({width,height});
 await page.goto('/');await page.evaluate(async()=>{
  const {mountAnalysisPanel}=await import('/src/analysis-panel.js'),{prepareProgramAnalysisSnapshot}=await import('/src/program-analysis-input.js');
  document.body.innerHTML='<div class="program-route"><div><button class="secondary-btn review-toggle" data-review><span>AI review</span></button><p class="after" tabindex="-1">x</p></div><aside class="review-dock"></aside></div>';
  window.program={name:'Program',mode:'schedule',goals:{},context:{goalsAndPriorities:'Grow'},workouts:[{id:'o',templateId:'t',day:0,name:'Push',goals:{},exercises:[{name:'Bench',sets:3,repRange:{min:8,max:12},restSeconds:120,primaryMuscles:['Chest'],secondaryMuscles:[]}]}]};
  window.requests=[];window.validation=null;
  window.panel=mountAnalysisPanel({anchor:document.querySelector('[data-review]'),dock:document.querySelector('.review-dock'),getSnapshot:()=>prepareProgramAnalysisSnapshot(window.program),onValidationError:e=>window.validation={occurrenceIndex:e.occurrenceIndex,exerciseIndex:e.exerciseIndex},request:(snapshot,options)=>new Promise((resolve,reject)=>window.requests.push({snapshot,...options,resolve,reject}))});
 });
}
const longReport='Assessment\n'+Array(80).fill('A detailed observation.').join('\n');
test('dock opens with focus, generates once and keeps the report on close',async({page})=>{
 await fixture(page);const toggle=page.locator('[data-review]'),dock=page.locator('.review-dock');
 await toggle.click();
 await expect(page.getByRole('heading',{name:'AI review',exact:true})).toBeFocused();
 await expect(page.locator('.analysis-caption')).toHaveText('Hypertrophy · AI-generated');
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 const dockId=await dock.getAttribute('id');expect(dockId).toBeTruthy();await expect(toggle).toHaveAttribute('aria-controls',dockId);
 await expect(dock).toHaveClass(/is-open/);
 expect(await page.evaluate(()=>window.requests.length)).toBe(1);
 await expect(toggle).toHaveClass(/is-generating/);await expect(toggle).toHaveText('AI review');
 await page.evaluate(()=>window.requests[0].onEvent({type:'delta',text:'Assessment\nReview <img src=x>\nStrengths\n- Shared template.\nImprovements\nNo changes.\nLimits\nEffort unknown.'}));
 await expect(page.locator('.analysis-report img')).toHaveCount(0);await expect(page.locator('.analysis-report')).toContainText('Shared template.');
 const type=await page.evaluate(()=>{const report=getComputedStyle(document.querySelector('.analysis-report')),title=getComputedStyle(document.querySelector('.analysis-title')),lead=getComputedStyle(document.querySelector('.analysis-report h3 + p'));return {size:report.fontSize,line:parseFloat(report.lineHeight),title:title.fontSize,lead:lead.fontSize};});
 expect(type.size).toBe('14px');expect(Math.abs(type.line-20.3)).toBeLessThanOrEqual(.5);expect(type.title).toBe('16px');expect(type.lead).toBe('14px');
 await page.getByRole('button',{name:'Close AI review'}).click();
 await expect(toggle).toBeFocused();await expect(toggle).toHaveAttribute('aria-expanded','false');
 expect(await dock.evaluate(e=>e.inert)).toBe(true);await expect(dock).toHaveAttribute('aria-hidden','true');await expect(dock).not.toHaveClass(/is-open/);
 expect(await page.evaluate(()=>window.requests[0].signal.aborted)).toBe(false);
 await toggle.click();await expect(page.locator('.analysis-report')).toContainText('Shared template.');expect(await page.evaluate(()=>window.requests.length)).toBe(1);
 await page.evaluate(()=>{window.program.context.goalsAndPriorities='Maintain';window.panel.refresh();});await expect(page.locator('.analysis-stale')).toHaveText('Program changed');
 await page.evaluate(()=>{window.program.context.goalsAndPriorities='Grow';window.panel.refresh();});await expect(page.locator('.analysis-stale')).toBeHidden();
 await page.getByRole('button',{name:'Stop',exact:true}).click();await expect(toggle).not.toHaveClass(/is-generating/);await expect(toggle).toHaveText('AI review');
});
test('escape closes the dock only from inside it',async({page})=>{
 await fixture(page);const toggle=page.locator('[data-review]'),dock=page.locator('.review-dock');
 await toggle.click();await expect(dock).toHaveClass(/is-open/);
 await page.locator('p.after').focus();await page.keyboard.press('Escape');await expect(dock).toHaveClass(/is-open/);await expect(toggle).toHaveAttribute('aria-expanded','true');
 await page.getByRole('heading',{name:'AI review',exact:true}).focus();await page.keyboard.press('Escape');
 await expect(dock).not.toHaveClass(/is-open/);await expect(toggle).toBeFocused();
});
test('dock keeps report scroll and survives rapid reversal',async({page})=>{
 await fixture(page);const dock=page.locator('.review-dock'),scroll=page.locator('.analysis-scroll');
 await page.locator('[data-review]').click();await page.evaluate(text=>window.requests[0].onEvent({type:'delta',text}),longReport);
 await expect.poll(()=>scroll.evaluate(e=>e.scrollTop)).toBeGreaterThan(200);
 await scroll.evaluate(e=>{e.scrollTop=200;e.dispatchEvent(new Event('scroll'));});
 await page.evaluate(()=>{const toggle=document.querySelector('[data-review]');toggle.click();toggle.click();toggle.click();toggle.click();});
 await expect(dock).toHaveClass(/is-open/);expect(await dock.evaluate(e=>e.inert)).toBe(false);await expect(dock).not.toHaveAttribute('aria-hidden','true');
 expect(await scroll.evaluate(e=>e.scrollTop)).toBe(200);
 await expect(page.getByRole('heading',{name:'AI review',exact:true})).toBeFocused();
});
test('below 1024px the program review is a full-screen modal and adapts across the breakpoint',async({page})=>{
 await fixture(page,{width:1023,height:800});const toggle=page.locator('[data-review]'),dialog=page.locator('dialog.analysis-modal'),dock=page.locator('.review-dock');
 await toggle.click();await expect(dialog).toBeVisible();
 expect(await dialog.boundingBox()).toEqual({x:0,y:0,width:1023,height:800});
 await expect(toggle).toHaveAttribute('aria-controls',await dialog.getAttribute('id'));
 await page.evaluate(text=>window.requests[0].onEvent({type:'delta',text}),longReport+'\nLatest');
 await page.getByRole('button',{name:'Stop',exact:true}).focus();
 await page.setViewportSize({width:1024,height:800});
 await expect(dock.locator('.analysis-content')).toHaveCount(1);await expect(dock).toHaveClass(/is-open/);await expect(dialog).toBeHidden();
 await expect(page.getByRole('button',{name:'Stop',exact:true})).toBeFocused();await expect(page.locator('.analysis-report')).toContainText('Latest');
 await expect(toggle).toHaveAttribute('aria-controls',await dock.getAttribute('id'));
 await page.setViewportSize({width:1023,height:800});
 await expect(dialog).toBeVisible();await expect(dock).not.toHaveClass(/is-open/);expect(await dock.evaluate(e=>e.inert)).toBe(true);
});
test('dismissModal only closes the full-screen review',async({page})=>{
 await fixture(page);await page.locator('[data-review]').click();await page.evaluate(()=>window.panel.dismissModal());
 await expect(page.locator('.review-dock')).toHaveClass(/is-open/);
 await fixture(page,{width:1000,height:800});await page.locator('[data-review]').click();await expect(page.locator('dialog.analysis-modal')).toBeVisible();
 await page.evaluate(()=>window.panel.dismissModal());await expect(page.locator('dialog.analysis-modal')).toBeHidden();
 await expect(page.locator('[data-review]')).toHaveAttribute('aria-expanded','false');
});
test('dock tracks its offset and destroy restores the empty dock',async({page})=>{
 await fixture(page);await page.evaluate(()=>{document.querySelector('.program-route').style.marginTop='120px';});
 await page.locator('[data-review]').click();
 await expect.poll(()=>page.locator('.review-dock').evaluate(e=>e.style.getPropertyValue('--review-dock-top'))).toBe('120px');
 await page.evaluate(()=>window.panel.destroy());
 expect(await page.locator('.review-dock').evaluate(e=>({children:e.children.length,open:e.classList.contains('is-open'),inert:e.inert,hidden:e.hasAttribute('aria-hidden'),top:e.style.getPropertyValue('--review-dock-top')}))).toEqual({children:0,open:false,inert:false,hidden:false,top:''});
});
test('program panel validates the whole program before a request',async({page})=>{
 await fixture(page);await page.evaluate(()=>window.program.workouts[0].exercises[0].sets=0);await page.locator('[data-review]').click();
 expect(await page.evaluate(()=>window.requests.length)).toBe(0);expect(await page.evaluate(()=>window.validation)).toEqual({occurrenceIndex:0,exerciseIndex:0});
});
test('stream follows the reader, offers Jump to latest and keeps scroll across the breakpoint',async({page})=>{
 await fixture(page);await page.locator('[data-review]').click();
 await page.evaluate(text=>window.requests[0].onEvent({type:'delta',text}),'Assessment\n'+Array(80).fill('A detailed exercise observation.').join('\n'));
 const scroll=page.locator('.analysis-scroll');await expect.poll(()=>scroll.evaluate(e=>e.scrollTop)).toBeGreaterThan(100);
 await scroll.evaluate(e=>{e.scrollTop=0;e.dispatchEvent(new Event('scroll'));});
 await page.evaluate(()=>window.requests[0].onEvent({type:'delta',text:'\nMore details'}));
 await expect(page.getByRole('button',{name:'Jump to latest'})).toBeVisible();expect(await scroll.evaluate(e=>e.scrollTop)).toBe(0);
 await page.getByRole('button',{name:'Jump to latest'}).click();await expect.poll(()=>scroll.evaluate(e=>e.scrollTop)).toBeGreaterThan(100);
 await page.getByRole('button',{name:'Stop',exact:true}).focus();
 await page.setViewportSize({width:390,height:844});await expect(page.locator('dialog.analysis-panel')).toBeVisible();await expect(page.getByRole('button',{name:'Stop',exact:true})).toBeFocused();await expect(page.locator('.analysis-report')).toContainText('More details');
 await page.setViewportSize({width:1440,height:900});await expect(page.locator('.review-dock')).toHaveClass(/is-open/);await expect(page.getByRole('button',{name:'Stop',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.locator('[data-review]')).toBeFocused();
});
test('generation control changes preserve keyboard focus through stop, retry and completion',async({page})=>{
 await fixture(page);await page.locator('[data-review]').click();
 await page.getByRole('button',{name:'Stop',exact:true}).click();await expect(page.getByRole('button',{name:'Analyze again',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Analyze again',exact:true}).click();await expect(page.getByRole('button',{name:'Stop',exact:true})).toBeFocused();
 await page.evaluate(()=>{window.requests[1].onEvent({type:'delta',text:'Report'});window.requests[1].onEvent({type:'complete'});});await expect(page.getByRole('button',{name:'Analyze again',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Analyze again',exact:true}).click();await page.evaluate(()=>window.requests[2].reject(Error('Please retry')));
 await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeFocused();await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByRole('button',{name:'Stop',exact:true})).toBeFocused();
});
test('streaming survives close, Stop retains partial output and stale callbacks cannot replace retry',async({page})=>{
 await fixture(page);const toggle=page.locator('[data-review]');await toggle.click();
 await page.evaluate(()=>window.requests[0].onEvent({type:'delta',text:'Assessment\nFirst finding'}));await expect(page.locator('.analysis-report')).toContainText('First finding');
 await page.getByRole('button',{name:'Close AI review'}).click();await expect(toggle).toHaveClass(/is-generating/);expect(await page.evaluate(()=>window.requests[0].signal.aborted)).toBe(false);
 await toggle.click();expect(await page.evaluate(()=>window.requests.length)).toBe(1);
 await page.getByRole('button',{name:'Stop',exact:true}).click();await expect(page.locator('.analysis-status')).toContainText('incomplete');expect(await page.evaluate(()=>window.requests[0].signal.aborted)).toBe(true);
 await page.getByRole('button',{name:'Analyze again',exact:true}).click();
 await page.evaluate(()=>{window.requests[0].onEvent({type:'delta',text:'STALE'});window.requests[1].onEvent({type:'delta',text:'Assessment\nNewest finding'});window.requests[1].onEvent({type:'complete'});});
 await expect(page.locator('.analysis-report')).toHaveText('AssessmentNewest finding');
 await page.evaluate(()=>{window.panel.destroy();window.requests[1].onEvent({type:'delta',text:'late'});});await expect(page.locator('.analysis-panel')).toHaveCount(0);
});
test('mobile reopening runs a new entry transition after every completed close',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await fixture(page,{width:390,height:844});
 await page.locator('[data-review]').click();await page.getByRole('button',{name:'Close AI review'}).click();await expect(page.locator('.analysis-panel:visible')).toHaveCount(0);
 for(let i=0;i<2;i++){
  const opacity=await page.evaluate(()=>{document.querySelector('[data-review]').click();return Number(getComputedStyle(document.querySelector('dialog.analysis-panel')).opacity);});expect(opacity).toBeLessThan(1);
  await page.getByRole('button',{name:'Close AI review'}).click();await expect(page.locator('.analysis-panel:visible')).toHaveCount(0);
 }
});
