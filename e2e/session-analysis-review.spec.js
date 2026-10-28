import {test,expect} from '@playwright/test';
async function mount(page,{editor=false}={}){
 await page.goto('/');await page.evaluate(async editor=>{
  const workout={name:'Push',goals:{},exercises:[{name:'Bench',sets:3,restSeconds:180,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:['Triceps']}]};document.body.innerHTML='<div id="fixture"></div>';
  if(editor){const {mountSessionEditor}=await import('/src/session-editor.js');window.editor=mountSessionEditor(document.querySelector('#fixture'),{workout,analysisEnabled:true});}
  else{document.querySelector('#fixture').innerHTML='<button data-analyze><span data-analysis-label>Analyze</span></button>';const {mountAnalysisPanel}=await import('/src/analysis-panel.js');window.calls=[];window.panel=mountAnalysisPanel({anchor:document.querySelector('[data-analyze]'),getWorkout:()=>workout,request:(_,options)=>new Promise((resolve,reject)=>window.calls.push({...options,resolve,reject}))});}
 },editor);
}
test('Escape closes a newer Goals dialog before nonmodal analysis',async({page})=>{
 await page.route('**/api/analysis',r=>r.fulfill({contentType:'text/event-stream',body:'event: start\ndata: {"requestId":"a","promptVersion":"v"}\n\nevent: delta\ndata: {"text":"Assessment\\nA report."}\n\nevent: complete\ndata: {}\n\n'}));await mount(page,{editor:true});await page.locator('[data-analyze]').click();await page.getByRole('button',{name:'Set goals',exact:true}).click();await expect(page.locator('#goals-dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#goals-dialog')).toBeHidden();await expect(page.locator('section.analysis-panel')).toBeVisible();
});
test('generation control changes preserve keyboard focus through stop retry and completion',async({page})=>{
 await mount(page);await page.locator('[data-analyze]').click();await page.getByRole('button',{name:'Stop',exact:true}).click();await expect(page.getByRole('button',{name:'Analyze again',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Analyze again',exact:true}).click();await expect(page.getByRole('button',{name:'Stop',exact:true})).toBeFocused();await page.evaluate(()=>{window.calls[1].onEvent({type:'delta',text:'Report'});window.calls[1].onEvent({type:'complete'});});await expect(page.getByRole('button',{name:'Analyze again',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Analyze again',exact:true}).click();await page.evaluate(()=>window.calls[2].reject(Error('Please retry')));await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeFocused();await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByRole('button',{name:'Stop',exact:true})).toBeFocused();
});
test('enabled analysis has no unavailable accessible description',async({page})=>{
 await mount(page);await expect(page.locator('[data-analyze]')).toHaveAccessibleDescription('');await page.evaluate(()=>window.panel.setEnabled(false));await expect(page.locator('[data-analyze]')).toHaveAccessibleDescription('Session analysis is not configured yet.');await page.evaluate(()=>window.panel.setEnabled(true));await expect(page.locator('[data-analyze]')).toHaveAccessibleDescription('');
});
test('mobile reopening runs a new entry transition after every completed close',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'no-preference'});await mount(page);await page.locator('[data-analyze]').click();await page.getByRole('button',{name:'Close session analysis'}).click();await expect(page.locator('.analysis-panel:visible')).toHaveCount(0);
 for(let i=0;i<2;i++){const opacity=await page.evaluate(()=>{document.querySelector('[data-analyze]').click();return Number(getComputedStyle(document.querySelector('dialog.analysis-panel')).opacity);});expect(opacity).toBeLessThan(1);await page.getByRole('button',{name:'Close session analysis'}).click();await expect(page.locator('.analysis-panel:visible')).toHaveCount(0);}
});
