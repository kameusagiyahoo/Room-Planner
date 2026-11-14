import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { Floor, Point } from '../domain/model';
import { distance, getBounds, openingMidpoint, pointInPolygon, roomArea, roomPolygon, wallPoints } from '../domain/geometry';
export type DrawTool='select'|'room'|'vertex';
type Props={floor:Floor;tool:DrawTool;selectedRoom:string|null;onSelect:(id:string|null)=>void;onAddRoom:(a:Point,b:Point)=>void;onMoveVertex:(id:string,p:Point)=>void};
type Drag={kind:'room'|'vertex';start:Point;current:Point;vertexId?:string};
export function PlanEditor({floor,tool,selectedRoom,onSelect,onAddRoom,onMoveVertex}:Props){
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
    const p=toWorld(e),element=e.target as Element;
    if(tool==='room'){setDrag({kind:'room',start:p,current:p});e.currentTarget.setPointerCapture(e.pointerId);return;}
    if(tool==='vertex'){
      const circle=element.closest('[data-vertex]'),id=circle?.getAttribute('data-vertex');
      if(id){setDrag({kind:'vertex',vertexId:id,start:p,current:p});e.currentTarget.setPointerCapture(e.pointerId);}
      return;
    }
    const room=[...floor.rooms].reverse().find(r=>pointInPolygon(p,roomPolygon(floor,r)));
    onSelect(room?.id||null);
  };
  const onMove=(e:PointerEvent<SVGSVGElement>)=>{if(drag)setDrag({...drag,current:toWorld(e)});};
  const onUp=(e:PointerEvent<SVGSVGElement>)=>{
    if(!drag)return;
    const p=toWorld(e);
    if(drag.kind==='room'&&distance(drag.start,p)>0.7)onAddRoom(drag.start,p);
    if(drag.kind==='vertex'&&drag.vertexId&&distance(drag.start,p)>0.03)onMoveVertex(drag.vertexId,p);
    setDrag(null);
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const step=1,lines=[];
  for(let x=Math.floor(bounds.minX);x<=bounds.maxX;x+=step)lines.push(<line key={'x'+x} x1={x} y1={bounds.minY} x2={x} y2={bounds.maxY} stroke="#dce4ed" strokeWidth=".015"/>);
  for(let y=Math.floor(bounds.minY);y<=bounds.maxY;y+=step)lines.push(<line key={'y'+y} x1={bounds.minX} y1={y} x2={bounds.maxX} y2={y} stroke="#dce4ed" strokeWidth=".015"/>);
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
      const points=wallPoints(floor,w);if(!points)return null;
      return <line key={w.id} x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y}
        stroke="#314b62" strokeWidth={w.thickness} strokeLinecap="square"/>;
    })}
    {floor.openings.map(o=>{
      const wall=floor.walls.find(w=>w.id===o.wallId);if(!wall)return null;
      const pts=wallPoints(floor,wall),center=openingMidpoint(floor,wall,o.offset);
      if(!pts||!center)return null;
      const d={x:(pts[1].x-pts[0].x)/distance(...pts),y:(pts[1].y-pts[0].y)/distance(...pts)};
      const a={x:center.x-d.x*o.width/2,y:center.y-d.y*o.width/2};
      const b={x:center.x+d.x*o.width/2,y:center.y+d.y*o.width/2};
      return <g key={o.id}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#f9fbff" strokeWidth={wall.thickness+.04}/>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={o.kind==='door'?'#cf803a':'#20a2ca'} strokeWidth=".035"/>
      </g>;
    })}
    {floor.furniture.map(f=><g key={f.id} transform={`rotate(${f.rotation} ${f.x+f.width/2} ${f.y+f.depth/2})`}>
      <rect x={f.x} y={f.y} width={f.width} height={f.depth} rx=".05" stroke="#9d875c" strokeWidth=".025" fill="#f4dba8"/>
      <text x={f.x+f.width/2} y={f.y+f.depth/2} fill="#685534" textAnchor="middle" fontSize=".15">{f.name}</text>
    </g>)}
    {tool==='vertex'&&floor.vertices.map(v=><circle key={v.id} data-vertex={v.id} cx={v.x} cy={v.y} r=".12" fill="#f9a825" stroke="#fff" strokeWidth=".035"/>)}
    {drag?.kind==='room'&&<rect x={Math.min(drag.start.x,drag.current.x)} y={Math.min(drag.start.y,drag.current.y)}
      width={Math.abs(drag.start.x-drag.current.x)} height={Math.abs(drag.start.y-drag.current.y)}
      fill="#63aadb" fillOpacity=".2" stroke="#2375a4" strokeWidth=".04" strokeDasharray=".16,.09"/>}
    {drag?.kind==='vertex'&&drag.vertexId&&<circle cx={drag.current.x} cy={drag.current.y} r=".14" fill="#ed6c3d"/>}
  </svg>;
}
