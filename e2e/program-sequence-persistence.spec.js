import {test,expect} from '@playwright/test';

async function newSequence(page) {
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('button',{name:'New program',exact:true}).click();
 await expect(page.getByRole('radio',{name:'Week',exact:true})).toBeChecked();
 await page.getByRole('radio',{name:'Sequence',exact:true}).check();
 await page.getByLabel('Program name',{exact:true}).fill('Rest cycle');
}
const getRecord=async page=>(await (await page.request.get('/api/documents/'+page.url().split('/').at(-1))).json()).record;
const entryTypes=page=>page.locator('[data-sequence-key]').evaluateAll(els=>els.map(e=>e.hasAttribute('data-rest')?'rest':'workout'));

test('rest sequence survives save, reload, portable export, import and library duplication',async({page})=>{
 await newSequence(page);
 await page.getByRole('button',{name:'Empty workout',exact:true}).click();
 await page.getByRole('button',{name:'Add rest day',exact:true}).click();
 await page.keyboard.press('ArrowUp');
 await page.getByRole('button',{name:'Add rest day',exact:true}).click();
 await expect(page.getByTestId('save-status')).toHaveText('Saved');
 const original=await getRecord(page);
 await page.reload();await expect(page.locator('[data-sequence-key]')).toHaveCount(3);expect(await entryTypes(page)).toEqual(['rest','workout','rest']);
 await expect(page.getByRole('radio',{name:'Sequence',exact:true})).toBeChecked();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export program',exact:true}).click();
 const stream=await (await downloadPromise).createReadStream();let text='';for await(const chunk of stream)text+=chunk;
 const portable=JSON.parse(text);
 expect(portable.version).toBe(3);expect(portable.program.sequence).toEqual([{type:'rest',key:'rest-0'},{type:'workout',workoutKey:'workout-0'},{type:'rest',key:'rest-2'}]);
 expect(portable.program.workouts[0].day).toBeNull();expect(portable.program.workouts[0].id).toBeUndefined();
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Programs',exact:true}).click();
 await page.getByRole('button',{name:'Duplicate Rest cycle',exact:true}).click();
 await expect(page.getByRole('link',{name:'Rest cycle',exact:true})).toHaveCount(2);
 await page.locator('.library-item h2 a:not([href="#/programs/'+original.id+'"])').filter({hasText:'Rest cycle'}).click();
 await expect(page.getByLabel('Program name',{exact:true})).toHaveValue('Rest cycle');
 const duplicate=await getRecord(page);
 expect(duplicate.id).not.toBe(original.id);
 expect(duplicate.document.workouts[0].id).not.toBe(original.document.workouts[0].id);
 expect(duplicate.document.sequence[0].id).not.toBe(original.document.sequence[0].id);
 expect(await entryTypes(page)).toEqual(['rest','workout','rest']);
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Programs',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 await page.locator('[data-file]').setInputFiles({name:'cycle.json',mimeType:'application/json',buffer:Buffer.from(text)});
 await expect(page.getByLabel('Program name',{exact:true})).toHaveValue('Rest cycle');
 expect(await entryTypes(page)).toEqual(['rest','workout','rest']);
 const imported=await getRecord(page);
 expect(imported.document.workouts[0].id).not.toBe(original.document.workouts[0].id);
 await page.getByRole('radio',{name:'Week',exact:true}).check();
 await expect(page.locator('[data-rest]')).toHaveCount(0);
 await expect(page.locator('[data-sort-group="unscheduled"] h3')).toHaveText('Untitled workout');
 await page.getByRole('radio',{name:'Sequence',exact:true}).check();
 expect(await entryTypes(page)).toEqual(['rest','workout','rest']);
});

test('failed rest saves retain edits and Retry persists them',async({page})=>{
 await newSequence(page);await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.route('**/api/documents/*',async route=>{
  if(route.request().method()==='PUT')await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Unavailable'})});
  else await route.continue();
 });
 await page.getByRole('button',{name:'Add rest day',exact:true}).click();
 await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();
 await expect(page.locator('[data-rest]')).toHaveCount(1);
 await page.unroute('**/api/documents/*');
 await page.getByRole('button',{name:'Retry',exact:true}).click();
 await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.reload();await expect(page.locator('[data-rest]')).toHaveCount(1);
});

test('conflicted mixed sequences Save as copy without overwriting the saved program',async({page})=>{
 await newSequence(page);await page.getByRole('button',{name:'Empty workout',exact:true}).click();
 await page.getByRole('button',{name:'Add rest day',exact:true}).click();
 await expect(page.getByTestId('save-status')).toHaveText('Saved');
 const original=await getRecord(page),url=page.url(),other=await page.context().newPage();
 await other.goto(url);await other.getByLabel('Program name',{exact:true}).fill('Remote cycle');
 await expect(other.getByTestId('save-status')).toHaveText('Saved');
 await page.getByRole('button',{name:'Add rest day',exact:true}).click();
 await expect(page.getByRole('button',{name:'Save as copy',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Save as copy',exact:true}).click();
 await expect(page).not.toHaveURL(url);
 expect(await entryTypes(page)).toEqual(['workout','rest','rest']);
 const copy=await getRecord(page);expect(copy.id).not.toBe(original.id);
 expect(copy.document.sequence[0].workoutId).toBe(copy.document.workouts[0].id);
 await page.reload();await expect(page.locator('[data-sequence-key]')).toHaveCount(3);expect(await entryTypes(page)).toEqual(['workout','rest','rest']);
 const remote=(await (await page.request.get('/api/documents/'+original.id)).json()).record;
 expect(remote.document.name).toBe('Remote cycle');expect(remote.document.sequence).toHaveLength(2);
 await other.close();
});
