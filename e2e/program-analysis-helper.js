import {expect} from '@playwright/test';
export const report='Assessment\nThe program fits your priorities.\nStrengths\n- Consistent sessions.\nImprovements\nNo clear changes are warranted.\nLimits\nEffort is unknown.';
export const frames=text=>`event: start\ndata: {"requestId":"p","promptVersion":"program-test"}\n\nevent: delta\ndata: ${JSON.stringify({text})}\n\nevent: complete\ndata: {}\n\n`;
export async function programFixture(page,{contextOnly=false,emptySession=false}={}){
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Programs',exact:true})).toBeVisible();
 const result=await page.evaluate(async({contextOnly,emptySession})=>{
  const {createApiClient}=await import('/src/api-client.js'),api=createApiClient();
  const template=await api.create({id:crypto.randomUUID(),kind:'template',document:{name:'Upper',goals:{},exercises:emptySession?[]:[{name:'Bench',sets:3,repRange:{min:8,max:12},restSeconds:120,primaryMuscles:['Chest'],secondaryMuscles:['Triceps']}]}});
  const program=await api.create({id:crypto.randomUUID(),kind:'program',document:{name:'AI program '+crypto.randomUUID(),mode:'schedule',goals:contextOnly?{}:{Chest:8},context:{goalsAndPriorities:'Build muscle',constraintsAndPreferences:'60 minutes'},workouts:contextOnly?[]:[{id:'first',templateId:template.id,day:0},{id:'repeat',templateId:template.id,day:4}]}});
  return {program,template};
 },{contextOnly,emptySession});
 await page.goto('/#/programs/'+result.program.id);await expect(page.getByLabel('Program name')).toHaveValue(result.program.document.name);return result;
}
