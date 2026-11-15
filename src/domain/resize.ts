import type {Floor,Furniture,Point} from './model';
import {polygonArea,roomPolygon} from './geometry';
import {snapValue} from './snap';
import type {SnapStep} from './snap';

export type FurnitureCorner='nw'|'ne'|'se'|'sw';
export const FURNITURE_CORNERS:readonly FurnitureCorner[]=['nw','ne','se','sw'];
const signs:Record<FurnitureCorner,[number,number]>={
  nw:[-1,-1],ne:[1,-1],se:[1,1],sw:[-1,1]
};
export function furnitureCorner(f:Furniture,corner:FurnitureCorner):Point{
  const [sx,sy]=signs[corner],angle=f.rotation*Math.PI/180;
  const dx=sx*f.width/2,dy=sy*f.depth/2;
  return {x:f.x+f.width/2+dx*Math.cos(angle)-dy*Math.sin(angle),
    y:f.y+f.depth/2+dx*Math.sin(angle)+dy*Math.cos(angle)};
}
/** Resizes an oriented rectangle, holding the diagonally opposite corner fixed. */
export function resizeFurnitureCorner(f:Furniture,corner:FurnitureCorner,point:Point,step:SnapStep):
  Pick<Furniture,'x'|'y'|'width'|'depth'>{
  const opposite=FURNITURE_CORNERS[(FURNITURE_CORNERS.indexOf(corner)+2)%4];
  const anchor=furnitureCorner(f,opposite);
  const [sx,sy]=signs[corner],angle=f.rotation*Math.PI/180;
  const c=Math.cos(angle),s=Math.sin(angle);
  const dx=point.x-anchor.x,dy=point.y-anchor.y;
  const localX=dx*c+dy*s,localY=-dx*s+dy*c;
  const width=Math.max(.25,snapValue(localX*sx,step));
  const depth=Math.max(.25,snapValue(localY*sy,step));
  const centerX=anchor.x+(sx*width*c-sy*depth*s)/2;
  const centerY=anchor.y+(sx*width*s+sy*depth*c)/2;
  const round=(v:number)=>Math.round(v*1000)/1000;
  return {x:round(centerX-width/2),y:round(centerY-depth/2),width,depth};
}

export type RoomEdge='left'|'right'|'top'|'bottom';
export const ROOM_EDGES:readonly RoomEdge[]=['left','right','top','bottom'];
export type RoomBox={minX:number;maxX:number;minY:number;maxY:number};
const EPS=1e-5;
export function rectangularRoomBounds(floor:Floor,roomId:string):RoomBox|null{
  const room=floor.rooms.find(r=>r.id===roomId);if(!room)return null;
  const p=roomPolygon(floor,room);
  if(p.length<4||p.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)))return null;
  const box={minX:Math.min(...p.map(v=>v.x)),maxX:Math.max(...p.map(v=>v.x)),
    minY:Math.min(...p.map(v=>v.y)),maxY:Math.max(...p.map(v=>v.y))};
  const width=box.maxX-box.minX,height=box.maxY-box.minY;
  if(width<.5||height<.5||Math.abs(polygonArea(p)-width*height)>EPS)return null;
  for(let i=0;i<p.length;i++){
    const a=p[i],b=p[(i+1)%p.length];
    if(Math.abs(a.x-b.x)>EPS&&Math.abs(a.y-b.y)>EPS)return null;
  }
  return box;
}
function roomVertexIds(floor:Floor,roomId:string):Set<string>{
  const room=floor.rooms.find(r=>r.id===roomId);
  const walls=new Map(floor.walls.map(w=>[w.id,w]));
  const ids=new Set<string>();
  for(const link of room?.boundary??[]){
    const w=walls.get(link.wallId);if(w){ids.add(w.a);ids.add(w.b);}
  }
  return ids;
}
/** Blocks resizing an edge whose vertices also define another room.
 * This avoids silently stretching adjacent rooms or breaking shared-wall topology.
 */
export function resizableRoomEdges(floor:Floor,roomId:string):RoomEdge[]{
  const box=rectangularRoomBounds(floor,roomId);if(!box)return [];
  const roomIds=roomVertexIds(floor,roomId);
  const shared=new Set(floor.rooms.filter(r=>r.id!==roomId).flatMap(r=>[...roomVertexIds(floor,r.id)]));
  const edgeVertices=(edge:RoomEdge)=>[...roomIds].filter(id=>{
    const v=floor.vertices.find(v=>v.id===id);if(!v)return false;
    return Math.abs((edge==='left'?v.x-box.minX:edge==='right'?v.x-box.maxX:
      edge==='top'?v.y-box.minY:v.y-box.maxY))<EPS;
  });
  return ROOM_EDGES.filter(edge=>{
    const ids=edgeVertices(edge);
    return ids.length>=2&&ids.every(id=>!shared.has(id));
  });
}
export function proposedRoomBounds(box:RoomBox,edge:RoomEdge,coordinate:number,step:SnapStep):RoomBox{
  const next={...box};
  const value=snapValue(coordinate,step);
  if(edge==='left')next.minX=Math.min(value,box.maxX-.5);
  else if(edge==='right')next.maxX=Math.max(value,box.minX+.5);
  else if(edge==='top')next.minY=Math.min(value,box.maxY-.5);
  else next.maxY=Math.max(value,box.minY+.5);
  return next;
}
/** Changes only the selected room's non-shared edge vertices; uses exact connectivity IDs. */
export function resizeRoomEdge(floor:Floor,roomId:string,edge:RoomEdge,coordinate:number,step:SnapStep):void{
  const box=rectangularRoomBounds(floor,roomId);
  if(!box||!resizableRoomEdges(floor,roomId).includes(edge))
    throw Error('この辺は共有壁または非矩形のため直接変更できません');
  const next=proposedRoomBounds(box,edge,coordinate,step);
  const axis=edge==='left'||edge==='right'?'x':'y';
  const start=edge==='left'?box.minX:edge==='right'?box.maxX:edge==='top'?box.minY:box.maxY;
  const end=edge==='left'?next.minX:edge==='right'?next.maxX:edge==='top'?next.minY:next.maxY;
  const ids=roomVertexIds(floor,roomId);
  for(const v of floor.vertices){
    if(ids.has(v.id)&&Math.abs(v[axis]-start)<EPS)v[axis]=end;
  }
}
export function roomEdgeMidpoint(box:RoomBox,edge:RoomEdge):Point{
  const cx=(box.minX+box.maxX)/2,cy=(box.minY+box.maxY)/2;
  if(edge==='left')return {x:box.minX,y:cy};
  if(edge==='right')return {x:box.maxX,y:cy};
  if(edge==='top')return {x:cx,y:box.minY};
  return {x:cx,y:box.maxY};
}
