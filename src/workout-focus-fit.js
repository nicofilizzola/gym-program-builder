export const stackHeight=(heights,gap,paddingBlock)=>heights.reduce((a,b)=>a+b,0)+gap*Math.max(0,heights.length-1)+paddingBlock;
/** Pinned block: name-only when the block plus the viewed group cannot fit; row 0 sits under the whole block. Each row fills the space under its pin (whole pixels, never short of it); taller content grows. */
export function fitGroup({feedHeight,nameHeight,detailsHeight,contentHeights,editing=false}){
 const nameOnly=!editing&&nameHeight+detailsHeight+Math.max(...contentHeights)>feedHeight,pinned=nameOnly?nameHeight:nameHeight+detailsHeight;
 return {nameOnly,pinned,rows:contentHeights.map((_,i)=>{const offset=i===0?nameHeight+detailsHeight:pinned;return {offset,minHeight:Math.ceil(feedHeight-offset)};})};
}
/** Superset round: compact (selector names the exercise) once the full panes would crowd the controls; the pane reserves the larger member.
 * The decision uses the full header; a compact round then lays out under its own (tighter) header. */
export function fitPair({feedHeight,headerHeight,fullHeights,compactHeights,compactHeaderHeight=headerHeight}){
 const compact=headerHeight+Math.max(...fullHeights)>feedHeight,header=compact?compactHeaderHeight:headerHeight,paneMinHeight=Math.max(...(compact?compactHeights:fullHeights),feedHeight-header);
 return {compact,minHeight:header+paneMinHeight,paneMinHeight};
}
