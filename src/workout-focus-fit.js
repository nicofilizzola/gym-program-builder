/** A card shows the next set's whole header below it, or no peek at all — never a partial one. */
export function focusCardFit({feedHeight,contentHeight,peekHeight}){
 if(peekHeight>0&&contentHeight+peekHeight<=feedHeight)return {minHeight:Math.round(feedHeight-peekHeight),peekless:false};
 return {minHeight:feedHeight,peekless:true};
}
export const stackHeight=(heights,gap,paddingBlock)=>heights.reduce((a,b)=>a+b,0)+gap*Math.max(0,heights.length-1)+paddingBlock;
/** Pinned block: name-only when the block plus the viewed group cannot fit; row 0 sits under the whole block. */
export function fitGroup({feedHeight,nameHeight,detailsHeight,contentHeights,peekHeights,editing=false}){
 const nameOnly=!editing&&nameHeight+detailsHeight+Math.max(...contentHeights)>feedHeight,pinned=nameOnly?nameHeight:nameHeight+detailsHeight;
 return {nameOnly,pinned,rows:contentHeights.map((contentHeight,i)=>{
  const offset=i===0?nameHeight+detailsHeight:pinned;
  return {offset,...focusCardFit({feedHeight:feedHeight-offset,contentHeight,peekHeight:peekHeights[i]})};
 })};
}
