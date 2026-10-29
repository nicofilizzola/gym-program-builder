import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDb,migrate} from '../server/db.js';
import {createCatalogRepository} from '../server/catalog-repository.js';
import {createRepository} from '../server/repository.js';
import {createApi} from '../server/api.js';
import {createApiClient} from '../src/api-client.js';
test('tag routes enforce authentication and safely expose revisioned management',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);let signedIn=false;
 const handler=createApi({repository:createRepository(db),catalog:createCatalogRepository(db),auth:{session:async()=>signedIn},origin:'http://localhost'});
 const api=createApiClient({fetch:(url,options={})=>handler(new Request('http://localhost'+url,{...options,headers:{...options.headers,origin:'http://localhost'}}))});
 await assert.rejects(api.listTags(),{status:401});signedIn=true;
 const tag=await api.createTag({id:'brand',kind:'brand',name:'Prime'});assert.equal(tag.revision,1);
 assert.equal((await api.updateTag({id:'brand',revision:1,name:'Panatta'})).revision,2);
 await assert.rejects(api.archiveTag({id:'brand',revision:1,archived:true}),{status:409});
 await api.archiveTag({id:'brand',revision:2,archived:true});assert.equal((await api.listTags())[0].archived,true);
});
