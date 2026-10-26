import {domainError} from './repository.js';
export function referenceName(name){
 if(typeof name!=='string'||!name.trim()||name.trim().length>200)throw domainError('INVALID','Enter a reference exercise name (up to 200 characters).');
 return name.trim();
}
export async function readReference(tx,id){
 const result=await tx.execute({sql:'SELECT id,name,revision,archived FROM catalog_families WHERE id=?',args:[id]});
 if(!result.rows[0])throw domainError('NOT_FOUND','Reference exercise not found.');
 const row=result.rows[0];return {...row,revision:Number(row.revision),archived:Boolean(row.archived)};
}
export function createReferenceRepository(db){
 async function write(fn){const tx=await db.transaction('write');try{const value=await fn(tx);await tx.commit();return value;}finally{tx.close();}}
 const conflict=()=>domainError('CONFLICT','This reference exercise or its variants changed. Reload the saved version.');
 return {
  get:id=>readReference(db,id),
  async create({id,name}){
   const clean=referenceName(name);if(typeof id!=='string'||!id||id.length>100)throw domainError('INVALID','Invalid reference exercise ID.');
   return write(async tx=>{const found=await tx.execute({sql:'SELECT id FROM catalog_families WHERE id=?',args:[id]});if(found.rows.length){const old=await readReference(tx,id);if(old.name===clean)return old;throw conflict();}await tx.execute({sql:'INSERT INTO catalog_families(id,name) VALUES(?,?)',args:[id,clean]});return readReference(tx,id);});
  },
  async update({id,revision,name}){
   const clean=referenceName(name);
   return write(async tx=>{const old=await readReference(tx,id);if(!Number.isInteger(revision))throw conflict();if(old.revision!==revision){if(old.revision===revision+1&&old.name===clean)return old;throw conflict();}if(old.name===clean)return old;await tx.execute({sql:'UPDATE catalog_families SET name=?,revision=revision+1 WHERE id=?',args:[clean,id]});return readReference(tx,id);});
  },
  async archive({id,revision,archived}){
   if(typeof archived!=='boolean')throw domainError('INVALID','Invalid reference archive state.');
   return write(async tx=>{const old=await readReference(tx,id);if(!Number.isInteger(revision))throw conflict();if(old.revision!==revision){if(old.revision===revision+1&&old.archived===archived)return old;throw conflict();}if(old.archived===archived)return old;await tx.execute({sql:'UPDATE catalog_families SET archived=?,revision=revision+1 WHERE id=?',args:[archived?1:0,id]});return readReference(tx,id);});
  }
 };
}
