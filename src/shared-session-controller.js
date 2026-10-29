import {createAutosave} from './autosave.js';

export function createSharedSessionController({api,onStatus=()=>{},onConflict=()=>{},onTemplate=()=>{},makeId=()=>crypto.randomUUID()}){
 const entries=new Map();let disposed=false;
 return {
  load(record){
   if(entries.has(record.id))return entries.get(record.id).queue;
   const entry={record:structuredClone(record),queue:null,copy:null};
   entry.queue=createAutosave({record,save:request=>api.update(request),createCopy:document=>{entry.copy??={id:makeId(),kind:'template',copyOf:record.id,document:structuredClone(document)};return api.create(entry.copy);},onStatus,onConflict,onRecord:value=>{if(!disposed){entry.record=value;onTemplate(value);}}});
   entries.set(record.id,entry);return entry.queue;
  },
  edit(id,workout){const entry=entries.get(id);if(!entry)throw Error('Session template not loaded.');entry.queue.change(workout);},
  async flush(){for(const entry of entries.values())await entry.queue.flush();},
  async refresh(){
   for(const entry of entries.values()){
    const revision=entry.record.revision,remote=await api.get(entry.record.id);
    if(disposed||entry.record.revision!==revision||entry.queue.isSaving()||remote.revision===revision)continue;
    if(entry.queue.isDirty()){entry.queue.conflict(Object.assign(Error('This shared template changed. Reload saved version or Save as copy. Programs keep their original template when you save a copy.'),{code:'CONFLICT',status:409}));continue;}
    entry.queue.reload(remote);
   }
  },
  async saveAsCopy(id){const entry=entries.get(id);if(!entry)throw Error('Session template not loaded.');return entry.queue.saveAsCopy();},
  dispose(){disposed=true;for(const entry of entries.values())entry.queue.dispose();entries.clear();},
 };
}
