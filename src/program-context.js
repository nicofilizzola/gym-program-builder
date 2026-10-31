export const PROGRAM_CONTEXT_FIELDS=Object.freeze(['goalsAndPriorities','constraintsAndPreferences','trainingBackgroundAndApproach']);
export const PROGRAM_CONTEXT_MAX_LENGTH=2000;

/** Optional program notes; shared by storage, portable files and analysis. */
export function normalizeProgramContext(value=undefined){
 if(value!==undefined&&(value===null||typeof value!=='object'||Array.isArray(value)))throw Error('Invalid program context.');
 return Object.fromEntries(PROGRAM_CONTEXT_FIELDS.map(key=>{
  const raw=value&&Object.hasOwn(value,key)?value[key]:'';
  if(typeof raw!=='string')throw Error('Invalid program context '+key+'.');
  const text=raw.replace(/\r\n?/g,'\n');
  if(text.length>PROGRAM_CONTEXT_MAX_LENGTH)throw Error('Program context fields must be at most 2,000 characters.');
  return [key,text.trim()?text:''];
 }));
}
export const hasProgramContext=program=>Object.values(normalizeProgramContext(program?.context)).some(Boolean);
