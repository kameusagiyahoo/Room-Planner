import type {Floor,HouseProject,Point,Stair} from './model';
import {pointInPolygon,roomPolygon} from './geometry';
import {blocked,makeCollisionWorld,PLAYER_RADIUS} from './collision';
import {stairFootprint} from './stairs';

const clamp=(x:number,min:number,max:number)=>Math.min(max,Math.max(min,x));
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export type WalkRoute={source:Floor;target:Floor;stair:Stair;rise:number};
export type StairTraversal={route:WalkRoute;progress:number;side:number;direction:1|-1};
export function routeForStair(project:HouseProject,sourceId:string,stairId:string):WalkRoute|null{
  const source=project.floors.find(f=>f.id===sourceId);
  const stair=source?.stairs?.find(s=>s.id===stairId);
  const target=stair&&project.floors.find(f=>f.id===stair.toFloorId);
  if(!source||!stair||!target||target.elevation<=source.elevation)return null;
  if(![stair.x,stair.y,stair.width,stair.run,stair.rotation].every(Number.isFinite)
    ||stair.width<.6||stair.run<1)return null;
  return {source,target,stair,rise:target.elevation-source.elevation};
}
export function stairAxis(s:Stair):Point{
  const a=s.rotation*Math.PI/180;
  return {x:-Math.sin(a),y:Math.cos(a)};
}
export function stairSideAxis(s:Stair):Point{
  const a=s.rotation*Math.PI/180;
  return {x:Math.cos(a),y:Math.sin(a)};
}
export function stairPosition(s:Stair,t:number,side=0):Point{
  const axis=stairAxis(s),normal=stairSideAxis(s);
  const u=(t-.5)*s.run;
  return {x:s.x+s.width/2+axis.x*u+normal.x*side,
    y:s.y+s.run/2+axis.y*u+normal.y*side};
}
export function stairProgress(s:Stair,p:Point):number{
  const start=stairPosition(s,0),dir=stairAxis(s);
  return ((p.x-start.x)*dir.x+(p.y-start.y)*dir.y)/s.run;
}
export function stairSideOffset(s:Stair,p:Point):number{
  const center=stairPosition(s,.5),axis=stairSideAxis(s);
  return (p.x-center.x)*axis.x+(p.y-center.y)*axis.y;
}
export function stairHeight(route:WalkRoute,progress:number):number{
  return route.source.elevation+route.rise*clamp(progress,0,1);
}
function onFloor(f:Floor,p:Point):boolean{
  return f.rooms.some(r=>pointInPolygon(p,roomPolygon(f,r)));
}
function stairReservedOnFloor(route:WalkRoute,floorId:string):boolean{
  return route.source.id===floorId||route.target.id===floorId;
}
function hasLanding(floor:Floor,s:Stair,t:number):boolean{
  const p=stairPosition(s,t);
  return onFloor(floor,p);
}
/** Only wholly-in-room stairs are considered traversable.
 * This avoids falling through unmodeled floor slabs and crossing room boundaries.
 */
export function traversableRoute(project:HouseProject,route:WalkRoute):boolean{
  const corners=stairFootprint(route.stair);
  if(!corners.every(p=>onFloor(route.source,p)&&onFloor(route.target,p)))return false;
  if(!hasLanding(route.source,route.stair,-.1)||!hasLanding(route.target,route.stair,1.1))return false;
  for(const floor of [route.source,route.target]){
    const world=makeCollisionWorld(floor);
    const s=route.stair;
    // Sample the centerline, keeping clearance from both sides of the stairs.
    for(let i=0;i<=12;i++){
      const p=stairPosition(s,i/12);
      if(blocked(world,p,Math.min(PLAYER_RADIUS,s.width/2-.02)))return false;
    }
  }
  return true;
}
export function routesForFloor(project:HouseProject,floorId:string):WalkRoute[]{
  const routes:WalkRoute[]=[];
  for(const source of project.floors)for(const stair of source.stairs??[]){
    const r=routeForStair(project,source.id,stair.id);
    if(r&&stairReservedOnFloor(r,floorId))routes.push(r);
  }
  return routes;
}
export function walkCollisionWorld(project:HouseProject,floorId:string,eyeHeight=1.6){
  const floor=project.floors.find(f=>f.id===floorId);
  if(!floor)throw Error('階が見つかりません');
  const world=makeCollisionWorld(floor,eyeHeight);
  // Reserve the stairwell; walking into the sides or falling into the upper opening
  // is blocked unless the walker begins a legal stair traversal at a landing.
  for(const route of routesForFloor(project,floorId)){
    const s=route.stair;
    world.furniture.push({
      cx:s.x+s.width/2,cy:s.y+s.run/2,
      halfWidth:s.width/2,halfDepth:s.run/2,rotation:s.rotation*Math.PI/180
    });
  }
  return world;
}
export function tryEnterStair(project:HouseProject,floorId:string,position:Point,move:Point):StairTraversal|null{
  for(const route of routesForFloor(project,floorId)){
    if(!traversableRoute(project,route))continue;
    const goingUp=route.source.id===floorId;
    const t=goingUp?0:1,entry=stairPosition(route.stair,t);
    const s=route.stair;
    if(distance(position,entry)>Math.max(.42,PLAYER_RADIUS+.12))continue;
    const side=stairSideOffset(s,position);
    if(Math.abs(side)>s.width/2-PLAYER_RADIUS)continue;
    const axis=stairAxis(s);
    const longitudinal=move.x*axis.x+move.y*axis.y;
    if((goingUp?longitudinal:-longitudinal)<=.00001)continue;
    return {route,progress:t,side:clamp(side,-s.width/2+PLAYER_RADIUS,s.width/2-PLAYER_RADIUS),
      direction:goingUp?1:-1};
  }
  return null;
}
export type StairStep={state:StairTraversal|null;position:Point;eyeY:number;floorId:string;finished:boolean};
export function advanceStair(state:StairTraversal,move:Point,sideMove=0):StairStep{
  const {route}=state,s=route.stair,axis=stairAxis(s);
  const change=(move.x*axis.x+move.y*axis.y)/s.run;
  const side=clamp(state.side+sideMove,-s.width/2+PLAYER_RADIUS,s.width/2-PLAYER_RADIUS);
  const t=clamp(state.progress+change,0,1);
  const finished=state.direction===1?t>=1:t<=0;
  const floorId=finished?(state.direction===1?route.target.id:route.source.id):
    state.direction===1?route.source.id:route.target.id;
  const beyond=finished?state.direction*.38/s.run:0;
  return {state:finished?null:{...state,progress:t,side},
    position:stairPosition(s,t+beyond,side),eyeY:stairHeight(route,t),
    floorId,finished};
}
/** Upper-level floor mesh may cut this polygon only when all four corners sit in one room. */
export function stairwellOpenings(project:HouseProject,upperFloorId:string):Point[][]{
  const floor=project.floors.find(f=>f.id===upperFloorId);if(!floor)return [];
  return routesForFloor(project,upperFloorId)
    .filter(r=>r.target.id===upperFloorId&&traversableRoute(project,r))
    .map(r=>stairFootprint(r.stair));
}
