import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Floor } from '../domain/model';
import { distance, getBounds, roomPolygon, wallPoints } from '../domain/geometry';
type Props={floor:Floor};
export function Viewer3D({floor}:Props){
  const host=useRef<HTMLDivElement>(null);
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
    scene.add(new THREE.AmbientLight(0xffffff,1.25));
    const sun=new THREE.DirectionalLight(0xffffff,2.1);sun.position.set(10,20,8);scene.add(sun);
    const floorMaterial=new THREE.MeshStandardMaterial({color:0xd7e8dc,side:THREE.DoubleSide});
    const wallMaterial=new THREE.MeshStandardMaterial({color:0x9eaab8});
    const windowMaterial=new THREE.MeshStandardMaterial({color:0x5bb6d5,transparent:true,opacity:.35});
    const doorMaterial=new THREE.MeshStandardMaterial({color:0xb98f5a,transparent:true,opacity:.8});
    const furnitureMaterial=new THREE.MeshStandardMaterial({color:0xd8ae79});
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
    for(const f of floor.furniture){
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(f.width,f.height,f.depth),furnitureMaterial);
      mesh.position.set(f.x+f.width/2,floor.elevation+f.height/2,-(f.y+f.depth/2));
      mesh.rotation.y=-f.rotation*Math.PI/180;scene.add(mesh);
    }
    const grid=new THREE.GridHelper(Math.max(10,Math.ceil(span)),Math.ceil(span),0xb1c4d5,0xd5e0e8);
    grid.position.set(center.x,floor.elevation-.015,center.z);scene.add(grid);
    const resize=()=>{
      const w=Math.max(node.clientWidth,1),h=Math.max(node.clientHeight,1);
      camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
    };
    const observer=new ResizeObserver(resize);observer.observe(node);resize();
    let frame=0;const render=()=>{controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(render);};render();
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();scene.traverse(o=>{
      if(o instanceof THREE.Mesh){o.geometry.dispose();}
    });for(const mat of [floorMaterial,wallMaterial,windowMaterial,doorMaterial,furnitureMaterial])mat.dispose();
    grid.geometry.dispose();renderer.dispose();node.removeChild(renderer.domElement);};
  },[floor]);
  return <div ref={host} className="viewer3d" aria-label="3D住宅プレビュー"/>;
}
