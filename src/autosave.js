/** A record owns one queue. UI edits never wait for a network response. */
export function createAutosave({record,save,createCopy,delay=400,onStatus=()=>{},onRecord=()=>{},onConflict=()=>{},timers=globalThis}) {
  let current=structuredClone(record),document=structuredClone(record.document),generation=0,saved=0,timer=null,inflight=null,paused=null,disposed=false;
  const cancel=()=>{if(timer!==null)timers.clearTimeout(timer);timer=null;};
  async function drain() {
    cancel();if(disposed)return;
    if(inflight)return inflight;
    if(paused)throw paused;
    inflight=(async()=>{
      while(!disposed&&saved<generation) {
        const writing=generation,snapshot=structuredClone(document);
        onStatus('Saving…');
        try {
          const result=await save({id:current.id,revision:current.revision,document:snapshot});
          if(disposed)return;
          current=structuredClone(result);saved=writing;
          onRecord({...current,document:structuredClone(document)});
        }catch(error) {if(disposed)return;paused=error;onStatus(error.status===409?'Conflict':error.status===401?'Sign in to save':'Couldn’t save');if(error.status===409)onConflict(error);throw error;}
      }
      if(!disposed&&saved===generation)onStatus('Saved');
    })();
    try {return await inflight;}finally {inflight=null;}
  }
  return {
    change(value) {if(disposed)return;document=structuredClone(value);generation++;cancel();onStatus(paused?'Couldn’t save':'Saving…');if(!paused)timer=timers.setTimeout(()=>{timer=null;drain().catch(()=>{});},delay);},
    flush:drain,
    retry() {if(paused?.status===409) return Promise.reject(paused);paused=null;return drain();},
    reload(value) {if(inflight)throw Error('Wait for pending save.');cancel();current=structuredClone(value);document=structuredClone(value.document);generation=saved=0;paused=null;onRecord(current);onStatus('Saved');},
    async saveAsCopy() {const result=await createCopy(structuredClone(document));cancel();disposed=true;return result;},
    dispose() {disposed=true;cancel();},
    isDirty:()=>saved<generation
  };
}
