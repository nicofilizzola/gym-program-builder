import {createDocumentCommands} from '../server/document-commands.js';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {createDb,migrate} from '../server/db.js';
import {createAuth,hashPassword} from '../server/auth.js';
import {createRepository} from '../server/repository.js';
import {createApi} from '../server/api.js';
import {createCatalogRepository} from '../server/catalog-repository.js';
import {createProfileRepository} from '../server/profile-repository.js';
import {createWorkoutRepository} from '../server/workout-repository.js';
import {createAnalysisService} from '../server/analysis-service.js';
import {pipeWebResponse} from '../server/http-response.js';
import {seedCatalog} from '../server/catalog-seed.js';
const testing=process.argv.includes('--test'),port=testing?3199:Number(process.env.PORT||3000);
const temp=testing?await mkdtemp(join(tmpdir(),'gym-browser-')):null;
if(!testing&&!process.env.APP_PASSWORD_HASH)throw Error('Set APP_PASSWORD_HASH and AUTH_SECRET in .env.local first.');
const db=createDb({url:testing?`file:${join(temp,'test.db')}`:process.env.TURSO_DATABASE_URL||'file:local.db',authToken:process.env.TURSO_AUTH_TOKEN});
if(testing){await migrate(db);await seedCatalog(db);}
const origin=testing?`http://127.0.0.1:${port}`:process.env.APP_ORIGIN||`http://localhost:${port}`;
const analysis=testing?{enabled:true,analyze:async()=>{
 const report='Assessment\nA test program review.\nStrengths\n- Clear exercise selection.\nImprovements\nNo clear changes needed.\nLimits\nEffort is unknown.';
 return new Response('event: start\ndata: '+JSON.stringify({requestId:'test',promptVersion:'test-program'})+'\n\nevent: delta\ndata: '+JSON.stringify({text:report})+'\n\nevent: complete\ndata: {}\n\n',{headers:{'content-type':'text/event-stream'}});
}}:createAnalysisService({apiKey:process.env.OPENROUTER_API_KEY,model:process.env.OPENROUTER_MODEL});
const api=createApi({repository:createRepository(db),commands:createDocumentCommands(db),catalog:createCatalogRepository(db),profile:createProfileRepository(db),workouts:createWorkoutRepository(db),analysis,auth:createAuth({db,passwordHash:testing?await hashPassword('test-password'):process.env.APP_PASSWORD_HASH,authSecret:testing?'test-only-secret':process.env.AUTH_SECRET}),origin});
const root=resolve('.'),mime={'.js':'text/javascript','.css':'text/css','.html':'text/html'};
const server=createServer(async(req,res)=>{
 try {
  // Keep the host the browser used (localhost or 127.0.0.1) so same-host writes pass; other Host values (DNS rebinding) fall back to the configured origin.
  const host=req.headers.host,loopback=/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host||'');
  const url=new URL(req.url,loopback?`http://${host}`:origin);
  if(url.pathname.startsWith('/api/')) {
   const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
   const abort=new AbortController();const disconnect=()=>{if(!res.writableFinished)abort.abort();};req.once('aborted',disconnect);res.once('close',disconnect);
   try{const request=new Request(url,{method:req.method,headers,signal:abort.signal,...(['GET','HEAD'].includes(req.method)?{}:{body:req,duplex:'half'})});await pipeWebResponse(await api(request),res,{signal:abort.signal});}
   finally{req.off('aborted',disconnect);res.off('close',disconnect);}return;
  }
  const path=decodeURIComponent(url.pathname),file=path==='/'?'/index.html':path;
  if(!['/index.html','/style.css'].includes(file)&&!/^\/src\/[\w-]+\.js$/.test(file)){res.writeHead(404);res.end('Not found');return;}
  const target=resolve(root,`.${file}`);if(!target.startsWith(root+sep))throw Error('Invalid path');
  res.writeHead(200,{'content-type':mime[file.slice(file.lastIndexOf('.'))]||'text/plain','cache-control':'no-store'});res.end(await readFile(target));
 }catch {if(!res.headersSent)res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Gym Program Builder: ${origin}`));
async function shutdown(){server.close();db.close();if(temp)await rm(temp,{recursive:true,force:true,maxRetries:10,retryDelay:100});process.exit(0);}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
