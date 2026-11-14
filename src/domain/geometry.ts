import type { Floor, Point, Room, Wall, WallLink } from './model';
export const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export const roundGrid=(v:number,grid=0.1)=>Math.round(v/grid)*grid;
export function wallPoints(floor:Floor,wall:Wall):[Point,Point] | null {
  const a=floor.vertices.find(v=>v.id===wall.a),b=floor.vertices.find(v=>v.id===wall.b);
  return a && b ? [a,b] : null;
}
export function polygonArea(points:Point[]):number {
  if(points.length<3)return 0;
  let sum=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];sum+=a.x*b.y-b.x*a.y;
  }
  return Math.abs(sum)/2;
}
export function roomPolygon(floor:Floor,room:Room):Point[] {
  const walls=new Map(floor.walls.map(w=>[w.id,w]));
  const verts=new Map(floor.vertices.map(v=>[v.id,v]));
  return room.boundary.map(link=>{
    const wall=walls.get(link.wallId);
    const vertex=wall && verts.get(link.reversed?wall.b:wall.a);
    return vertex ? {x:vertex.x,y:vertex.y}: {x:NaN,y:NaN};
  });
}
export function pointInPolygon(p:Point,poly:Point[]):boolean {
  let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))yes=!yes;
  }return yes;
}
export function roomArea(floor:Floor,room:Room):number {return polygonArea(roomPolygon(floor,room));}
export function getBounds(floor:Floor):{minX:number,minY:number,maxX:number,maxY:number}{
  const vs=floor.vertices;
  if(!vs.length)return {minX:0,minY:0,maxX:10,maxY:8};
  return {minX:Math.min(...vs.map(v=>v.x))-1,minY:Math.min(...vs.map(v=>v.y))-1,maxX:Math.max(...vs.map(v=>v.x))+1,maxY:Math.max(...vs.map(v=>v.y))+1};
}
export function addRectangle(floor:Floor,a:Point,b:Point,name:string):Room {
  const x0=roundGrid(Math.min(a.x,b.x)),y0=roundGrid(Math.min(a.y,b.y));
  const x1=roundGrid(Math.max(a.x,b.x)),y1=roundGrid(Math.max(a.y,b.y));
  if(x1-x0<0.5 || y1-y0<0.5)throw new Error('部屋は幅・奥行きとも0.5m以上にしてください');
  const points=[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
  const getVertex=(p:Point)=>{
    let v=floor.vertices.find(v=>distance(v,p)<0.001);
    if(!v){v={id:'v-'+crypto.randomUUID(),...p};floor.vertices.push(v);}return v;
  };
  const vertices=points.map(getVertex),boundary:WallLink[]=[];
  for(let i=0;i<4;i++){
    const a=vertices[i],b=vertices[(i+1)%4];
    let wall=floor.walls.find(w=>(w.a===a.id&&w.b===b.id)||(w.a===b.id&&w.b===a.id));
    if(!wall){wall={id:'wall-'+crypto.randomUUID(),a:a.id,b:b.id,thickness:0.12};floor.walls.push(wall);}
    boundary.push({wallId:wall.id,reversed:wall.a!==a.id});
  }
  const room:Room={id:'room-'+crypto.randomUUID(),name,boundary};floor.rooms.push(room);return room;
}
export function openingMidpoint(floor:Floor,wall:Wall,offset:number):Point|null {
  const pair=wallPoints(floor,wall);if(!pair)return null;
  const [a,b]=pair,L=distance(a,b);if(!L)return null;
  return {x:a.x+(b.x-a.x)*offset/L,y:a.y+(b.y-a.y)*offset/L};
}
