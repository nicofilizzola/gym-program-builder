import {domainError} from './repository.js';

const ACTIVE_PROGRAM='activeProgramId';

/** Single-user app settings. The active program is last-write-wins; an id naming no program reads as null. */
export function createSettingsRepository(db,{now=()=>new Date().toISOString()}={}){
 const isProgram=async id=>(await db.execute({sql:"SELECT 1 FROM documents WHERE id=? AND kind='program'",args:[id]})).rows.length>0;
 return {
  async get(){
   const row=(await db.execute({sql:'SELECT value_json FROM app_settings WHERE key=?',args:[ACTIVE_PROGRAM]})).rows[0];
   const id=row?JSON.parse(row.value_json):null;
   return {activeProgramId:typeof id==='string'&&await isProgram(id)?id:null};
  },
  async setActiveProgram(programId){
   if(programId===null){await db.execute({sql:'DELETE FROM app_settings WHERE key=?',args:[ACTIVE_PROGRAM]});return {activeProgramId:null};}
   if(typeof programId!=='string'||!programId)throw domainError('INVALID','Invalid program id.');
   if(!await isProgram(programId))throw domainError('NOT_FOUND','Program not found.');
   await db.execute({sql:'INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at',args:[ACTIVE_PROGRAM,JSON.stringify(programId),now()]});
   return {activeProgramId:programId};
  }
 };
}
