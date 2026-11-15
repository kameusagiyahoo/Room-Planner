import {useEffect,useRef,useState} from 'react';
import {initialView,panView,pixelScale,zoomView} from '../domain/viewport';
import {SNAP_STEPS,snapLabel,snapPoint} from '../domain/snap';
import type {SnapStep} from '../domain/snap';
import type {PointerEvent} from 'react';
import type {Floor,Point} from '../domain/model';
import {distance,getBounds,openingMidpoint,pointInPolygon,roomArea,roomPolygon,wallPoints} from '../domain/geometry';
import {offsetForPoint} from '../domain/openings';
import {FURNITURE_CORNERS,furnitureCorner,resizeFurnitureCorner,rectangularRoomBounds,
  resizableRoomEdges,roomEdgeMidpoint,proposedRoomBounds} from '../domain/resize';
import type {FurnitureCorner,RoomEdge} from '../domain/resize';

export type DrawTool='select'|'room'|'vertex'|'door'|'window'|'furniture'|'measure'|'stairs';
type Props={
  floor:Floor;tool:DrawTool;snapStep:SnapStep;onSnapChange:(step:SnapStep)=>void;
  measurePoints:Point[];onMeasurePoint:(point:Point)=>void;
  selectedRoom:string|null;selectedWall:string|null;selectedOpening:string|null;selectedFurniture:string|null;selectedStair:string|null;selectedVertex:string|null;
  onSelectRoom:(id:string|null)=>void;onSelectWall:(id:string|null)=>void;onSelectOpening:(id:string|null)=>void;onSelectFurniture:(id:string|null)=>void;onSelectStair:(id:string|null)=>void;onSelectVertex:(id:string|null)=>void;
  onAddRoom:(a:Point,b:Point)=>void;onMoveVertex:(id:string,p:Point)=>void;
  onAddOpening:(kind:'door'|'window',wallId:string,offset:number)=>void;
  onMoveOpening:(id:string,offset:number)=>void;
  onAddStair:(point:Point)=>void;onMoveStair:(id:string,point:Point)=>void;onAddFurniture:(point:Point)=>void;onMoveFurniture:(id:string,point:Point)=>void;
  onResizeFurniture:(id:string,corner:FurnitureCorner,p:Point)=>void;
  onResizeRoom:(id:string,edge:RoomEdge,p:Point)=>void;
};
type Drag={kind:'room'|'vertex'|'opening'|'furniture'|'stair'|'tap'|'pan'|'resize-furniture'|'resize-room';
  start:Point;current:Point;id?:string;grab?:Point;action?:DrawTool;screen?:Point;
  corner?:FurnitureCorner;edge?:RoomEdge};
