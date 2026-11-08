import {focusFixture} from '../test/fixtures/workout-focus.js';

export async function mountFocusFixture(page,{log=focusFixture(),enable=true}={}){
 await page.goto('/');await page.evaluate(async({log,enable})=>{
  const {mountWorkoutLogger}=await import('/src/workout-logger-view.js');
  const {mountWorkoutFocus}=await import('/src/workout-focus-view.js');
  document.body.innerHTML='<main id="app"><div id="fixture"></div></main>';
  window.initialLog=log;window.saved=[];window.activity=[];
  window.logger=mountWorkoutLogger(document.querySelector('#fixture'),{api:{},log,onChange:value=>saved.push(value)});
  window.port=logger.presentationPort;window.originalWeight=port.row({exerciseId:'straight',setId:'s1'})?.querySelector('[data-field="weight"]');
  const host=document.createElement('div');document.querySelector('.workout-logger').append(host);
  window.focusView=mountWorkoutFocus(host,{port,ui:{viewed:null,autoNext:true,weightIncrement:2.5},onInteraction:e=>activity.push(e),onViewed:()=>{},onFinish:()=>{}});
  focusView.setEnabled(enable);
 },{log,enable});
}
