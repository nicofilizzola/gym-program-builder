/** Library display naming only; record identity and template links remain independent. */
export function duplicateName(sourceName,existingNames,fallback){
 const base=sourceName.trim()||fallback,used=new Set(existingNames.map(name=>name.trim().toLocaleLowerCase()));
 let suffix=1;while(used.has(`${base} ${suffix}`.toLocaleLowerCase()))suffix++;
 return `${base} ${suffix}`;
}
