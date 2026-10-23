import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('static build removes stale private files and publishes only browser assets',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gym-build-'));
 try{
  await mkdir(join(dir,'src'));await mkdir(join(dir,'public'));await writeFile(join(dir,'index.html'),'<main>Public</main>');await writeFile(join(dir,'style.css'),'body{}');await writeFile(join(dir,'src','app.js'),'console.log("app")');
  await writeFile(join(dir,'public','.env'),'PRIVATE');await writeFile(join(dir,'local.db'),'PRIVATE');
  execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/build-static.js',import.meta.url))],{cwd:dir});
  assert.equal(await readFile(join(dir,'public','index.html'),'utf8'),'<main>Public</main>');
  await assert.rejects(access(join(dir,'public','.env')));await assert.rejects(access(join(dir,'public','local.db')));
 }finally{await rm(dir,{recursive:true,force:true,maxRetries:5});}
});
