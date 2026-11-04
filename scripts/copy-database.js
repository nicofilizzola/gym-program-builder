import {resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {createDb} from '../server/db.js';
import {copyDatabase} from '../server/copy-database.js';

const usage='Usage: node --env-file=<environment file> scripts/copy-database.js --from <path to .db file>\nCopies every data row into the empty, migrated database named by TURSO_DATABASE_URL.';
let from;
try {({values:{from}}=parseArgs({options:{from:{type:'string'}}}));} catch {}
const url=process.env.TURSO_DATABASE_URL;
if(!from||!url) {console.error(usage);process.exit(2);}
const sourceUrl='file:'+resolve(from);
if(url.startsWith('file:')&&resolve(url.slice(5))===resolve(from)) {console.error('Source and target are the same database.');process.exit(2);}
const source=createDb({url:sourceUrl}),target=createDb({url,authToken:process.env.TURSO_AUTH_TOKEN});
try {
  const counts=await copyDatabase(source,target);
  for(const [table,count] of Object.entries(counts))console.log(`${table}: ${count}`);
  console.log('Database copied.');
} catch(error) {console.error(error.message);process.exitCode=1;}
finally {source.close();target.close();}
