/** Render only text, known headings and list markers. Never interpret provider HTML. */
export function mountAnalysisReport(container){
 let previous='',rows=[];
 return {update(text){
  if(!text.startsWith(previous)){container.replaceChildren();rows=[];}
  const lines=text.split('\n');
  lines.forEach((line,i)=>{
   if(!rows[i]){
    const heading=['Assessment','Strengths','Improvements','Limits'].includes(line);
    const node=document.createElement(heading?'h3':'p');node.className=/^(?:- |\d+\. )/.test(line)?'analysis-finding':'';
    node.append(document.createTextNode(line));container.append(node);rows[i]=node;
   }else if(rows[i].firstChild.data!==line){
    // A partial heading becomes semantic only once its whole line has arrived.
    if(['Assessment','Strengths','Improvements','Limits'].includes(line)&&rows[i].tagName!=='H3'){
     const h=document.createElement('h3');rows[i].replaceWith(h);h.append(rows[i].firstChild);rows[i]=h;
    }
    const node=rows[i].firstChild,old=node.data;if(line.startsWith(old))node.appendData(line.slice(old.length));else node.data=line;
    rows[i].classList.toggle('analysis-finding',/^(?:- |\d+\. )/.test(line));
   }
   rows[i].hidden=!line;
  });previous=text;
 },destroy(){container.replaceChildren();rows=[];previous='';}};
}
