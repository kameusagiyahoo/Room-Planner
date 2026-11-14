import {useEffect,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import type {Floor,HouseProject,Point} from '../domain/model';
import {distance,getBounds,pointInPolygon,roomPolygon,wallPoints} from '../domain/geometry';
import {blocked,movePlayer,PLAYER_RADIUS} from '../domain/collision';
import {advanceStair,stairwellOpenings,tryEnterStair,walkCollisionWorld,routeForStair} from '../domain/stairWalking';
import type {StairTraversal} from '../domain/stairWalking';
import {addFurnitureModels} from '../viewer3d/furnitureMeshes';

type Props={project:HouseProject;activeFloorId:string;onFloorChange:(id:string)=>void};
type Pose={floorId:string;p:Point;yaw:number;pitch:number};
const signedArea=(p:Point[])=>p.reduce((s,v,i)=>{
  const q=p[(i+1)%p.length];return s+v.x*q.y-q.x*v.y;
},0)/2;
function floorGeometry(floor:Floor,project:HouseProject):THREE.BufferGeometry[]{
  const geometries:THREE.BufferGeometry[]=[];
  const holes=stairwellOpenings(project,floor.id);
  for(const room of floor.rooms){
    const polygon=roomPolygon(floor,room);
    if(polygon.length<3||polygon.some(p=>!Number.isFinite(p.x)))continue;
    const shape=new THREE.Shape();
    polygon.forEach((p,i)=>i?shape.lineTo(p.x,p.y):shape.moveTo(p.x,p.y));
    shape.closePath();
    for(const hole of holes){
      // THREE.ShapeGeometry expects opposite winding for interior contours.
      if(!hole.every(p=>pointInPolygon(p,polygon)))continue;
      const ordered=signedArea(polygon)*signedArea(hole)>0?[...hole].reverse():hole;
      const path=new THREE.Path();
      ordered.forEach((p,i)=>i?path.lineTo(p.x,p.y):path.moveTo(p.x,p.y));
      path.closePath();shape.holes.push(path);
    }
    geometries.push(new THREE.ShapeGeometry(shape));
  }
  return geometries;
}
function spawnPoint(floor:Floor,project:HouseProject,eyeHeight:number):Point{
  const world=walkCollisionWorld(project,floor.id,eyeHeight);
  for(const room of floor.rooms){
    const poly=roomPolygon(floor,room);
    if(poly.length<3||poly.some(p=>!Number.isFinite(p.x)))continue;
    const bounds={minX:Math.min(...poly.map(p=>p.x)),maxX:Math.max(...poly.map(p=>p.x)),
      minY:Math.min(...poly.map(p=>p.y)),maxY:Math.max(...poly.map(p=>p.y))};
    for(let y=bounds.minY+.34;y<bounds.maxY;y+=.34){
      for(let x=bounds.minX+.34;x<bounds.maxX;x+=.34){
        if(pointInPolygon({x,y},poly)&&!blocked(world,{x,y},PLAYER_RADIUS))return {x,y};
      }
    }
  }
  const bounds=getBounds(floor);
  return {x:(bounds.minX+bounds.maxX)/2,y:(bounds.minY+bounds.maxY)/2};
}
export function BuildingViewer3D({project,activeFloorId,onFloorChange}:Props){
  const host=useRef<HTMLDivElement>(null);
  const [walking,setWalking]=useState(false);
  const [eyeHeight,setEyeHeight]=useState(1.6);
  const [currentFloor,setCurrentFloor]=useState(activeFloorId);
  const walkRef=useRef(walking);walkRef.current=walking;
  const onFloorChangeRef=useRef(onFloorChange);onFloorChangeRef.current=onFloorChange;
  const touch=useRef({forward:0,side:0,turn:0});
  const keys=useRef(new Set<string>());
  const poseRef=useRef<Pose|null>(null);
  const travelRef=useRef<StairTraversal|null>(null);
  const internalSwitch=useRef<string|null>(null);
  const pendingFloor=useRef<string|null>(null);
  useEffect(()=>{
    if(internalSwitch.current===activeFloorId){
      internalSwitch.current=null;return;
    }
    pendingFloor.current=activeFloorId;
    setCurrentFloor(activeFloorId);
    poseRef.current=null;travelRef.current=null;
  },[activeFloorId]);
  useEffect(()=>{
    const node=host.current;
    if(!node)return;
    const selected=project.floors.find(f=>f.id===activeFloorId)||project.floors[0];
    if(!selected)return;
    const scene=new THREE.Scene();scene.background=new THREE.Color('#eaf0f6');
    const centerBounds=getBounds(selected);
    const span=Math.max(8,centerBounds.maxX-centerBounds.minX,centerBounds.maxY-centerBounds.minY);
    const center=new THREE.Vector3((centerBounds.minX+centerBounds.maxX)/2,selected.elevation,
      -(centerBounds.minY+centerBounds.maxY)/2);
    const camera=new THREE.PerspectiveCamera(58,1,.05,400);
    camera.position.set(center.x+span*.8,center.y+span*.9,center.z+span*.8);
    const renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    node.appendChild(renderer.domElement);
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.target.set(center.x,center.y,center.z);controls.enableDamping=true;
    const first=poseRef.current;
    let pose:Pose=first&&project.floors.some(f=>f.id===first.floorId)?first:{
      floorId:selected.id,p:spawnPoint(selected,project,eyeHeight),yaw:0,pitch:0
    };
    const validCurrent=project.floors.find(f=>f.id===pose.floorId);
    if(validCurrent&&blocked(walkCollisionWorld(project,pose.floorId,eyeHeight),pose.p,PLAYER_RADIUS)
      &&!travelRef.current)pose={...pose,p:spawnPoint(validCurrent,project,eyeHeight)};
    poseRef.current=pose;
    // Model edits invalidate a partially traversed route.
    travelRef.current=null;
    scene.add(new THREE.AmbientLight(0xffffff,1.25));
    const sun=new THREE.DirectionalLight(0xffffff,2.1);sun.position.set(10,20,8);scene.add(sun);
    const floorMaterial=new THREE.MeshStandardMaterial({color:0xd9e7dc,side:THREE.DoubleSide});
    const wallMaterial=new THREE.MeshStandardMaterial({color:0x9eacba});
    const windowMaterial=new THREE.MeshStandardMaterial({color:0x5bb6d5,transparent:true,opacity:.35});
    const doorMaterial=new THREE.MeshStandardMaterial({color:0xb98f5a,transparent:true,opacity:.8});
    const stairMaterial=new THREE.MeshStandardMaterial({color:0xc7a678,roughness:.85});
    const railMaterial=new THREE.MeshStandardMaterial({color:0x645447,roughness:.6});
    const disposers:Array<()=>void>=[];
    const box=(length:number,height:number,thickness:number,x:number,y:number,z:number,
      angle:number,material:THREE.Material)=>{
      if(length<=.001||height<=.001||thickness<=.001)return;
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(length,height,thickness),material);
      mesh.position.set(x,y,z);mesh.rotation.y=angle;scene.add(mesh);
    };
    for(const floor of project.floors){
      for(const geometry of floorGeometry(floor,project)){
        const mesh=new THREE.Mesh(geometry,floorMaterial);
        mesh.rotation.x=-Math.PI/2;mesh.position.y=floor.elevation;
        scene.add(mesh);
      }
      for(const wall of floor.walls){
        const pts=wallPoints(floor,wall);if(!pts)continue;
        const [a,b]=pts,L=distance(a,b);if(L<.001)continue;
        const angle=Math.atan2(b.y-a.y,b.x-a.x),h=wall.height??floor.ceilingHeight,t=wall.thickness;
        const at=(offset:number,dy:number,len:number,height:number,mat:THREE.Material)=>{
          const frac=offset/L;
          box(len,height,t,a.x+(b.x-a.x)*frac,floor.elevation+dy,-(a.y+(b.y-a.y)*frac),angle,mat);
        };
        const openings=floor.openings.filter(o=>o.wallId===wall.id).sort((x,y)=>x.offset-y.offset);
        let cursor=0;
        for(const o of openings){
          const start=Math.max(cursor,o.offset-o.width/2),end=Math.min(L,o.offset+o.width/2);
          if(end<=start)continue;
          if(start>cursor)at((start+cursor)/2,h/2,start-cursor,h,wallMaterial);
          if(o.sillHeight>0)at((start+end)/2,o.sillHeight/2,end-start,o.sillHeight,wallMaterial);
          const top=o.sillHeight+o.height;
          if(top<h)at((start+end)/2,(top+h)/2,end-start,h-top,wallMaterial);
          if(o.kind==='window')at((start+end)/2,o.sillHeight+o.height/2,end-start,o.height,windowMaterial);
          else if(!o.open)at((start+end)/2,o.height/2,end-start,o.height,doorMaterial);
          cursor=end;
        }
        if(cursor<L)at((cursor+L)/2,h/2,L-cursor,h,wallMaterial);
      }
      disposers.push(addFurnitureModels(scene,floor.furniture,floor.elevation));
      for(const stair of floor.stairs??[]){
        const route=routeForStair(project,floor.id,stair.id);
        if(!route)continue;
        const group=new THREE.Group(),steps=12;
        for(let i=0;i<steps;i++){
          const height=route.rise*(i+1)/steps;
          const mesh=new THREE.Mesh(new THREE.BoxGeometry(stair.width,height,stair.run/steps),stairMaterial);
          mesh.position.set(0,height/2,-((i+.5)/steps-.5)*stair.run);
          group.add(mesh);
        }
        // Guardrails visually mark the stair edges; the walk solver confines lateral motion.
        for(const side of [-1,1]){
          const rail=new THREE.Mesh(new THREE.BoxGeometry(.055,.9,stair.run),railMaterial);
          rail.position.set(side*stair.width/2,route.rise/2+.45,0);
          group.add(rail);
        }
        group.position.set(stair.x+stair.width/2,floor.elevation,-(stair.y+stair.run/2));
        group.rotation.y=-stair.rotation*Math.PI/180;
        scene.add(group);
      }
    }
    const grid=new THREE.GridHelper(Math.ceil(span+2),Math.ceil(span+2),0xb1c4d5,0xd5e0e8);
    grid.position.set(center.x,project.floors.reduce((min,f)=>Math.min(min,f.elevation),0)-.02,center.z);
    scene.add(grid);
    const resize=()=>{
      const w=Math.max(node.clientWidth,1),h=Math.max(node.clientHeight,1);
      camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
    };
    const observer=new ResizeObserver(resize);observer.observe(node);resize();
    let dragging=false,lastX=0,lastY=0;
    const onKeyDown=(e:KeyboardEvent)=>{
      if(!walkRef.current)return;
      if(e.target instanceof HTMLElement&&e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
      const key=e.key.toLowerCase();
      if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){
        keys.current.add(key);e.preventDefault();
      }
    };
    const onKeyUp=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());
    const onBlur=()=>{keys.current.clear();dragging=false;};
    const onDown=(e:PointerEvent)=>{
      if(!walkRef.current)return;
      dragging=true;lastX=e.clientX;lastY=e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove=(e:PointerEvent)=>{
      if(!walkRef.current||!dragging)return;
      pose.yaw-=(e.clientX-lastX)*.004;
      pose.pitch=Math.max(-1.25,Math.min(1.25,pose.pitch-(e.clientY-lastY)*.004));
      lastX=e.clientX;lastY=e.clientY;
    };
    const onUp=()=>{dragging=false;};
    window.addEventListener('keydown',onKeyDown);window.addEventListener('keyup',onKeyUp);
    window.addEventListener('blur',onBlur);
    renderer.domElement.addEventListener('pointerdown',onDown);
    renderer.domElement.addEventListener('pointermove',onMove);
    renderer.domElement.addEventListener('pointerup',onUp);
    renderer.domElement.addEventListener('pointercancel',onUp);
    let lastTime=performance.now(),frame=0;
    const render=(now:number)=>{
      const requested=pendingFloor.current;
      if(requested){
        pendingFloor.current=null;
        const floor=project.floors.find(f=>f.id===requested);
        if(floor){
          pose={floorId:floor.id,p:spawnPoint(floor,project,eyeHeight),yaw:pose.yaw,pitch:pose.pitch};
          poseRef.current=pose;travelRef.current=null;
          if(!walkRef.current){
            const bounds=getBounds(floor),span=Math.max(8,bounds.maxX-bounds.minX,bounds.maxY-bounds.minY);
            const x=(bounds.minX+bounds.maxX)/2,z=-(bounds.minY+bounds.maxY)/2;
            controls.target.set(x,floor.elevation,z);
            camera.position.set(x+span*.8,floor.elevation+span*.9,z+span*.8);
          }
        }
      }
      const dt=Math.min(.05,(now-lastTime)/1000);lastTime=now;
      if(walkRef.current){
        controls.enabled=false;
        const k=keys.current;
        const forward=Number(k.has('w')||k.has('arrowup'))-Number(k.has('s')||k.has('arrowdown'))+touch.current.forward;
        const side=Number(k.has('d'))-Number(k.has('a'))+touch.current.side;
        pose.yaw+=(Number(k.has('arrowleft'))-Number(k.has('arrowright'))+touch.current.turn)*dt*1.9;
        const speed=2.1*dt/Math.max(1,Math.hypot(forward,side));
        const movement={x:(Math.sin(pose.yaw)*forward+Math.cos(pose.yaw)*side)*speed,
          y:(Math.cos(pose.yaw)*forward-Math.sin(pose.yaw)*side)*speed};
        let eyeY:number;
        let travel=travelRef.current;
        if(!travel){
          travel=tryEnterStair(project,pose.floorId,pose.p,movement);
          if(travel)travelRef.current=travel;
        }
        if(travel){
          const step=advanceStair(travel,movement);
          pose.p=step.position;eyeY=step.eyeY+eyeHeight;
          travelRef.current=step.state;
          if(step.finished){
            pose.floorId=step.floorId;
            setCurrentFloor(step.floorId);
            internalSwitch.current=step.floorId;
            onFloorChangeRef.current(step.floorId);
          }
        }else{
          const world=walkCollisionWorld(project,pose.floorId,eyeHeight);
          pose.p=movePlayer(world,pose.p,movement,PLAYER_RADIUS);
          eyeY=(project.floors.find(f=>f.id===pose.floorId)?.elevation??0)+eyeHeight;
        }
        poseRef.current=pose;
        camera.position.set(pose.p.x,eyeY,-pose.p.y);
        camera.rotation.order='YXZ';camera.rotation.y=-pose.yaw;camera.rotation.x=pose.pitch;
      }else{controls.enabled=true;controls.update();}
      renderer.render(scene,camera);frame=requestAnimationFrame(render);
    };
    frame=requestAnimationFrame(render);
    return ()=>{
      cancelAnimationFrame(frame);observer.disconnect();controls.dispose();
      window.removeEventListener('keydown',onKeyDown);window.removeEventListener('keyup',onKeyUp);
      window.removeEventListener('blur',onBlur);
      renderer.domElement.removeEventListener('pointerdown',onDown);
      renderer.domElement.removeEventListener('pointermove',onMove);
      renderer.domElement.removeEventListener('pointerup',onUp);
      renderer.domElement.removeEventListener('pointercancel',onUp);
      for(const dispose of disposers)dispose();
      scene.traverse(obj=>{if(obj instanceof THREE.Mesh)obj.geometry.dispose();});
      for(const mat of [floorMaterial,wallMaterial,windowMaterial,doorMaterial,stairMaterial,railMaterial])mat.dispose();
      grid.geometry.dispose();renderer.dispose();node.removeChild(renderer.domElement);
    };
  },[project,eyeHeight]);
  const toggle=()=>{
    keys.current.clear();touch.current={forward:0,side:0,turn:0};setWalking(x=>!x);
  };
  const bind=(key:'forward'|'side'|'turn',value:number)=>({
    onPointerDown:(e:ReactPointerEvent<HTMLButtonElement>)=>{
      e.preventDefault();touch.current[key]=value;e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerUp:()=>{touch.current[key]=0;},
    onPointerCancel:()=>{touch.current[key]=0;},
    onLostPointerCapture:()=>{touch.current[key]=0;}
  });
  const floorName=project.floors.find(f=>f.id===currentFloor)?.name??'階';
  return <div className="viewer-shell">
    <div ref={host} className="viewer3d" aria-label="複数階対応3D住宅プレビュー"/>
    <div className="walk-toolbar">
      <button onClick={toggle} aria-pressed={walking}>{walking?'俯瞰へ戻る':'室内を歩く'}</button>
      <span className="walk-floor-name">{floorName}</span>
      {walking&&<label>目線 <select value={eyeHeight} onChange={e=>setEyeHeight(Number(e.target.value))}>
        <option value={1.2}>1.2m</option><option value={1.6}>1.6m</option><option value={1.8}>1.8m</option>
      </select></label>}
    </div>
    {walking&&<div className="walk-controls" aria-label="タッチ歩行操作">
      <div className="walk-dpad">
        <button {...bind('forward',1)} aria-label="前進">↑</button>
        <div><button {...bind('side',-1)} aria-label="左移動">←</button>
          <button {...bind('forward',-1)} aria-label="後退">↓</button>
          <button {...bind('side',1)} aria-label="右移動">→</button></div>
      </div>
      <div className="walk-turn"><button {...bind('turn',1)} aria-label="左回転">↶</button><button {...bind('turn',-1)} aria-label="右回転">↷</button></div>
    </div>}
    {walking&&<div className="walk-hint">WASD / 矢印・タッチ操作。階段の下端から進むと昇降できます。</div>}
  </div>;
}
