export async function migrateCatalogMetadata(tx){
 await tx.execute('INSERT INTO catalog_equipment_backup SELECT id,family_id,equipment FROM catalog_entries');
 await tx.execute('UPDATE catalog_families SET equipment=(SELECT CASE WHEN count(DISTINCT e.equipment)=1 THEN min(e.equipment) END FROM catalog_entries e WHERE e.family_id=catalog_families.id)');
 const counts=(await tx.execute('SELECT sum(equipment IS NOT NULL) AS configured,sum(equipment IS NULL) AS unconfigured FROM catalog_families')).rows[0];
 return {configured:Number(counts.configured||0),unconfigured:Number(counts.unconfigured||0)};
}
