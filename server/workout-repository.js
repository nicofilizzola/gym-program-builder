import {bestPerRep} from '../src/workout-best.js';
import {upgradeLog,validateWorkoutLog,workoutSummary,WORKOUT_LIMITS} from '../src/workout-log.js';
import {domainError} from './repository.js';

const conflict=(message,reason)=>Object.assign(domainError('CONFLICT',message),{details:{reason}});
const revisionConflict=()=>conflict('Workout changed on another device.','revision_conflict');
const utc=value=>new Date(value).toISOString();

/** Workout logs: one revisioned row per log, a single active log, and a variant index of finished logs. */
export function createWorkoutRepository(db,{now=()=>new Date().toISOString()}={}){
 const decode=row=>({id:row.id,revision:Number(row.revision),log:upgradeLog(JSON.parse(row.log_json))});
 const validId=id=>typeof id==='string'&&id.length>=1&&id.length<=100;
 const validRevision=revision=>Number.isInteger(revision)&&revision>=0;
 const find=async(executor,id)=>{
  const row=(await executor.execute({sql:'SELECT * FROM workout_logs WHERE id=?',args:[id]})).rows[0];
  return row?{...decode(row),status:row.status,json:row.log_json}:null;
 };
 const isActiveViolation=error=>/UNIQUE/i.test(String(error?.message))&&/workout_logs\.status|workout_logs_one_active/.test(String(error?.message));

 return {
  async list({before,beforeId,limit=WORKOUT_LIMITS.historyPage}={}){
   if(!Number.isInteger(limit)||limit<1)throw domainError('INVALID','Invalid limit.');
   const size=Math.min(limit,WORKOUT_LIMITS.historyPage);
   let sql="SELECT log_json FROM workout_logs WHERE status='finished'";const args=[];
   if(before!==undefined&&before!==null){
    if(typeof before!=='string'||Number.isNaN(Date.parse(before)))throw domainError('INVALID','Invalid cursor.');
    const at=utc(before);
    if(typeof beforeId==='string'){sql+=' AND (started_at<? OR (started_at=? AND id<?))';args.push(at,at,beforeId);}
    else{sql+=' AND started_at<?';args.push(at);}
   }
   sql+=' ORDER BY started_at DESC,id DESC LIMIT ?';args.push(size+1);
   const rows=(await db.execute({sql,args})).rows;
   return {records:rows.slice(0,size).map(row=>workoutSummary(upgradeLog(JSON.parse(row.log_json)))),hasMore:rows.length>size};
  },
  async active(){
   const row=(await db.execute("SELECT * FROM workout_logs WHERE status='active'")).rows[0];
   return row?decode(row):null;
  },
  async get(id){
   const record=await find(db,id);
   if(!record)throw domainError('NOT_FOUND','Workout not found.');
   return {id:record.id,revision:record.revision,log:record.log};
  },
  async save({id,revision,log}={}){
   if(!validId(id))throw domainError('INVALID','Invalid id.');
   if(!validRevision(revision))throw domainError('INVALID','Invalid revision.');
   const checked=validateWorkoutLog(log);
   if(checked.error)throw domainError('INVALID',checked.error);
   if(checked.log.id!==id)throw domainError('INVALID','Log id must match the record id.');
   const canonical=checked.log,json=JSON.stringify(canonical),stamp=now();
   const tx=await db.transaction('write');
   try{
    const stored=await find(tx,id);
    // A retried save whose acknowledgement was lost is already applied; any other revision mismatch is stale.
    if(stored&&stored.revision===revision+1&&stored.json===json)return {id,revision:stored.revision,log:stored.log};
    if((stored?stored.revision:0)!==revision)throw revisionConflict();
    if(stored?.status==='finished'&&canonical.status==='active')throw domainError('INVALID','A finished workout cannot become active.');
    if(canonical.status==='active'){
     const other=await tx.execute({sql:"SELECT id FROM workout_logs WHERE status='active' AND id<>?",args:[id]});
     if(other.rows.length)throw conflict('Another workout is already in progress.','active_exists');
    }
    let applied;
    if(revision===0){
     if(stored)applied=false;
     else{
      try{
       await tx.execute({sql:'INSERT INTO workout_logs(id,revision,status,started_at,finished_at,log_json,created_at,updated_at) VALUES(?,1,?,?,?,?,?,?)',
        args:[id,canonical.status,utc(canonical.startedAt),canonical.finishedAt&&utc(canonical.finishedAt),json,stamp,stamp]});
       applied=true;
      }catch(error){
       if(isActiveViolation(error))throw conflict('Another workout is already in progress.','active_exists');
       throw error;
      }
     }
    }else{
     const result=await tx.execute({sql:'UPDATE workout_logs SET revision=revision+1,status=?,started_at=?,finished_at=?,log_json=?,updated_at=? WHERE id=? AND revision=?',
      args:[canonical.status,utc(canonical.startedAt),canonical.finishedAt&&utc(canonical.finishedAt),json,stamp,id,revision]});
     applied=result.rowsAffected>0;
    }
    if(!applied){
     throw revisionConflict();
    }
    await tx.execute({sql:'DELETE FROM workout_log_variants WHERE log_id=?',args:[id]});
    if(canonical.status==='finished'){
     const ids=new Set(canonical.exercises.map(e=>e.variantId).filter(v=>v!==null&&v!==undefined));
     for(const variantId of ids)await tx.execute({sql:'INSERT INTO workout_log_variants(log_id,variant_id,finished_at) VALUES(?,?,?)',args:[id,variantId,utc(canonical.finishedAt)]});
    }
    await tx.commit();
    return {id,revision:revision+1,log:canonical};
   }finally{tx.close();}
  },
  async remove({id,revision}={}){
   if(!validId(id))throw domainError('INVALID','Invalid id.');
   if(!validRevision(revision))throw domainError('INVALID','Invalid revision.');
   const tx=await db.transaction('write');
   try{
    const stored=await find(tx,id);
    if(!stored)return;
    if(stored.revision!==revision)throw revisionConflict();
    await tx.execute({sql:'DELETE FROM workout_log_variants WHERE log_id=?',args:[id]});
    await tx.execute({sql:'DELETE FROM workout_logs WHERE id=?',args:[id]});
    await tx.commit();
   }finally{tx.close();}
  },
  async bestPerformance({variantIds,exclude}={}){
   if(!Array.isArray(variantIds)||variantIds.some(v=>typeof v!=='string'))throw domainError('INVALID','Invalid variant ids.');
   if(variantIds.length>WORKOUT_LIMITS.lastTimeIds)throw domainError('INVALID','Too many variant ids.');
   const ids=[...new Set(variantIds)],result=Object.fromEntries(ids.map(id=>[id,[]]));
   if(!ids.length)return result;
   const wanted=new Set(ids),tx=await db.transaction('read');
   try{
    let cursor=null;
    while(true){
     const rows=(await tx.execute({sql:`SELECT l.id,l.log_json FROM workout_logs l WHERE l.status='finished' AND l.id<>? ${cursor===null?'':'AND l.id>?'} AND EXISTS (SELECT 1 FROM workout_log_variants v WHERE v.log_id=l.id AND v.variant_id IN (${ids.map(()=>'?').join(',')})) ORDER BY l.id LIMIT 100`,args:[typeof exclude==='string'?exclude:'',...(cursor===null?[]:[cursor]),...ids]})).rows;
     for(const row of rows){
      const log=upgradeLog(JSON.parse(row.log_json));
      for(const ex of log.exercises){
       if(!wanted.has(ex.variantId))continue;
       const candidates=ex.sets.filter(s=>s.kind!=='warmup'&&s.done&&Number.isInteger(s.reps)&&s.reps>=1&&s.reps<=100).map(s=>({weightKg:s.weightKg??0,reps:s.reps,logId:log.id,finishedAt:log.finishedAt}));
       result[ex.variantId]=bestPerRep([...result[ex.variantId],...candidates]);
      }
     }
     if(rows.length<100)break;
     cursor=rows.at(-1).id;
    }
    return result;
   }finally{tx.close();}
  },
  async lastTime({variantIds,exclude}={}){
   if(!Array.isArray(variantIds)||variantIds.some(v=>typeof v!=='string'))throw domainError('INVALID','Invalid variant ids.');
   if(variantIds.length>WORKOUT_LIMITS.lastTimeIds)throw domainError('INVALID','Too many variant ids.');
   const ids=[...new Set(variantIds)];
   if(!ids.length)return {};
   const rows=(await db.execute({sql:`SELECT variant_id,log_json FROM (
     SELECT v.variant_id,l.log_json,ROW_NUMBER() OVER (PARTITION BY v.variant_id ORDER BY v.finished_at DESC,v.log_id DESC) AS rn
     FROM workout_log_variants v JOIN workout_logs l ON l.id=v.log_id
     WHERE l.status='finished' AND v.variant_id IN (${ids.map(()=>'?').join(',')}) AND v.log_id<>?) WHERE rn=1`,
    args:[...ids,typeof exclude==='string'?exclude:'']})).rows;
   const result={};
   for(const row of rows){
    const log=upgradeLog(JSON.parse(row.log_json));
    const match=log.exercises.find(e=>e.variantId===row.variant_id);
    if(!match)continue;
    result[row.variant_id]={logId:log.id,finishedAt:log.finishedAt,sets:match.sets.map(s=>({weightKg:s.weightKg,reps:s.reps,rir:s.rir,kind:s.kind==='warmup'?'warmup':'working'})),note:match.note??''};
   }
   return result;
  },
 };
}
