import type {Floor,Furniture,Point} from './model';
import {distance,wallPoints} from './geometry';
import {makeCollisionWorld} from './collision';
const EPS=1e-8;
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
export function furnitureCorners(f:Furniture):Point[]{
  const cx=f.x+f.width/2,cy=f.y+f.depth/2;
  const c=Math.cos(f.rotation*Math.PI/180),s=Math.sin(f.rotation*Math.PI/180);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>{
    const dx=sx*f.width/2,dy=sy*f.depth/2;
    return {x:cx+dx*c-dy*s,y:cy+dx*s+dy*c};
  });
}
export function pointSegmentDistance(p:Point,a:Point,b:Point):number{
  const dx=b.x-a.x,dy=b.y-a.y,L=dx*dx+dy*dy;
  const t=L>EPS?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/L,0,1):0;
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
function orientation(a:Point,b:Point,c:Point):number{
  return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}
function onSegment(p:Point,a:Point,b:Point){
  return Math.abs(orientation(a,b,p))<EPS &&
    p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&
    p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;
}
function segmentsIntersect(a:Point,b:Point,c:Point,d:Point){
  const x=orientation(a,b,c),y=orientation(a,b,d),z=orientation(c,d,a),w=orientation(c,d,b);
  if(x*y<0&&z*w<0)return true;
  return onSegment(c,a,b)||onSegment(d,a,b)||onSegment(a,c,d)||onSegment(b,c,d);
}
function segmentsDistance(a:Point,b:Point,c:Point,d:Point){
  return segmentsIntersect(a,b,c,d)?0:Math.min(
    pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),
    pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
}
function pointInside(p:Point,poly:Point[]){
  let yes=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if(((a.y>p.y)!==(b.y>p.y))&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;
  }
  return yes;
}
function edges(p:Point[]):[Point,Point][]{
  return p.map((a,i)=>[a,p[(i+1)%p.length]]);
}
function segmentPolygonDistance(a:Point,b:Point,poly:Point[]){
  if(pointInside(a,poly)||pointInside(b,poly))return 0;
  return Math.min(...edges(poly).map(([c,d])=>segmentsDistance(a,b,c,d)));
}
function polygonsDistance(a:Point[],b:Point[]){
  if(a.some(p=>pointInside(p,b))||b.some(p=>pointInside(p,a)))return 0;
  return Math.min(...edges(a).flatMap(([p,q])=>edges(b).map(([r,s])=>segmentsDistance(p,q,r,s))));
}
export type Clearance={furnitureId:string;otherId:string;kind:'wall'|'furniture';gap:number;overlap:boolean};
export function furnitureClearances(floor:Floor):Clearance[]{
  const result:Clearance[]=[];
  for(const f of floor.furniture){
    const poly=furnitureCorners(f);
    for(const wall of floor.walls){
      const pts=wallPoints(floor,wall);if(!pts)continue;
      const d=segmentPolygonDistance(pts[0],pts[1],poly)-wall.thickness/2;
      result.push({furnitureId:f.id,otherId:wall.id,kind:'wall',gap:Math.max(0,d),overlap:d<=EPS});
    }
  }
  for(let i=0;i<floor.furniture.length;i++)for(let j=i+1;j<floor.furniture.length;j++){
    const a=floor.furniture[i],b=floor.furniture[j];
    const d=polygonsDistance(furnitureCorners(a),furnitureCorners(b));
    const gap=Math.max(0,d),overlap=d<=EPS;
    result.push({furnitureId:a.id,otherId:b.id,kind:'furniture',gap,overlap});
    result.push({furnitureId:b.id,otherId:a.id,kind:'furniture',gap,overlap});
  }
  return result;
}
export function nearestFurnitureClearance(floor:Floor,id:string):Clearance|null{
  const items=furnitureClearances(floor).filter(x=>x.furnitureId===id);
  return items.reduce<Clearance|null>((nearest,x)=>!nearest||x.gap<nearest.gap?x:nearest,null);
}
/** Conservative diameter of the largest free circle at each point along a chosen line.
 * It is not the architectural shortest wall-to-wall corridor width.
 */
export function minimumPassageDiameter(floor:Floor,a:Point,b:Point,spacing=0.1):number{
  const world=makeCollisionWorld(floor);
  const len=distance(a,b),count=Math.max(1,Math.ceil(len/spacing));
  let minRadius=2;
  for(let i=0;i<=count;i++){
    const t=i/count,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    let radius=2;
    for(const s of world.segments){
      radius=Math.min(radius,pointSegmentDistance(p,s.a,s.b)-s.thickness/2);
    }
    for(const f of world.furniture){
      const dx=p.x-f.cx,dy=p.y-f.cy,c=Math.cos(f.rotation),s=Math.sin(f.rotation);
      const x=dx*c+dy*s,y=-dx*s+dy*c;
      const qx=Math.max(Math.abs(x)-f.halfWidth,0),qy=Math.max(Math.abs(y)-f.halfDepth,0);
      const d=Math.hypot(qx,qy);
      radius=Math.min(radius,d);
    }
    minRadius=Math.min(minRadius,Math.max(0,radius));
  }
  return Math.max(0,minRadius*2);
}
