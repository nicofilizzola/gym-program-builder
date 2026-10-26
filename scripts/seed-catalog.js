import {createDb} from '../server/db.js';
import {seedCatalog} from '../server/catalog-seed.js';
const db=createDb({url:process.env.TURSO_DATABASE_URL||'file:local.db',authToken:process.env.TURSO_AUTH_TOKEN});
try {await seedCatalog(db);console.log('Exercise catalog seeded (existing entries preserved).');}finally{db.close();}
