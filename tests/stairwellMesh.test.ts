import {describe,it,expect} from 'vitest';
import {demoStairProject} from '../src/domain/demoStairProject';
import {floorGeometry} from '../src/components/BuildingViewer3D';
import {stairwellOpenings} from '../src/domain/stairWalking';
import schema from '../schemas/project.schema.json';
function surfaceArea(geo:import('three').BufferGeometry){
 const pos=geo.getAttribute('position'),idx=geo.getIndex();
 let area=0,n=idx?idx.count:pos.count;
 for(let i=0;i<n;i+=3){
  const a=idx?idx.getX(i):i,b=idx?idx.getX(i+1):i+1,c=idx?idx.getX(i+2):i+2;
  const ax=pos.getX(a),ay=pos.getY(a),bx=pos.getX(b),by=pos.getY(b),cx=pos.getX(c),cy=pos.getY(c);
  area+=Math.abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))/2;
 }
 return area;
}
describe('upper-floor stairwell mesh',()=>{
 it('cuts an opening matching the stair footprint',()=>{
  const p=demoStairProject(),upper=p.floors[1];
  const holes=stairwellOpenings(p,upper.id);
  expect(holes).toHaveLength(1);
  const geometries=floorGeometry(upper,p);
  const area=geometries.reduce((sum,g)=>sum+surfaceArea(g),0);
  expect(area).toBeCloseTo(8*6-0.9*3.2,2);
  geometries.forEach(g=>g.dispose());
 });
 it('accepts stairs in declared floor JSON schema',()=>{
  const floor=(schema.$defs as Record<string,any>).floor;
  expect(floor.properties.stairs.items.required).toContain('toFloorId');
  expect(floor.required).not.toContain('stairs');
 });
});
