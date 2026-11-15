import {describe,it,expect} from 'vitest';
import {emptyFloor} from '../src/domain/model';
import {PRESETS,addFurniture,changeFurniture} from '../src/domain/furniture';
import {validateFloor} from '../src/domain/validation';
import {blocked,makeCollisionWorld} from '../src/domain/collision';
describe('furniture',()=>{
 it('has at least 10 presets',()=>expect(PRESETS.length).toBeGreaterThanOrEqual(10));
 it('places and edits furniture',()=>{
  const f=emptyFloor(),item=addFurniture(f,'sofa',{x:2,y:2});
  changeFurniture(f,item.id,{width:2.1,rotation:90});
  expect(item.width).toBe(2.1);expect(item.rotation).toBe(90);
  expect(validateFloor(f)).toEqual([]);
 });
 it('updates collision',()=>{
  const f=emptyFloor(),item=addFurniture(f,'sofa',{x:2,y:2});
  expect(blocked(makeCollisionWorld(f),{x:2,y:2})).toBe(true);
  changeFurniture(f,item.id,{x:10,y:10});
  expect(blocked(makeCollisionWorld(f),{x:2,y:2})).toBe(false);
 });
});
