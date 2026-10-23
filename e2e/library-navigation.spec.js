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
 await login(page);const programs=page.getByRole('link',{name:'Programs',exact:true});
 await expect(programs).toHaveAttribute('aria-current','page');
 expect(await programs.evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
 await page.emulateMedia({reducedMotion:'no-preference'});
 expect(await programs.evaluate(el=>getComputedStyle(el).transitionDuration)).toContain('0.15s');
 await page.getByRole('link',{name:'Session templates',exact:true}).click();
 await expect(page.getByRole('link',{name:'Session templates',exact:true})).toHaveAttribute('aria-current','page');
 await page.getByRole('button',{name:'New session template',exact:true}).click();
 await expect(page.getByRole('link',{name:'Session templates',exact:true})).toHaveAttribute('aria-current','page');
});
async function fixture(page,kind='program'){
 await login(page);
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
 await page.getByRole('link',{name:'Programs',exact:true}).click();
 const row=page.locator('.library-item').filter({has:page.getByRole('link',{name:'Action check',exact:true})});
 page.once('dialog',dialog=>dialog.dismiss());await row.getByRole('button',{name:'Delete Action check',exact:true}).click();await expect(row).toHaveCount(1);
 const downloadPromise=page.waitForEvent('download');await row.getByRole('button',{name:'Export Action check',exact:true}).click();const download=await downloadPromise;
 const stream=await download.createReadStream();let text='';for await(const chunk of stream)text+=chunk;expect(JSON.parse(text).version).toBe(2);
 await row.getByRole('button',{name:'Duplicate Action check',exact:true}).click();await expect(row).toHaveCount(2);
 const chooserPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Import',exact:true}).click();expect(await chooserPromise).toBeTruthy();
});
