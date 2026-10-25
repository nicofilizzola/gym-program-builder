import {validateCatalogEntry} from '../src/catalog.js';
// Hand-curated starter definitions. Secondary muscles are counted as half sets.
// IDs are stable; changes to this fixture must not overwrite personal edits.
const groups=[
 ['bench','Bench press',[
  ['Barbell bench press','Barbell',['Chest'],['Triceps','Front delts']],
  ['Incline barbell bench press','Barbell',['Chest'],['Triceps','Front delts']],
  ['Dumbbell bench press','Dumbbell',['Chest'],['Triceps','Front delts']],
  ['Incline dumbbell bench press','Dumbbell',['Chest'],['Triceps','Front delts']],
  ['Machine chest press','Machine',['Chest'],['Triceps','Front delts']],
  ['Close-grip bench press','Barbell',['Triceps'],['Chest','Front delts']]]],
 ['fly','Chest fly',[
  ['Cable chest fly','Cable',['Chest'],['Front delts']],['Dumbbell chest fly','Dumbbell',['Chest'],['Front delts']],['Pec deck','Machine',['Chest'],[]]]],
 ['pushup','Push-up',[
  ['Push-up','Bodyweight',['Chest'],['Triceps','Front delts']],['Diamond push-up','Bodyweight',['Triceps'],['Chest','Front delts']]]],
 ['dip','Dip',[['Parallel-bar dip','Bodyweight',['Chest','Triceps'],['Front delts']],['Machine assisted dip','Machine',['Chest','Triceps'],['Front delts']]]],
 ['pullup','Vertical pull',[
  ['Pull-up','Bodyweight',['Lats'],['Biceps','Upper back']],['Chin-up','Bodyweight',['Lats'],['Biceps','Upper back']],['Lat pulldown','Cable',['Lats'],['Biceps','Upper back']],['Neutral-grip pulldown','Cable',['Lats'],['Biceps','Upper back']],['Straight-arm pulldown','Cable',['Lats'],[]]]],
 ['row','Row',[
  ['Barbell row','Barbell',['Upper back','Lats'],['Biceps','Rear delts']],['Dumbbell row','Dumbbell',['Lats','Upper back'],['Biceps','Rear delts']],['Seated cable row','Cable',['Upper back','Lats'],['Biceps','Rear delts']],['Chest-supported machine row','Machine',['Upper back'],['Lats','Biceps','Rear delts']],['Inverted row','Bodyweight',['Upper back'],['Lats','Biceps','Rear delts']]]],
 ['overhead','Overhead press',[
  ['Barbell overhead press','Barbell',['Front delts'],['Triceps','Side delts']],['Dumbbell shoulder press','Dumbbell',['Front delts'],['Triceps','Side delts']],['Machine shoulder press','Machine',['Front delts'],['Triceps','Side delts']]]],
 ['lateral','Lateral raise',[
  ['Dumbbell lateral raise','Dumbbell',['Side delts'],[]],['Cable lateral raise','Cable',['Side delts'],[]],['Machine lateral raise','Machine',['Side delts'],[]]]],
 ['rear','Rear delt fly',[
  ['Dumbbell reverse fly','Dumbbell',['Rear delts'],['Upper back']],['Reverse pec deck','Machine',['Rear delts'],['Upper back']],['Cable face pull','Cable',['Rear delts','Upper back'],[]]]],
 ['curl','Biceps curl',[
  ['Barbell curl','Barbell',['Biceps'],[]],['Dumbbell curl','Dumbbell',['Biceps'],[]],['Hammer curl','Dumbbell',['Biceps'],[]],['Cable curl','Cable',['Biceps'],[]],['Preacher curl machine','Machine',['Biceps'],[]]]],
 ['extension','Triceps extension',[
  ['Cable triceps pushdown','Cable',['Triceps'],[]],['Overhead cable triceps extension','Cable',['Triceps'],[]],['Dumbbell triceps extension','Dumbbell',['Triceps'],[]],['Lying barbell triceps extension','Barbell',['Triceps'],[]]]],
 ['squat','Squat',[
  ['Barbell back squat','Barbell',['Quads'],[]],['Barbell front squat','Barbell',['Quads'],['Abs']],['Goblet squat','Dumbbell',['Quads'],[]],['Hack squat','Machine',['Quads'],[]],['Bodyweight squat','Bodyweight',['Quads'],[]]]],
 ['lunge','Single-leg squat',[
  ['Dumbbell split squat','Dumbbell',['Quads'],[]],['Dumbbell walking lunge','Dumbbell',['Quads'],[]],['Bulgarian split squat','Dumbbell',['Quads'],[]]]],
 ['legpress','Leg press',[['Leg press','Machine',['Quads'],[]],['Leg extension','Machine',['Quads'],[]]]],
 ['hinge','Hip hinge',[
  ['Barbell Romanian deadlift','Barbell',['Hamstrings'],[]],['Dumbbell Romanian deadlift','Dumbbell',['Hamstrings'],[]],['Single-leg Romanian deadlift','Dumbbell',['Hamstrings'],[]]]],
 ['legcurl','Leg curl',[
  ['Seated leg curl','Machine',['Hamstrings'],[]],['Lying leg curl','Machine',['Hamstrings'],[]],['Nordic curl','Bodyweight',['Hamstrings'],[]]]],
 ['calf','Calf raise',[
  ['Standing calf raise','Machine',['Calves'],[]],['Seated calf raise','Machine',['Calves'],[]],['Dumbbell calf raise','Dumbbell',['Calves'],[]]]],
 ['abs','Abdominal exercise',[
  ['Cable crunch','Cable',['Abs'],[]],['Hanging knee raise','Bodyweight',['Abs'],[]],['Reverse crunch','Bodyweight',['Abs'],[]],['Machine crunch','Machine',['Abs'],[]]]]
];
const slug=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
export const STARTER_CATALOG=groups.flatMap(([id,familyName,items])=>items.map(([name,equipment,primaryMuscles,secondaryMuscles])=>({id:'seed-'+slug(name),familyId:'seed-family-'+id,familyName,...validateCatalogEntry({name,equipment,primaryMuscles,secondaryMuscles}).entry})));
export async function seedCatalog(db) {
  const tx=await db.transaction('write');
  try {
    if(!(await tx.execute('SELECT version FROM catalog_seed_versions WHERE version=1')).rows.length) {
      for(const e of STARTER_CATALOG) {
        await tx.execute({sql:'INSERT OR IGNORE INTO catalog_families(id,name) VALUES(?,?)',args:[e.familyId,e.familyName]});
        const stamp=new Date().toISOString();
        await tx.execute({sql:'INSERT OR IGNORE INTO catalog_entries(id,family_id,name,equipment,primary_json,secondary_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',args:[e.id,e.familyId,e.name,e.equipment,JSON.stringify(e.primaryMuscles),JSON.stringify(e.secondaryMuscles),stamp,stamp]});
      }
      await tx.execute('INSERT INTO catalog_seed_versions VALUES(1)');
    }
    await tx.commit();
  }finally{tx.close();}
}
