import {test,expect} from '@playwright/test';
test('reference icon pills and defaults initialize a variant with searchable descriptions and tags',async({page})=>{
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 const ids=await page.evaluate(async()=>{const {createApiClient}=await import('/src/api-client.js'),api=createApiClient();return {brand:await api.createTag({id:crypto.randomUUID(),kind:'brand',name:'Visual Prime'}),focus:await api.createTag({id:crypto.randomUUID(),kind:'focus',name:'Visual upper chest'})};});
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Exercise catalog',exact:true}).click();await page.getByRole('button',{name:'New reference exercise',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Reference exercise name',{exact:true}).fill('Visual bench');await dialog.getByLabel('Exercise type',{exact:true}).selectOption('compound');
 await dialog.getByRole('radio',{name:'Machine',exact:true}).check();await expect(dialog.getByRole('radio',{name:'Barbell',exact:true})).not.toBeChecked();
 await dialog.getByRole('radio',{name:'Machine',exact:true}).focus();await page.keyboard.press('ArrowLeft');await expect(dialog.getByRole('radio',{name:'Cable',exact:true})).toBeChecked();await dialog.getByRole('radio',{name:'Machine',exact:true}).check();
 await expect(dialog.locator('.equipment-pills label svg')).toHaveCount(8);
 await dialog.getByRole('group',{name:'Default primary muscles',exact:true}).getByLabel('Chest',{exact:true}).check();
 await expect(dialog.getByRole('button',{name:'Reference description (optional)',exact:true})).toHaveCount(0);await dialog.getByRole('textbox',{name:'Reference description (optional)',exact:true}).fill('Reference <img> notes');
 await dialog.getByRole('button',{name:'Create reference exercise',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'Add variant to Visual bench',exact:true}).click();await expect(dialog.getByLabel('Variant name',{exact:true})).toHaveValue('Visual bench');await dialog.getByLabel('Variant name',{exact:true}).fill('Visual paused press');
 await expect(dialog.getByText('Equipment: Machine',{exact:true})).toBeVisible();await expect(dialog.getByRole('radio',{name:'Machine',exact:true})).toHaveCount(0);
 await expect(dialog.getByRole('group',{name:'Primary muscles',exact:true}).getByLabel('Chest',{exact:true})).toBeChecked();
 await dialog.getByRole('group',{name:'Brand',exact:true}).getByRole('radio',{name:'Visual Prime',exact:true}).check();await dialog.getByRole('group',{name:'Focus',exact:true}).getByLabel('Visual upper chest',{exact:true}).check();
 await expect(dialog.getByRole('button',{name:'Variant description (optional)',exact:true})).toHaveCount(0);await dialog.getByRole('textbox',{name:'Variant description (optional)',exact:true}).fill('Pause two seconds');
 await dialog.getByRole('button',{name:'Save variant',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.locator('.catalog-row').filter({hasText:'Visual paused press'})).toContainText('Brand: Visual Prime');
 await page.getByRole('button',{name:'Create variant from Visual paused press',exact:true}).click();await expect(dialog.getByRole('group',{name:'Brand',exact:true}).getByRole('radio',{name:'Visual Prime',exact:true})).toBeChecked();await expect(dialog.getByRole('group',{name:'Focus',exact:true}).getByLabel('Visual upper chest',{exact:true})).toBeChecked();await expect(dialog.getByRole('textbox',{name:'Variant description (optional)',exact:true})).toHaveValue('Pause two seconds');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('button',{name:'New session template',exact:true}).click();await page.getByRole('button',{name:'Add exercise',exact:true}).click();
 const picker=page.getByRole('combobox',{name:'Exercise',exact:true});await picker.fill('Visual Prime upper chest');await expect(page.getByRole('option').filter({hasText:'Visual paused press'})).toBeVisible();await picker.press('ArrowDown');await picker.press('Enter');
 await page.getByRole('button',{name:'About Visual paused press',exact:true}).click();await expect(page.getByRole('tooltip').filter({hasText:'Pause two seconds'})).toContainText('Reference <img> notes');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:/^Collapse exercise: /}).click();await expect(page.locator('.exercise')).toContainText('Focus: Visual upper chest');
});
test('optional description and catalog modal preserve closing motion focus and reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Exercise catalog',exact:true}).click();
 const create=page.getByRole('button',{name:'New reference exercise',exact:true});await create.click();const dialog=page.getByRole('dialog');await expect(dialog).toHaveCSS('opacity','1');
 await expect(dialog.getByRole('button',{name:'Reference description',exact:true})).toHaveCount(0);
 const text=dialog.getByRole('textbox',{name:'Reference description (optional)',exact:true});await expect(text).toBeVisible();await expect(text).toHaveAttribute('maxlength','2000');await text.focus();await page.keyboard.press('Escape');
 expect(await dialog.count()).toBe(1);await expect(dialog).toHaveClass(/is-closing/);await expect(dialog.locator('form')).toHaveAttribute('inert','');await expect(dialog).toHaveCount(0);await expect(create).toBeFocused();
 await page.emulateMedia({reducedMotion:'reduce'});await create.click();await dialog.getByRole('button',{name:'Cancel',exact:true}).evaluate(b=>b.click());expect(await dialog.count()).toBe(0);await expect(create).toBeFocused();
});

