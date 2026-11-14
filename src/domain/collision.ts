import type {Floor,Point} from './model';
import {distance,wallPoints} from './geometry';
export type Obstacle={a:Point;b:Point;thickness:number};
export type FurnitureObstacle={cx:number;cy:number;halfWidth:number;halfDepth:number;rotation:number};
export type CollisionWorld={segments:Obstacle[];furniture:FurnitureObstacle[]};
export const PLAYER_RADIUS=0.23;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export function makeCollisionWorld(floor:Floor,playerHeight=1.65):CollisionWorld{
  const segments:Obstacle[]=[];
  for(const wall of floor.walls){
    const pair=wallPoints(floor,wall);if(!pair)continue;
    const [a,b]=pair,L=distance(a,b);if(L<1e-6)continue;
    const dx=(b.x-a.x)/L,dy=(b.y-a.y)/L;
    const openings=floor.openings.filter(o=>o.wallId===wall.id)
      .sort((x,y)=>x.offset-y.offset);
    let cursor=0;
    const push=(start:number,end:number)=>{
      if(end-start>1e-6)segments.push({
        a:{x:a.x+dx*start,y:a.y+dy*start},
        b:{x:a.x+dx*end,y:a.y+dy*end},thickness:wall.thickness
      });
    };
    for(const o of openings){
      const start=clamp(o.offset-o.width/2,0,L),end=clamp(o.offset+o.width/2,0,L);
      if(start>cursor)push(cursor,start);
      // A window blocks passage. Closed doors block. Low overhead openings block tall players.
      const passable=o.kind==='door'&&!!o.open&&o.sillHeight===0&&o.height>=playerHeight;
      if(!passable)push(Math.max(cursor,start),end);
      cursor=Math.max(cursor,end);
    }
    push(cursor,L);
  }
  const furniture=floor.furniture.filter(f=>f.height>0.12).map(f=>({
    cx:f.x+f.width/2,cy:f.y+f.depth/2,
    halfWidth:f.width/2,halfDepth:f.depth/2,rotation:f.rotation*Math.PI/180
  }));
  return {segments,furniture};
}
export function blocked(world:CollisionWorld,p:Point,radius=PLAYER_RADIUS):boolean{
  for(const s of world.segments){
    const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,l2=dx*dx+dy*dy;
    const t=l2>1e-9?clamp(((p.x-s.a.x)*dx+(p.y-s.a.y)*dy)/l2,0,1):0;
    const x=s.a.x+dx*t,y=s.a.y+dy*t;
    if(Math.hypot(p.x-x,p.y-y)<radius+s.thickness/2-1e-8)return true;
  }
  for(const f of world.furniture){
    const dx=p.x-f.cx,dy=p.y-f.cy,c=Math.cos(f.rotation),s=Math.sin(f.rotation);
    const x=dx*c+dy*s,y=-dx*s+dy*c;
    const qx=clamp(x,-f.halfWidth,f.halfWidth),qy=clamp(y,-f.halfDepth,f.halfDepth);
    if(Math.hypot(x-qx,y-qy)<radius-1e-8)return true;
  }
  return false;
}
/** Swept movement via small steps; axis separation allows sliding along walls. */
export function movePlayer(world:CollisionWorld,from:Point,delta:Point,radius=PLAYER_RADIUS):Point{
  const steps=Math.max(1,Math.ceil(Math.hypot(delta.x,delta.y)/Math.max(radius*.35,.03)));
  let p={...from};
  for(let i=0;i<steps;i++){
    const dx=delta.x/steps,dy=delta.y/steps;
    const full={x:p.x+dx,y:p.y+dy};
    if(!blocked(world,full,radius)){p=full;continue;}
    const xOnly={x:p.x+dx,y:p.y};
    if(!blocked(world,xOnly,radius))p=xOnly;
    const yOnly={x:p.x,y:p.y+dy};
    if(!blocked(world,yOnly,radius))p=yOnly;
  }
  return p;
}
