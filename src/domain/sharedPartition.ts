import type {Floor,Point} from './model';
import {distance,openingMidpoint,wallPoints} from './geometry';
import {offsetForPoint} from './openings';
import {rectangularRoomBounds,ROOM_EDGES} from './resize';
import type {RoomEdge,RoomBox} from './resize';
import {snapValue} from './snap';
import type {SnapStep} from './snap';
import {validateFloor} from './validation';

type Axis='x'|'y';
export type SharedPartition={
  wallId:string;wallIds:string[];roomIds:[string,string];axis:Axis;
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
function sideBounds(boxes:[RoomBox,RoomBox],axis:Axis,value:number):{
  first:RoomBox;second:RoomBox;low:number;high:number;min:number;max:number
}|null{
  const [a,b]=boxes;
  if(axis==='x'){
    const left=equal(a.maxX,value)&&equal(b.minX,value)?a:equal(b.maxX,value)&&equal(a.minX,value)?b:null;
    const right=left===a?b:left===b?a:null;
    if(!left||!right||!equal(left.minY,right.minY)||!equal(left.maxY,right.maxY))return null;
    return {first:left,second:right,low:left.minY,high:left.maxY,min:left.minX+.5,max:right.maxX-.5};
  }
  const top=equal(a.maxY,value)&&equal(b.minY,value)?a:equal(b.maxY,value)&&equal(a.minY,value)?b:null;
  const bottom=top===a?b:top===b?a:null;
  if(!top||!bottom||!equal(top.minX,bottom.minX)||!equal(top.maxX,bottom.maxX))return null;
  return {first:top,second:bottom,low:top.minX,high:top.maxX,min:top.minY+.5,max:bottom.maxY-.5};
}
/**
 * Only supports complete, axis-aligned partitions between two rectangular rooms
 * with matching side lengths. Refuses T junctions and cross-room vertex attachments.
 */
export function sharedPartitionForWall(f:Floor,wallId:string):SharedPartition|null{
  const selected=axisLine(f,wallId);if(!selected)return null;
  const ids=roomsForWall(f,wallId);
  if(ids.length!==2)return null;
  const a=rectangularRoomBounds(f,ids[0]),b=rectangularRoomBounds(f,ids[1]);
  if(!a||!b)return null;
  const side=sideBounds([a,b],selected.axis,selected.coordinate);
  if(!side||side.min>side.max)return null;
  const chain=f.walls.flatMap(w=>{
    const line=axisLine(f,w.id);
    const refs=roomsForWall(f,w.id);
    if(!line||line.axis!==selected.axis||!equal(line.coordinate,selected.coordinate)||
       refs.length!==2||!refs.every(id=>ids.includes(id))||
       line.low<side.low-EPS||line.high>side.high+EPS)return [];
    return [{wall:w,low:line.low,high:line.high}];
  }).sort((u,v)=>u.low-v.low);
  if(!chain.some(c=>c.wall.id===wallId)||!chain.length||!equal(chain[0].low,side.low)||
      !equal(chain[chain.length-1].high,side.high))return null;
  for(let i=1;i<chain.length;i++)if(!equal(chain[i-1].high,chain[i].low))return null;
  const verts=[...new Set(chain.flatMap(c=>[c.wall.a,c.wall.b]))];
  // A branch into any third room (including an outer T-junction) is unsafe to move.
  for(const room of f.rooms){
    if(ids.includes(room.id))continue;
    const referenced=new Set(room.boundary.flatMap(b=>{
      const w=f.walls.find(w=>w.id===b.wallId);
      return w?[w.a,w.b]:[];
    }));
    if(verts.some(id=>referenced.has(id)))return null;
  }
  const localWalls=new Set(f.rooms.filter(r=>ids.includes(r.id)).flatMap(r=>r.boundary.map(b=>b.wallId)));
  if(f.walls.some(w=>(verts.includes(w.a)||verts.includes(w.b))&&!localWalls.has(w.id)))return null;
  return {wallId,wallIds:chain.map(c=>c.wall.id),roomIds:[ids[0],ids[1]],
    axis:selected.axis,coordinate:selected.coordinate,low:side.low,high:side.high,
    minCoordinate:side.min,maxCoordinate:side.max,vertexIds:verts};
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
/** Mutate a floor atomically, rolling back if geometry or door/window positions become invalid. */
export function moveSharedPartition(f:Floor,wallId:string,value:number,step:SnapStep):number{
  const partition=sharedPartitionForWall(f,wallId);
  if(!partition)throw Error('この共有壁は連動移動に対応していません');
  const next=proposedPartitionCoordinate(partition,value,step);
  if(equal(next,partition.coordinate))return next;
  const oldVertices=new Map(f.vertices.filter(v=>partition.vertexIds.includes(v.id))
    .map(v=>[v.id,{x:v.x,y:v.y}]));
  const oldOpenings=new Map(f.openings.map(o=>[o.id,o.offset]));
  const openingCenters=f.openings.map(o=>{
    const wall=f.walls.find(w=>w.id===o.wallId);
    return {opening:o,center:wall?openingMidpoint(f,wall,o.offset):null};
  });
  const delta=next-partition.coordinate;
  try{
    for(const vertex of f.vertices){
      if(partition.vertexIds.includes(vertex.id))vertex[partition.axis]=next;
    }
    for(const {opening,center} of openingCenters){
      const wall=f.walls.find(w=>w.id===opening.wallId);
      if(!wall||!center)continue;
      const target=partition.wallIds.includes(wall.id)?
        {x:center.x+(partition.axis==='x'?delta:0),y:center.y+(partition.axis==='y'?delta:0)}:
        center;
      opening.offset=Math.round(offsetForPoint(f,wall,target)*1000)/1000;
    }
    const errors=validateFloor(f).filter(i=>i.severity==='error');
    if(errors.length)throw Error('共有壁の移動を取り消しました: '+errors[0].message);
    return next;
  }catch(e){
    for(const vertex of f.vertices){
      const saved=oldVertices.get(vertex.id);
      if(saved){vertex.x=saved.x;vertex.y=saved.y;}
    }
    for(const opening of f.openings){
      const saved=oldOpenings.get(opening.id);if(saved!==undefined)opening.offset=saved;
    }
    throw e;
  }
}
