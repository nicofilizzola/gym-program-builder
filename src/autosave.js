/** A record owns one queue. UI edits never wait for a network response. */
export function createAutosave({record,save,createCopy,delay=400,onStatus=()=>{},onRecord=()=>{},onConflict=()=>{},timers=globalThis}) {
  let current=structuredClone(record),document=structuredClone(record.document),generation=0,saved=0,timer=null,inflight=null,paused=null,disposed=false;
  let attempt=null,copyAttempt=null,copyRecord=null,copyWrite=null,copying=false;
  const cancel=()=>{if(timer!==null)timers.clearTimeout(timer);timer=null;};
  const pausedStatus=()=>paused?.status===409?'Conflict':paused?.status===401?'Sign in to save':'Couldn’t save';
  async function drain() {
    cancel();if(disposed)return;
    if(inflight)return inflight;
    if(paused)throw paused;
    inflight=(async()=>{
      while(!disposed&&saved<generation) {
        // A failed response may hide a committed write. Replay its exact envelope first.
        attempt??={generation,revision:current.revision,document:structuredClone(document)};
        const writing=attempt.generation;
        onStatus('Saving…');
        try {
          const result=await save({id:current.id,revision:attempt.revision,document:attempt.document});
          if(disposed)return;
          current=structuredClone(result);saved=writing;attempt=null;
          if(writing===generation)document=structuredClone(current.document);
          onRecord({...current,document:structuredClone(document)});
        }catch(error) {if(disposed)return;paused=error;onStatus(pausedStatus());if(error.status===409)onConflict(error);throw error;}
      }
      if(!disposed&&saved===generation)onStatus('Saved');
    })();
    try {return await inflight;}finally {inflight=null;}
  }
  return {
    change(value) {if(disposed)return;document=structuredClone(value);generation++;cancel();onStatus(paused?pausedStatus():'Saving…');if(!paused&&!copying)timer=timers.setTimeout(()=>{timer=null;drain().catch(()=>{});},delay);},
    flush:drain,
    conflict(error) {if(disposed)return;cancel();paused=error;onStatus('Conflict');onConflict(error);},
    retry() {if(paused?.status===409) return Promise.reject(paused);paused=null;return drain();},
    reload(value) {if(inflight)throw Error('Wait for pending save.');cancel();current=structuredClone(value);document=structuredClone(value.document);generation=saved=0;paused=attempt=null;onRecord(current);onStatus('Saved');},
    async saveAsCopy() {
      cancel();copying=true;
      try {
        if(inflight)await inflight.catch(()=>{});
        copyAttempt??={generation,document:structuredClone(document)};
        copyRecord??=await createCopy(copyAttempt.document);
        let copied=copyWrite?.generation??copyAttempt.generation;
        while(copyWrite||copied<generation) {
          copyWrite??={generation,revision:copyRecord.revision,document:structuredClone(document)};
          const result=await save({id:copyRecord.id,revision:copyWrite.revision,document:copyWrite.document});
          copied=copyWrite.generation;copyRecord=result;copyWrite=null;
        }
        saved=generation;disposed=true;return copyRecord;
      } finally {copying=false;}
    },
    dispose() {disposed=true;cancel();},
    isDirty:()=>saved<generation,
    isSaving:()=>Boolean(inflight)
  };
}
