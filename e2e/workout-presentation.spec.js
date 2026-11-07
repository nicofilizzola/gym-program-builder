import {test,expect} from '@playwright/test';
import {focusFixture} from '../test/fixtures/workout-focus.js';

async function mount(page){
 await page.goto('/');
 await page.evaluate(async fixture=>{
  const {mountWorkoutLogger}=await import('/src/workout-logger-view.js');
  document.body.innerHTML='<main id="fixture"></main><ol id="alternate"></ol>';
  window.log=fixture;window.events=[];window.changes=[];
  window.logger=mountWorkoutLogger(document.querySelector('#fixture'),{api:{},log:window.log,onChange:value=>window.changes.push(value)});
  window.port=window.logger.presentationPort;window.ref={exerciseId:'straight',setId:'s1'};
 },focusFixture());
}
test('reparents the exact focused input without changing an invalid draft',async({page})=>{
 await mount(page);const field=page.getByLabel('Set 1 weight, Bench press',{exact:true});
 await field.fill('82.3');await field.evaluate(el=>el.setSelectionRange(2,3));
 await page.evaluate(()=>{window.originalInput=document.activeElement;window.port.setRowPlacement(({row})=>document.querySelector('#alternate').append(row));window.logger.setLog(window.log);});
 await expect(field).toHaveValue('82.3');await expect(field).toBeFocused();
 expect(await page.evaluate(()=>originalInput===port.row(ref).querySelector('[data-field="weight"]'))).toBe(true);
 expect(await field.evaluate(el=>[el.selectionStart,el.selectionEnd])).toEqual([2,3]);
 await page.evaluate(()=>port.restoreRows());await expect(field).toBeFocused();await expect(field).toHaveAttribute('aria-invalid','true');
});
test('ports emit only explicit edits and preserve bodyweight',async({page})=>{
 await mount(page);
 const events=await page.evaluate(async()=>{
  port.subscribe(e=>window.events.push({cause:e.cause,action:e.action?.type,saved:window.changes.length}));
  logger.setLog(log);logger.setLastTime({});logger.setBestPerformance({});
  await port.command({type:'patch',ref,patch:{reps:8,weightKg:0}});
  await port.command({type:'toggle',ref});
  return {events:window.events,log:port.read().log};
 });
 expect(events.events.filter(e=>e.action==='toggle')).toEqual([{cause:'edit',action:'toggle',saved:2}]);
 expect(events.events.some(e=>e.cause==='hydrate')).toBe(true);
 expect(events.log.exercises[0].sets[1]).toMatchObject({done:true,reps:8,weightKg:0});
});
test('canceling a destructive command leaves the canonical log unchanged',async({page})=>{
 await mount(page);await page.evaluate(()=>{log.exercises[0].sets[1].done=true;log.exercises[0].sets[1].reps=8;logger.setLog(log);window.removal=port.command({type:'remove-exercise',exerciseId:'straight'});});
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 expect(await page.evaluate(async()=>({result:await removal,count:port.read().log.exercises.length}))).toEqual({result:{accepted:false},count:4});
});
test('history refresh keeps a composing exercise note and input nodes',async({page})=>{
 await mount(page);await page.getByRole('button',{name:'Add note, Bench press',exact:true}).click();
 const note=page.getByRole('textbox',{name:'Note, Bench press',exact:true});await note.fill('  controlled lowering');
 await page.evaluate(()=>{window.originalNote=document.activeElement;originalNote.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));logger.setLastTime({});logger.setBestPerformance({});});
 await expect(note).toBeFocused();await expect(note).toHaveValue('  controlled lowering');
 expect(await page.evaluate(()=>originalNote===document.activeElement)).toBe(true);
 await page.evaluate(()=>logger.destroy());await expect(page.locator('.workout-logger')).toHaveCount(0);
});
