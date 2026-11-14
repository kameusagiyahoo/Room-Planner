import type {Floor,HouseProject,Point} from './model';
import {distance,polygonArea,roomPolygon,wallPoints} from './geometry';
import {furnitureClearances} from './clearance';
export type Issue={severity:'error'|'warning';message:string;itemId?:string};
const EPS=1e-7;
const orient=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function properCross(a:Point,b:Point,c:Point,d:Point):boolean{
  const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
  return o1*o2<-EPS&&o3*o4<-EPS;
}
function onSegment(p:Point,a:Point,b:Point):boolean{
  if(Math.abs(orient(a,b,p))>1e-6)return false;
  return p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS
      &&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;
}
function strictlyInside(p:Point,poly:Point[]):boolean{
  if(poly.some((a,i)=>onSegment(p,a,poly[(i+1)%poly.length])))return false;
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))inside=!inside;
  }
  return inside;
}
function selfCross(poly:Point[]):boolean{
  for(let i=0;i<poly.length;i++)for(let j=i+1;j<poly.length;j++){
    if(j===i+1||(i===0&&j===poly.length-1))continue;
    if(properCross(poly[i],poly[(i+1)%poly.length],poly[j],poly[(j+1)%poly.length]))return true;
  }
  return false;
}
function roomOverlap(a:Point[],b:Point[]):boolean{
  // For ordinary simple polygons; collinear shared boundaries and touching corners are permitted.
  if(a.some(p=>strictlyInside(p,b))||b.some(p=>strictlyInside(p,a)))return true;
  for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
    if(properCross(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]))return true;
  }
  const avg=(poly:Point[])=>({x:poly.reduce((s,p)=>s+p.x,0)/poly.length,y:poly.reduce((s,p)=>s+p.y,0)/poly.length});
  return strictlyInside(avg(a),b)||strictlyInside(avg(b),a);
}
export function validateFloor(floor:Floor):Issue[]{
  const issues:Issue[]=[];
  const wallMap=new Map(floor.walls.map(w=>[w.id,w]));
  const ids=new Set<string>();
  for(const obj of [...floor.vertices,...floor.walls,...floor.rooms,...floor.openings,...floor.furniture]){
    if(ids.has(obj.id))issues.push({severity:'error',itemId:obj.id,message:'IDが重複しています'});
    ids.add(obj.id);
  }
  const segmentKeys=new Set<string>();
  for(const w of floor.walls){
    const p=wallPoints(floor,w);
    if(!p)issues.push({severity:'error',itemId:w.id,message:'参照頂点がありません'});
    else if(distance(...p)<0.05)issues.push({severity:'error',itemId:w.id,message:'短すぎる壁'});
    const key=[w.a,w.b].sort().join('|');
    if(segmentKeys.has(key))issues.push({severity:'error',itemId:w.id,message:'同じ壁が重複しています'});
    segmentKeys.add(key);
    if(!Number.isFinite(w.thickness)||w.thickness<=0||w.thickness>1)
      issues.push({severity:'error',itemId:w.id,message:'壁厚が不正'});
  }
  const polygons: {id:string,points:Point[]}[]=[];
  for(const r of floor.rooms){
    if(r.boundary.length<3){issues.push({severity:'error',itemId:r.id,message:'部屋の境界が不足'});continue;}
    const chain=r.boundary.map(link=>{
      const wall=wallMap.get(link.wallId);
      if(!wall)return null;
      return [link.reversed?wall.b:wall.a,link.reversed?wall.a:wall.b] as const;
    });
    if(chain.some(x=>!x)){issues.push({severity:'error',itemId:r.id,message:'部屋が存在しない壁を参照'});continue;}
    for(let i=0;i<chain.length;i++)if(chain[i]![1]!==chain[(i+1)%chain.length]![0]){
      issues.push({severity:'error',itemId:r.id,message:'部屋の壁が閉じていません'});break;
    }
    const poly=roomPolygon(floor,r);
    if(poly.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))||polygonArea(poly)<.1){
      issues.push({severity:'error',itemId:r.id,message:'部屋の形状・面積が不正'});continue;
    }
    if(selfCross(poly))issues.push({severity:'error',itemId:r.id,message:'部屋が自己交差しています'});
    polygons.push({id:r.id,points:poly});
  }
  for(let i=0;i<polygons.length;i++)for(let j=i+1;j<polygons.length;j++){
    if(roomOverlap(polygons[i].points,polygons[j].points))
      issues.push({severity:'error',itemId:polygons[j].id,message:'部屋同士が重複しています'});
  }
  for(const o of floor.openings){
    const wall=wallMap.get(o.wallId),pts=wall&&wallPoints(floor,wall);
    if(!wall||!pts){issues.push({severity:'error',itemId:o.id,message:'配置壁がありません'});continue;}
    const L=distance(...pts);
    if(![o.offset,o.width,o.height,o.sillHeight].every(Number.isFinite)||
       o.width<=0||o.height<=0||o.sillHeight<0||
       o.offset-o.width/2<.02||o.offset+o.width/2>L-.02){
      issues.push({severity:'error',itemId:o.id,message:'開口部の位置・寸法が不正（壁からはみ出し）'});
    }
    if(o.height+o.sillHeight>(wall.height??floor.ceilingHeight)+.001)
      issues.push({severity:'error',itemId:o.id,message:'開口部が壁高を超えています'});
    if(o.kind==='door'&&o.sillHeight!==0)
      issues.push({severity:'error',itemId:o.id,message:'ドアの床からの高さは0です'});
    if(o.kind==='door'&&!['hinged','sliding'].includes(o.style))
      issues.push({severity:'error',itemId:o.id,message:'ドアの種類が不正です'});
    if(o.kind==='window'&&!['sliding','fixed'].includes(o.style))
      issues.push({severity:'error',itemId:o.id,message:'窓の種類が不正です'});
  }
  for(let i=0;i<floor.openings.length;i++)for(let j=i+1;j<floor.openings.length;j++){
    const a=floor.openings[i],b=floor.openings[j];
    if(a.wallId===b.wallId&&Math.abs(a.offset-b.offset)<(a.width+b.width)/2)
      issues.push({severity:'error',itemId:a.id,message:'同じ壁の開口部が重なっています'});
  }
  for(const v of floor.vertices){
    if(!Number.isFinite(v.x)||!Number.isFinite(v.y))
      issues.push({severity:'error',itemId:v.id,message:'頂点座標が不正'});
  }
  for(const f of floor.furniture){
    if(![f.x,f.y,f.width,f.depth,f.height,f.rotation].every(Number.isFinite)||f.width<=0||f.depth<=0||f.height<=0)
      issues.push({severity:'error',itemId:f.id,message:'家具の寸法が不正'});
  }
  for(const item of furnitureClearances(floor)){
    // Furniture pairs are reported once. Soft warnings do not prevent experimenting or JSON saves.
    if(!item.overlap)continue;
    if(item.kind==='furniture'&&item.furnitureId>item.otherId)continue;
    issues.push({severity:'warning',itemId:item.furnitureId,
      message:item.kind==='wall'?'家具が壁と干渉しています':'家具同士が干渉しています'});
  }
  return issues;
}
export function validateProject(value:unknown):Issue[]{
  if(!value||typeof value!=='object')return [{severity:'error',message:'JSONオブジェクトではありません'}];
  const p=value as Partial<HouseProject>;
  if(p.schemaVersion!=='1.0.0'||p.units!=='m'||!Array.isArray(p.floors)||p.floors.length<1)
    return [{severity:'error',message:'schemaVersion・units・floorsが不正'}];
  const issues:Issue[]=[];
  for(const floor of p.floors){
    if(!floor||!Array.isArray(floor.vertices)||!Array.isArray(floor.walls)||!Array.isArray(floor.rooms)||!Array.isArray(floor.openings)||!Array.isArray(floor.furniture))
      return [{severity:'error',message:'階のデータ構造が不正'}];
    issues.push(...validateFloor(floor));
  }
  return issues;
}
