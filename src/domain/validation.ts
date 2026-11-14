import type { Floor, HouseProject } from './model';
import { distance, polygonArea, roomPolygon, wallPoints } from './geometry';
export type Issue = { severity:'error'|'warning'; message:string; itemId?:string };
export function validateFloor(floor:Floor):Issue[] {
  const issues:Issue[]=[];
  const wallMap=new Map(floor.walls.map(w=>[w.id,w]));
  const vertexMap=new Map(floor.vertices.map(v=>[v.id,v]));
  const ids=new Set<string>();
  for(const obj of [...floor.vertices,...floor.walls,...floor.rooms,...floor.openings,...floor.furniture]){
    if(ids.has(obj.id))issues.push({severity:'error',itemId:obj.id,message:'IDが重複しています'});
    ids.add(obj.id);
  }
  for(const wall of floor.walls){
    const points=wallPoints(floor,wall);
    if(!points)issues.push({severity:'error',itemId:wall.id,message:'壁の頂点参照が不正'});
    else if(distance(...points)<0.05)issues.push({severity:'error',itemId:wall.id,message:'短すぎる壁'});
    if(!Number.isFinite(wall.thickness)||wall.thickness<=0)issues.push({severity:'error',itemId:wall.id,message:'壁厚が不正'});
  }
  for(const room of floor.rooms){
    if(room.boundary.length<3){issues.push({severity:'error',itemId:room.id,message:'部屋の境界が不足'});continue;}
    const chain=room.boundary.map(link=>{
      const wall=wallMap.get(link.wallId);
      if(!wall)return null;
      return [link.reversed?wall.b:wall.a,link.reversed?wall.a:wall.b] as const;
    });
    if(chain.some(x=>!x)){issues.push({severity:'error',itemId:room.id,message:'部屋が存在しない壁を参照'});continue;}
    for(let i=0;i<chain.length;i++)if(chain[i]![1]!==chain[(i+1)%chain.length]![0]){
      issues.push({severity:'error',itemId:room.id,message:'部屋の壁が閉じていません'});break;
    }
    const poly=roomPolygon(floor,room);
    if(poly.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))||polygonArea(poly)<0.1)
      issues.push({severity:'error',itemId:room.id,message:'部屋の形状または面積が不正'});
  }
  for(const opening of floor.openings){
    const wall=wallMap.get(opening.wallId),pts=wall&&wallPoints(floor,wall);
    if(!wall||!pts){issues.push({severity:'error',itemId:opening.id,message:'開口部の壁が存在しません'});continue;}
    const L=distance(...pts);
    if(opening.offset-opening.width/2<0.02||opening.offset+opening.width/2>L-0.02)
      issues.push({severity:'error',itemId:opening.id,message:'開口部が壁の端からはみ出しています'});
    if(opening.width<=0||opening.height<=0||opening.sillHeight<0||opening.height+opening.sillHeight>(wall.height??floor.ceilingHeight)+0.001)
      issues.push({severity:'error',itemId:opening.id,message:'開口部の寸法が不正'});
  }
  for(let i=0;i<floor.openings.length;i++)for(let j=i+1;j<floor.openings.length;j++){
    const a=floor.openings[i],b=floor.openings[j];
    if(a.wallId===b.wallId&&Math.abs(a.offset-b.offset)<(a.width+b.width)/2)
      issues.push({severity:'error',itemId:a.id,message:'同じ壁の開口部が重なっています'});
  }
  for(const v of floor.vertices){
    if(!Number.isFinite(v.x)||!Number.isFinite(v.y))issues.push({severity:'error',itemId:v.id,message:'頂点座標が不正'});
  }
  for(const fur of floor.furniture){
    if(![fur.x,fur.y,fur.width,fur.depth,fur.height,fur.rotation].every(Number.isFinite)||fur.width<=0||fur.depth<=0||fur.height<=0)
      issues.push({severity:'error',itemId:fur.id,message:'家具の寸法が不正'});
  }
  if(vertexMap.size!==floor.vertices.length)issues.push({severity:'error',message:'頂点ID重複'});
  return issues;
}
export function validateProject(value:unknown):Issue[] {
  if(!value||typeof value!=='object')return [{severity:'error',message:'JSONオブジェクトではありません'}];
  const p=value as Partial<HouseProject>;
  if(p.schemaVersion!=='1.0.0'||p.units!=='m'||!Array.isArray(p.floors))
    return [{severity:'error',message:'schemaVersion・units・floorsが不正'}];
  const issues:Issue[]=[];
  for(const floor of p.floors){
    if(!floor||!Array.isArray(floor.vertices)||!Array.isArray(floor.walls)||!Array.isArray(floor.rooms)||!Array.isArray(floor.openings)||!Array.isArray(floor.furniture))
      return [{severity:'error',message:'階のデータ構造が不正'}];
    issues.push(...validateFloor(floor));
  }
  return issues;
}
