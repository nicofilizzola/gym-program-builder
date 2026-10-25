import {MAX_DOCUMENT_BYTES} from '../src/document-file.js';
import {domainError} from './repository.js';
const statuses={INVALID:400,UNAUTHORIZED:401,FORBIDDEN:403,NOT_FOUND:404,METHOD:405,CONFLICT:409,TOO_LARGE:413,RATE_LIMIT:429};
async function body(request) {
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw domainError('INVALID','Expected JSON.');
  if(Number(request.headers.get('content-length'))>MAX_DOCUMENT_BYTES)throw domainError('TOO_LARGE','Request must be at most 1 MiB.');
  let size=0;const chunks=[];
  if(request.body) {const reader=request.body.getReader();while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_DOCUMENT_BYTES){await reader.cancel();throw domainError('TOO_LARGE','Request must be at most 1 MiB.');}chunks.push(value);}}
  try {const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data;}catch {throw domainError('INVALID','Request is not valid JSON.');}
}
export function createApi({repository,catalog,auth,origin,clientIp=()=> 'local'}) {
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
      if(path[0]==='catalog'&&catalog){
        if(path.length===1&&method==='GET')return respond(await catalog.list());
        if(path.length===1&&method==='POST')return respond({entry:await catalog.create(await body(request))},201);
        if(path.length===3&&path[1]==='families'&&method==='PUT')return respond({family:await catalog.renameFamily({...await body(request),id:path[2]})});
        if(path.length===3&&path[2]==='impact'&&method==='GET')return respond({impact:await catalog.impact(path[1])});
        if(path.length===3&&path[2]==='archive'&&method==='PUT')return respond({entry:await catalog.archive({...await body(request),id:path[1]})});
        if(path.length===2&&method==='PUT')return respond({entry:await catalog.update({...await body(request),id:path[1]})});
        throw domainError('METHOD','Method not allowed.');
      }
      if(path[0]!=='documents'||path.length>2)throw domainError('NOT_FOUND','Endpoint not found.');
      const id=path[1];
      if(!id&&method==='GET')return respond({records:await repository.list(url.searchParams.get('kind'))});
      if(!id&&method==='POST')return respond({record:await repository.create(await body(request))},201);
      if(id&&method==='GET')return respond({record:await repository.get(id)});
      if(id&&method==='PUT')return respond({record:await repository.update({...await body(request),id})});
      if(id&&method==='DELETE') {await repository.remove({...await body(request),id});return respond(null,204);}
      throw domainError('METHOD','Method not allowed.');
    } catch(error) {const status=statuses[error.code]||503;return respond({error:{code:status===503?'UNAVAILABLE':error.code,message:status===503?'Storage is unavailable. Please retry.':error.message}},status);}
  };
}
