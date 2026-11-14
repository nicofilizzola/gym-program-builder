import {test,expect} from '@playwright/test';
import {login,resetWorkouts,createLinkedTemplate,saveFinishedLog} from './workout-helper.js';

test('desktop keeps its four links and Workouts current on a workout',async({page})=>{
 await page.setViewportSize({width:1366,height:768});await login(page);await resetWorkouts(page);
 const {id}=await saveFinishedLog(page,{name:'Desktop navigation',startedAt:Date.now()});await page.goto('/#/workouts/'+id);
 const nav=page.getByRole('navigation',{name:'Main'});expect(await nav.locator('a:visible').evaluateAll(links=>links.map(link=>link.innerText.trim()))).toEqual(['Programs','Session templates','Exercise catalog','Workouts']);
 await expect(nav.getByRole('link',{name:'Workouts',exact:true})).toHaveAttribute('aria-current','page');
});

test('a failed older page keeps the desktop rows and refresh message',async({page})=>{
 await login(page);await resetWorkouts(page);
 for(let i=0;i<45;i++)await saveFinishedLog(page,{name:'Session '+i,startedAt:Date.now()-i*86400000});
 await page.route('**/api/workouts?**',route=>route.request().url().includes('before=')?route.abort():route.continue());
 await page.getByRole('link',{name:'Workouts',exact:true}).click();
 await expect(page.locator('.workout-history-row')).toHaveCount(30);
 await page.getByRole('button',{name:'Load more',exact:true}).click();
 await expect(page.locator('.workout-history [data-error]')).toHaveText("Couldn't refresh. Showing previously loaded data.");
 await expect(page.locator('.root-page-feedback')).toContainText("Couldn't refresh. Showing previously loaded data.");
 await expect(page.locator('.root-page-feedback').getByRole('button',{name:'Retry',exact:true})).toBeVisible();
 await expect(page.locator('.workout-history-row')).toHaveCount(30);
});

test('Workouts nav shows History with empty state and Start workout',async({page})=>{
 await login(page);await resetWorkouts(page);
 await page.getByRole('link',{name:'Workouts',exact:true}).click();
 await expect(page).toHaveURL(/#\/workouts$/);
 await expect(page.getByRole('link',{name:'Workouts',exact:true})).toHaveAttribute('aria-current','page');
 await expect(page.getByRole('heading',{level:1,name:'Workouts'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Start workout',exact:true})).toBeVisible();
 await expect(page.getByText('No workouts yet. Start one from a program, a session template or a blank workout.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Load more'})).toHaveCount(0);
});

test('History lists 30 rows, Load more appends the rest and rows show their details',async({page})=>{
 await login(page);await resetWorkouts(page);
 const template=await createLinkedTemplate(page,'Push day');
 expect(template.id).toBeTruthy();
 const base=Date.now()-40*86400000;
 for(let i=0;i<31;i++){
  await saveFinishedLog(page,{name:i===30?'Newest session':'Session '+i,startedAt:base+i*86400000,minutes:i===30?75:45,doneSets:i===30?1:3,
   source:i===30?{kind:'program',programId:'p',occurrenceId:'o',templateId:template.id,programName:'My program',templateName:'Push day'}:{kind:'blank'}});
 }
 await page.getByRole('link',{name:'Workouts',exact:true}).click();
 const rows=page.locator('.workout-history-row');
 await expect(rows).toHaveCount(30);
 const first=rows.first();
 await expect(first).toContainText('Newest session');
 await expect(first).toContainText('My program · Push day');
 await expect(first).toContainText('1 h 15 min');
 await expect(first).toContainText('1 set');
 await expect(first).not.toContainText('1 sets');
 await expect(rows.nth(1)).toContainText('Blank');
 await expect(rows.nth(1)).toContainText('3 sets');
 await expect(first.locator('a')).toHaveAttribute('href',/#\/workouts\/[\w-]+$/);
 await page.getByRole('button',{name:'Load more'}).click();
 await expect(rows).toHaveCount(31);
 await expect(page.getByRole('button',{name:'Load more'})).toHaveCount(0);
 await resetWorkouts(page);
});
