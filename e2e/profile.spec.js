import {test,expect} from '@playwright/test';
const headers={origin:'http://127.0.0.1:3199'};
async function login(page){await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();}
const field=page=>page.getByLabel('Training background and approach',{exact:true});

test('header Profile button opens the profile page with its labeled field and note',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await login(page);
 const button=page.getByRole('button',{name:'Profile',exact:true});
 expect(await button.evaluate(el=>el.nextElementSibling.id)).toBe('logout');
 await button.hover();await expect(page.locator('.action-tooltip:popover-open')).toHaveText('Profile');
 await button.click();await expect(page).toHaveURL(/#\/profile$/);
 await expect(button).toHaveAttribute('aria-current','page');
 await expect(page.getByRole('heading',{level:1,name:'Profile',exact:true})).toBeVisible();
 await expect(field(page)).toHaveAttribute('maxlength','2000');
 await expect(page.getByText('Used by AI program reviews. Not included in program exports.',{exact:true})).toBeVisible();
 await expect(page.getByText('Example: Two years of consistent training. Usually leave 1–2 reps in reserve and increase weight at the top of the rep range.',{exact:true})).toBeVisible();
 const box=await button.boundingBox();expect(Math.round(box.width)).toBe(32);expect(Math.round(box.height)).toBe(32);
 await page.getByRole('link',{name:'Programs',exact:true}).click();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 expect(await button.getAttribute('aria-current')).not.toBe('page');
});

test('profile text autosaves and persists after reload',async({page})=>{
 await login(page);await page.getByRole('button',{name:'Profile',exact:true}).click();
 const text='Three years training '+crypto.randomUUID();
 await field(page).fill(text);await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.reload();await expect(field(page)).toHaveValue(text);
 expect((await (await page.request.get('/api/profile')).json()).profile.trainingBackgroundAndApproach).toBe(text);
});

test('profile conflict offers Reload saved version only',async({page})=>{
 await login(page);await page.getByRole('button',{name:'Profile',exact:true}).click();await expect(field(page)).toBeVisible();
 const current=await (await page.request.get('/api/profile')).json(),remote='Remote '+crypto.randomUUID();
 const put=await page.request.put('/api/profile',{headers,data:{revision:current.revision,profile:{trainingBackgroundAndApproach:remote}}});expect(put.ok()).toBeTruthy();
 await field(page).fill('Local edit');await expect(page.getByTestId('save-status')).toHaveText('Conflict');
 await expect(page.locator('#reload-saved')).toBeVisible();await expect(page.locator('#copy-saved')).toBeHidden();
 await page.locator('#reload-saved').click();await page.getByRole('button',{name:'Reload saved version',exact:true}).last().click();
 await expect(field(page)).toHaveValue(remote);await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await expect(page.locator('#reload-saved')).toBeHidden();
 await field(page).fill(remote+' then local');await expect(page.getByTestId('save-status')).toHaveText('Saved');
});

