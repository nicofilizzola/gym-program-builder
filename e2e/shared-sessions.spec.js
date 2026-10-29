import {test,expect} from '@playwright/test';
test('editing a program occurrence updates its shared template and every repeated occurrence',async({page})=>{
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('button',{name:'New session template',exact:true}).click();
 await page.getByLabel('Session template name').fill('Shared push');await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Programs',exact:true}).click();await page.getByRole('button',{name:'New program',exact:true}).click();
 await page.getByRole('combobox',{name:'Session template',exact:true}).selectOption({label:'Shared push'});await page.getByRole('button',{name:'Add template',exact:true}).click();
 await page.getByRole('button',{name:'Duplicate Shared push',exact:true}).click();await expect(page.locator('.workout-item')).toHaveCount(2);
 await page.getByRole('button',{name:'Edit Shared push',exact:true}).first().click();await expect(page).toHaveURL(/programs\/[^/]+\/workouts\//);
 await expect(page.getByRole('link',{name:'Shared template',exact:true})).toBeVisible();
 await page.getByLabel('Session template name').fill('Updated push');await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.getByRole('navigation',{name:'Breadcrumb'}).getByRole('link').last().click();await expect(page.locator('.workout-item h3')).toHaveText(['Updated push','Updated push']);
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('link',{name:'Updated push',exact:true}).click();await expect(page.getByLabel('Session template name')).toHaveValue('Updated push');
});
test('shared session conflict copy keeps program links on the original template',async({page})=>{
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 const fixture=await page.evaluate(async()=>{
  const {createApiClient}=await import('/src/api-client.js'),api=createApiClient();
  const template=await api.create({id:crypto.randomUUID(),kind:'template',document:{name:'Conflict shared '+crypto.randomUUID(),exercises:[],goals:{}}});
  const programs=[];for(let i=0;i<2;i++)programs.push(await api.create({id:crypto.randomUUID(),kind:'program',document:{name:'Shared program '+i,mode:'schedule',goals:{},workouts:[{id:'occurrence',templateId:template.id,day:i}]}}));
  return {template,programs};
 });
 await page.goto(`/#/programs/${fixture.programs[0].id}/workouts/occurrence`);
 await expect(page.getByLabel('Session template name')).toHaveValue(fixture.template.document.name);
 const other=await page.context().newPage();await other.goto('/#/templates/'+fixture.template.id);
 await other.getByLabel('Session template name').fill('Remote shared');await expect(other.getByTestId('save-status')).toHaveText('Saved');
 await page.getByLabel('Session template name').fill('Local copy');await expect(page.getByTestId('save-status')).toHaveText('Conflict');
 await expect(page.locator('#app-message')).toContainText('existing programs keep their original template');
 await page.getByRole('button',{name:'Save as copy',exact:true}).click();await expect(page).toHaveURL(/#\/templates\//);await expect(page.getByLabel('Session template name')).toHaveValue('Local copy');
 for(const program of fixture.programs){const saved=(await (await page.request.get('/api/documents/'+program.id)).json()).record;expect(saved.document.workouts[0].templateId).toBe(fixture.template.id);}
 const original=(await (await page.request.get('/api/documents/'+fixture.template.id)).json()).record;expect(original.document.name).toBe('Remote shared');
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Delete Remote shared',exact:true}).click();await expect(page.locator('#app-message')).toContainText('Remove this session template');
 expect((await page.locator('#app-message a').allTextContents()).map(name=>name.trim()).sort()).toEqual(['Shared program 0','Shared program 1']);await other.close();
});
