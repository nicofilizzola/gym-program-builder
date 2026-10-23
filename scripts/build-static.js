import {mkdir,copyFile,cp,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const output=resolve('public');
if(dirname(output)!==process.cwd())throw Error('Build output must be inside this workspace.');
await rm(output,{recursive:true,force:true});
await mkdir('public',{recursive:true});
for(const file of ['index.html','style.css'])await copyFile(file,`public/${file}`);
await cp('src','public/src',{recursive:true});
console.log('Built public assets.');
