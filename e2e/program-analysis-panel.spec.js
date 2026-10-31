import {test,expect} from '@playwright/test';
async function fixture(page){
 await page.goto('/');await page.evaluate(async()=>{
  const {mountAnalysisPanel}=await import('/src/analysis-panel.js'),{prepareProgramAnalysisSnapshot}=await import('/src/program-analysis-input.js');
  document.body.innerHTML='<button data-analyze><span data-analysis-label>Analyze program</span></button>';
  window.program={name:'Program',mode:'schedule',goals:{},context:{goalsAndPriorities:'Grow'},workouts:[{id:'o',templateId:'t',day:0,name:'Push',goals:{},exercises:[{name:'Bench',sets:3,repRange:{min:8,max:12},restSeconds:120,primaryMuscles:['Chest'],secondaryMuscles:[]}]}]};
  window.requests=[];window.validation=null;
  window.panel=mountAnalysisPanel({anchor:document.querySelector('[data-analyze]'),scope:'program',getSnapshot:()=>prepareProgramAnalysisSnapshot(window.program),onValidationError:e=>window.validation={occurrenceIndex:e.occurrenceIndex,exerciseIndex:e.exerciseIndex},request:(snapshot,options)=>new Promise(resolve=>window.requests.push({snapshot,...options,resolve}))});
 });
}
test('program scope preserves the streamed report on close and detects context changes and reverts',async({page})=>{
 await fixture(page);await page.getByRole('button',{name:'Analyze program',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Program analysis · Hypertrophy',exact:true})).toBeFocused();
 await page.evaluate(()=>window.requests[0].onEvent({type:'delta',text:'Assessment\nReview <img src=x>\nStrengths\n- Shared template.\nImprovements\nNo changes.\nLimits\nEffort unknown.'}));
 await expect(page.locator('.analysis-report img')).toHaveCount(0);
 await page.getByRole('button',{name:'Close program analysis'}).click();expect(await page.evaluate(()=>window.requests[0].signal.aborted)).toBe(false);
 await expect(page.locator('[data-analyze]')).toHaveText('Analyzing');await page.locator('[data-analyze]').click();expect(await page.evaluate(()=>window.requests.length)).toBe(1);
 await page.evaluate(()=>{window.program.context.goalsAndPriorities='Maintain';window.panel.refresh();});await expect(page.locator('.analysis-stale')).toHaveText('Program changed');
 await page.evaluate(()=>{window.program.context.goalsAndPriorities='Grow';window.panel.refresh();});await expect(page.locator('.analysis-stale')).toBeHidden();
 await page.getByRole('button',{name:'Stop',exact:true}).click();await expect(page.locator('.analysis-status')).toContainText('incomplete');
 await page.keyboard.press('Escape');await expect(page.locator('[data-analyze]')).toBeFocused();
});
test('program panel exposes controlled close and validates the whole program before a request',async({page})=>{
 await fixture(page);await page.locator('[data-analyze]').click();await page.evaluate(()=>window.panel.close({restoreFocus:false}));await expect(page.locator('.analysis-panel:visible')).toHaveCount(0);
 await page.evaluate(()=>{window.panel.destroy();window.program.workouts[0].exercises[0].sets=0;});
 await fixture(page);await page.evaluate(()=>window.program.workouts[0].exercises[0].sets=0);await page.locator('[data-analyze]').click();
 expect(await page.evaluate(()=>window.requests.length)).toBe(0);expect(await page.evaluate(()=>window.validation)).toEqual({occurrenceIndex:0,exerciseIndex:0});
});
test('program mobile report keeps focus and text across breakpoint changes',async({page})=>{
 await fixture(page);await page.locator('[data-analyze]').click();await page.evaluate(()=>window.requests[0].onEvent({type:'delta',text:'Assessment\n'+Array(80).fill('A detailed observation.').join('\n')}));
 const scroll=page.locator('.analysis-scroll');await expect.poll(()=>scroll.evaluate(e=>e.scrollTop)).toBeGreaterThan(100);
 await scroll.evaluate(e=>{e.scrollTop=0;e.dispatchEvent(new Event('scroll'));});await page.evaluate(()=>window.requests[0].onEvent({type:'delta',text:'\nLatest'}));await expect(page.getByRole('button',{name:'Jump to latest'})).toBeVisible();
 await page.getByRole('button',{name:'Stop',exact:true}).focus();await page.setViewportSize({width:390,height:844});await expect(page.locator('dialog.analysis-panel')).toBeVisible();await expect(page.getByRole('button',{name:'Stop',exact:true})).toBeFocused();
 await page.setViewportSize({width:1440,height:900});await expect(page.locator('section.analysis-panel')).toBeVisible();await expect(page.locator('.analysis-report')).toContainText('Latest');
});
