/** Arm before the triggering action; existing workflow tests need no native-dialog handler. */
export async function answerNextConfirmation(page,accept){
 await page.evaluate(accept=>{
  const observer=new MutationObserver(()=>{
   const button=document.querySelector('.confirm-dialog[open] '+(accept?'[data-confirm-accept]':'[data-confirm-cancel]'));
   if(button){observer.disconnect();button.click();}
  });
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 },accept);
}
