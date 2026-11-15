import {describe,it,expect} from 'vitest';
import {emptyProject,emptyFloor} from '../src/domain/model';
import {addRectangle} from '../src/domain/geometry';
import {addStair} from '../src/domain/stairs';
import {advanceStair,routeForStair,stairAxis,stairHeight,stairPosition,stairProgress,stairwellOpenings,tryEnterStair,traversableRoute,walkCollisionWorld} from '../src/domain/stairWalking';
import {blocked,PLAYER_RADIUS} from '../src/domain/collision';
function house(){
 const p=emptyProject();const ground=p.floors[0],upper=emptyFloor('2階');
 ground.elevation=0;upper.elevation=2.8;
 addRectangle(ground,{x:0,y:0},{x:5,y:6},'1階');
 addRectangle(upper,{x:0,y:0},{x:5,y:6},'2階');
 p.floors.push(upper);const s=addStair(ground,upper.id,{x:2,y:1});
 return {p,ground,upper,s};
}
describe('continuous stair traversal',()=>{
 it('tracks forward progress and height',()=>{
  const {p,ground,s}=house(),route=routeForStair(p,ground.id,s.id)!;
  expect(traversableRoute(p,route)).toBe(true);
  expect(stairProgress(s,stairPosition(s,.75))).toBeCloseTo(.75);
  expect(stairHeight(route,.5)).toBeCloseTo(1.4);
  const entry=tryEnterStair(p,ground.id,stairPosition(s,0),{x:0,y:.1})!;
  expect(entry?.direction).toBe(1);
  let state=entry;
  const next=advanceStair(state,{x:0,y:1.6});
  expect(next.eyeY).toBeCloseTo(1.4);
  expect(next.finished).toBe(false);
  state=next.state!;
  const end=advanceStair(state,{x:0,y:1.7});
  expect(end.finished).toBe(true);
  expect(end.floorId).toBe(route.target.id);
 });
 it('descends the same stair from upper landing',()=>{
  const {p,ground,upper,s}=house();
  const entry=tryEnterStair(p,upper.id,stairPosition(s,1),{x:0,y:-.1})!;
  expect(entry.direction).toBe(-1);
  const end=advanceStair(entry,{x:0,y:-3.3});
  expect(end.finished).toBe(true);
  expect(end.floorId).toBe(ground.id);
  expect(end.eyeY).toBeCloseTo(0);
 });
 it('keeps the player from walking into stairwell sideways or hole',()=>{
  const {p,upper,s}=house(),world=walkCollisionWorld(p,upper.id);
  expect(blocked(world,stairPosition(s,.5),PLAYER_RADIUS)).toBe(true);
  expect(tryEnterStair(p,upper.id,stairPosition(s,.5),{x:.1,y:0})).toBeNull();
 });
 it('matches rotated stair axis and endpoints',()=>{
  const {s}=house();s.rotation=90;
  const axis=stairAxis(s);expect(axis.x).toBeCloseTo(-1);
  const from=stairPosition(s,0),to=stairPosition(s,1);
  expect(to.x).toBeLessThan(from.x);
  expect(stairProgress(s,to)).toBeCloseTo(1);
 });
 it('refuses traversals when upstairs has no room or staircase blocked',()=>{
  const {p,ground,upper,s}=house();upper.rooms=[];
  expect(traversableRoute(p,routeForStair(p,ground.id,s.id)!)).toBe(false);
  expect(stairwellOpenings(p,upper.id)).toHaveLength(0);
 });
 it('provides one upper floor opening for a valid route',()=>{
  const {p,upper}=house();expect(stairwellOpenings(p,upper.id)).toHaveLength(1);
 });
});
