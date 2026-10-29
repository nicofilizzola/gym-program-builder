import {pathToFileURL} from 'node:url';
import {createDb} from '../server/db.js';

/** Read-only cleanup report. Neither migration nor seeding is performed here. */
export async function equipmentReport(db){
 const rows=await db.execute("SELECT f.id,f.name,(SELECT json_group_array(DISTINCT b.equipment) FROM catalog_equipment_backup b WHERE b.reference_id=f.id) AS previous_values FROM catalog_families f WHERE f.equipment IS NULL ORDER BY f.name,f.id");
 return rows.rows.map(row=>({id:row.id,name:row.name,equipmentValues:JSON.parse(row.previous_values||'[]').sort()}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const db=createDb({url:process.env.TURSO_DATABASE_URL||'file:local.db',authToken:process.env.TURSO_AUTH_TOKEN});
 try{const rows=await equipmentReport(db);console.table(rows.map(row=>({...row,equipmentValues:row.equipmentValues.join(', ')||'No variants'})));console.log(rows.length+' reference exercise(s) need an equipment choice.');}finally{db.close();}
}
