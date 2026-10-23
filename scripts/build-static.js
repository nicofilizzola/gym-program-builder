import {mkdir,copyFile,cp} from 'node:fs/promises';
await mkdir('public',{recursive:true});
for(const file of ['index.html','style.css'])await copyFile(file,`public/${file}`);
await cp('src','public/src',{recursive:true});
console.log('Built public assets.');
