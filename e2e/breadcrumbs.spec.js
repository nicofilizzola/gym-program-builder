import {test,expect} from '@playwright/test';
import {login} from './workout-helper.js';
const createFixture=page=>page.evaluate(async()=>{
  const {createApiClient}=await import('/src/api-client.js'),api=createApiClient();
  const reference=await api.createReference({id:crypto.randomUUID(),name:'Barbell <Bench> Press',exerciseType:'compound',equipment:'Barbell'});
  const variant=await api.createCatalog({id:crypto.randomUUID(),familyId:reference.id,entry:{name:'Paused breadcrumb press',primaryMuscles:['Chest'],secondaryMuscles:[]}});
  const template=await api.create({id:crypto.randomUUID(),kind:'template',document:{name:'Push A',exercises:[],goals:{}}});
  const program=await api.create({id:crypto.randomUUID(),kind:'program',document:{name:'Strength',mode:'schedule',goals:{},workouts:[{id:'w',templateId:template.id,day:0}]}});
  return {reference,variant,template,program};
 });
test('breadcrumbs retain shared-session program context and reveal catalog deep links',async({page})=>{
 await login(page);const fixture=await createFixture(page);
 await page.goto('/#/templates/'+fixture.template.id);const trail=page.getByRole('navigation',{name:'Breadcrumb'});await expect(trail.locator('li')).toHaveText(['Session templates','Push A']);
 await page.getByLabel('Session template name').fill('Push renamed');await expect(trail.locator('[aria-current=page]')).toHaveText('Push renamed');await expect(page.getByTestId('save-status')).toHaveText('Saved');
 await page.goto(`/#/programs/${fixture.program.id}/workouts/w`);await expect(trail.locator('li')).toHaveText(['Programs','Strength','Push renamed']);await expect(page.getByRole('button',{name:'Back to program',exact:true})).toHaveCount(0);
 await trail.getByRole('link',{name:'Strength',exact:true}).click();await expect(page.locator('.workout-title').filter({hasText:'Push renamed'})).toBeVisible();await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'Programs',exact:true}).first().click();await expect(trail).toHaveCount(0);
 await page.goto(`/#/catalog/references/${fixture.reference.id}/variants/${fixture.variant.id}`);await expect(trail.locator('li')).toHaveText(['Exercise catalog','Barbell <Bench> Press','Paused breadcrumb press']);await expect(page.getByRole('button',{name:'Edit variant Paused breadcrumb press',exact:true})).toBeFocused();
 await trail.getByRole('link',{name:'Barbell <Bench> Press',exact:true}).click();await expect(trail.locator('[aria-current=page]')).toHaveText('Barbell <Bench> Press');await page.reload();await expect(page.getByRole('button',{name:'Collapse reference exercise Barbell <Bench> Press',exact:true})).toBeVisible();
});

test('compact parent link survives updates and responsive changes',async({page})=>{
 await login(page);const fixture=await createFixture(page);await page.setViewportSize({width:390,height:844});
 await page.goto(`/#/programs/${fixture.program.id}`);
 await expect(page.getByRole('navigation',{name:'Breadcrumb'}).getByRole('link',{name:'Back to Programs',exact:true})).toBeVisible();
 const occurrence=page.locator('[data-workout-title="w"]');await occurrence.scrollIntoViewIfNeeded();const returnY=await page.evaluate(()=>window.scrollY);await occurrence.click();
 const trail=page.getByRole('navigation',{name:'Breadcrumb'}),back=trail.getByRole('link',{name:'Back to Strength',exact:true});
 await expect(trail.getByRole('link')).toHaveCount(1);await expect(back).toHaveAttribute('href','#/programs/'+fixture.program.id);
 const bounds=await back.boundingBox();expect(bounds.height).toBeGreaterThanOrEqual(44);expect(bounds.width).toBeGreaterThanOrEqual(44);
 await page.screenshot({path:test.info().outputPath('compact-parent.png')});
 let release;const held=new Promise(resolve=>release=resolve);let received;const waiting=new Promise(resolve=>received=resolve);
 await page.route('**/api/documents/'+fixture.template.id,async route=>{if(route.request().method()!=='PUT')return route.continue();const response=await route.fetch();received();await held;await route.fulfill({response});});
 await page.getByLabel('Session template name').fill('Push renamed');await waiting;
 await back.evaluate(node=>window.savedBack=node);await back.focus();release();
 await expect(page.getByTestId('save-status')).toHaveText('Saved');await expect(back).toBeFocused();expect(await back.evaluate(node=>node===window.savedBack)).toBe(true);
 await page.setViewportSize({width:761,height:844});await expect(trail.locator('li')).toHaveText(['Programs','Strength','Push renamed']);await expect(trail.getByRole('link')).toHaveCount(2);await expect(trail.getByRole('link',{name:'Strength',exact:true})).toBeFocused();
 await page.screenshot({path:test.info().outputPath('desktop-trail.png')});
 await page.setViewportSize({width:760,height:844});await expect(back).toBeFocused();expect(await back.evaluate(node=>node===window.savedBack)).toBe(true);
 await page.setViewportSize({width:390,height:844});await back.press('Enter');await expect(occurrence).toBeFocused();expect(await page.evaluate(()=>window.scrollY)).toBeCloseTo(returnY,0);
 await page.goto('/#/templates/'+fixture.template.id);await trail.getByRole('link',{name:'Back to Templates',exact:true}).click();await expect(trail).toHaveCount(0);
 await page.goto(`/#/catalog/references/${fixture.reference.id}/variants/${fixture.variant.id}`);await expect(trail.getByRole('link')).toHaveCount(1);
 await trail.getByRole('link',{name:'Back to Barbell <Bench> Press',exact:true}).click();await expect(page).toHaveURL(new RegExp('#/catalog/references/'+fixture.reference.id+'$'));
 await trail.getByRole('link',{name:'Back to Exercises',exact:true}).click();await expect(trail).toHaveCount(0);
 await page.goto('/#/catalog/tags?kind=focus&q=Chest');await trail.getByRole('link',{name:'Back to Exercises',exact:true}).click();await expect(trail).toHaveCount(0);
 await page.goto('/#/profile');await trail.getByRole('link',{name:'Back to User',exact:true}).click();await expect(trail).toHaveCount(0);
});

