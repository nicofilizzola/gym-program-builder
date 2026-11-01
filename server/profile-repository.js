import {normalizeProfile} from '../src/profile.js';
import {domainError} from './repository.js';

/** Single-user profile row (id=1) with the same optimistic revision rule as documents. */
export function createProfileRepository(db,{now=()=>new Date().toISOString()}={}){
 const clean=value=>{try{return normalizeProfile(value);}catch(error){throw domainError('INVALID',error.message);}};
 const read=async()=>{
  const row=(await db.execute('SELECT revision,profile_json FROM user_profile WHERE id=1')).rows[0];
  return row?{profile:normalizeProfile(JSON.parse(row.profile_json)),revision:Number(row.revision)}:{profile:normalizeProfile(),revision:0};
 };
 return {
  get:read,
  async update({revision,profile}={}){
   if(!Number.isInteger(revision)||revision<0)throw domainError('INVALID','Invalid revision.');
   // A missing or non-object profile is malformed, never an instruction to clear the background.
   if(!profile||typeof profile!=='object'||Array.isArray(profile))throw domainError('INVALID','Invalid profile.');
   const next=clean(profile);
   const json=JSON.stringify(next),stamp=now();
   const result=revision===0
    ?await db.execute({sql:'INSERT INTO user_profile(id,revision,profile_json,updated_at) VALUES(1,1,?,?) ON CONFLICT(id) DO NOTHING',args:[json,stamp]})
    :await db.execute({sql:'UPDATE user_profile SET revision=revision+1,profile_json=?,updated_at=? WHERE id=1 AND revision=?',args:[json,stamp,revision]});
   if(!result.rowsAffected){
    // A retried save whose acknowledgement was lost is already applied; anything else is stale.
    const current=await read();
    if(current.revision===revision+1&&JSON.stringify(current.profile)===json)return current;
    throw domainError('CONFLICT','Profile changed on another device.');
   }
   return {profile:next,revision:revision+1};
  },
 };
}
