import {test,expect} from '@playwright/test';
test('breadcrumbs retain shared-session program context and reveal catalog deep links',async({page})=>{
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 const fixture=await page.evaluate(async()=>{
  const {createApiClient}=await import('/src/api-client.js'),api=createApiClient();
  const reference=await api.createReference({id:crypto.randomUUID(),name:'Barbell <Bench> Press',exerciseType:'compound',equipment:'Barbell'});
  const variant=await api.createCatalog({id:crypto.randomUUID(),familyId:reference.id,entry:{name:'Paused breadcrumb press',primaryMuscles:['Chest'],secondaryMuscles:[]}});
  const template=await api.create({id:crypto.randomUUID(),kind:'template',document:{name:'Push A',exercises:[],goals:{}}});
  const program=await api.create({id:crypto.randomUUID(),kind:'program',document:{name:'Strength',mode:'schedule',goals:{},workouts:[{id:'w',templateId:template.id,day:0}]}});
  return {reference,variant,template,program};
 });
 await page.goto('/#/templates/'+fixture.template.id);const trail=page.getByRole('navigation',{name:'Breadcrumb'});await expect(trail.locator('li')).toHaveText(['Session templates','Push A']);
 await page.getByLabel('Session template name').fill('Push renamed');await expect(trail.locator('[aria-current=page]')).toHaveText('Push renamed');await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.goto(`/#/programs/${fixture.program.id}/workouts/w`);await expect(trail.locator('li')).toHaveText(['Programs','Strength','Push renamed']);await expect(page.getByRole('button',{name:'Back to program',exact:true})).toHaveCount(0);
 await trail.getByRole('link',{name:'Strength',exact:true}).click();await expect(page.locator('.workout-title').filter({hasText:'Push renamed'})).toBeVisible();await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Programs',exact:true}).first().click();await expect(trail).toHaveCount(0);
 await page.goto(`/#/catalog/references/${fixture.reference.id}/variants/${fixture.variant.id}`);await expect(trail.locator('li')).toHaveText(['Exercise catalog','Barbell <Bench> Press','Paused breadcrumb press']);await expect(page.getByRole('button',{name:'Edit variant Paused breadcrumb press',exact:true})).toBeFocused();
 await trail.getByRole('link',{name:'Barbell <Bench> Press',exact:true}).click();await expect(trail.locator('[aria-current=page]')).toHaveText('Barbell <Bench> Press');await page.reload();await expect(page.getByRole('button',{name:'Collapse reference exercise Barbell <Bench> Press',exact:true})).toBeVisible();
});
test('moved archived variant links resolve their current parent and missing links remain recoverable',async({page})=>{
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 const fixture=await page.evaluate(async()=>{
  const {createApiClient}=await import('/src/api-client.js'),api=createApiClient();
  const source=await api.createReference({id:crypto.randomUUID(),name:'Old breadcrumb reference',exerciseType:'compound',equipment:'Barbell'}),target=await api.createReference({id:crypto.randomUUID(),name:'Current breadcrumb reference',exerciseType:'compound',equipment:'Machine'});
  let variant=await api.createCatalog({id:crypto.randomUUID(),familyId:source.id,entry:{name:'Archived breadcrumb variant',primaryMuscles:['Chest'],secondaryMuscles:[]}});
  variant=await api.archiveCatalog({id:variant.id,revision:variant.revision,archived:true});
  await api.moveCatalog({id:variant.id,revision:variant.revision,destinationReferenceId:target.id,sourceReferenceRevision:(await api.getReference(source.id)).revision,destinationReferenceRevision:target.revision,impact:await api.catalogImpact(variant.id)});
  return {source,target,variant};
 });
 await page.goto(`/#/catalog/references/${fixture.source.id}/variants/${fixture.variant.id}`);
 await expect(page).toHaveURL(new RegExp('/catalog/references/'+fixture.target.id+'/variants/'+fixture.variant.id+'$'));
 const trail=page.getByRole('navigation',{name:'Breadcrumb'});await expect(trail.locator('li')).toHaveText(['Exercise catalog','Current breadcrumb reference','Archived breadcrumb variant']);await expect(page.getByLabel('Show archived',{exact:true})).toBeChecked();
 await expect(page.getByRole('button',{name:'Edit variant Archived breadcrumb variant',exact:true})).toBeVisible();
 await page.goto('/#/catalog/references/missing/variants/not-here');await expect(page.locator('#app').getByRole('alert')).toContainText('unavailable');await trail.getByRole('link',{name:'Exercise catalog',exact:true}).click();await expect(trail).toHaveCount(0);await expect(page.getByRole('heading',{name:'Exercise catalog',exact:true})).toBeVisible();
});
