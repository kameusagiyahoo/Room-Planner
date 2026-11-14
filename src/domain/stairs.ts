import type {Floor,HouseProject,Point,Stair} from './model';
import {newId} from './model';
export function addStair(floor:Floor,toFloorId:string,p:Point):Stair{
 const stair:Stair={id:newId('stair'),x:p.x,y:p.y,width:0.9,run:3.2,rotation:0,toFloorId};
 (floor.stairs??=[]).push(stair);return stair;
}
export function stairDestination(project:HouseProject,sourceFloorId:string,stairId:string):{floorId:string;position:Point}|null{
 const floor=project.floors.find(f=>f.id===sourceFloorId);
 const stair=floor?.stairs?.find(s=>s.id===stairId);
 if(!stair||!project.floors.some(f=>f.id===stair.toFloorId))return null;
 return {floorId:stair.toFloorId,position:{x:stair.x+stair.width/2,y:stair.y+stair.run/2}};
}
export function stairFootprint(stair:Stair):Point[]{
 const cx=stair.x+stair.width/2,cy=stair.y+stair.run/2;
 const c=Math.cos(stair.rotation*Math.PI/180),s=Math.sin(stair.rotation*Math.PI/180);
 return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>{
  const x=sx*stair.width/2,y=sy*stair.run/2;
  return {x:cx+x*c-y*s,y:cy+x*s+y*c};
 });
}
