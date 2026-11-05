import {test,expect} from '@playwright/test';
import {login,headers} from './workout-helper.js';

/** Deletes every program and clears the active program, then creates the given ones in order (last = most recently edited). */
async function programs(page,names){
 await page.request.put('/api/settings/active-program',{headers,data:{programId:null}});
 for(const record of (await (await page.request.get('/api/documents?kind=program')).json()).records)await page.request.delete(`/api/documents/${record.id}`,{headers,data:{revision:record.revision}});
 const ids={};
 for(const name of names){const id=crypto.randomUUID();ids[name]=id;await page.request.post('/api/documents',{headers,data:{id,kind:'program',document:{name,mode:'schedule',goals:{},workouts:[]}}});}
 return ids;
}
const cards=page=>page.locator('.library-item h2');
const star=(page,name)=>page.getByRole('button',{name:`Active program ${name}`,exact:true});

test('the star marks one active program, sorts it first and persists',async({page})=>{
 await login(page);await programs(page,['Alpha','Beta']);await page.reload();
 await expect(cards(page)).toHaveText(['Beta','Alpha']);
 await expect(star(page,'Alpha')).toHaveAttribute('aria-pressed','false');
 await star(page,'Alpha').click();
 await expect(star(page,'Alpha')).toHaveAttribute('aria-pressed','true');
 await expect(cards(page)).toHaveText(['AlphaActive','Beta']);
 await page.reload();
 await expect(cards(page)).toHaveText(['AlphaActive','Beta']);
 await star(page,'Beta').click();
 await expect(cards(page)).toHaveText(['BetaActive','Alpha']);
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
 await page.route('**/api/settings/active-program',async route=>{if(first){first=false;await new Promise(r=>setTimeout(r,500));}await route.continue();});
 await star(page,'Alpha').click();await star(page,'Beta').click();
 await page.waitForTimeout(900);
 await expect(star(page,'Beta')).toHaveAttribute('aria-pressed','true');
 await expect(cards(page)).toHaveText(['BetaActive','Alpha']);
 await expect.poll(async()=>(await (await page.request.get('/api/settings')).json()).settings.activeProgramId).toBe(ids.Beta);
});
