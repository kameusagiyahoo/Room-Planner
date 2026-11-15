import type {Floor,Point} from './model';
import {openingMidpoint,wallPoints} from './geometry';
import {offsetForPoint} from './openings';
import {rectangularRoomBounds,ROOM_EDGES} from './resize';
import type {RoomEdge,RoomBox} from './resize';
import {snapValue} from './snap';
import type {SnapStep} from './snap';
import {validateFloor} from './validation';

type Axis='x'|'y';
export type SharedPartition={
  wallId:string;wallIds:string[];roomIds:string[];axis:Axis;
  coordinate:number;low:number;high:number;minCoordinate:number;maxCoordinate:number;
  vertexIds:string[];
};
const EPS=1e-5;
const equal=(a:number,b:number)=>Math.abs(a-b)<EPS;
function roomsForWall(f:Floor,wallId:string):string[]{
  return f.rooms.filter(r=>r.boundary.some(b=>b.wallId===wallId)).map(r=>r.id);
}
function axisLine(f:Floor,wallId:string):{axis:Axis;coordinate:number;low:number;high:number}|null{
  const wall=f.walls.find(w=>w.id===wallId),p=wall&&wallPoints(f,wall);
  if(!p)return null;
  const [a,b]=p;
  if(equal(a.x,b.x)&&!equal(a.y,b.y))
    return {axis:'x',coordinate:a.x,low:Math.min(a.y,b.y),high:Math.max(a.y,b.y)};
  if(equal(a.y,b.y)&&!equal(a.x,b.x))
    return {axis:'y',coordinate:a.y,low:Math.min(a.x,b.x),high:Math.max(a.x,b.x)};
  return null;
}
type Segment={wallId:string;low:number;high:number;roomIds:string[]};
function roomSide(f:Floor,id:string,axis:Axis,value:number):{
  box:RoomBox;edge:RoomEdge;low:number;high:number;limit:number
}|null{
  const box=rectangularRoomBounds(f,id);
  if(!box)return null;
  if(axis==='x'){
    if(equal(box.maxX,value))return {box,edge:'right',low:box.minY,high:box.maxY,limit:box.minX+.5};
    if(equal(box.minX,value))return {box,edge:'left',low:box.minY,high:box.maxY,limit:box.maxX-.5};
  }else{
    if(equal(box.maxY,value))return {box,edge:'bottom',low:box.minX,high:box.maxX,limit:box.minY+.5};
    if(equal(box.minY,value))return {box,edge:'top',low:box.minX,high:box.maxX,limit:box.maxY-.5};
  }
  return null;
}
/** Finds a complete straight internal partition even when a T-junction splits it
 * among three or more rectangular rooms. Partial room-side edits are rejected.
 */
