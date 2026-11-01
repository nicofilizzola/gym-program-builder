import {normalizeContextText} from './program-context.js';

export const PROFILE_FIELDS=Object.freeze(['trainingBackgroundAndApproach']);

/** Single-user profile prose; same text rules as program context. Unknown keys are dropped. */
export function normalizeProfile(value=undefined){
 if(value!==undefined&&(value===null||typeof value!=='object'||Array.isArray(value)))throw Error('Invalid profile.');
 return Object.fromEntries(PROFILE_FIELDS.map(key=>{
  const raw=value&&Object.hasOwn(value,key)?value[key]:'';
  if(typeof raw!=='string')throw Error('Invalid profile.');
  try{return [key,normalizeContextText(raw,key)];}catch{throw Error('Profile fields must be at most 2,000 characters.');}
 }));
}
