import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Floor } from '../domain/model';
import {addFurnitureModels} from '../viewer3d/furnitureMeshes';
import { distance, getBounds, roomPolygon, wallPoints } from '../domain/geometry';
import {makeCollisionWorld,movePlayer,blocked,PLAYER_RADIUS} from '../domain/collision';
type Props={floor:Floor};
export function Viewer3D({floor}:Props){
  const host=useRef<HTMLDivElement>(null);
  const [walk,setWalk]=useState(false);
  const [eyeHeight,setEyeHeight]=useState(1.6);
  const hint=('歩行モード: WASD / 矢印、画面ドラッグで視点回転');
  const keys=useRef(new Set<string>());
  const touch=useRef({forward:0,side:0,turn:0});
  const walkRef=useRef(walk);walkRef.current=walk;
  useEffect(()=>{
    const node=host.current;if(!node)return;
    const scene=new THREE.Scene();scene.background=new THREE.Color('#eaf0f6');
    const bounds=getBounds(floor);
    const center=new THREE.Vector3((bounds.minX+bounds.maxX)/2,0,-(bounds.minY+bounds.maxY)/2);
    const span=Math.max(bounds.maxX-bounds.minX,bounds.maxY-bounds.minY,8);
    const camera=new THREE.PerspectiveCamera(50,1,0.05,300);
    camera.position.set(center.x+span*.8,span*.95,center.z+span*.8);
    const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    node.appendChild(renderer.domElement);
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(center.x,0,center.z);controls.enableDamping=true;
    const world=makeCollisionWorld(floor,eyeHeight);
    const spawn=()=>{
      for(const room of floor.rooms){
        const poly=roomPolygon(floor,room);if(poly.some(p=>!Number.isFinite(p.x)))continue;
        const minX=Math.min(...poly.map(p=>p.x)),maxX=Math.max(...poly.map(p=>p.x));
        const minY=Math.min(...poly.map(p=>p.y)),maxY=Math.max(...poly.map(p=>p.y));
        for(let y=minY+.35;y<maxY;y+=.35)for(let x=minX+.35;x<maxX;x+=.35){
          if(!blocked(world,{x,y},PLAYER_RADIUS))return {x,y};
        }
      }
      return null;
    };
    const initial=spawn();
    const player=initial??{x:center.x,y:-center.z};
    let yaw=0,pitch=0,dragging=false,lastX=0,lastY=0;
    const onKeyDown=(e:KeyboardEvent)=>{
      if(!walkRef.current||!(e.target instanceof HTMLElement))return;
      if(e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())){
        keys.current.add(e.key.toLowerCase());e.preventDefault();
      }
    };
    const onKeyUp=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());
    const down=(e:PointerEvent)=>{
      if(!walkRef.current)return;
      dragging=true;lastX=e.clientX;lastY=e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move=(e:PointerEvent)=>{
      if(!walkRef.current||!dragging)return;
      yaw-=(e.clientX-lastX)*.004;
      pitch=Math.max(-1.25,Math.min(1.25,pitch-(e.clientY-lastY)*.004));
      lastX=e.clientX;lastY=e.clientY;
    };
    const up=()=>{dragging=false;};
    window.addEventListener('keydown',onKeyDown);
    window.addEventListener('keyup',onKeyUp);
    window.addEventListener('blur',up);
    renderer.domElement.addEventListener('pointerdown',down);
    renderer.domElement.addEventListener('pointermove',move);
    renderer.domElement.addEventListener('pointerup',up);
    renderer.domElement.addEventListener('pointercancel',up);
    const resetKeys=()=>keys.current.clear();
    window.addEventListener('blur',resetKeys);
    scene.add(new THREE.AmbientLight(0xffffff,1.25));
    const sun=new THREE.DirectionalLight(0xffffff,2.1);sun.position.set(10,20,8);scene.add(sun);
    const floorMaterial=new THREE.MeshStandardMaterial({color:0xd7e8dc,side:THREE.DoubleSide});
    const wallMaterial=new THREE.MeshStandardMaterial({color:0x9eaab8});
    const windowMaterial=new THREE.MeshStandardMaterial({color:0x5bb6d5,transparent:true,opacity:.35});
    const doorMaterial=new THREE.MeshStandardMaterial({color:0xb98f5a,transparent:true,opacity:.8});

    for(const room of floor.rooms){
      const points=roomPolygon(floor,room);if(points.some(p=>!Number.isFinite(p.x)))continue;
      const shape=new THREE.Shape();points.forEach((p,i)=>i?shape.lineTo(p.x,p.y):shape.moveTo(p.x,p.y));shape.closePath();
      const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),floorMaterial);
      mesh.rotation.x=-Math.PI/2;mesh.position.y=floor.elevation;scene.add(mesh);
    }
    const box=(length:number,height:number,thickness:number,worldX:number,y:number,worldZ:number,angle:number,material:THREE.Material)=>{
      if(length<=0.001||height<=0.001)return;
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(length,height,thickness),material);
      mesh.position.set(worldX,y,worldZ);mesh.rotation.y=angle;scene.add(mesh);
    };
    for(const wall of floor.walls){
      const pts=wallPoints(floor,wall);if(!pts)continue;
      const [a,b]=pts,L=distance(a,b);if(L<.001)continue;
      const angle=Math.atan2(b.y-a.y,b.x-a.x);
      const h=wall.height??floor.ceilingHeight,t=wall.thickness;
      const at=(offset:number,dy:number,length:number,height:number,mat:THREE.Material)=>{
        const frac=offset/L;box(length,height,t,a.x+(b.x-a.x)*frac,floor.elevation+dy,-(a.y+(b.y-a.y)*frac),angle,mat);
      };
      const openings=floor.openings.filter(o=>o.wallId===wall.id).sort((x,y)=>x.offset-y.offset);
      let cursor=0;
      for(const opening of openings){
        const begin=Math.max(cursor,opening.offset-opening.width/2),end=Math.min(L,opening.offset+opening.width/2);
        if(end<=begin)continue;
        if(begin>cursor)at((begin+cursor)/2,h/2,begin-cursor,h,wallMaterial);
        if(opening.sillHeight>0)at((begin+end)/2,opening.sillHeight/2,end-begin,opening.sillHeight,wallMaterial);
        const top=opening.sillHeight+opening.height;
        if(top<h)at((begin+end)/2,(top+h)/2,end-begin,h-top,wallMaterial);
        if(opening.kind==='window')at((begin+end)/2,opening.sillHeight+opening.height/2,end-begin,opening.height,windowMaterial);
        else if(!opening.open)at((begin+end)/2,opening.height/2,end-begin,opening.height,doorMaterial);
        cursor=end;
      }
      if(cursor<L)at((cursor+L)/2,h/2,L-cursor,h,wallMaterial);
    }
    const disposeFurniture=addFurnitureModels(scene,floor.furniture,floor.elevation);
    const stairMaterial=new THREE.MeshStandardMaterial({color:0xc7a678,roughness:.85});
    const stairMeshes:THREE.Group[]=[];
    for(const stair of floor.stairs??[]){
      const group=new THREE.Group();
      const steps=12,stepRise=floor.ceilingHeight/steps;
      for(let i=0;i<steps;i++){
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(stair.width,stepRise,stair.run/steps),stairMaterial);
        mesh.position.set(0,stepRise*(i+.5),-(stair.run*(i+.5)/steps-stair.run/2));
        group.add(mesh);
      }
      group.position.set(stair.x+stair.width/2,floor.elevation,-(stair.y+stair.run/2));
      group.rotation.y=-stair.rotation*Math.PI/180;
      scene.add(group);stairMeshes.push(group);
    }
    const grid=new THREE.GridHelper(Math.max(10,Math.ceil(span)),Math.ceil(span),0xb1c4d5,0xd5e0e8);
    grid.position.set(center.x,floor.elevation-.015,center.z);scene.add(grid);
    const resize=()=>{
      const w=Math.max(node.clientWidth,1),h=Math.max(node.clientHeight,1);
      camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
    };
    const observer=new ResizeObserver(resize);observer.observe(node);resize();
    let frame=0,lastTime=performance.now();
    const render=(now:number)=>{
      const dt=Math.min(.05,(now-lastTime)/1000);lastTime=now;
      if(walkRef.current){
        controls.enabled=false;
        const k=keys.current;
        const forward=Number(k.has('w')||k.has('arrowup'))-Number(k.has('s')||k.has('arrowdown'))+touch.current.forward;
        const side=Number(k.has('d'))-Number(k.has('a'))+touch.current.side;
        yaw+=(Number(k.has('arrowleft'))-Number(k.has('arrowright'))+touch.current.turn)*dt*1.9;
        const norm=Math.max(1,Math.hypot(forward,side)),speed=2.1*dt/norm;
        const dx=(Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed;
        const dy=(Math.cos(yaw)*forward-Math.sin(yaw)*side)*speed;
        const next=movePlayer(world,player,{x:dx,y:dy});
        player.x=next.x;player.y=next.y;
        camera.position.set(player.x,floor.elevation+eyeHeight,-player.y);
        camera.rotation.order='YXZ';camera.rotation.y=-yaw;camera.rotation.x=pitch;
      }else{controls.enabled=true;controls.update();}
      renderer.render(scene,camera);frame=requestAnimationFrame(render);
    };
    frame=requestAnimationFrame(render);
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();
      window.removeEventListener('keydown',onKeyDown);window.removeEventListener('keyup',onKeyUp);
      window.removeEventListener('blur',up);window.removeEventListener('blur',resetKeys);
      renderer.domElement.removeEventListener('pointerdown',down);
      renderer.domElement.removeEventListener('pointermove',move);
      renderer.domElement.removeEventListener('pointerup',up);
      renderer.domElement.removeEventListener('pointercancel',up);
      disposeFurniture();stairMeshes.forEach(group=>{group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});scene.remove(group);});
      stairMaterial.dispose();scene.traverse(o=>{
      if(o instanceof THREE.Mesh){o.geometry.dispose();}
    });for(const mat of [floorMaterial,wallMaterial,windowMaterial,doorMaterial])mat.dispose();
    grid.geometry.dispose();renderer.dispose();node.removeChild(renderer.domElement);};
  },[floor,eyeHeight]);
  const toggle=()=>{
    keys.current.clear();touch.current={forward:0,side:0,turn:0};
    setWalk(w=>!w);
  };
  const bind=(key:'forward'|'side'|'turn',value:number)=>({
    onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{
      e.preventDefault();touch.current[key]=value;e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerUp:()=>{touch.current[key]=0;},
    onPointerCancel:()=>{touch.current[key]=0;},
    onLostPointerCapture:()=>{touch.current[key]=0;}
  });
  return <div className="viewer-shell">
    <div ref={host} className="viewer3d" aria-label="3D住宅プレビュー"/>
    <div className="walk-toolbar">
      <button onClick={toggle} aria-pressed={walk}>{walk?'俯瞰へ戻る':'室内を歩く'}</button>
      {walk&&<label>目線 <select value={eyeHeight} onChange={e=>setEyeHeight(Number(e.target.value))}>
        <option value={1.2}>1.2m</option><option value={1.6}>1.6m</option><option value={1.8}>1.8m</option>
      </select></label>}
    </div>
    {walk&&<div className="walk-controls" aria-label="タッチ歩行操作">
      <div className="walk-dpad">
        <button {...bind('forward',1)} aria-label="前進">↑</button>
        <div><button {...bind('side',-1)} aria-label="左移動">←</button>
          <button {...bind('forward',-1)} aria-label="後退">↓</button>
          <button {...bind('side',1)} aria-label="右移動">→</button></div>
      </div>
      <div className="walk-turn"><button {...bind('turn',1)} aria-label="左回転">↶</button><button {...bind('turn',-1)} aria-label="右回転">↷</button></div>
    </div>}
    {walk&&<div className="walk-hint">{hint}</div>}
  </div>;
}