export function sharedPartitionForWall(f:Floor,wallId:string):SharedPartition|null{
  const selected=axisLine(f,wallId);if(!selected||roomsForWall(f,wallId).length!==2)return null;
  const candidates:Segment[]=f.walls.flatMap(w=>{
    const line=axisLine(f,w.id),ids=roomsForWall(f,w.id);
    return line&&ids.length===2&&line.axis===selected.axis&&equal(line.coordinate,selected.coordinate)?
      [{wallId:w.id,low:line.low,high:line.high,roomIds:ids}]:[];
  }).sort((a,b)=>a.low-b.low||a.high-b.high);
  const index=candidates.findIndex(s=>s.wallId===wallId);
  if(index<0)return null;
  let start=index,end=index;
  while(start>0&&equal(candidates[start-1].high,candidates[start].low))start--;
  while(end<candidates.length-1&&equal(candidates[end].high,candidates[end+1].low))end++;
  const chain=candidates.slice(start,end+1);
  // Overlapping segments would make the moving boundary ambiguous.
  for(let i=1;i<chain.length;i++)if(!equal(chain[i-1].high,chain[i].low))return null;
  const ids=[...new Set(chain.flatMap(c=>c.roomIds))];
  const sides=ids.map(id=>({id,side:roomSide(f,id,selected.axis,selected.coordinate)}));
  if(sides.some(s=>!s.side))return null;
  let min=-Infinity,max=Infinity;
  for(const {id,side} of sides){
    if(!side)return null;
    const segments=chain.filter(c=>c.roomIds.includes(id)).sort((a,b)=>a.low-b.low);
    // Each affected room must use the entire corresponding side of the partition.
    if(!segments.length||!equal(segments[0].low,side.low)||
       !equal(segments[segments.length-1].high,side.high))return null;
    for(let i=1;i<segments.length;i++)if(!equal(segments[i-1].high,segments[i].low))return null;
    if(side.edge==='right'||side.edge==='bottom')min=Math.max(min,side.limit);
    else max=Math.min(max,side.limit);
  }
  if(!Number.isFinite(min)||!Number.isFinite(max)||min>max)return null;
  const walls=new Map(f.walls.map(w=>[w.id,w]));
  const vertices=[...new Set(chain.flatMap(s=>{
    const w=walls.get(s.wallId)!;return [w.a,w.b];
  }))];
  const verticesSet=new Set(vertices);
  // A third room may touch an end vertex; allow only when it remains rectangular
  // after the move. Reject direct branches not belonging to any modeled room.
  const modeledWalls=new Set(f.rooms.flatMap(r=>r.boundary.map(link=>link.wallId)));
  if(f.walls.some(w=>(verticesSet.has(w.a)||verticesSet.has(w.b))&&!modeledWalls.has(w.id)))
    return null;
  return {wallId,wallIds:chain.map(s=>s.wallId),roomIds:ids,
    axis:selected.axis,coordinate:selected.coordinate,
    low:chain[0].low,high:chain[chain.length-1].high,
    minCoordinate:min,maxCoordinate:max,vertexIds:vertices};
}
export function sharedPartitionForRoomEdge(f:Floor,roomId:string,edge:RoomEdge):SharedPartition|null{
  const box=rectangularRoomBounds(f,roomId);if(!box||!ROOM_EDGES.includes(edge))return null;
  const axis:Axis=(edge==='left'||edge==='right')?'x':'y';
  const coordinate=edge==='left'?box.minX:edge==='right'?box.maxX:edge==='top'?box.minY:box.maxY;
  for(const link of f.rooms.find(r=>r.id===roomId)?.boundary??[]){
    const line=axisLine(f,link.wallId);
    if(!line||line.axis!==axis||!equal(line.coordinate,coordinate))continue;
    const partition=sharedPartitionForWall(f,link.wallId);
    if(partition&&partition.roomIds.includes(roomId))return partition;
  }
  return null;
}
export function partitionMidpoint(p:SharedPartition):Point{
  return p.axis==='x'?{x:p.coordinate,y:(p.low+p.high)/2}:
    {x:(p.low+p.high)/2,y:p.coordinate};
}
export function proposedPartitionCoordinate(p:SharedPartition,value:number,step:SnapStep):number{
  if(!Number.isFinite(value))return p.coordinate;
  return Math.max(p.minCoordinate,Math.min(p.maxCoordinate,snapValue(value,step)));
}
/** Move all collinear shared segments together, preserving openings and atomic rollback.
 * Rejects operations which deform any affected rectangle or create invalid room topology.
 */
export function moveSharedPartition(f:Floor,wallId:string,value:number,step:SnapStep):number{
  const partition=sharedPartitionForWall(f,wallId);
  if(!partition)throw Error('この共有壁は連動移動に対応していません');
  const next=proposedPartitionCoordinate(partition,value,step);
  if(equal(next,partition.coordinate))return next;
  const original=f.vertices.map(v=>({id:v.id,x:v.x,y:v.y}));
  const oldOpenings=f.openings.map(o=>({id:o.id,offset:o.offset}));
  const centers=f.openings.map(o=>{
    const wall=f.walls.find(w=>w.id===o.wallId);
    return {opening:o,center:wall?openingMidpoint(f,wall,o.offset):null};
  });
  const delta=next-partition.coordinate;
  const moved=new Set(partition.vertexIds),partitionWalls=new Set(partition.wallIds);
  // Capture the currently rectangular rooms touching the edited vertices.
  const touchingRooms=f.rooms.filter(r=>r.boundary.some(b=>{
    const w=f.walls.find(w=>w.id===b.wallId);
    return w&&(moved.has(w.a)||moved.has(w.b));
  })).map(r=>r.id);
  try{
    for(const vertex of f.vertices)if(moved.has(vertex.id))vertex[partition.axis]=next;
    for(const {opening,center} of centers){
      const wall=f.walls.find(w=>w.id===opening.wallId);
      if(!wall||!center)continue;
      const target=partitionWalls.has(wall.id)?
        {x:center.x+(partition.axis==='x'?delta:0),
         y:center.y+(partition.axis==='y'?delta:0)}:center;
      opening.offset=Math.round(offsetForPoint(f,wall,target)*1000)/1000;
    }
    if(touchingRooms.some(id=>!rectangularRoomBounds(f,id)))
      throw Error('T字接合部の形状が矩形を保てません');
    const errors=validateFloor(f).filter(i=>i.severity==='error');
    if(errors.length)throw Error(errors[0].message);
    return next;
  }catch(err){
    const previous=new Map(original.map(v=>[v.id,v]));
    for(const vertex of f.vertices){
      const saved=previous.get(vertex.id);
      if(saved){vertex.x=saved.x;vertex.y=saved.y;}
    }
    const offsets=new Map(oldOpenings.map(o=>[o.id,o.offset]));
    for(const opening of f.openings){
      const offset=offsets.get(opening.id);
      if(offset!==undefined)opening.offset=offset;
    }
    throw Error('共有壁の移動を取り消しました: '+(err instanceof Error?err.message:String(err)));
  }
}
