/** Resolve display data without making embedded content authoritative. */
export function resolveProgram(program,templateRecords){
 const templates=new Map();
 for(const record of templateRecords){
  if(record.kind!=='template')throw Error('Expected a session template.');
  if(templates.has(record.id))throw Error('Duplicate template record.');
  templates.set(record.id,record);
 }
 return {...structuredClone(program),workouts:program.workouts.map(occurrence=>{
  const template=templates.get(occurrence.templateId);
  if(!template)throw Error('Session template not found.');
  return {...structuredClone(template.document),...occurrence,templateRevision:template.revision};
 })};
}

export function programArrangement(program){
 return {...program,workouts:program.workouts.map(({id,templateId,day})=>({id,templateId,day}))};
}
