export type ViewState={zoom:number;panX:number;panY:number};
export const initialView:ViewState={zoom:1,panX:0,panY:0};
export const clampZoom=(zoom:number)=>Math.min(6,Math.max(.55,zoom));
export function zoomView(view:ViewState,factor:number,baseWidth:number,baseHeight:number):ViewState{
  if(!Number.isFinite(factor)||factor<=0)return view;
  const next=clampZoom(view.zoom*factor);
  const dw=baseWidth/view.zoom-baseWidth/next;
  const dh=baseHeight/view.zoom-baseHeight/next;
  return {zoom:next,panX:view.panX+dw/2,panY:view.panY+dh/2};
}
export function panView(view:ViewState,clientDx:number,clientDy:number,
  pixelsPerWorld:number):ViewState{
  if(!Number.isFinite(pixelsPerWorld)||pixelsPerWorld<=0)return view;
  return {...view,panX:view.panX-clientDx/pixelsPerWorld,panY:view.panY-clientDy/pixelsPerWorld};
}
export function pixelScale(zoom:number,baseWidth:number,baseHeight:number,pixelWidth:number,pixelHeight:number){
  return Math.min(pixelWidth/(baseWidth/zoom),pixelHeight/(baseHeight/zoom));
}
