import {describe,it,expect} from 'vitest';
import {emptyFloor} from '../src/domain/model';
import {insertRectangle} from '../src/domain/topology';
import {roomArea,roomPolygon} from '../src/domain/geometry';
import {validateFloor} from '../src/domain/validation';
import {FURNITURE_CORNERS,furnitureCorner,resizeFurnitureCorner,rectangularRoomBounds,
  resizableRoomEdges,resizeRoomEdge,proposedRoomBounds} from '../src/domain/resize';
import type {Furniture} from '../src/domain/model';

function furniture(rotation:number):Furniture{
 return {id:'f',name:'家具',kind:'custom',x:1,y:2,width:2,depth:1,height:1,rotation};
}
describe('furniture dimension handles',()=>{
 it.each([0,30,90,135])('preserves opposite corner at %d degrees',angle=>{
  const f=furniture(angle);
  for(const corner of FURNITURE_CORNERS){
   const opposite=FURNITURE_CORNERS[(FURNITURE_CORNERS.indexOf(corner)+2)%4];
   const anchor=furnitureCorner(f,opposite);
   const dragged=furnitureCorner(f,corner);
   const patch=resizeFurnitureCorner(f,corner,{x:dragged.x+.36,y:dragged.y+.28},.05);
   const after=furnitureCorner({...f,...patch},opposite);
   expect(after.x).toBeCloseTo(anchor.x,2);
   expect(after.y).toBeCloseTo(anchor.y,2);
   expect(patch.width).toBeGreaterThanOrEqual(.25);
   expect(patch.depth).toBeGreaterThanOrEqual(.25);
  }
 });
 it('enforces minimum footprint even when crossing anchor',()=>{
  const f=furniture(0),anchor=furnitureCorner(f,'se');
  const next=resizeFurnitureCorner(f,'nw',{x:anchor.x+1,y:anchor.y+1},.1);
  expect(next.width).toBe(.25);expect(next.depth).toBe(.25);
 });
});
describe('safe room dimension handles',()=>{
 it('resizes an isolated rectangular room without altering topology',()=>{
  const f=emptyFloor();const r=insertRectangle(f,{x:0,y:0},{x:4,y:3},'A');
  expect(resizableRoomEdges(f,r.id)).toEqual(['left','right','top','bottom']);
  resizeRoomEdge(f,r.id,'right',5.12,.05);
  expect(rectangularRoomBounds(f,r.id)?.maxX).toBe(5.1);
  expect(roomArea(f,r)).toBeCloseTo(5.1*3);
  expect(validateFloor(f).filter(x=>x.severity==='error')).toEqual([]);
 });
 it('keeps shared walls and adjacent rooms unchanged',()=>{
  const f=emptyFloor(),r1=insertRectangle(f,{x:0,y:0},{x:4,y:4},'A');
  const r2=insertRectangle(f,{x:4,y:0},{x:7,y:4},'B');
  const area=roomArea(f,r1);
  expect(resizableRoomEdges(f,r2.id)).toContain('right');
  expect(resizableRoomEdges(f,r2.id)).not.toContain('left');
  expect(()=>resizeRoomEdge(f,r2.id,'left',3.5,.1)).toThrow('共有壁');
  resizeRoomEdge(f,r2.id,'right',8,.1);
  expect(roomArea(f,r1)).toBe(area);
  expect(roomArea(f,r2)).toBe(16);
  expect(validateFloor(f).filter(x=>x.severity==='error')).toEqual([]);
 });
 it('clamps rectangle width to 0.5m',()=>{
  const f=emptyFloor(),r=insertRectangle(f,{x:0,y:0},{x:4,y:3},'A');
  const box=rectangularRoomBounds(f,r.id)!;
  expect(proposedRoomBounds(box,'left',4,.1).minX).toBe(3.5);
 });
 it('does not expose handles on irregular rooms',()=>{
  const f=emptyFloor(),r=insertRectangle(f,{x:0,y:0},{x:4,y:4},'A');
  const corner=f.vertices.find(v=>v.x===4&&v.y===4)!;corner.x=3;
  expect(resizableRoomEdges(f,r.id)).toEqual([]);
 });
});
