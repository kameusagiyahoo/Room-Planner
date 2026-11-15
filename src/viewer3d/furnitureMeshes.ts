import * as THREE from 'three';
import type {Furniture} from '../domain/model';

type Palette={wood:THREE.Material;fabric:THREE.Material;metal:THREE.Material;white:THREE.Material;dark:THREE.Material;glass:THREE.Material};
export function furnitureMaterials():Palette{
  return {
    wood:new THREE.MeshStandardMaterial({color:0xb89061,roughness:.8}),
    fabric:new THREE.MeshStandardMaterial({color:0x658fa4,roughness:.95}),
    metal:new THREE.MeshStandardMaterial({color:0x9ba6b1,metalness:.35,roughness:.55}),
    white:new THREE.MeshStandardMaterial({color:0xe7e9e9}),
    dark:new THREE.MeshStandardMaterial({color:0x364149}),
    glass:new THREE.MeshStandardMaterial({color:0x64b6c6,transparent:true,opacity:.6})
  };
}
/** Meters; model origin is at the furniture footprint center on the floor. */
export function furnitureModel(f:Furniture,m:Palette):THREE.Group{
  const root=new THREE.Group();
  const w=f.width,d=f.depth,h=f.height;
  function box(width:number,height:number,depth:number,x:number,y:number,z:number,mat:THREE.Material){
    if(Math.min(width,height,depth)<=0)return;
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),mat);
    mesh.position.set(x,y,z);root.add(mesh);
  }
  function legs(top:number,mat:THREE.Material){
    const diameter=Math.min(.08,w*.12,d*.12);
    for(const x of [-w/2+diameter,w/2-diameter])for(const z of [-d/2+diameter,d/2-diameter]){
      box(diameter,top,diameter,x,top/2,z,mat);
    }
  }
  switch(f.kind){
    case 'sofa':
      box(w*.86,h*.28,d*.82,0,h*.38,0,m.fabric);
      box(w,h*.4,d*.2,0,h*.7,-d*.4,m.fabric);
      for(const side of [-1,1])box(w*.12,h*.62,d*.95,side*w*.44,h*.38,0,m.fabric);
      break;
    case 'bed':
    case 'double-bed':
      box(w,h*.25,d,0,h*.24,0,m.wood);
      box(w*.97,h*.18,d*.93,0,h*.44,0,m.white);
      box(w,h*.6,d*.08,0,h*.48,-d*.46,m.wood);
      box(w*.44,h*.07,d*.22,0,h*.56,-d*.3,m.fabric);
      break;
    case 'table':
    case 'desk':
    case 'dining':
      legs(h*.9,m.wood);
      box(w,h*.1,d,0,h*.95,0,m.wood);
      break;
    case 'chair':
      legs(h*.52,m.wood);
      box(w,h*.09,d,0,h*.54,0,m.wood);
      box(w,h*.45,d*.12,0,h*.78,-d*.44,m.fabric);
      break;
    case 'shelf':
      box(w,h,d,0,h/2,0,m.wood);
      box(w*.9,h*.97,d*.08,0,h/2,-d*.46,m.dark);
      for(let i=1;i<=3;i++)box(w*.9,h*.025,d*.8,0,h*i/4,0,m.white);
      break;
    case 'kitchen':
      box(w,h*.88,d,0,h*.44,0,m.white);
      box(w,h*.08,d,0,h*.94,0,m.metal);
      box(w*.28,.012,d*.44,-w*.24,h*.99,0,m.dark);
      box(w*.3,.012,d*.45,w*.23,h*.99,0,m.glass);
      break;
    case 'fridge':
      box(w,h,d,0,h/2,0,m.white);
      box(w*.05,h*.2,d*.08,w*.35,h*.58,d*.52,m.metal);
      break;
    case 'washer':
      box(w,h,d,0,h/2,0,m.white);
      box(w*.55,.02,d*.55,0,h+.01,0,m.dark);
      break;
    case 'toilet':
      box(w*.78,h*.42,d*.62,0,h*.3,d*.12,m.white);
      box(w*.8,h*.55,d*.2,0,h*.7,-d*.4,m.white);
      break;
    case 'bath':
      box(w,h*.7,d*.09,0,h*.35,-d*.46,m.white);
      box(w,h*.7,d*.09,0,h*.35,d*.46,m.white);
      for(const side of [-1,1])box(w*.08,h*.7,d,side*w*.46,h*.35,0,m.white);
      box(w*.84,.03,d*.77,0,h*.22,0,m.glass);
      break;
    default:box(w,h,d,0,h/2,0,m.wood);
  }
  return root;
}
export function addFurnitureModels(scene:THREE.Scene,furniture:Furniture[],elevation:number):()=>void{
  const materials=furnitureMaterials();
  const roots:THREE.Group[]=[];
  for(const f of furniture){
    const root=furnitureModel(f,materials);
    root.position.set(f.x+f.width/2,elevation,-(f.y+f.depth/2));
    root.rotation.y=-f.rotation*Math.PI/180;
    scene.add(root);roots.push(root);
  }
  return ()=>{
    for(const root of roots){
      root.traverse(obj=>{if(obj instanceof THREE.Mesh)obj.geometry.dispose();});
      scene.remove(root);
    }
    Object.values(materials).forEach(material=>material.dispose());
  };
}
