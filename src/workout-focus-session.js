/** Signed-in session memory only. Nothing here belongs in a saved log. */
export function createWorkoutFocusSession(){
 const cursors=new Map();let preferences={autoNext:true,weightIncrement:2.5};
 return {read(logId){return structuredClone({viewed:cursors.get(logId)??null,...preferences});},patch(logId,patch){if('viewed' in patch)cursors.set(logId,structuredClone(patch.viewed));if(typeof patch.autoNext==='boolean')preferences.autoNext=patch.autoNext;if([.25,1,2.5,5].includes(patch.weightIncrement))preferences.weightIncrement=patch.weightIncrement;},clear(){cursors.clear();preferences={autoNext:true,weightIncrement:2.5};}};
}
