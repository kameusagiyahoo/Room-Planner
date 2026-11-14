import {describe,it,expect} from 'vitest';
import {emptyFloor,emptyProject} from '../src/domain/model';
import {addStair,stairDestination,stairFootprint} from '../src/domain/stairs';
describe('stairs',()=>{
 it('links one floor to another',()=>{
  const p=emptyProject(),upper=emptyFloor('2階');upper.elevation=2.8;p.floors.push(upper);
  const stair=addStair(p.floors[0],upper.id,{x:1,y:1});
  expect(stairDestination(p,p.floors[0].id,stair.id)?.floorId).toBe(upper.id);
  expect(stairFootprint(stair)).toHaveLength(4);
 });
 it('does not navigate to a deleted floor',()=>{
  const p=emptyProject();const stair=addStair(p.floors[0],'missing',{x:1,y:1});
  expect(stairDestination(p,p.floors[0].id,stair.id)).toBeNull();
 });
});
