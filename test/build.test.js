import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readdir} from 'node:fs/promises';
test('all published browser sources are valid UTF-8',async()=>{
 const root=new URL('../',import.meta.url),files=['index.html','style.css',...(await readdir(new URL('src/',root))).filter(f=>f.endsWith('.js')).map(f=>`src/${f}`)];
 for(const file of files)new TextDecoder('utf-8',{fatal:true}).decode(await readFile(new URL(file,root)));
});
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
