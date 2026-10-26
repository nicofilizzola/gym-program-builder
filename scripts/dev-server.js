import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {createDb,migrate} from '../server/db.js';
import {createAuth,hashPassword} from '../server/auth.js';
import {createRepository} from '../server/repository.js';
import {createApi} from '../server/api.js';
import {createCatalogRepository} from '../server/catalog-repository.js';
import {seedCatalog} from '../server/catalog-seed.js';
const testing=process.argv.includes('--test'),port=testing?3199:Number(process.env.PORT||3000);
const temp=testing?await mkdtemp(join(tmpdir(),'gym-browser-')):null;
if(!testing&&!process.env.APP_PASSWORD_HASH)throw Error('Set APP_PASSWORD_HASH and AUTH_SECRET in .env.local first.');
const db=createDb({url:testing?`file:${join(temp,'test.db')}`:process.env.TURSO_DATABASE_URL||'file:local.db',authToken:process.env.TURSO_AUTH_TOKEN});
if(testing){await migrate(db);await seedCatalog(db);}
const origin=testing?`http://127.0.0.1:${port}`:process.env.APP_ORIGIN||`http://localhost:${port}`;
const api=createApi({repository:createRepository(db),catalog:createCatalogRepository(db),auth:createAuth({db,passwordHash:testing?await hashPassword('test-password'):process.env.APP_PASSWORD_HASH,authSecret:testing?'test-only-secret':process.env.AUTH_SECRET}),origin});
const root=resolve('.'),mime={'.js':'text/javascript','.css':'text/css','.html':'text/html'};
const server=createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,origin);
  if(url.pathname.startsWith('/api/')) {
   const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
   const request=new Request(url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:req,duplex:'half'})});
   const response=await api(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
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
