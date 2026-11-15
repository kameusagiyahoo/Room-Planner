import {describe,it,expect} from 'vitest';
import {snapValue,snapPoint,nudgePoint,SNAP_STEPS,snapLabel} from '../src/domain/snap';
import {emptyFloor} from '../src/domain/model';
import {insertRectangle} from '../src/domain/topology';
import {roomArea} from '../src/domain/geometry';
describe('grid snapping',()=>{
 it('snaps positive and negative coordinates without float drift',()=>{
  expect(snapPoint({x:1.074,y:-.074},.05)).toEqual({x:1.05,y:-.05});
  expect(snapValue(1.27,.25)).toBe(1.25);
  expect(snapValue(-0.001,.1)).toBe(0);
  expect(snapValue(1.23456,0)).toBe(1.235);
 });
 it('moves by the exact selected step, even when snapping is off',()=>{
  expect(nudgePoint({x:1.05,y:2},{x:1,y:0},.05).x).toBe(1.1);
  expect(nudgePoint({x:1,y:2},{x:0,y:-1},0).y).toBe(1.95);
 });
 it('preserves 5cm rectangle geometry instead of rounding to 10cm',()=>{
  const floor=emptyFloor();
  const room=insertRectangle(floor,{x:0,y:0},{x:2.05,y:3.15},'精密な部屋',.05);
  expect(roomArea(floor,room)).toBeCloseTo(2.05*3.15);
  expect(floor.vertices.some(p=>p.x===2.05&&p.y===3.15)).toBe(true);
 });
 it('has selectable steps with display names',()=>{
  expect(SNAP_STEPS).toEqual([0,.05,.1,.25]);
  expect(snapLabel(.05)).toBe('5cm');
 });
});
