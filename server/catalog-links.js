import {snapshotExercise} from '../src/catalog.js';
import {readCatalogEntry,documentExercises} from './catalog-repository.js';
import {domainError} from './repository.js';
export async function resolveCatalogLinks(tx,document,{previous}={}) {
 const allowed=new Map();
 for(const ex of previous?documentExercises(previous):[])if(ex.catalogId)allowed.set(ex.catalogId,(allowed.get(ex.catalogId)||0)+1);
 const cache=new Map();
 for(const ex of documentExercises(document))if(ex.catalogId){
  let entry=cache.get(ex.catalogId);
  if(!entry){try{entry=await readCatalogEntry(tx,ex.catalogId);}catch(error){if(error.code==='NOT_FOUND')throw domainError('INVALID','The selected catalog exercise no longer exists.');throw error;}cache.set(ex.catalogId,entry);}
  if(entry.archived){const remaining=allowed.get(entry.id)||0;if(!remaining)throw domainError('INVALID','Archived exercises cannot be newly selected. Choose an active exercise or create a variant.');allowed.set(entry.id,remaining-1);}
  if(ex.familyId!==entry.familyId)throw domainError('INVALID','Exercise family does not match its catalog entry.');
  Object.assign(ex,snapshotExercise(ex,entry));
 }
 return document;
}
