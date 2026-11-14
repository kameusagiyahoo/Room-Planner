import {useRef,useState} from 'react';
import type {PointerEvent} from 'react';
import type {Floor,Point} from '../domain/model';
import {distance,getBounds,openingMidpoint,pointInPolygon,roomArea,roomPolygon,wallPoints} from '../domain/geometry';
import {offsetForPoint} from '../domain/openings';

export type DrawTool='select'|'room'|'vertex'|'door'|'window'|'furniture';
type Props={
  floor:Floor;tool:DrawTool;
  selectedRoom:string|null;selectedWall:string|null;selectedOpening:string|null;selectedFurniture:string|null;
  onSelectRoom:(id:string|null)=>void;onSelectWall:(id:string|null)=>void;onSelectOpening:(id:string|null)=>void;onSelectFurniture:(id:string|null)=>void;
  onAddRoom:(a:Point,b:Point)=>void;onMoveVertex:(id:string,p:Point)=>void;
  onAddOpening:(kind:'door'|'window',wallId:string,offset:number)=>void;
  onMoveOpening:(id:string,offset:number)=>void;
  onAddFurniture:(point:Point)=>void;onMoveFurniture:(id:string,point:Point)=>void;
};
type Drag={kind:'room'|'vertex'|'opening'|'furniture';start:Point;current:Point;id?:string};
export function PlanEditor({floor,tool,selectedRoom,selectedWall,selectedOpening,selectedFurniture,
  onSelectRoom,onSelectWall,onSelectOpening,onSelectFurniture,onAddRoom,onMoveVertex,onAddOpening,onMoveOpening,onAddFurniture,onMoveFurniture}:Props){
  const svgRef=useRef<SVGSVGElement>(null),[drag,setDrag]=useState<Drag|null>(null);
  const bounds=getBounds(floor),width=Math.max(8,bounds.maxX-bounds.minX),height=Math.max(6,bounds.maxY-bounds.minY);
  const viewBox=[bounds.minX,bounds.minY,width,height].join(' ');
  const toWorld=(e:PointerEvent<SVGSVGElement>):Point=>{
    const svg=svgRef.current;if(!svg)return {x:0,y:0};
    const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;
    const matrix=svg.getScreenCTM();const converted=matrix?pt.matrixTransform(matrix.inverse()):pt;
    return {x:converted.x,y:converted.y};
  };
  const onDown=(e:PointerEvent<SVGSVGElement>)=>{
    if(e.button!==0 && e.pointerType==='mouse')return;
    const p=toWorld(e),el=e.target as Element;
    if(tool==='room'){
      setDrag({kind:'room',start:p,current:p});e.currentTarget.setPointerCapture(e.pointerId);return;
    }
    if(tool==='vertex'){
      const id=el.closest('[data-vertex]')?.getAttribute('data-vertex');
      if(id){setDrag({kind:'vertex',id,start:p,current:p});e.currentTarget.setPointerCapture(e.pointerId);}
      return;
    }
    if(tool==='furniture'){onAddFurniture(p);return;}
    const furnitureId=el.closest('[data-furniture-id]')?.getAttribute('data-furniture-id');
    if(tool==='select'&&furnitureId){
      onSelectFurniture(furnitureId);setDrag({kind:'furniture',id:furnitureId,start:p,current:p});
      e.currentTarget.setPointerCapture(e.pointerId);return;
    }
    const openingId=el.closest('[data-opening-id]')?.getAttribute('data-opening-id');
    if(tool==='select' && openingId){
      onSelectOpening(openingId);
      setDrag({kind:'opening',id:openingId,start:p,current:p});
      e.currentTarget.setPointerCapture(e.pointerId);return;
    }
    const wallId=el.closest('[data-wall-id]')?.getAttribute('data-wall-id');
    const wall=floor.walls.find(w=>w.id===wallId);
    if((tool==='door'||tool==='window')&&wall){
      onAddOpening(tool,wall.id,offsetForPoint(floor,wall,p));return;
    }
    if(tool==='select'&&wall){onSelectWall(wall.id);return;}
    const room=[...floor.rooms].reverse().find(r=>pointInPolygon(p,roomPolygon(floor,r)));
    onSelectRoom(room?.id||null);
  };
  const onMove=(e:PointerEvent<SVGSVGElement>)=>{if(drag)setDrag({...drag,current:toWorld(e)});};
  const onUp=(e:PointerEvent<SVGSVGElement>)=>{
    if(!drag)return;
    const p=toWorld(e);
    if(drag.kind==='room'&&distance(drag.start,p)>0.7)onAddRoom(drag.start,p);
    if(drag.kind==='vertex'&&drag.id&&distance(drag.start,p)>0.03)onMoveVertex(drag.id,p);
    if(drag.kind==='furniture'&&drag.id&&distance(drag.start,p)>0.03){
      const f=floor.furniture.find(f=>f.id===drag.id);
      if(f)onMoveFurniture(drag.id,{x:p.x-f.width/2,y:p.y-f.depth/2});
    }
    if(drag.kind==='opening'&&drag.id&&distance(drag.start,p)>0.03){
      const opening=floor.openings.find(o=>o.id===drag.id),wall=opening&&floor.walls.find(w=>w.id===opening.wallId);
      if(wall)onMoveOpening(drag.id,offsetForPoint(floor,wall,p));
    }
    setDrag(null);
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const lines=[];
  for(let x=Math.floor(bounds.minX);x<=bounds.maxX;x++)lines.push(<line key={'x'+x} x1={x} y1={bounds.minY} x2={x} y2={bounds.maxY} stroke="#dce4ed" strokeWidth=".015"/>);
  for(let y=Math.floor(bounds.minY);y<=bounds.maxY;y++)lines.push(<line key={'y'+y} x1={bounds.minX} y1={y} x2={bounds.maxX} y2={y} stroke="#dce4ed" strokeWidth=".015"/>);
  return <svg aria-label="2D間取り図" ref={svgRef} viewBox={viewBox} preserveAspectRatio="xMidYMid meet"
    onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
    onPointerCancel={()=>setDrag(null)} className="plan-svg" style={{touchAction:'none'}}>
    <rect x={bounds.minX} y={bounds.minY} width={width} height={height} fill="#f9fbff"/>
    {lines}
    {floor.rooms.map(room=>{
      const poly=roomPolygon(floor,room);if(poly.some(p=>!Number.isFinite(p.x)))return null;
      const area=roomArea(floor,room);
      const cx=poly.reduce((s,p)=>s+p.x,0)/poly.length,cy=poly.reduce((s,p)=>s+p.y,0)/poly.length;
      return <g key={room.id}>
        <polygon points={poly.map(p=>p.x+','+p.y).join(' ')} fill={selectedRoom===room.id?'#b4ddf0':'#dfebf2'} fillOpacity=".8"/>
        <text x={cx} y={cy-.15} textAnchor="middle" fontSize=".24" fontWeight="700" fill="#1e3549">{room.name}</text>
        <text x={cx} y={cy+.18} textAnchor="middle" fontSize=".2" fill="#415e73">{area.toFixed(2)}㎡ / {(area/1.62).toFixed(1)}帖</text>
      </g>;
    })}
    {floor.walls.map(w=>{
      const pts=wallPoints(floor,w);if(!pts)return null;
      return <g key={w.id}>
        <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y}
          stroke={selectedWall===w.id?'#1b8ccc':'#314b62'} strokeWidth={w.thickness} strokeLinecap="square"/>
        <line data-wall-id={w.id} x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y}
          stroke="transparent" strokeWidth=".30" pointerEvents="stroke"/>
      </g>;
    })}
    {floor.openings.map(o=>{
      const w=floor.walls.find(w=>w.id===o.wallId),pts=w&&wallPoints(floor,w),center=w&&openingMidpoint(floor,w,o.offset);
      if(!w||!pts||!center)return null;
      const L=distance(...pts),d={x:(pts[1].x-pts[0].x)/L,y:(pts[1].y-pts[0].y)/L};
      const a={x:center.x-d.x*o.width/2,y:center.y-d.y*o.width/2};
      const b={x:center.x+d.x*o.width/2,y:center.y+d.y*o.width/2};
      const color=selectedOpening===o.id?'#df266b':o.kind==='door'?'#cd7d32':'#179bc0';
      return <g key={o.id} data-opening-id={o.id}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#f9fbff" strokeWidth={w.thickness+.06}/>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth=".05"
          strokeDasharray={o.style==='sliding'?'.12,.045':undefined}/>
        {o.kind==='door'&&o.style==='hinged'&&<line x1={a.x} y1={a.y} x2={a.x+d.y*o.width*.65} y2={a.y-d.x*o.width*.65} stroke={color} strokeWidth=".025"/>}
        <circle cx={center.x} cy={center.y} r=".16" fill="transparent" stroke="transparent" strokeWidth=".1"/>
      </g>;
    })}
    {floor.furniture.map(f=><g key={f.id} data-furniture-id={f.id} transform={`rotate(${f.rotation} ${f.x+f.width/2} ${f.y+f.depth/2})`}>
      <rect x={f.x} y={f.y} width={f.width} height={f.depth} rx=".05" stroke={selectedFurniture===f.id?"#df266b":"#9d875c"} strokeWidth={selectedFurniture===f.id?".07":".025"} fill="#f4dba8"/>
      <text x={f.x+f.width/2} y={f.y+f.depth/2} fill="#685534" textAnchor="middle" fontSize=".15" pointerEvents="none">{f.name}</text>
    </g>)}
    {tool==='vertex'&&floor.vertices.map(v=><circle key={v.id} data-vertex={v.id} cx={v.x} cy={v.y} r=".12" fill="#f9a825" stroke="#fff" strokeWidth=".035"/>)}
    {drag?.kind==='room'&&<rect x={Math.min(drag.start.x,drag.current.x)} y={Math.min(drag.start.y,drag.current.y)}
      width={Math.abs(drag.start.x-drag.current.x)} height={Math.abs(drag.start.y-drag.current.y)}
      fill="#63aadb" fillOpacity=".2" stroke="#2375a4" strokeWidth=".04" strokeDasharray=".16,.09"/>}
    {drag?.kind==='vertex'&&<circle cx={drag.current.x} cy={drag.current.y} r=".14" fill="#ed6c3d"/>}
  </svg>;
}
