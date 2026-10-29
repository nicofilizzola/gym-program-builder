import {createDocumentCommands} from '../server/document-commands.js';
import {createDb} from '../server/db.js';
import {createRepository} from '../server/repository.js';
import {createAuth} from '../server/auth.js';
import {createApi} from '../server/api.js';
import {createCatalogRepository} from '../server/catalog-repository.js';
import {createAnalysisService} from '../server/analysis-service.js';
let handler;
export default {
  async fetch(request) {
    try {
      if(!handler) {
        const db=createDb({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
        handler=createApi({repository:createRepository(db),commands:createDocumentCommands(db),catalog:createCatalogRepository(db),analysis:createAnalysisService({apiKey:process.env.OPENROUTER_API_KEY,model:process.env.OPENROUTER_MODEL}),auth:createAuth({db,passwordHash:process.env.APP_PASSWORD_HASH,authSecret:process.env.AUTH_SECRET}),origin:process.env.APP_ORIGIN,clientIp:req=>process.env.VERCEL?req.headers.get('x-vercel-forwarded-for')||'unknown':'local'});
      }
      const url=new URL(request.url);
      if(url.pathname==='/api'||url.pathname==='/api/index') {
        const route=url.searchParams.get('route');
        if(route){url.pathname=`/api/${route.replace(/^\//,'')}`;url.searchParams.delete('route');request=new Request(url,request);}
      }
      return await handler(request);
    } catch {return Response.json({error:{code:'UNAVAILABLE',message:'Server is not configured or storage is unavailable.'}},{status:503,headers:{'cache-control':'no-store'}});}
  }
};
