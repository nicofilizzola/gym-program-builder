/** Exercise the public navigation at either breakpoint without assuming the old mobile tabs. */
export async function openLibrarySection(page,section){
 const main=page.getByRole('navigation',{name:'Main'}),library=main.getByRole('link',{name:'Library',exact:true});
 const names={programs:['Programs','Programs'],templates:['Templates','Session templates'],catalog:['Exercises','Exercise catalog']};
 if(await library.isVisible()){
  await library.click();await page.getByRole('navigation',{name:'Library sections'}).getByRole('link',{name:names[section][0],exact:true}).click();
 }else await main.getByRole('link',{name:names[section][1],exact:true}).click();
}
