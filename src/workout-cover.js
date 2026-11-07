/** Fixed portable identities; assets and credits are shipped with the application. */
export const WORKOUT_COVERS=Object.freeze([
 ['gym','Gym'],['dumbbells','Dumbbells'],['barbell','Barbell'],['machines','Machines'],
].map(([id,label])=>Object.freeze({id,label,src:`/src/assets/workout-covers/${id}.webp`,width:667,height:1000,objectPosition:'50% 50%',credit:'/src/assets/workout-covers/CREDITS.md'})));
export function normalizeWorkoutCover(value=undefined){
 if(value===undefined)return 'gym';
 if(typeof value!=='string'||!WORKOUT_COVERS.some(cover=>cover.id===value))throw Error('Invalid workout cover.');
 return value;
}
export const workoutCover=id=>WORKOUT_COVERS.find(cover=>cover.id===normalizeWorkoutCover(id));
