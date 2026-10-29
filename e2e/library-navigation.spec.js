import {test,expect} from '@playwright/test';
async function login(page){
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
}
test('logout is an accessible icon with a dismissible tooltip',async({page})=>{
 await login(page);
 const logout=page.getByRole('button',{name:'Log out',exact:true});
 await expect(logout).toHaveText('');await expect(logout.locator('svg')).toHaveAttribute('aria-hidden','true');
 await logout.focus();await expect(page.getByRole('tooltip')).toHaveText('Log out');
 await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toHaveCount(0);await expect(logout).toBeFocused();
 await page.mouse.move(0,0);await logout.hover();await expect(page.getByRole('tooltip')).toHaveText('Log out');
 await logout.click();await expect(page.getByLabel('Password',{exact:true})).toBeVisible();await expect(page.getByRole('tooltip')).toHaveCount(0);
});
test('navigation shows active tabs and respects motion preference',async({page})=>{
 await login(page);const programs=page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Programs',exact:true});
 await expect(programs).toHaveAttribute('aria-current','page');
 expect(await programs.evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
 await page.emulateMedia({reducedMotion:'no-preference'});
 expect(await programs.evaluate(el=>getComputedStyle(el).transitionDuration)).toContain('0.15s');
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();
 await expect(page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true})).toHaveAttribute('aria-current','page');
 await page.getByRole('button',{name:'New session template',exact:true}).click();
 await expect(page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true})).toHaveAttribute('aria-current','page');
});
async function fixture(page,kind='program'){
 await login(page);
 if(kind==='template')await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();
 await page.evaluate(async kind=>{
  const {mountLibrary}=await import('/src/library-view.js');window.calls=[];
  const records=[{id:'one',name:'Same'},{id:'two',name:'Same'},{id:'empty',name:' '},{id:'literal',name:'<img src=x onerror=alert(1)>'}];
  const track=action=>record=>window.calls.push([action,record?.id]);
  window.library=mountLibrary(document.querySelector('#app'),{kind,records,recordHref:record=>`#/${kind==='program'?'programs':'templates'}/${record.id}`,onCreate:track('create'),onOpen:track('open'),onDuplicate:track('duplicate'),onDelete:track('delete'),onExport:track('export'),onImport:track('import')});
 },kind);
}
for(const kind of ['program','template']){
 test(`${kind} library has safe title links and distinct icon actions`,async({page})=>{
  await fixture(page,kind);const rows=page.locator('.library-item');
  const create=page.getByRole('button',{name:kind==='program'?'New program':'New session template',exact:true});
  await expect(create.locator('svg')).toHaveAttribute('aria-hidden','true');
  await expect(page.getByRole('button',{name:'Import',exact:true}).locator('svg')).toHaveCount(1);
  await expect(rows.nth(0).getByRole('link',{name:'Same',exact:true})).toHaveAttribute('href',`#/${kind==='program'?'programs':'templates'}/one`);
  await expect(rows.nth(1).getByRole('link',{name:'Same',exact:true})).toHaveAttribute('href',`#/${kind==='program'?'programs':'templates'}/two`);
  await expect(rows.nth(2).getByRole('link')).toHaveText(kind==='program'?'Untitled program':'Untitled template');
  await expect(rows.nth(3).getByRole('link')).toHaveText('<img src=x onerror=alert(1)>');await expect(rows.locator('img')).toHaveCount(0);
  await expect(rows.getByRole('button',{name:/^Open /})).toHaveCount(0);
  for(const label of ['Duplicate','Export','Delete']){
   const button=rows.nth(1).getByRole('button',{name:`${label} Same`,exact:true});
   await expect(button).toHaveText('');await button.click();
  }
  await expect.poll(()=>page.evaluate(()=>window.calls)).toEqual([['duplicate','two'],['export','two'],['delete','two']]);
  await rows.first().getByRole('link').focus();await page.keyboard.press('Enter');
  expect(await page.evaluate(()=>window.calls.at(-1))).toEqual(['open','one']);
  expect(await rows.first().getByRole('link').evaluate(el=>{
   const event=new MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true});el.dispatchEvent(event);return event.defaultPrevented;
  })).toBe(false);
  expect(await page.evaluate(()=>window.calls.filter(([action])=>action==='open').length)).toBe(1);
 });
}
test('library actions preserve file picker, download, duplicate and delete confirmation',async({page})=>{
 await login(page);await page.getByRole('button',{name:'New program',exact:true}).click();
 await page.getByLabel('Program name',{exact:true}).fill('Action check');await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Programs',exact:true}).click();
 const row=page.locator('.library-item').filter({has:page.getByRole('link',{name:'Action check',exact:true})});
 page.once('dialog',dialog=>dialog.dismiss());await row.getByRole('button',{name:'Delete Action check',exact:true}).click();await expect(row).toHaveCount(1);
 const downloadPromise=page.waitForEvent('download');await row.getByRole('button',{name:'Export Action check',exact:true}).click();const download=await downloadPromise;
 const stream=await download.createReadStream();let text='';for await(const chunk of stream)text+=chunk;expect(JSON.parse(text).version).toBe(3);
 await row.getByRole('button',{name:'Duplicate Action check',exact:true}).click();await expect(row).toHaveCount(2);
 const chooserPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Import',exact:true}).click();expect(await chooserPromise).toBeTruthy();
});
for(const kind of ['program','template']){
 test(`${kind} layout reflows at narrow widths and enlarged text`,async({page})=>{
  await fixture(page,kind);await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>window.library.update([{id:'long',name:'Long'.repeat(50)},{id:'other',name:'Long'.repeat(50)}]));
  for(const width of [320,375,768,1280]){
   await page.setViewportSize({width,height:900});
   const create=await page.locator('[data-new]').boundingBox(),importBox=await page.locator('[data-import]').boundingBox();
   expect(Math.abs(create.y-importBox.y)).toBeLessThan(2);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   const buttons=await page.locator('.library-item').first().getByRole('button').all();let previous;
   for(const button of buttons){const box=await button.boundingBox();expect(box.width).toBeGreaterThanOrEqual(width>=1100?32:44);expect(box.height).toBeGreaterThanOrEqual(width>=1100?32:44);if(previous)expect(box.x-previous.x-previous.width).toBeGreaterThanOrEqual(8);previous=box;}
  }
  await page.setViewportSize({width:375,height:900});
  await page.screenshot({path:`.superpowers/sdd/2026-10-23-library-navigation-polish/${kind}-mobile.png`,fullPage:true});
  await page.setViewportSize({width:1280,height:900});await page.screenshot({path:`.superpowers/sdd/2026-10-23-library-navigation-polish/${kind}-desktop.png`,fullPage:true});
  await page.setViewportSize({width:320,height:900});await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expect(page.locator('[data-new]')).toBeVisible();await expect(page.locator('[data-import]')).toBeVisible();
 });
}
test('tooltips survive rapid reentry, respect bounds and clean up on updates',async({page})=>{
 await fixture(page);const tooltipNodes=await page.locator('.action-tooltip').count();const row=page.locator('.library-item').first(),duplicate=row.getByRole('button',{name:'Duplicate Same',exact:true});
 // Deterministic sub-delay pointer departure and reentry reproduces canceled entrance timers.
 await duplicate.evaluate(el=>{for(const type of ['pointerover','pointerout','pointerover'])el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'mouse'}));});
 await expect(page.getByRole('tooltip')).toHaveText('Duplicate');
 const tip=page.getByRole('tooltip');await tip.hover();await expect(tip).toBeVisible();
 const exportButton=row.getByRole('button',{name:'Export Same',exact:true});await duplicate.focus();await page.keyboard.press('Tab');await expect(tip).toHaveText('Export');await expect(tip).toHaveCount(1);
 const box=await tip.boundingBox();expect(box.x).toBeGreaterThanOrEqual(8);expect(box.y).toBeGreaterThanOrEqual(8);expect(box.x+box.width).toBeLessThanOrEqual(1272);
 expect(await exportButton.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
 await page.keyboard.press('Enter');expect(await page.evaluate(()=>window.calls.at(-1))).toEqual(['export','one']);await expect(tip).toHaveCount(0);
 await duplicate.focus();await expect(tip).toHaveText('Duplicate');await page.keyboard.press('Space');expect(await page.evaluate(()=>window.calls.at(-1))).toEqual(['duplicate','one']);
 await exportButton.focus();await expect(tip).toHaveText('Export');await page.evaluate(()=>document.dispatchEvent(new Event('scroll')));await expect(tip).toHaveCount(0);
 await duplicate.focus();await expect(tip).toHaveText('Duplicate');await page.evaluate(()=>window.library.update([{id:'new',name:'New'}]));await expect(tip).toHaveCount(0);
 await page.getByRole('button',{name:'Delete New',exact:true}).focus();await expect(tip).toHaveText('Delete');await page.evaluate(()=>window.library.destroy());await expect(page.locator('.action-tooltip')).toHaveCount(tooltipNodes-1);await expect(tip).toHaveCount(0);
 await page.getByRole('button',{name:'Log out',exact:true}).focus();await expect(tip).toHaveText('Log out');await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await expect(tip).toHaveCount(0);
});
test('touch actions execute with a single tap',async({browser})=>{
 const context=await browser.newContext({hasTouch:true,viewport:{width:375,height:812}});const page=await context.newPage();
 try{
  await fixture(page);const row=page.locator('.library-item').first();
  for(const label of ['Duplicate','Export','Delete'])await row.getByRole('button',{name:`${label} Same`,exact:true}).tap();
  expect(await page.evaluate(()=>window.calls)).toEqual([['duplicate','one'],['export','one'],['delete','one']]);
 }finally{await context.close();}
});
test('tooltips flip at viewport edges, preserve descriptions and cancel pending work',async({page})=>{
 await fixture(page);await page.emulateMedia({reducedMotion:'no-preference'});
 const button=page.locator('.library-item').first().getByRole('button',{name:'Delete Same',exact:true});
 await button.evaluate(el=>{el.style.cssText='position:fixed;right:4px;bottom:4px;z-index:2';el.setAttribute('aria-describedby','existing-description');const description=document.createElement('span');description.id='existing-description';description.hidden=true;description.textContent='Existing description';document.body.append(description);});
 await button.focus();const tip=page.getByRole('tooltip');await expect(tip).toHaveText('Delete');
 const bounds=await tip.boundingBox(),anchor=await button.boundingBox();
 expect(bounds.x).toBeGreaterThanOrEqual(8);expect(bounds.x+bounds.width).toBeLessThanOrEqual(1272);expect(bounds.y+bounds.height).toBeLessThanOrEqual(anchor.y);
 expect(await tip.evaluate(el=>getComputedStyle(el).transitionDuration)).toContain('0.15s');
 await expect(button).toHaveAttribute('aria-describedby',/existing-description action-tooltip-/);
 await page.setViewportSize({width:375,height:812});await expect(tip).toHaveCount(0);await expect(button).toHaveAttribute('aria-describedby','existing-description');
 await button.evaluate(el=>el.blur());await button.focus();await page.evaluate(()=>window.library.destroy());await expect(tip).toHaveCount(0);
});
