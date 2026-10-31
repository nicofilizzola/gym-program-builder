import {test,expect} from '@playwright/test';
async function fixture(page){
 await page.goto('/');await page.evaluate(async()=>{
  const {mountProgramContextDialog}=await import('/src/program-context-dialog.js');
  document.body.innerHTML='<button id="context-trigger">Program context</button>';
  window.context={};window.events=[];
  window.contextDialog=mountProgramContextDialog({anchor:document.querySelector('#context-trigger'),getContext:()=>window.context,onChange:next=>{window.context=next;window.events.push(next);}});
 });
}
test('guided fields update immediately and Escape, Done and backdrop keep edits',async({page})=>{
 await fixture(page);const trigger=page.getByRole('button',{name:'Program context',exact:true});await trigger.click();
 const field=page.getByLabel('Goals and priorities',{exact:true});await expect(field).toBeFocused();await expect(field).toHaveAttribute('rows','3');await expect(field).toHaveAttribute('maxlength','2000');
 await expect(page.getByLabel('Constraints and preferences',{exact:true})).toBeVisible();await expect(page.getByLabel('Training background and approach',{exact:true})).toBeVisible();
 await field.fill('Prioritize delts');expect(await page.evaluate(()=>window.context.goalsAndPriorities)).toBe('Prioritize delts');
 await page.keyboard.press('Escape');await expect(trigger).toBeFocused();await trigger.click();await expect(field).toHaveValue('Prioritize delts');
 await page.getByRole('button',{name:'Done',exact:true}).click();await expect(trigger).toBeFocused();await trigger.click();await page.mouse.click(2,2);await expect(trigger).toBeFocused();
});
test('context refresh preserves textarea identity, selection and composition while updating other fields',async({page})=>{
 await fixture(page);await page.locator('#context-trigger').click();const field=page.getByLabel('Goals and priorities',{exact:true});await field.fill('Unsaved priorities');
 await field.evaluate(el=>{window.original=el;el.setSelectionRange(7,7);el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));});
 await page.evaluate(()=>{window.context.constraintsAndPreferences='45 minutes';window.contextDialog.refresh();});
 await expect(field).toBeFocused();expect(await field.evaluate(el=>el===window.original&&el.selectionStart===7)).toBe(true);await expect(page.getByLabel('Constraints and preferences',{exact:true})).toHaveValue('45 minutes');
 await field.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));
});
test('context exit is noninteractive, rapidly reversible and immediately settles under reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await fixture(page);await page.locator('#context-trigger').click();await page.getByRole('button',{name:'Done',exact:true}).click();
 expect(await page.locator('.program-context-exit').evaluate(el=>el.matches(':popover-open')&&el.inert)).toBe(true);
 await page.locator('#context-trigger').click();await page.waitForTimeout(230);await expect(page.getByRole('dialog',{name:'Program context',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Done',exact:true}).click();await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.program-context-exit:visible')).toHaveCount(0);await expect(page.locator('#context-trigger')).toBeFocused();
});
test('context dialog stays reachable with long notes, mobile width and enlarged text',async({page})=>{
 await fixture(page);await page.setViewportSize({width:390,height:660});await page.locator('#context-trigger').click();await page.getByLabel('Goals and priorities',{exact:true}).fill('Long goals '.repeat(150));
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');await page.getByRole('button',{name:'Done',exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Done',exact:true})).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.keyboard.press('Escape');await expect(page.locator('#context-trigger')).toBeFocused();
});
test('closing a scrolled context editor preserves its exit picture and rapid reopening resets to the first field',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await fixture(page);await page.setViewportSize({width:390,height:660});await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 await page.locator('#context-trigger').click();await expect(page.getByRole('dialog',{name:'Program context',exact:true})).toHaveCSS('opacity','1');
 const geometry=await page.evaluate(()=>{
  const dialog=document.querySelector('dialog.program-context-surface');dialog.scrollTop=dialog.scrollHeight;
  const input=dialog.querySelector('textarea'),before={scrollTop:dialog.scrollTop,top:input.getBoundingClientRect().top};
  window.contextDialog.close();
  const exit=document.querySelector('.program-context-exit');
  return {before,after:{scrollTop:exit.scrollTop,top:input.getBoundingClientRect().top},inert:exit.inert};
 });
 expect(geometry.before.scrollTop).toBeGreaterThan(100);expect(geometry.after.scrollTop).toBe(geometry.before.scrollTop);expect(Math.abs(geometry.after.top-geometry.before.top)).toBeLessThan(2);expect(geometry.inert).toBe(true);
 await page.locator('#context-trigger').click();await expect(page.getByLabel('Goals and priorities',{exact:true})).toBeFocused();await expect(page.getByLabel('Goals and priorities',{exact:true})).toBeInViewport();
 await page.waitForTimeout(230);await expect(page.getByRole('dialog',{name:'Program context',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.program-context-exit:visible')).toHaveCount(0);
});
