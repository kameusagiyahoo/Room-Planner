import type {Floor, Point, Room, Wall, WallLink} from './model';
import {newId} from './model';
import {distance,polygonArea,roomPolygon,roundGrid,wallPoints} from './geometry';
const EPS=1e-6;
function interior(p:Point,a:Point,b:Point):number|null {
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2<EPS)return null;
  const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/l2;
  const perpendicular=Math.abs((p.x-a.x)*dy-(p.y-a.y)*dx)/Math.sqrt(l2);
  return t>EPS&&t<1-EPS&&perpendicular<1e-5?t:null;
}
function vertex(f:Floor,p:Point){
  const current=f.vertices.find(v=>distance(v,p)<1e-5);
  if(current)return current;
  const v={id:newId('vertex'),x:p.x,y:p.y};f.vertices.push(v);return v;
}
function overlapArea(poly:Point[],xmin:number,xmax:number,ymin:number,ymax:number){
  const planes:Array<(p:Point)=>number>=[p=>p.x-xmin,p=>xmax-p.x,p=>p.y-ymin,p=>ymax-p.y];
  let result=poly;
  for(const fn of planes){
    const next:Point[]=[];
    for(let i=0;i<result.length;i++){
      const a=result[i],b=result[(i+1)%result.length],fa=fn(a),fb=fn(b),ia=fa>=-EPS,ib=fb>=-EPS;
      if(ia)next.push(a);
      if(ia!==ib){const t=fa/(fa-fb);next.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});}
    }
    result=next;if(!result.length)return 0;
  }
  return polygonArea(result);
}
/** In-place; caller must provide a cloned floor and discard the clone on failure. */
export function splitWall(f:Floor,wallId:string,p:Point):string {
  const wall=f.walls.find(w=>w.id===wallId),pts=wall&&wallPoints(f,wall);
  if(!wall||!pts)throw Error('分割する壁が存在しません');
  const t=interior(p,...pts);
  if(t===null)throw Error('分割点は壁の内側を指定してください');
  const splitAt=distance(...pts)*t;
  for(const o of f.openings.filter(o=>o.wallId===wallId)){
    if(o.offset-o.width/2<splitAt+0.02 && o.offset+o.width/2>splitAt-0.02)
      throw Error('ドア・窓の範囲内では壁を分割できません');
  }
  const middle=vertex(f,p),oldB=wall.b;
  wall.b=middle.id;
  const second:Wall={...wall,id:newId('wall'),a:middle.id,b:oldB};
  f.walls.push(second);
  for(const room of f.rooms)room.boundary=room.boundary.flatMap(link=>{
    if(link.wallId!==wallId)return [link];
    return link.reversed?
      [{wallId:second.id,reversed:true},{wallId,reversed:true}]:
      [{wallId,reversed:false},{wallId:second.id,reversed:false}];
  });
  for(const o of f.openings.filter(o=>o.wallId===wallId&&o.offset>splitAt)){
    o.wallId=second.id;o.offset-=splitAt;
  }
  return middle.id;
}
/** Rectangular room insertion supports shared subsegments/T junctions and rejects interior overlap. */
export function insertRectangle(f:Floor,a:Point,b:Point,name:string):Room {
  const x0=roundGrid(Math.min(a.x,b.x)),y0=roundGrid(Math.min(a.y,b.y));
  const x1=roundGrid(Math.max(a.x,b.x)),y1=roundGrid(Math.max(a.y,b.y));
  if(x1-x0<0.5||y1-y0<0.5)throw Error('部屋は幅・奥行きとも0.5m以上にしてください');
  if(f.rooms.some(r=>overlapArea(roomPolygon(f,r),x0,x1,y0,y1)>1e-5))
    throw Error('既存の部屋と重複しています');
  const corners:Point[]=[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
  for(let i=0;i<4;i++){
    const a=corners[i],b=corners[(i+1)%4];
    for(const wall of f.walls){
      const pts=wallPoints(f,wall);if(!pts)continue;
      const [c,d]=pts;
      const den=(b.x-a.x)*(d.y-c.y)-(b.y-a.y)*(d.x-c.x);
      if(Math.abs(den)<EPS)continue;
      const t=((c.x-a.x)*(d.y-c.y)-(c.y-a.y)*(d.x-c.x))/den;
      const u=((c.x-a.x)*(b.y-a.y)-(c.y-a.y)*(b.x-a.x))/den;
      if(t>EPS&&t<1-EPS&&u>EPS&&u<1-EPS)throw Error('新しい壁が既存の壁と交差します');
    }
  }
  for(const p of corners){
    const wall=f.walls.find(w=>{const pts=wallPoints(f,w);return pts&&interior(p,...pts)!==null;});
    if(wall)splitWall(f,wall.id,p);
  }
  const boundary:WallLink[]=[];
  for(let i=0;i<4;i++){
    const a=corners[i],b=corners[(i+1)%4],dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
    const vertices=[vertex(f,a),vertex(f,b),...f.vertices.filter(v=>interior(v,a,b)!==null)];
    const sorted=[...new Map(vertices.map(v=>[v.id,v])).values()].sort((v,w)=>
      ((v.x-a.x)*dx+(v.y-a.y)*dy - (w.x-a.x)*dx-(w.y-a.y)*dy)/l2
    );
    for(let j=0;j<sorted.length-1;j++){
      const start=sorted[j],end=sorted[j+1];
      let wall=f.walls.find(w=>(w.a===start.id&&w.b===end.id)||(w.a===end.id&&w.b===start.id));
      if(!wall){wall={id:newId('wall'),a:start.id,b:end.id,thickness:0.12};f.walls.push(wall);}
      boundary.push({wallId:wall.id,reversed:wall.a!==start.id});
    }
  }
  const room={id:newId('room'),name,boundary};
  f.rooms.push(room);return room;
}
