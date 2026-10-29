import {snapshotExercise} from '../src/catalog.js';
import {readCatalogEntry} from './catalog-repository.js';
import {documentExercises} from './catalog-propagation.js';
import {domainError} from './repository.js';
export async function resolveCatalogLinks(tx,document,{previous}={}) {
 const allowed=new Map();
 for(const ex of previous?documentExercises(previous):[])if(ex.catalogId)allowed.set(ex.catalogId,(allowed.get(ex.catalogId)||0)+1);
 const cache=new Map();
 for(const ex of documentExercises(document))if(ex.catalogId){
  let entry=cache.get(ex.catalogId);
  if(!entry){try{entry=await readCatalogEntry(tx,ex.catalogId);}catch(error){if(error.code==='NOT_FOUND')throw domainError('INVALID','The selected catalog exercise no longer exists.');throw error;}cache.set(ex.catalogId,entry);}
  let copied=false;
  if(ex.catalogCopyOf&&!(allowed.get(entry.id)>0)){
   const source=await tx.execute({sql:'SELECT document_json FROM documents WHERE id=?',args:[ex.catalogCopyOf]});
   copied=Boolean(source.rows[0]&&documentExercises(JSON.parse(source.rows[0].document_json)).some(e=>e.catalogId===entry.id));
   if(!copied)throw domainError('INVALID','Copy source does not contain this catalog exercise.');
  }
  if(entry.archived||entry.equipmentConfigured===false){const remaining=allowed.get(entry.id)||0;if(!remaining&&!copied)throw domainError('INVALID',entry.archived?'Archived exercises cannot be newly selected. Choose an active exercise or create a variant.':'Set equipment on the reference exercise before selecting this variant.');if(remaining)allowed.set(entry.id,remaining-1);}
  Object.assign(ex,snapshotExercise(ex,entry));
  delete ex.catalogCopyOf;
 }
 return document;
}
