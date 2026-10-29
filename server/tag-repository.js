import {domainError} from './repository.js';
import {normalizeSearch} from '../src/catalog.js';
import {readCatalogEntry} from './catalog-repository.js';
import {propagateCatalogEntries} from './catalog-propagation.js';

export const tagRow=row=>({id:row.id,kind:row.kind,name:row.name,archived:Boolean(row.archived),revision:Number(row.revision)});
async function readTag(tx,id){const row=(await tx.execute({sql:'SELECT * FROM catalog_tags WHERE id=?',args:[id]})).rows[0];if(!row)throw domainError('NOT_FOUND','Tag not found.');return tagRow(row);}
function tagName(value){if(typeof value!=='string'||!value.trim()||value.trim().length>80)throw domainError('INVALID','Enter a tag name (up to 80 characters).');return value.trim();}
function validId(id){if(typeof id!=='string'||!id||id.length>100)throw domainError('INVALID','Invalid tag ID.');}
export async function syncVariantTags(tx,id,entry,{previous,source}={}){
 const requested=[...(entry.brandId?[{id:entry.brandId,kind:'brand'}]:[]),...entry.focusTagIds.map(id=>({id,kind:'focus'}))];
 const retained=new Set([previous?.brand?.id,source?.brand?.id,...(previous?.focusTags||[]).map(t=>t.id),...(source?.focusTags||[]).map(t=>t.id)].filter(Boolean));
 for(const assignment of requested){
  let tag;try{tag=await readTag(tx,assignment.id);}catch(error){if(error.code==='NOT_FOUND')throw domainError('INVALID','A selected tag no longer exists. Refresh the catalog.');throw error;}
  if(tag.kind!==assignment.kind)throw domainError('INVALID','Choose tags of the correct Brand or Focus type.');
  if(tag.archived&&!retained.has(tag.id))throw domainError('INVALID','Archived tags cannot be newly assigned. Refresh the catalog.');
 }
 await tx.execute({sql:'DELETE FROM catalog_variant_tags WHERE variant_id=?',args:[id]});
 for(const tag of requested)await tx.execute({sql:'INSERT INTO catalog_variant_tags VALUES(?,?)',args:[id,tag.id]});
}
export function createTagRepository(db){
 async function write(action){const tx=await db.transaction('write');try{const result=await action(tx);await tx.commit();return result;}finally{tx.close();}}
 async function unique(tx,kind,name,except=''){
  if((await tx.execute({sql:'SELECT id FROM catalog_tags WHERE kind=? AND normalized_name=? AND id<>?',args:[kind,normalizeSearch(name),except]})).rows.length)throw domainError('CONFLICT','A tag with this name already exists in this type, possibly archived.');
 }
 async function propagate(tx,id){
  const rows=(await tx.execute({sql:'SELECT variant_id FROM catalog_variant_tags WHERE tag_id=? ORDER BY variant_id',args:[id]})).rows,entries=[],stamp=new Date().toISOString();
  for(const row of rows){await tx.execute({sql:'UPDATE catalog_entries SET revision=revision+1,updated_at=? WHERE id=?',args:[stamp,row.variant_id]});entries.push(await readCatalogEntry(tx,row.variant_id));}
  await propagateCatalogEntries(tx,entries,stamp);
 }
 return {
  async list({kind}={}){if(kind!==undefined&&!['brand','focus'].includes(kind))throw domainError('INVALID','Unknown tag type.');const rows=await db.execute({sql:'SELECT * FROM catalog_tags'+(kind?' WHERE kind=?':'')+' ORDER BY kind,normalized_name,id',args:kind?[kind]:[]});return rows.rows.map(tagRow);},
  async create({id,kind,name}){
   validId(id);name=tagName(name);if(!['brand','focus'].includes(kind))throw domainError('INVALID','Choose Brand or Focus.');
   return write(async tx=>{
    const found=(await tx.execute({sql:'SELECT * FROM catalog_tags WHERE id=?',args:[id]})).rows[0];
    if(found){if(found.name===name&&found.kind===kind)return tagRow(found);throw domainError('CONFLICT','This tag ID already exists.');}
    await unique(tx,kind,name);await tx.execute({sql:'INSERT INTO catalog_tags(id,kind,name,normalized_name) VALUES(?,?,?,?)',args:[id,kind,name,normalizeSearch(name)]});return readTag(tx,id);
   });
  },
  async update({id,revision,name}){
   name=tagName(name);return write(async tx=>{
    const old=await readTag(tx,id);if(!Number.isInteger(revision)||old.revision!==revision){if(old.revision===revision+1&&old.name===name)return old;throw domainError('CONFLICT','This tag changed. Reload its saved version.');}
    if(old.name===name)return old;await unique(tx,old.kind,name,id);
    await tx.execute({sql:'UPDATE catalog_tags SET name=?,normalized_name=?,revision=revision+1 WHERE id=?',args:[name,normalizeSearch(name),id]});await propagate(tx,id);return readTag(tx,id);
   });
  },
  async archive({id,revision,archived}){
   if(typeof archived!=='boolean')throw domainError('INVALID','Invalid tag archive state.');
   return write(async tx=>{
    const old=await readTag(tx,id);if(!Number.isInteger(revision)||old.revision!==revision){if(old.revision===revision+1&&old.archived===archived)return old;throw domainError('CONFLICT','This tag changed. Reload its saved version.');}
    if(old.archived===archived)return old;
    await tx.execute({sql:'UPDATE catalog_tags SET archived=?,revision=revision+1 WHERE id=?',args:[archived?1:0,id]});await propagate(tx,id);return readTag(tx,id);
   });
  },
 };
}