test('variants can share a name when their tags differ',async({page})=>{
 test.setTimeout(45000);
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 const fixture=await page.evaluate(async()=>{
  const {createApiClient}=await import('/src/api-client.js'),api=createApiClient(),suffix=crypto.randomUUID();
  const ref=await api.createReference({id:crypto.randomUUID(),name:'Same names '+suffix,equipment:'Machine',exerciseType:'compound',defaultPrimaryMuscles:['Chest']});
  const brand=await api.createTag({id:crypto.randomUUID(),name:'Hammer '+suffix,kind:'brand'}),focus=await api.createTag({id:crypto.randomUUID(),name:'Stretch '+suffix,kind:'focus'});
  return {ref,brand,focus};
 });
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Exercise catalog',exact:true}).click();
 await page.getByLabel('Search catalog',{exact:true}).fill(fixture.ref.name);
 const dialog=page.getByRole('dialog'),rows=page.locator('.catalog-row');
 const add=async(brand=false)=>{
  await page.getByRole('button',{name:'Add variant to '+fixture.ref.name,exact:true}).click();
  await dialog.getByLabel('Variant name',{exact:true}).fill('Chest press');
  if(brand)await dialog.getByRole('group',{name:'Brand',exact:true}).getByRole('radio',{name:fixture.brand.name,exact:true}).check();
  await dialog.getByRole('button',{name:'Save variant',exact:true}).click();
 };
 await add();await expect(dialog).toHaveCount(0);await add(true);await expect(dialog).toHaveCount(0);
 await expect(rows).toHaveCount(2);await expect(rows.nth(1)).toContainText('Brand: '+fixture.brand.name);
 const refusal='A variant with this name and the same tags already exists in this reference exercise, possibly archived. Change the name or a tag.';
 const checkDraft=async()=>{
  await expect(dialog.getByRole('alert')).toHaveText(refusal);await expect(dialog.getByLabel('Variant name',{exact:true})).toBeFocused();
  await expect(dialog.getByLabel('Variant name',{exact:true})).toHaveValue('Chest press');
  await expect(dialog.getByRole('group',{name:'Brand',exact:true}).getByRole('radio',{name:fixture.brand.name,exact:true})).toBeChecked();
  await expect(dialog.getByRole('group',{name:'Primary muscles',exact:true}).getByLabel('Chest',{exact:true})).toBeChecked();
  await expect(dialog.getByRole('button',{name:'Reload saved version',exact:true})).toHaveCount(0);await expect(dialog.getByRole('button',{name:'Save as variant',exact:true})).toHaveCount(0);
 };
 await add(true);await checkDraft();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await rows.nth(0).getByRole('button',{name:'Edit variant Chest press',exact:true}).click();
 await dialog.getByRole('group',{name:'Brand',exact:true}).getByRole('radio',{name:fixture.brand.name,exact:true}).check();await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
 await checkDraft();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await rows.nth(1).getByRole('button',{name:'Create variant from Chest press',exact:true}).click();
 await dialog.getByRole('group',{name:'Focus',exact:true}).getByLabel(fixture.focus.name,{exact:true}).check();await dialog.getByRole('button',{name:'Save variant',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(rows).toHaveCount(3);
 await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Session templates',exact:true}).click();await page.getByRole('button',{name:'New session template',exact:true}).click();await page.getByRole('button',{name:'Add exercise',exact:true}).click();
 await page.getByRole('combobox',{name:'Exercise',exact:true}).fill('chest press');
 const options=page.locator('.exercise-option-group').filter({hasText:fixture.ref.name}).getByRole('option');await expect(options).toHaveCount(3);
 await expect(options.nth(1)).toHaveAccessibleName(new RegExp('Brand: '+fixture.brand.name));await expect(options.nth(2)).toHaveAccessibleName(new RegExp('Focus: '+fixture.focus.name));
});
