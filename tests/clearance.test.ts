import {describe,it,expect} from 'vitest';
import {emptyFloor,exampleProject} from '../src/domain/model';
import {addRectangle} from '../src/domain/geometry';
import {furnitureCorners,furnitureClearances,minimumPassageDiameter,nearestFurnitureClearance} from '../src/domain/clearance';
describe('physical clearance',()=>{
  it('respects furniture rotation',()=>{
    const p=exampleProject().floors[0].furniture[0];
    const a=furnitureCorners(p);
    p.rotation=90;
    const b=furnitureCorners(p);
    expect(a[0].x).not.toBeCloseTo(b[0].x);
  });
  it('detects furniture crossing a wall',()=>{
    const f=exampleProject().floors[0];f.furniture[0].x=-.2;
    expect(furnitureClearances(f).some(x=>x.furnitureId==='sofa-1'&&x.kind==='wall'&&x.overlap)).toBe(true);
  });
  it('detects furniture crossing another furniture',()=>{
    const f=exampleProject().floors[0];f.furniture[1].x=1;f.furniture[1].y=1;
    expect(nearestFurnitureClearance(f,'bed-1')?.gap).toBe(0);
    expect(furnitureClearances(f).some(x=>x.furnitureId==='bed-1'&&x.kind==='furniture'&&x.overlap)).toBe(true);
  });
  it('measures open aisle conservatively',()=>{
    const f=emptyFloor();addRectangle(f,{x:0,y:0},{x:2,y:4},'corridor');
    expect(minimumPassageDiameter(f,{x:1,y:1},{x:1,y:3})).toBeCloseTo(1.88,2);
  });
  it('reports 0 when a measurement crosses a closed wall',()=>{
    const f=exampleProject().floors[0];
    expect(minimumPassageDiameter(f,{x:4,y:2},{x:6,y:2})).toBe(0);
  });
});
