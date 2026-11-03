import {MAX_DOCUMENT_BYTES} from '../src/document-file.js';
import {domainError} from './repository.js';
import {WORKOUT_LIMITS} from '../src/workout-log.js';
import {validateProgramAnalysisSnapshot,PROGRAM_ANALYSIS_MAX_BYTES} from '../src/program-analysis-input.js';
const statuses={INVALID:400,UNAUTHORIZED:401,FORBIDDEN:403,NOT_FOUND:404,METHOD:405,CONFLICT:409,IN_USE:409,TOO_LARGE:413,RATE_LIMIT:429};
async function body(request,limit=MAX_DOCUMENT_BYTES,message='Request must be at most 1 MiB.') {
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw domainError('INVALID','Expected JSON.');
  const sizeMessage=message;
  if(Number(request.headers.get('content-length'))>limit)throw domainError('TOO_LARGE',sizeMessage);
  let size=0;const chunks=[];
  if(request.body) {const reader=request.body.getReader();try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw domainError('TOO_LARGE',sizeMessage);}chunks.push(value);}}finally{reader.releaseLock();}}
  try {const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data;}catch {throw domainError('INVALID','Request is not valid JSON.');}
}
export function createApi({repository,commands,catalog,auth,origin,analysis,profile,workouts,clientIp=()=> 'local'}) {
  const respond=(value,status=200,headers={})=>new Response(status===204?null:JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store',...headers}});
  return async request=>{
    try {
      const url=new URL(request.url),path=url.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean),method=request.method;
      const secure=new URL(origin).protocol==='https:';
      if(!['GET','HEAD'].includes(method)&&request.headers.get('origin')!==origin)throw domainError('FORBIDDEN','Cross-origin requests are not allowed.');
      if(path[0]==='auth') {
        if(path[1]==='login'&&method==='POST') {const data=await body(request);const cookie=await auth.login(data.password,clientIp(request),secure);return respond({ok:true},200,{'set-cookie':cookie});}
        if(path[1]==='logout'&&method==='POST')return respond({ok:true},200,{'set-cookie':await auth.logout(request.headers.get('cookie'),secure)});
        if(path[1]==='session'&&method==='GET') {if(!await auth.session(request.headers.get('cookie')))throw domainError('UNAUTHORIZED','Sign in to continue.');return respond({ok:true});}
        throw domainError('METHOD','Method not allowed.');
      }
      if(!await auth.session(request.headers.get('cookie')))throw domainError('UNAUTHORIZED','Sign in to continue.');
      if(path[0]==='analysis'){
        if(path.length===1&&method==='GET')return respond({enabled:Boolean(analysis?.enabled)});
        if(path.length!==2||path[1]!=='program'||method!=='POST')throw domainError('METHOD','Method not allowed.');
        try{
          if(!analysis?.enabled)return respond({error:{code:'CONFIGURATION',message:'Program analysis is not configured.'}},503);
          const data=await body(request,PROGRAM_ANALYSIS_MAX_BYTES,'Program analysis request must be at most 256 KiB.');
          const snapshot=validateProgramAnalysisSnapshot(data.snapshot);
          // The background is server-owned profile data; the validated snapshot never carries a client copy.
          const athlete={trainingBackgroundAndApproach:profile?(await profile.get()).profile.trainingBackgroundAndApproach:''};
          return await analysis.analyze({...snapshot,athlete},{signal:request.signal});
        }catch(error){
          const allowed={INVALID:400,TOO_LARGE:413,CONFIGURATION:503,CREDITS:402,RATE_LIMIT:429,PROVIDER:502,TIMEOUT:504},status=allowed[error.code]||502,details={};
          if(error.code==='INVALID'){
            for(const key of ['occurrenceIndex','exerciseIndex'])if(Number.isInteger(error[key])&&error[key]>=0)details[key]=error[key];
            if(['name','sets','repRange','muscles','restSeconds','equipment'].includes(error.field))details.field=error.field;
          }
          return respond({error:{code:allowed[error.code]?error.code:'PROVIDER',message:allowed[error.code]?error.message:'Analysis is unavailable. Please retry.',...(Object.keys(details).length?{details}:{})}},status);
        }
      }
      if(path[0]==='profile'&&profile){
        if(path.length!==1)throw domainError('NOT_FOUND','Endpoint not found.');
        if(method==='GET')return respond(await profile.get());
        if(method==='PUT')return respond(await profile.update(await body(request)));
        throw domainError('METHOD','Method not allowed.');
      }
      if(path[0]==='workouts'&&workouts){
        if(path.length>2)throw domainError('NOT_FOUND','Endpoint not found.');
        if(path.length===1){
          if(method!=='GET')throw domainError('METHOD','Method not allowed.');
          return respond(await workouts.list({before:url.searchParams.get('before')??undefined,beforeId:url.searchParams.get('beforeId')??undefined}));
        }
        const id=path[1];
        if(id==='active'||id==='last'){
          if(method!=='GET')throw domainError('METHOD','Method not allowed.');
          if(id==='active')return respond({record:await workouts.active()});
          const ids=url.searchParams.get('variantIds');
          return respond({lastTime:ids?await workouts.lastTime({variantIds:ids.split(','),exclude:url.searchParams.get('exclude')??undefined}):{}});
        }
        if(method==='GET')return respond({record:await workouts.get(id)});
        if(method==='PUT')return respond({record:await workouts.save({...await body(request,WORKOUT_LIMITS.bytes,'Request must be at most 256 KiB.'),id})});
        if(method==='DELETE'){
          const text=url.searchParams.get('revision');
          if(!/^\d+$/.test(text??''))throw domainError('INVALID','Invalid revision.');
          await workouts.remove({id,revision:Number(text)});return respond(null,204);
        }
        throw domainError('METHOD','Method not allowed.');
      }
      if(path[0]==='catalog'&&catalog){
        if(path[1]==='tags'){
          if(path.length===2&&method==='GET')return respond({tags:await catalog.listTags({kind:url.searchParams.get('kind')||undefined})});
          if(path.length===2&&method==='POST')return respond({tag:await catalog.createTag(await body(request))},201);
          if(path.length===3&&method==='PUT')return respond({tag:await catalog.updateTag({...await body(request),id:path[2]})});
          if(path.length===4&&path[3]==='archive'&&method==='PUT')return respond({tag:await catalog.archiveTag({...await body(request),id:path[2]})});
          throw domainError('METHOD','Method not allowed.');
        }
        if(path[1]==='references'){
          if(path.length===4&&path[3]==='impact'&&method==='GET')return respond({impact:await catalog.referenceImpact(path[2])});
          if(path.length===2&&method==='POST')return respond({reference:await catalog.createReference(await body(request))},201);
          if(path.length===3&&method==='GET')return respond({reference:await catalog.getReference(path[2])});
          if(path.length===3&&method==='PUT')return respond({reference:await catalog.updateReference({...await body(request),id:path[2]})});
          if(path.length===4&&path[3]==='archive'&&method==='PUT')return respond({reference:await catalog.archiveReference({...await body(request),id:path[2]})});
          throw domainError('METHOD','Method not allowed.');
        }
        if(path.length===3&&path[2]==='reference'&&method==='PUT')return respond({entry:await catalog.move({...await body(request),id:path[1]})});
        if(path.length===1&&method==='GET')return respond(await catalog.list());
        if(path.length===1&&method==='POST')return respond({entry:await catalog.create(await body(request))},201);
        if(path.length===3&&path[1]==='families'&&method==='PUT')return respond({family:await catalog.renameFamily({...await body(request),id:path[2]})});
        if(path.length===3&&path[2]==='impact'&&method==='GET')return respond({impact:await catalog.impact(path[1])});
        if(path.length===3&&path[2]==='archive'&&method==='PUT')return respond({entry:await catalog.archive({...await body(request),id:path[1]})});
        if(path.length===2&&method==='PUT')return respond({entry:await catalog.update({...await body(request),id:path[1]})});
        throw domainError('METHOD','Method not allowed.');
      }
      if(path[0]==='document-commands'&&path.length===2&&method==='POST'&&commands){
        if(path[1]==='attach')return respond(await commands.createAndAttach(await body(request)));
        if(path[1]==='import')return respond(await commands.importDocument(await body(request)));
      }
      if(path[0]==='documents'&&path.length===3&&method==='GET'){
        if(path[2]==='bundle')return respond(await repository.programBundle(path[1]));
        if(path[2]==='usage')return respond({programs:await repository.templateUsage(path[1])});
      }
      if(path[0]!=='documents'||path.length>2)throw domainError('NOT_FOUND','Endpoint not found.');
      const id=path[1];
      if(!id&&method==='GET')return respond({records:await repository.list(url.searchParams.get('kind'))});
      if(!id&&method==='POST')return respond({record:await repository.create(await body(request))},201);
      if(id&&method==='GET')return respond({record:await repository.get(id)});
      if(id&&method==='PUT')return respond({record:await repository.update({...await body(request),id})});
      if(id&&method==='DELETE') {await repository.remove({...await body(request),id});return respond(null,204);}
      throw domainError('METHOD','Method not allowed.');
    } catch(error) {const status=statuses[error.code]||503;return respond({error:{code:status===503?'UNAVAILABLE':error.code,message:status===503?'Storage is unavailable. Please retry.':error.message,...(error.code==='IN_USE'||error.code==='CONFLICT'&&error.details?{details:error.details}:{})}},status);}
  };
}
