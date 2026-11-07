import {test,expect} from '@playwright/test';
import {login,createLinkedTemplate} from './workout-helper.js';
test('bundled covers decode with image MIME and private paths remain unavailable',async({page})=>{
 for(const id of ['gym','dumbbells','barbell','machines']){
  const response=await page.request.get('/src/assets/workout-covers/'+id+'.webp');
  expect(response.ok()).toBeTruthy();expect(response.headers()['content-type']).toContain('image/webp');
 }
 expect((await page.request.get('/src/assets/workout-covers/other.webp')).status()).toBe(404);
 expect((await page.request.get('/src/assets/workout-covers/%2e%2e/%2e%2e/server/repository.js')).status()).toBe(404);
});
test('template cover choice autosaves and keeps radio focus after acknowledgment',async({page})=>{
 await login(page);const {id}=await createLinkedTemplate(page,'Cover test');
 await page.goto('/#/templates/'+id);
 const disclosure=page.getByRole('button',{name:'Workout cover',exact:true});
 await expect(disclosure).toHaveAttribute('aria-expanded','false');await disclosure.click();
 const radio=page.getByRole('radio',{name:'Barbell',exact:true});await radio.check();
 await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await expect(radio).toBeFocused();
 const {record}=await (await page.request.get('/api/documents/'+id)).json();expect(record.document.coverId).toBe('barbell');
 await page.reload();await disclosure.click();await expect(radio).toBeChecked();
 await expect(page.getByRole('radio')).toHaveCount(4);
 await expect(page.locator('.workout-cover-choice img').first()).toHaveJSProperty('naturalWidth',667);
});
