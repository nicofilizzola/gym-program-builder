/** A card shows the next set's whole header below it, or no peek at all — never a partial one. */
export function focusCardFit({feedHeight,contentHeight,peekHeight}){
 if(peekHeight>0&&contentHeight+peekHeight<=feedHeight)return {minHeight:Math.round(feedHeight-peekHeight),peekless:false};
 return {minHeight:feedHeight,peekless:true};
}
export const stackHeight=(heights,gap,paddingBlock)=>heights.reduce((a,b)=>a+b,0)+gap*Math.max(0,heights.length-1)+paddingBlock;
