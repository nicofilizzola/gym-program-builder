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
