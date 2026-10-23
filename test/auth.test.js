import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDb,migrate} from '../server/db.js';
import {createAuth,hashPassword} from '../server/auth.js';
test('password sessions expire, revoke and persist rate limiting between instances',async t=>{
 const db=createDb({url:'file::memory:'});t.after(()=>db.close());await migrate(db);
 let now=1000000;const options={db,passwordHash:await hashPassword('secret'),authSecret:'test-secret',now:()=>now};
 const auth=createAuth(options);const cookie=await auth.login('secret','client',true);
 assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
 const token=cookie.split(';')[0];assert.equal(await auth.session(token),true);
 await auth.logout(token);assert.equal(await auth.session(token),false);
 for(let i=0;i<5;i++) await assert.rejects(createAuth(options).login('wrong','client',true),{code:'UNAUTHORIZED'});
 await assert.rejects(auth.login('secret','client',true),{code:'RATE_LIMIT'});
 now+=15*60*1000+1;const fresh=await auth.login('secret','client',true);
 now+=31*86400000;assert.equal(await auth.session(fresh.split(';')[0]),false);
});
