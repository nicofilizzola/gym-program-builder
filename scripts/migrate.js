import {createDb,migrate} from '../server/db.js';
const db=createDb({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
try {await migrate(db);console.log('Database migrations applied.');} finally {db.close();}