type Gesture={distance:number;center:Point};
export function PlanEditor({floor,tool,snapStep,onSnapChange,measurePoints,onMeasurePoint,selectedRoom,selectedWall,selectedOpening,selectedFurniture,selectedStair,selectedVertex,
  onSelectRoom,onSelectWall,onSelectOpening,onSelectFurniture,onSelectStair,onSelectVertex,onAddRoom,onMoveVertex,onAddOpening,onMoveOpening,onAddStair,onMoveStair,onAddFurniture,onMoveFurniture,onResizeFurniture,onResizeRoom}:Props){
  const svgRef=useRef<SVGSVGElement>(null),[drag,setDrag]=useState<Drag|null>(null);
  const [viewport,setViewport]=useState(initialView);
  const activePointers=useRef(new Map<number,Point>());
  const gesture=useRef<Gesture|null>(null);
  const pinching=useRef(false);
  useEffect(()=>{setViewport(initialView);setDrag(null);activePointers.current.clear();gesture.current=null;pinching.current=false;},[floor.id]);
  const bounds=getBounds(floor),width=Math.max(8,bounds.maxX-bounds.minX),height=Math.max(6,bounds.maxY-bounds.minY);
  const viewWidth=width/viewport.zoom,viewHeight=height/viewport.zoom;
  const viewBox=[bounds.minX+viewport.panX,bounds.minY+viewport.panY,viewWidth,viewHeight].join(' ');
  const zoom=(factor:number)=>setViewport(v=>zoomView(v,factor,width,height));
  const scaleOfSvg=()=>{
    const box=svgRef.current?.getBoundingClientRect();
    return box?pixelScale(viewport.zoom,width,height,box.width,box.height):1;
  };
  const toWorld=(e:PointerEvent<SVGSVGElement>):Point=>{
    const svg=svgRef.current;if(!svg)return {x:0,y:0};
    const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;
    const matrix=svg.getScreenCTM();const converted=matrix?pt.matrixTransform(matrix.inverse()):pt;
    return {x:converted.x,y:converted.y};
  };
  const targetPosition=(d:Drag):Point=>{
    const grab=d.grab??{x:0,y:0};
    return snapPoint({x:d.current.x-grab.x,y:d.current.y-grab.y},snapStep);
  };
  const onDown=(e:PointerEvent<SVGSVGElement>)=>{
    if(e.button!==0 && e.pointerType==='mouse')return;
    if(e.pointerType==='touch'){
      activePointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      e.currentTarget.setPointerCapture(e.pointerId);
      if(activePointers.current.size>=2){
        const points=[...activePointers.current.values()];
        gesture.current={
          distance:distance(points[0],points[1]),
          center:{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2}
        };
        pinching.current=true;setDrag(null);return;
      }
    }
    if(pinching.current)return;
    const p=toWorld(e),el=e.target as Element;
    if(tool==='select'){
      const furnitureHandle=el.closest('[data-resize-furniture]');
      if(furnitureHandle){
        const id=furnitureHandle.getAttribute('data-resize-furniture');
        const corner=furnitureHandle.getAttribute('data-resize-corner') as FurnitureCorner|null;
        const f=floor.furniture.find(f=>f.id===id);
        if(f&&corner&&FURNITURE_CORNERS.includes(corner)){
          const handle=furnitureCorner(f,corner);
          onSelectFurniture(f.id);
          setDrag({kind:'resize-furniture',id:f.id,corner,start:p,current:p,
            grab:{x:p.x-handle.x,y:p.y-handle.y}});
          e.currentTarget.setPointerCapture(e.pointerId);return;
        }
      }
      const roomHandle=el.closest('[data-resize-room]');
      if(roomHandle){
        const id=roomHandle.getAttribute('data-resize-room');
        const edge=roomHandle.getAttribute('data-resize-edge') as RoomEdge|null;
        if(id&&edge&&resizableRoomEdges(floor,id).includes(edge)){
          const box=rectangularRoomBounds(floor,id)!;
          const handle=roomEdgeMidpoint(box,edge);
          onSelectRoom(id);
          setDrag({kind:'resize-room',id,edge,start:p,current:p,
            grab:{x:p.x-handle.x,y:p.y-handle.y}});
          e.currentTarget.setPointerCapture(e.pointerId);return;
        }
      }
    }
    if(tool==='stairs'){setDrag({kind:'tap',start:p,current:p,action:'stairs'});return;}
    const stairId=el.closest('[data-stair-id]')?.getAttribute('data-stair-id');
    if(tool==='select'&&stairId){
      onSelectStair(stairId);
      const stair=(floor.stairs??[]).find(s=>s.id===stairId);
      setDrag({kind:'stair',id:stairId,start:p,current:p,
        grab:stair?{x:p.x-stair.x,y:p.y-stair.y}:undefined});
      e.currentTarget.setPointerCapture(e.pointerId);return;
    }
    if(tool==='measure'){setDrag({kind:'tap',start:p,current:p,action:'measure'});return;}
    if(tool==='room'){
      setDrag({kind:'room',start:p,current:p});e.currentTarget.setPointerCapture(e.pointerId);return;
    }
    if(tool==='vertex'){
      const id=el.closest('[data-vertex]')?.getAttribute('data-vertex');
      if(id){onSelectVertex(id);setDrag({kind:'vertex',id,start:p,current:p});e.currentTarget.setPointerCapture(e.pointerId);}
      return;
    }
    if(tool==='furniture'){setDrag({kind:'tap',start:p,current:p,action:'furniture'});return;}
    const furnitureId=el.closest('[data-furniture-id]')?.getAttribute('data-furniture-id');
    if(tool==='select'&&furnitureId){
      onSelectFurniture(furnitureId);
      const furniture=floor.furniture.find(f=>f.id===furnitureId);
      setDrag({kind:'furniture',id:furnitureId,start:p,current:p,
        grab:furniture?{x:p.x-furniture.x,y:p.y-furniture.y}:undefined});
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
      setDrag({kind:'tap',id:wall.id,start:p,current:p,action:tool});return;
    }
    if(tool==='select'&&wall){onSelectWall(wall.id);return;}
    const room=[...floor.rooms].reverse().find(r=>pointInPolygon(p,roomPolygon(floor,r)));
    onSelectRoom(room?.id||null);
    setDrag({kind:'pan',start:p,current:p,screen:{x:e.clientX,y:e.clientY}});
    if(e.pointerType==='mouse')e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove=(e:PointerEvent<SVGSVGElement>)=>{
    if(activePointers.current.has(e.pointerId)){
      activePointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(activePointers.current.size>=2){
        const p=[...activePointers.current.values()];
        const next={distance:distance(p[0],p[1]),
          center:{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2}};
        const prev=gesture.current;
        if(prev&&prev.distance>0&&next.distance>0){
          const scale=scaleOfSvg();
          setViewport(v=>panView(zoomView(v,next.distance/prev.distance,width,height),
            next.center.x-prev.center.x,next.center.y-prev.center.y,scale));
        }
        gesture.current=next;return;
      }
    }
    if(pinching.current)return;
    if(drag?.kind==='pan'&&drag.screen){
      const scale=scaleOfSvg();
      setViewport(v=>panView(v,e.clientX-drag.screen!.x,e.clientY-drag.screen!.y,scale));
      setDrag({...drag,screen:{x:e.clientX,y:e.clientY}});return;
    }
    if(drag)setDrag({...drag,current:toWorld(e)});
  };
  const onUp=(e:PointerEvent<SVGSVGElement>)=>{
    if(e.pointerType==='touch'){
      activePointers.current.delete(e.pointerId);
      if(activePointers.current.size<2)gesture.current=null;
      if(pinching.current){
        if(activePointers.current.size===0)pinching.current=false;
        setDrag(null);
        if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
        return;
      }
    }
    if(!drag)return;
    const p=toWorld(e);
    if(drag.kind==='tap'&&distance(drag.start,p)<.2){
      if(drag.action==='measure')onMeasurePoint(drag.start);
      else if(drag.action==='furniture')onAddFurniture(drag.start);
      else if(drag.action==='stairs')onAddStair(drag.start);
      else if((drag.action==='door'||drag.action==='window')&&drag.id){
        const wall=floor.walls.find(w=>w.id===drag.id);
        if(wall)onAddOpening(drag.action,wall.id,offsetForPoint(floor,wall,drag.start));
      }
    }
    if(drag.kind==='room'&&distance(drag.start,p)>0.7)onAddRoom(snapPoint(drag.start,snapStep),snapPoint(p,snapStep));
    if(drag.kind==='vertex'&&drag.id&&distance(drag.start,p)>0.03)onMoveVertex(drag.id,snapPoint(p,snapStep));
    if(drag.kind==='resize-furniture'&&drag.id&&drag.corner&&distance(drag.start,p)>0.03){
      onResizeFurniture(drag.id,drag.corner,{x:p.x-(drag.grab?.x??0),y:p.y-(drag.grab?.y??0)});
    }
    if(drag.kind==='resize-room'&&drag.id&&drag.edge&&distance(drag.start,p)>0.03){
      onResizeRoom(drag.id,drag.edge,{x:p.x-(drag.grab?.x??0),y:p.y-(drag.grab?.y??0)});
    }
    if(drag.kind==='furniture'&&drag.id&&distance(drag.start,p)>0.03){
      const f=floor.furniture.find(f=>f.id===drag.id);
      if(f)onMoveFurniture(drag.id,targetPosition({...drag,current:p}));
    }
    if(drag.kind==='stair'&&drag.id&&distance(drag.start,p)>0.03){
      onMoveStair(drag.id,targetPosition({...drag,current:p}));
    }
    if(drag.kind==='opening'&&drag.id&&distance(drag.start,p)>0.03){
      const opening=floor.openings.find(o=>o.id===drag.id),wall=opening&&floor.walls.find(w=>w.id===opening.wallId);
      if(wall)onMoveOpening(drag.id,offsetForPoint(floor,wall,p));
    }
    setDrag(null);
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onWheel=(e:React.WheelEvent<SVGSVGElement>)=>{
    e.preventDefault();zoom(e.deltaY<0?1.12:1/1.12);
  };
  const cancel=(e:PointerEvent<SVGSVGElement>)=>{
    activePointers.current.delete(e.pointerId);
    if(activePointers.current.size<2)gesture.current=null;
    if(activePointers.current.size===0)pinching.current=false;
    setDrag(null);
  };
  const resizeFurnitureModel=drag?.kind==='resize-furniture'?floor.furniture.find(f=>f.id===drag.id):null;
  const resizeFurniturePoint=drag?.kind==='resize-furniture'?
    {x:drag.current.x-(drag.grab?.x??0),y:drag.current.y-(drag.grab?.y??0)}:null;
  const resizedFurniture=resizeFurnitureModel&&drag?.corner&&resizeFurniturePoint?
    {...resizeFurnitureModel,...resizeFurnitureCorner(resizeFurnitureModel,drag.corner,resizeFurniturePoint,snapStep)}:null;
  const resizeRoomModel=drag?.kind==='resize-room'?rectangularRoomBounds(floor,drag.id??''):null;
  const resizedRoom=resizeRoomModel&&drag?.edge?proposedRoomBounds(
    resizeRoomModel,drag.edge,
    (drag.edge==='left'||drag.edge==='right'?drag.current.x-(drag.grab?.x??0):drag.current.y-(drag.grab?.y??0)),snapStep):null;
  const selectedFurnitureModel=floor.furniture.find(f=>f.id===selectedFurniture);
  const selectedRoomBox=selectedRoom?rectangularRoomBounds(floor,selectedRoom):null;
  const selectedEdges=selectedRoom?resizableRoomEdges(floor,selectedRoom):[];
  const screenScale=scaleOfSvg();
  const handleRadius=Math.max(.20,Math.min(.75,22/Math.max(1,screenScale)));
  // Tiny furniture cannot have four separate 44px touch targets without overlap.
  // Show the southeast handle until the user zooms in sufficiently.
  const visibleFurnitureCorners=selectedFurnitureModel&&
    Math.min(selectedFurnitureModel.width,selectedFurnitureModel.depth)*screenScale<55?
      FURNITURE_CORNERS.filter(c=>c==='se'):FURNITURE_CORNERS;
  const roomStart=drag?.kind==='room'?snapPoint(drag.start,snapStep):null;
  const roomEnd=drag?.kind==='room'?snapPoint(drag.current,snapStep):null;
  const movedFurniture=drag?.kind==='furniture'?floor.furniture.find(f=>f.id===drag.id):null;
  const movedStair=drag?.kind==='stair'?(floor.stairs??[]).find(s=>s.id===drag.id):null;
  const proposed=drag&&(drag.kind==='furniture'||drag.kind==='stair')?targetPosition(drag):null;
  const lines=[];
  for(let x=Math.floor(bounds.minX+viewport.panX-1);x<=Math.ceil(bounds.minX+viewport.panX+viewWidth+1);x++)lines.push(<line key={'x'+x} x1={x} y1={bounds.minY+viewport.panY-1} x2={x} y2={bounds.minY+viewport.panY+viewHeight+1} stroke="#dce4ed" strokeWidth=".015"/>);
  for(let y=Math.floor(bounds.minY+viewport.panY-1);y<=Math.ceil(bounds.minY+viewport.panY+viewHeight+1);y++)lines.push(<line key={'y'+y} x1={bounds.minX+viewport.panX-1} y1={y} x2={bounds.minX+viewport.panX+viewWidth+1} y2={y} stroke="#dce4ed" strokeWidth=".015"/>);
  return <div className="plan-editor-shell"><svg aria-label="2D間取り図" ref={svgRef} viewBox={viewBox} preserveAspectRatio="xMidYMid meet"
    onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onWheel={onWheel}
    onPointerCancel={cancel} className="plan-svg" style={{touchAction:'none'}}>
    <rect x={bounds.minX+viewport.panX-1} y={bounds.minY+viewport.panY-1} width={viewWidth+2} height={viewHeight+2} fill="#f9fbff"/>
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
    {measurePoints.length===2&&<g pointerEvents="none">
      <line x1={measurePoints[0].x} y1={measurePoints[0].y} x2={measurePoints[1].x} y2={measurePoints[1].y}
        stroke="#b82b74" strokeWidth=".055" strokeDasharray=".2,.07"/>
      <circle cx={measurePoints[1].x} cy={measurePoints[1].y} r=".1" fill="#b82b74"/>
    </g>}
    {measurePoints.length===1&&<circle pointerEvents="none" cx={measurePoints[0].x} cy={measurePoints[0].y} r=".1" fill="#b82b74"/>}
    {(floor.stairs??[]).map(stair=><g key={stair.id} data-stair-id={stair.id}
      transform={`rotate(${stair.rotation} ${stair.x+stair.width/2} ${stair.y+stair.run/2})`}>
      <rect x={stair.x} y={stair.y} width={stair.width} height={stair.run} fill="#d8d4c8"
        stroke={selectedStair===stair.id?'#df266b':'#756e61'} strokeWidth=".05"/>
      {Array.from({length:12},(_,i)=><line key={i} x1={stair.x} x2={stair.x+stair.width}
        y1={stair.y+(i+1)*stair.run/13} y2={stair.y+(i+1)*stair.run/13} stroke="#756e61" strokeWidth=".02" pointerEvents="none"/>)}
      <text x={stair.x+stair.width/2} y={stair.y+stair.run/2} fontSize=".16" textAnchor="middle" fill="#473f35" pointerEvents="none">階段 ↑</text>
    </g>)}
    {floor.furniture.map(f=><g key={f.id} data-furniture-id={f.id} transform={`rotate(${f.rotation} ${f.x+f.width/2} ${f.y+f.depth/2})`}>
      <rect x={f.x} y={f.y} width={f.width} height={f.depth} rx=".05" stroke={selectedFurniture===f.id?"#df266b":"#9d875c"} strokeWidth={selectedFurniture===f.id?".07":".025"} fill="#f4dba8"/>
      <text x={f.x+f.width/2} y={f.y+f.depth/2} fill="#685534" textAnchor="middle" fontSize=".15" pointerEvents="none">{f.name}</text>
    </g>)}
    {tool==='vertex'&&floor.vertices.map(v=><circle key={v.id} data-vertex={v.id} cx={v.x} cy={v.y}
      r={selectedVertex===v.id?".18":".15"} fill={selectedVertex===v.id?"#e15d46":"#f9a825"} stroke="#fff" strokeWidth=".035"/>)}
    {roomStart&&roomEnd&&<g pointerEvents="none">
      <rect x={Math.min(roomStart.x,roomEnd.x)} y={Math.min(roomStart.y,roomEnd.y)}
        width={Math.abs(roomStart.x-roomEnd.x)} height={Math.abs(roomStart.y-roomEnd.y)}
        fill="#63aadb" fillOpacity=".2" stroke="#2375a4" strokeWidth=".04" strokeDasharray=".16,.09"/>
      <text x={(roomStart.x+roomEnd.x)/2} y={(roomStart.y+roomEnd.y)/2} fontSize=".24" fill="#155985"
        textAnchor="middle">{Math.abs(roomStart.x-roomEnd.x).toFixed(2)} × {Math.abs(roomStart.y-roomEnd.y).toFixed(2)} m</text>
    </g>}
    {drag?.kind==='vertex'&&<g pointerEvents="none">
      <circle cx={snapPoint(drag.current,snapStep).x} cy={snapPoint(drag.current,snapStep).y}
        r=".15" fill="#ed6c3d" stroke="white" strokeWidth=".03"/>
      <text x={snapPoint(drag.current,snapStep).x+.18} y={snapPoint(drag.current,snapStep).y-.18}
        fill="#ad3c2e" fontSize=".2">{snapPoint(drag.current,snapStep).x.toFixed(2)}, {snapPoint(drag.current,snapStep).y.toFixed(2)}</text>
    </g>}
    {movedFurniture&&proposed&&<g pointerEvents="none" transform={`rotate(${movedFurniture.rotation} ${proposed.x+movedFurniture.width/2} ${proposed.y+movedFurniture.depth/2})`}>
      <rect x={proposed.x} y={proposed.y} width={movedFurniture.width} height={movedFurniture.depth}
        rx=".05" fill="#32a9ca" fillOpacity=".25" stroke="#0c80b0" strokeWidth=".055" strokeDasharray=".13,.08"/>
    </g>}
    {movedStair&&proposed&&<g pointerEvents="none" transform={`rotate(${movedStair.rotation} ${proposed.x+movedStair.width/2} ${proposed.y+movedStair.run/2})`}>
      <rect x={proposed.x} y={proposed.y} width={movedStair.width} height={movedStair.run}
        fill="#32a9ca" fillOpacity=".25" stroke="#0c80b0" strokeWidth=".055" strokeDasharray=".13,.08"/>
    </g>}
    {proposed&&<g pointerEvents="none">
      <text x={proposed.x} y={proposed.y-.16} fontSize=".2" fill="#0c80b0">
        {proposed.x.toFixed(2)}, {proposed.y.toFixed(2)} m
      </text>
    </g>}
    {resizedRoom&&<g pointerEvents="none">
      <rect x={resizedRoom.minX} y={resizedRoom.minY}
        width={resizedRoom.maxX-resizedRoom.minX} height={resizedRoom.maxY-resizedRoom.minY}
        fill="#1b87ce" fillOpacity=".10" stroke="#1475b4" strokeWidth=".06" strokeDasharray=".12,.08"/>
      <text x={(resizedRoom.minX+resizedRoom.maxX)/2} y={(resizedRoom.minY+resizedRoom.maxY)/2}
        textAnchor="middle" fill="#11568a" fontSize=".24">
        {(resizedRoom.maxX-resizedRoom.minX).toFixed(2)} × {(resizedRoom.maxY-resizedRoom.minY).toFixed(2)} m
      </text>
    </g>}
    {resizedFurniture&&<g pointerEvents="none"
      transform={`rotate(${resizedFurniture.rotation} ${resizedFurniture.x+resizedFurniture.width/2} ${resizedFurniture.y+resizedFurniture.depth/2})`}>
      <rect x={resizedFurniture.x} y={resizedFurniture.y}
        width={resizedFurniture.width} height={resizedFurniture.depth}
        fill="#198bc6" fillOpacity=".20" stroke="#0a76b2" strokeWidth=".055" strokeDasharray=".12,.08"/>
      <text x={resizedFurniture.x+resizedFurniture.width/2} y={resizedFurniture.y+resizedFurniture.depth/2}
        fontSize=".18" textAnchor="middle" fill="#125b86">
        {resizedFurniture.width.toFixed(2)} × {resizedFurniture.depth.toFixed(2)} m
      </text>
    </g>}
    {tool==='select'&&selectedRoom&&selectedRoomBox&&selectedEdges.map(edge=>{
      const p=roomEdgeMidpoint(selectedRoomBox,edge);
      return <g key={edge} role="button" aria-label={'部屋の'+edge+'側を伸縮'}
        data-resize-room={selectedRoom} data-resize-edge={edge} className="plan-resize-handle">
        <circle cx={p.x} cy={p.y} r={handleRadius} fill="transparent" stroke="transparent"/>
        <circle cx={p.x} cy={p.y} r=".18" fill="#fff" stroke="#177eaf" strokeWidth=".07" pointerEvents="none"/>
        <text x={p.x} y={p.y+.065} fontSize=".19" textAnchor="middle" fill="#177eaf" pointerEvents="none">
          {edge==='left'||edge==='right'?'↔':'↕'}
        </text>
      </g>;
    })}
    {tool==='select'&&selectedFurnitureModel&&visibleFurnitureCorners.map(corner=>{
      const p=furnitureCorner(selectedFurnitureModel,corner);
      return <g key={corner} role="button" aria-label={'家具の'+corner+'角を伸縮'}
        data-resize-furniture={selectedFurnitureModel.id} data-resize-corner={corner} className="plan-resize-handle">
        <circle cx={p.x} cy={p.y} r={handleRadius} fill="transparent" stroke="transparent"/>
        <circle cx={p.x} cy={p.y} r=".16" fill="#fff" stroke="#df266b" strokeWidth=".075" pointerEvents="none"/>
      </g>;
    })}
  </svg>
    <button type="button" className="plan-snap-chip" aria-label={'グリッド吸着: '+snapLabel(snapStep)}
      onClick={()=>onSnapChange(SNAP_STEPS[(SNAP_STEPS.indexOf(snapStep)+1)%SNAP_STEPS.length])}>
      {snapLabel(snapStep)} <span aria-hidden="true">⌄</span>
    </button>
    <div className="plan-zoom" aria-label="表示倍率">
      <button onClick={()=>zoom(1.3)} aria-label="拡大">＋</button>
      <button onClick={()=>setViewport(initialView)} aria-label="全体表示">全体</button>
      <button onClick={()=>zoom(1/1.3)} aria-label="縮小">−</button>
    </div>
  </div>;
}
