import {validateDocument} from '../src/document-validation.js';
import {normalizeWorkoutTiming} from '../src/duration.js';
import {normalizeWorkoutCover} from '../src/workout-cover.js';
import {resolveCatalogLinks} from './catalog-links.js';
import {syncProgramLinks,readProgramBundle,templateUsage} from './program-links.js';
export const domainError=(code,message)=>Object.assign(new Error(message),{code});
const decode=row=>{
  const saved=JSON.parse(row.document_json);
  const document=row.kind==='template'?{...normalizeWorkoutTiming(saved),coverId:normalizeWorkoutCover(saved.coverId)}:saved;
  return {id:row.id,kind:row.kind,revision:Number(row.revision),document,createdAt:row.created_at,updatedAt:row.updated_at};
};
export function createRepository(db,{now=()=>new Date().toISOString(),inTransaction=false}={}) {
  const read=async(client,id)=>{const r=await client.execute({sql:'SELECT * FROM documents WHERE id=?',args:[id]});return r.rows[0]?decode(r.rows[0]):null;};
  const canonical=(kind,value)=>{const r=validateDocument(kind,value,{draft:true});if(r.error) throw domainError('INVALID',r.error);return r.document;};
  async function transaction(action) {
    if(inTransaction)return action(db);
    const tx=await db.transaction('write');
    try {const value=await action(tx);await tx.commit();return value;} finally {tx.close();}
  }
  return {
    async programBundle(id){
      if(inTransaction)return readProgramBundle(db,id,read);
      const tx=await db.transaction('read');try{const bundle=await readProgramBundle(tx,id,read);await tx.commit();return bundle;}finally{tx.close();}
    },
    async templateUsage(id){return templateUsage(db,id);},
    async list(kind) {if(!['template','program'].includes(kind)) throw domainError('INVALID','Unknown document kind.');const r=await db.execute({sql:'SELECT * FROM documents WHERE kind=? ORDER BY updated_at DESC,id',args:[kind]});return r.rows.map(row=>{const {document,...record}=decode(row);return {...record,name:document.name};});},
    async get(id) {const record=await read(db,id);if(!record) throw domainError('NOT_FOUND','Document not found.');return record;},
    async create({id,kind,document,copyOf}) {
      if(typeof id!=='string'||!id||id.length>100) throw domainError('INVALID','Invalid document ID.');
      return transaction(async tx=>{
        const source=copyOf?await read(tx,copyOf):null;
        if(copyOf&&(!source||source.kind!==kind))throw domainError('INVALID','Copy source does not exist.');
        const cleaned=canonical(kind,document);if(kind==='template')await resolveCatalogLinks(tx,cleaned,{previous:source?.document});const json=JSON.stringify(cleaned);
        const old=await read(tx,id);
        if(old) {if(old.kind===kind&&JSON.stringify(canonical(old.kind,old.document))===json)return old;throw domainError('CONFLICT','This document ID already exists.');}
        const stamp=now();await tx.execute({sql:'INSERT INTO documents VALUES(?,?,1,?,?,?)',args:[id,kind,json,stamp,stamp]});if(kind==='program')await syncProgramLinks(tx,id,cleaned);return read(tx,id);
      });
    },
    async update({id,revision,document}) {
      if(!Number.isInteger(revision)||revision<1) throw domainError('INVALID','Invalid revision.');
      return transaction(async tx=>{
        const old=await read(tx,id);if(!old)throw domainError('NOT_FOUND','Document not found.');
        const cleaned=canonical(old.kind,document);if(old.kind==='template')await resolveCatalogLinks(tx,cleaned,{previous:old.document});const json=JSON.stringify(cleaned);
        if(old.revision!==revision) {if(old.revision===revision+1&&JSON.stringify(canonical(old.kind,old.document))===json)return old;throw domainError('CONFLICT','A newer version was saved on another device.');}
        if(old.kind==='program')await syncProgramLinks(tx,id,cleaned);
        await tx.execute({sql:'UPDATE documents SET document_json=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?',args:[json,now(),id,revision]});return read(tx,id);
      });
    },
    async remove({id,revision}) {
      if(!Number.isInteger(revision)||revision<1) throw domainError('INVALID','Invalid revision.');
      return transaction(async tx=>{const old=await read(tx,id);if(!old)return;if(old.revision!==revision)throw domainError('CONFLICT','A newer version was saved on another device.');if(old.kind==='template'){const programs=await templateUsage(tx,id);if(programs.length)throw Object.assign(domainError('IN_USE','Remove this session template from its programs before deleting it.'),{details:{programs}});}await tx.execute({sql:'DELETE FROM documents WHERE id=? AND revision=?',args:[id,revision]});});
    }
  };
}
