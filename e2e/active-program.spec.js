import {test,expect} from '@playwright/test';
import {login,headers,createLinkedTemplate,resetWorkouts} from './workout-helper.js';

/** Deletes every program and clears the active program, then creates the given ones in order (last = most recently edited). */
async function programs(page,names){
 await page.request.put('/api/settings/active-program',{headers,data:{programId:null}});
 for(const record of (await (await page.request.get('/api/documents?kind=program')).json()).records)await page.request.delete(`/api/documents/${record.id}`,{headers,data:{revision:record.revision}});
 const ids={};
 for(const name of names){const id=crypto.randomUUID();ids[name]=id;await page.request.post('/api/documents',{headers,data:{id,kind:'program',document:{name,mode:'schedule',goals:{},workouts:[]}}});}
 return ids;
}
// Leave no active program behind for later specs.
test.afterEach(async({page})=>{await page.request.put('/api/settings/active-program',{headers,data:{programId:null}}).catch(()=>{});});
const cards=page=>page.locator('.library-item h2');
const star=(page,name)=>page.getByRole('button',{name:`Active program ${name}`,exact:true});

test('the star marks one active program, sorts it first and persists',async({page})=>{
 await login(page);await programs(page,['Alpha','Beta']);await page.reload();
 await expect(cards(page)).toHaveText(['Beta','Alpha']);
 await expect(star(page,'Alpha')).toHaveAttribute('aria-pressed','false');
 await star(page,'Alpha').click();
 await expect(star(page,'Alpha')).toHaveAttribute('aria-pressed','true');
 await expect(cards(page)).toHaveText(['Alpha Active','Beta']);
 await page.reload();
 await expect(cards(page)).toHaveText(['Alpha Active','Beta']);
 await star(page,'Beta').click();
 await expect(cards(page)).toHaveText(['Beta Active','Alpha']);
 await expect(star(page,'Alpha')).toHaveAttribute('aria-pressed','false');
 await star(page,'Beta').click();
 await expect(cards(page)).toHaveText(['Beta','Alpha']);
 expect((await (await page.request.get('/api/settings')).json()).settings.activeProgramId).toBeNull();
});

test('a failed save reverts the star and reports the error',async({page})=>{
 await login(page);await programs(page,['Alpha','Beta']);await page.reload();
 await page.route('**/api/settings/active-program',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:{code:'SERVER',message:'Could not save the active program.'}})}));
 await star(page,'Alpha').click();
 await expect(page.locator('#app-message')).toContainText('Could not save the active program.');
 await expect(star(page,'Alpha')).toHaveAttribute('aria-pressed','false');
 await expect(cards(page)).toHaveText(['Beta','Alpha']);
});

test('rapid taps on two stars end with the last choice',async({page})=>{
 await login(page);const ids=await programs(page,['Alpha','Beta']);await page.reload();
 let first=true;
 await page.route('**/api/settings/active-program',async route=>{if(first){first=false;await new Promise(r=>setTimeout(r,1500));}await route.continue();});
 // Taps 600ms apart (past the re-sort guard) while the first request is still pending.
 await star(page,'Alpha').click();await page.waitForTimeout(600);await star(page,'Beta').click();
 await expect(star(page,'Beta')).toHaveAttribute('aria-pressed','true');
 await expect(cards(page)).toHaveText(['Beta Active','Alpha']);
 await expect.poll(async()=>(await (await page.request.get('/api/settings')).json()).settings.activeProgramId).toBe(ids.Beta);
});

test('the start sheet follows the active program and treats a failed settings load as none',async({page})=>{
 await login(page);await resetWorkouts(page);const ids=await programs(page,['Alpha','Beta']);
 const {id:templateId}=await createLinkedTemplate(page,'Alpha session');
 const alpha=(await (await page.request.get('/api/documents/'+ids.Alpha)).json()).record;
 await page.request.put('/api/documents/'+ids.Alpha,{headers,data:{revision:alpha.revision,document:{...alpha.document,workouts:[{id:'occ0',templateId,day:(new Date().getDay()+6)%7}]}}});
 await page.reload();await star(page,'Alpha').click();await expect(star(page,'Alpha')).toHaveAttribute('aria-pressed','true');
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Workouts'}).click();
 await page.getByRole('button',{name:'Start workout',exact:true}).click();
 await expect(page.getByRole('button',{name:'Up next: Alpha session, Alpha',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');
 await page.route('**/api/settings',route=>route.abort());
 await page.reload();await page.getByRole('button',{name:'Start workout',exact:true}).click();
 const sheet=page.locator('dialog.start-sheet[open]');
 await expect(sheet.getByRole('button',{name:/^Up next/})).toHaveCount(0);
 await expect(sheet.locator('.start-sheet-program-toggle')).toHaveCount(2);
});

test('keyboard toggling keeps focus on the moved star',async({page})=>{
 await login(page);await programs(page,['Alpha','Beta']);await page.reload();
 await star(page,'Alpha').focus();await page.keyboard.press('Space');
 await expect(star(page,'Alpha')).toHaveAttribute('aria-pressed','true');
 await expect(star(page,'Alpha')).toBeFocused();
 await page.keyboard.press('Space');
 await expect(star(page,'Alpha')).toHaveAttribute('aria-pressed','false');
 await expect(star(page,'Alpha')).toBeFocused();
});

test('a fast second tap where the starred card used to be does not toggle the card that moved in',async({page})=>{
 await login(page);const ids=await programs(page,['Alpha','Beta']);await page.reload();
 const box=await star(page,'Alpha').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
 await page.mouse.click(x,y);await page.mouse.click(x,y);
 await expect(star(page,'Alpha')).toHaveAttribute('aria-pressed','true');
 await expect(star(page,'Beta')).toHaveAttribute('aria-pressed','false');
 await expect.poll(async()=>(await (await page.request.get('/api/settings')).json()).settings.activeProgramId).toBe(ids.Alpha);
});
