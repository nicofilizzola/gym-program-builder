import {parseRoute} from './router.js';

export const MOBILE_DESTINATIONS=Object.freeze(['home','library','user']);
const roots={home:'#/home',user:'#/user'};
const libraryRoot=view=>view.startsWith('catalog')?'#/catalog':view==='template'||view==='templates'?'#/templates':'#/programs';
export function destinationFor(hash){
 const {view}=parseRoute(hash);
 if(['programs','program','program-workout','templates','template','catalog','catalog-reference','catalog-variant','catalog-tags'].includes(view))return 'library';
 if(['workouts','workout'].includes(view))return 'home';
 if(['user','profile'].includes(view))return 'user';
 return view==='home'?'home':null;
}
export function isSwipeRoot(hash){return ['home','programs','templates','catalog','workouts','user'].includes(parseRoute(hash).view);}
export function adjacentDestination(destination,direction){
 const index=MOBILE_DESTINATIONS.indexOf(destination);
 return index<0?null:MOBILE_DESTINATIONS[index+(direction==='next'?1:-1)]??null;
}
export function createMobileNavigationState(){
 let library='#/programs';const pages=new Map();
 return {
  href:destination=>destination==='library'?library:roots[destination],
  commit(hash){if(destinationFor(hash)==='library')library=libraryRoot(parseRoute(hash).view);},
  readPage:hash=>pages.has(hash)?structuredClone(pages.get(hash)):null,
  writePage(hash,value){if(isSwipeRoot(hash))pages.set(hash,structuredClone(value));},
  clear(){library='#/programs';pages.clear();}
 };
}