test('profile touch layout keeps 44px targets without horizontal overflow',async({browser})=>{
 const context=await browser.newContext({baseURL:'http://127.0.0.1:3199',viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),page=await context.newPage();
 await login(page);const button=page.getByRole('button',{name:'Profile',exact:true});await button.click();await expect(field(page)).toBeVisible();
 const box=await button.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await context.close();
});

async function resetProfile(page){
 const {revision}=await (await page.request.get('/api/profile')).json();
 expect((await page.request.put('/api/profile',{headers,data:{revision,profile:{}}})).ok()).toBeTruthy();
}
async function openProfile(page){
 await login(page);await resetProfile(page);await page.getByRole('button',{name:'Profile',exact:true}).click();await expect(field(page)).toBeVisible();
}
const savedProfile=async page=>(await (await page.request.get('/api/profile')).json()).profile;
const slider=(page,name)=>page.getByRole('slider',{name,exact:true});
const saved=page=>expect(page.getByTestId('save-status')).toHaveText('Saved');
const sessionsGroup=page=>page.getByRole('group',{name:'Max sessions per day',exact:true});

test('profile page shows sectioned structured controls with exact labels',async({page})=>{
 await page.setViewportSize({width:1366,height:768});await openProfile(page);
 expect(await page.locator('.profile-page h2').allTextContents()).toEqual(['Schedule','Session length','Experience','Equipment','Notes']);
 await expect(slider(page,'Max training days per week')).toHaveAttribute('aria-valuetext','No limit');
 const days=page.getByRole('group',{name:'Available days',exact:true}).getByRole('button');
 await expect(days).toHaveText(['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);
 for(const [i,name] of ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].entries()){await expect(days.nth(i)).toHaveAccessibleName(name);await expect(days.nth(i)).toHaveAttribute('aria-pressed','false');}
 await expect(sessionsGroup(page).getByRole('radio')).toHaveCount(3);
 for(const name of ['No limit','1','2'])await expect(sessionsGroup(page).getByRole('radio',{name,exact:true})).toHaveCount(1);
 await expect(sessionsGroup(page).getByRole('radio',{name:'No limit',exact:true})).toBeChecked();
 await expect(slider(page,'Max session length')).toHaveAttribute('aria-valuetext','No limit');
 const level=page.getByRole('group',{name:'Level',exact:true});
 for(const name of ['Not set','Beginner (<1 yr)','Intermediate (1–3 yrs)','Advanced (3+ yrs)'])await expect(level.getByRole('radio',{name,exact:true})).toHaveCount(1);
 await expect(level.getByRole('radio',{name:'Not set',exact:true})).toBeChecked();
 await expect(slider(page,'Typical reps in reserve')).toHaveAttribute('aria-valuetext','Not set');
 const equipment=page.getByRole('group',{name:'Equipment',exact:true}).getByRole('button');
 await expect(equipment).toHaveText(['Barbell','Dumbbell','Cable','Machine','Bodyweight','Kettlebell','Resistance band','Other']);
 await expect(page.getByLabel('Constraints and preferences',{exact:true})).toHaveAttribute('maxlength','2000');
 await expect(page.getByText('Example: Bad left shoulder, avoid overhead pressing. Prefer machines for isolation work.',{exact:true})).toBeVisible();
});

test('every profile control autosaves and reload restores every value',async({page})=>{
 await openProfile(page);
 const days=slider(page,'Max training days per week');
 await days.focus();await page.keyboard.press('End');await page.keyboard.press('Home');await expect(days).toHaveAttribute('aria-valuetext','No limit');
 await saved(page);expect((await savedProfile(page)).maxTrainingDaysPerWeek).toBeNull();
 await page.keyboard.press('ArrowRight');await expect(days).toHaveAttribute('aria-valuetext','1');
 await page.getByRole('button',{name:'Monday',exact:true}).click();await page.getByRole('button',{name:'Thursday',exact:true}).click();
 await expect(page.getByRole('button',{name:'Thursday',exact:true})).toHaveAttribute('aria-pressed','true');
 await sessionsGroup(page).getByRole('radio',{name:'2',exact:true}).check();
 const length=slider(page,'Max session length');
 await length.focus();await page.keyboard.press('Home');await expect(length).toHaveAttribute('aria-valuetext','No limit');await page.keyboard.press('ArrowRight');await expect(length).toHaveAttribute('aria-valuetext','20 min');
 await page.getByRole('radio',{name:'Intermediate (1–3 yrs)',exact:true}).check();
 const rir=slider(page,'Typical reps in reserve');
 await rir.focus();await page.keyboard.press('Home');await expect(rir).toHaveAttribute('aria-valuetext','Not set');await page.keyboard.press('ArrowRight');await expect(rir).toHaveAttribute('aria-valuetext','0');
 await page.getByRole('button',{name:'Machine',exact:true}).click();await page.getByRole('button',{name:'Barbell',exact:true}).click();
 await page.getByLabel('Constraints and preferences',{exact:true}).fill('Bad left shoulder');
 await saved(page);
 expect(await savedProfile(page)).toEqual({trainingBackgroundAndApproach:'',constraintsAndPreferences:'Bad left shoulder',maxTrainingDaysPerWeek:1,availableWeekdays:[0,3],maxSessionsPerDay:2,maxSessionMinutes:20,experienceLevel:'intermediate',typicalRepsInReserve:0,equipment:['Barbell','Machine']});
 await page.reload();await expect(field(page)).toBeVisible();
 await expect(days).toHaveAttribute('aria-valuetext','1');await expect(length).toHaveAttribute('aria-valuetext','20 min');await expect(rir).toHaveAttribute('aria-valuetext','0');
 for(const [name,pressed] of [['Monday','true'],['Tuesday','false'],['Thursday','true']])await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed',pressed);
 await expect(sessionsGroup(page).getByRole('radio',{name:'2',exact:true})).toBeChecked();
 await expect(page.getByRole('radio',{name:'Intermediate (1–3 yrs)',exact:true})).toBeChecked();
 for(const [name,pressed] of [['Barbell','true'],['Machine','true'],['Cable','false']])await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed',pressed);
 await expect(page.getByLabel('Constraints and preferences',{exact:true})).toHaveValue('Bad left shoulder');
 // Sentinels and released pills clear back to unknown.
 await page.getByRole('button',{name:'Monday',exact:true}).click();await page.getByRole('button',{name:'Thursday',exact:true}).click();
 await sessionsGroup(page).getByRole('radio',{name:'No limit',exact:true}).check();
 await length.focus();await page.keyboard.press('Home');await saved(page);
 expect(await savedProfile(page)).toMatchObject({availableWeekdays:[],maxSessionsPerDay:null,maxSessionMinutes:null});
});

test('changing one profile control never wipes another field, saved or unsaved',async({page})=>{
 await openProfile(page);
 const notes=page.getByLabel('Constraints and preferences',{exact:true});
 await field(page).fill('Saved background');await saved(page);
 // Unsaved text, then other controls before its acknowledgement lands.
 await notes.fill('Unsaved constraint');
 await page.getByRole('button',{name:'Friday',exact:true}).click();
 const days=slider(page,'Max training days per week');await days.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
 await page.getByRole('button',{name:'Dumbbell',exact:true}).click();
 await saved(page);
 await expect(field(page)).toHaveValue('Saved background');await expect(notes).toHaveValue('Unsaved constraint');
 await expect(days).toHaveAttribute('aria-valuetext','2');
 expect(await savedProfile(page)).toMatchObject({trainingBackgroundAndApproach:'Saved background',constraintsAndPreferences:'Unsaved constraint',availableWeekdays:[4],maxTrainingDaysPerWeek:2,equipment:['Dumbbell']});
 // Typing while acknowledgements arrive keeps focus and caret.
 await notes.click();await page.keyboard.press('End');await page.keyboard.type(' and more');
 await saved(page);
 await expect(notes).toBeFocused();expect(await notes.evaluate(el=>[el.selectionStart,el.value.length])).toEqual([27,27]);
 await page.getByRole('radio',{name:'Advanced (3+ yrs)',exact:true}).check();await saved(page);
 expect(await savedProfile(page)).toMatchObject({trainingBackgroundAndApproach:'Saved background',constraintsAndPreferences:'Unsaved constraint and more',experienceLevel:'advanced',availableWeekdays:[4],maxTrainingDaysPerWeek:2,equipment:['Dumbbell']});
});

test('profile conflict reload replaces every structured control',async({page})=>{
 await openProfile(page);
 const current=await (await page.request.get('/api/profile')).json();
 expect((await page.request.put('/api/profile',{headers,data:{revision:current.revision,profile:{maxSessionMinutes:90,availableWeekdays:[6],equipment:['Cable'],experienceLevel:'beginner'}}})).ok()).toBeTruthy();
 await page.getByRole('button',{name:'Monday',exact:true}).click();await expect(page.getByTestId('save-status')).toHaveText('Conflict');
 await page.locator('#reload-saved').click();await page.getByRole('button',{name:'Reload saved version',exact:true}).last().click();
 await saved(page);
 await expect(page.getByRole('button',{name:'Monday',exact:true})).toHaveAttribute('aria-pressed','false');
 await expect(page.getByRole('button',{name:'Sunday',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(slider(page,'Max session length')).toHaveAttribute('aria-valuetext','90 min');
 await expect(page.getByRole('button',{name:'Cable',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('radio',{name:'Beginner (<1 yr)',exact:true})).toBeChecked();
});

test('profile controls use two columns on desktop and keep 44px touch targets',async({browser,page})=>{
 await page.setViewportSize({width:1366,height:768});await openProfile(page);
 const a=await slider(page,'Max training days per week').boundingBox(),b=await page.getByRole('group',{name:'Available days',exact:true}).boundingBox();
 expect(Math.abs(a.y-b.y)).toBeLessThan(40);expect(b.x).toBeGreaterThan(a.x+a.width-1);
 const context=await browser.newContext({baseURL:'http://127.0.0.1:3199',viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),touch=await context.newPage();
 await login(touch);await touch.getByRole('button',{name:'Profile',exact:true}).click();await expect(field(touch)).toBeVisible();
 for(const target of [touch.getByRole('button',{name:'Monday',exact:true}),touch.getByRole('button',{name:'Barbell',exact:true}),touch.locator('label').filter({has:touch.getByRole('radio',{name:'Beginner (<1 yr)',exact:true})}),sessionsGroup(touch).locator('label').filter({has:touch.getByRole('radio',{name:'1',exact:true})}),slider(touch,'Max session length')]){
  const box=await target.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);expect(box.width).toBeGreaterThanOrEqual(44);
 }
 expect(await touch.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await context.close();
});
