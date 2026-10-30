import {test,expect} from '@playwright/test';
test('catalog tag management creates renames archives and restores independent tag types',async({page})=>{
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Exercise catalog',exact:true}).click();
 await page.getByRole('link',{name:'Manage tags',exact:true}).click();await page.getByLabel('New Brand tag',{exact:true}).fill('Test Panatta');await page.getByRole('button',{name:'Create Brand',exact:true}).click();
 await expect(page.locator('.tag-row').filter({hasText:'Test Panatta'})).toBeVisible();await page.getByRole('button',{name:'Rename Brand Test Panatta',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Tag name',{exact:true}).fill('Test Prime');await dialog.getByRole('button',{name:'Save tag',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'Archive Brand Test Prime',exact:true}).click();await page.getByLabel('Show archived',{exact:true}).check();await expect(page.locator('.tag-row').filter({hasText:'Test Prime'})).toContainText('Archived');
 await page.getByRole('button',{name:'Restore Brand Test Prime',exact:true}).click();await expect(page.locator('.tag-row').filter({hasText:'Test Prime'})).not.toContainText('Archived');
 await page.getByRole('link',{name:'Focus',exact:true}).click();await page.getByLabel('New Focus tag',{exact:true}).fill('Test Prime');await page.getByRole('button',{name:'Create Focus',exact:true}).click();await expect(page.locator('.tag-row').filter({hasText:'Test Prime'})).toBeVisible();
 await page.reload();await expect(page.getByRole('link',{name:'Focus',exact:true})).toHaveAttribute('aria-current','page');
});

test('Brand pills retain archived source selection, clear it, and keep radio focus',async({page})=>{
 await page.goto('/');await page.evaluate(async()=>{
  const {mountVariantTags}=await import('/src/catalog-controls.js');document.body.innerHTML='<main></main>';
  window.tags=mountVariantTags(document.querySelector('main'),{brandId:'old',tags:[{id:'old',kind:'brand',name:'Retained',archived:true},...Array.from({length:10},(_,i)=>({id:'b'+i,kind:'brand',name:'Brand '+i})),{id:'freshArchived',kind:'brand',name:'Unavailable',archived:true},{id:'focus',kind:'focus',name:'Strength'}]});
 });
 const group=page.getByRole('group',{name:'Brand',exact:true});await expect(group.getByRole('radio',{name:'Retained (Archived)',exact:true})).toBeChecked();await expect(group.getByRole('radio',{name:'Unavailable (Archived)',exact:true})).toHaveCount(0);
 await group.getByRole('radio',{name:'No Brand',exact:true}).check();await expect(group.getByRole('radio',{name:'Retained (Archived)',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>window.tags.getValue().brandId)).toBe(null);
 await page.getByLabel('Filter Brand tags',{exact:true}).fill('Brand 9');await group.getByRole('radio',{name:'Brand 9',exact:true}).check();
 await group.getByRole('radio',{name:'Brand 9',exact:true}).focus();await expect(group.getByRole('radio',{name:'Brand 9',exact:true})).toBeFocused();
 await page.getByRole('group',{name:'Focus',exact:true}).getByRole('checkbox',{name:'Strength',exact:true}).check();expect(await page.evaluate(()=>window.tags.getValue())).toEqual({brandId:'b9',focusTagIds:['focus']});
});
