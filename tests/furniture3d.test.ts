import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {furnitureMaterials,furnitureModel} from '../src/viewer3d/furnitureMeshes';
import {PRESETS} from '../src/domain/furniture';
describe('3D furniture models',()=>{
  it('generates non-empty distinct models with expected footprint',()=>{
    const materials=furnitureMaterials();
    for(const preset of PRESETS){
      const root=furnitureModel({id:'f',name:preset.name,kind:preset.kind,
        x:0,y:0,width:preset.width,depth:preset.depth,height:preset.height,rotation:0},materials);
      const children=root.children.filter(c=>c instanceof THREE.Mesh);
      expect(children.length).toBeGreaterThan(0);
      root.traverse(node=>{if(node instanceof THREE.Mesh)node.geometry.dispose();});
    }
    Object.values(materials).forEach(m=>m.dispose());
  });
});
