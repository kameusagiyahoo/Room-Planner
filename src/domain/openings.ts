import type {Floor,Opening,Point,Wall} from './model';
import {newId} from './model';
import {distance,wallPoints} from './geometry';
export function offsetForPoint(f:Floor,w:Wall,p:Point):number{
  const pts=wallPoints(f,w);if(!pts)throw Error('壁の頂点がありません');
  const [a,b]=pts,dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);
  if(L<0.01)throw Error('壁が短すぎます');
  return Math.max(0,Math.min(L,((p.x-a.x)*dx+(p.y-a.y)*dy)/L));
}
export function addOpening(f:Floor,wallId:string,offset:number,kind:'door'|'window'):Opening{
  const w=f.walls.find(w=>w.id===wallId),pts=w&&wallPoints(f,w);
  if(!pts)throw Error('壁を選択してください');
  const L=distance(...pts),width=kind==='door'?0.85:1.2;
  if(L<width+0.06)throw Error('壁が短く、開口部を配置できません');
  const o:Opening={id:newId('opening'),kind,wallId,
    offset:Math.max(width/2+0.03,Math.min(offset,L-width/2-0.03)),
    width,height:kind==='door'?2:1.2,sillHeight:kind==='door'?0:0.85,
    style:kind==='door'?'hinged':'sliding',
    ...(kind==='door'?{swing:'right' as const,open:false}:{})
  };
  f.openings.push(o);return o;
}
export function moveOpening(f:Floor,id:string,offset:number):void{
  const o=f.openings.find(o=>o.id===id),w=o&&f.walls.find(w=>w.id===o.wallId),pts=w&&wallPoints(f,w);
  if(!o||!pts)throw Error('ドア・窓が見つかりません');
  const L=distance(...pts);
  if(L<o.width+0.06)throw Error('壁が短すぎます');
  o.offset=Math.max(o.width/2+0.03,Math.min(offset,L-o.width/2-0.03));
}