test('compact renderer patches focused labels and preserves native link activation',async({page})=>{
 await page.goto('/');await page.setViewportSize({width:390,height:844});
 await page.evaluate(async()=>{
  const {mountBreadcrumbs}=await import('/src/breadcrumbs.js');document.body.replaceChildren();const host=document.createElement('main');document.body.append(host);host.innerHTML='<h1 tabindex="-1">Editor</h1>';
  window.crumbItems=[{label:'Programs',href:'#/programs'},{label:'Strength',href:'#/programs/one'},{label:'Push A'}];window.navigations=[];
  window.crumbs=mountBreadcrumbs(host,{items:window.crumbItems,mobileParent:{label:'Strength',href:'#/programs/one'},onNavigate:href=>window.navigations.push(href)});
 });
 const trail=page.getByRole('navigation',{name:'Breadcrumb'}),back=trail.getByRole('link',{name:'Back to Strength',exact:true});await back.focus();await back.evaluate(node=>window.savedBack=node);
 await page.evaluate(()=>window.crumbs.update([...window.crumbItems.slice(0,2),{label:'Renamed workout'}]));await expect(back).toBeFocused();expect(await back.evaluate(node=>node===window.savedBack)).toBe(true);
 const label='A very long <Strength & conditioning> program '.repeat(4);
 await page.evaluate(label=>window.crumbs.update(window.crumbItems,{mobileParent:{label,href:'#/programs/one'}}),label);
 const renamed=trail.getByRole('link',{name:'Back to '+label,exact:true});await expect(renamed).toBeFocused();expect(await renamed.evaluate(node=>node===window.savedBack)).toBe(true);
 expect(await renamed.evaluate(node=>{const label=node.querySelector('span');return getComputedStyle(label).whiteSpace==='nowrap'&&getComputedStyle(label).textOverflow==='ellipsis'&&label.scrollWidth>label.clientWidth;})).toBe(true);await expect(trail.locator('img,script')).toHaveCount(0);
 expect(await renamed.evaluate(node=>{const e=new MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true});node.dispatchEvent(e);return e.defaultPrevented;})).toBe(false);expect(await page.evaluate(()=>window.navigations)).toEqual([]);
 await renamed.press('Enter');await renamed.click();expect(await page.evaluate(()=>window.navigations)).toEqual(['#/programs/one','#/programs/one']);
 await page.setViewportSize({width:761,height:844});await trail.getByRole('link',{name:'Programs',exact:true}).focus();await page.setViewportSize({width:760,height:844});await expect(renamed).toBeFocused();
 await page.evaluate(()=>window.crumbs.update([],{mobileParent:{label:'Home',href:'#/home'}}));await expect(trail.getByRole('link',{name:'Back to Home',exact:true})).toBeVisible();
 await page.setViewportSize({width:761,height:844});await expect(trail).toBeHidden();await expect(page.getByRole('heading',{name:'Editor'})).toBeFocused();
 await page.evaluate(()=>window.crumbs.destroy());await expect(trail).toHaveCount(0);
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
 await page.setViewportSize({width:390,height:844});await expect(trail.getByRole('link',{name:'Back to Current breadcrumb reference',exact:true})).toHaveAttribute('href','#/catalog/references/'+fixture.target.id);await page.setViewportSize({width:761,height:844});
 await page.goto('/#/catalog/references/missing/variants/not-here');await expect(page.locator('#app').getByRole('alert')).toContainText('unavailable');await trail.getByRole('link',{name:'Exercise catalog',exact:true}).click();await expect(trail).toHaveCount(0);await expect(page.getByRole('heading',{name:'Exercise catalog',exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.goto(`/#/catalog/references/${fixture.source.id}/variants/not-here`);await expect(page.locator('#app').getByRole('alert')).toContainText('unavailable');
 await trail.getByRole('link',{name:'Back to Old breadcrumb reference',exact:true}).click();await expect(page).toHaveURL(new RegExp('#/catalog/references/'+fixture.source.id+'$'));
 await page.goto('/#/catalog/references/missing/variants/not-here');await trail.getByRole('link',{name:'Back to Exercises',exact:true}).click();await expect(trail).toHaveCount(0);
});
