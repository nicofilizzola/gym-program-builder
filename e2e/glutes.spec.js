import {test,expect} from '@playwright/test';

test('Glutes persists explicit mappings and drives session and repeated weekly volume',async({page})=>{
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 const fixture=await page.evaluate(async()=>{
  const {createApiClient}=await import('/src/api-client.js'),api=createApiClient();
  const reference=await api.createReference({id:crypto.randomUUID(),name:'Glutes reference',equipment:'Machine',exerciseType:'compound',defaultPrimaryMuscles:['Glutes']});
  const entry=await api.createCatalog({id:crypto.randomUUID(),familyId:reference.id,entry:{name:'Glutes variant',primaryMuscles:['Glutes'],secondaryMuscles:['Hamstrings']}});
  const template=await api.create({id:crypto.randomUUID(),kind:'template',document:{name:'Glutes session',goals:{Glutes:6},exercises:[{name:'Hip exercise',sets:3,repRange:{min:8,max:12},restSeconds:90,primaryMuscles:['Glutes'],secondaryMuscles:[]},{name:'Hinge',sets:4,repRange:{min:8,max:12},restSeconds:90,primaryMuscles:['Hamstrings'],secondaryMuscles:['Glutes']}]}});
  const program=await api.create({id:crypto.randomUUID(),kind:'program',document:{name:'Glutes week',mode:'schedule',goals:{Glutes:10},workouts:[{id:'first',templateId:template.id,day:0},{id:'repeat',templateId:template.id,day:null}]}});
  return {template,program,reference,entry};
 });
 await page.goto('/#/templates/'+fixture.template.id);await expect(page.locator('.volume-row[data-muscle="Glutes"] .value')).toHaveText('5 / 6');
 const region=page.locator('.region[data-muscle="Glutes"]');await expect(region).toHaveAttribute('data-heat','2');await region.locator('path').first().click();await expect(page.locator('.exercise[data-hit="primary"]')).toHaveCount(1);await expect(page.locator('.exercise[data-hit="secondary"]')).toHaveCount(1);
 await page.getByRole('button',{name:'Expand all',exact:true}).click();await expect(page.locator('.primary').first().getByRole('checkbox',{name:'Glutes',exact:true})).toBeChecked();
 await page.getByRole('button',{name:'Set goals',exact:true}).click();await expect(page.getByRole('slider',{name:'Glutes goal',exact:true})).toHaveValue('6');await page.keyboard.press('Escape');
 await page.goto('/#/programs/'+fixture.program.id);await expect(page.locator('.volume-row[data-muscle="Glutes"] .value')).toHaveText('10 / 10');await expect(region).toHaveAttribute('data-heat','2');await region.locator('path').first().click();await expect(page.locator('.workout-item.is-muscle-match')).toHaveCount(2);
 const title=page.getByRole('link',{name:'Glutes session',exact:true}).first();await expect(title).toHaveAttribute('href',`#/programs/${fixture.program.id}/workouts/first`);await expect(page.getByRole('button',{name:/^Edit Glutes session$/})).toHaveCount(0);await title.click();await expect(page).toHaveURL(/workouts\/first$/);
 await page.goto('/#/catalog');await page.getByLabel('Primary muscle',{exact:true}).selectOption('Glutes');const row=page.locator('.catalog-row').filter({hasText:'Glutes variant'});await expect(row).toBeVisible();await expect(row.locator('h3 a')).toHaveCount(0);const hash=await page.evaluate(()=>location.hash);await row.locator('h3').click();expect(await page.evaluate(()=>location.hash)).toBe(hash);
});
