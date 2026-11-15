import {describe,it,expect} from 'vitest';
import {junctionDemoProject} from '../src/domain/junctionDemoProject';
import {sharedPartitionForRoomEdge,moveSharedPartition} from '../src/domain/sharedPartition';
import {validateFloor} from '../src/domain/validation';
import {roomArea} from '../src/domain/geometry';
import {emptyFloor} from '../src/domain/model';
import {insertRectangle} from '../src/domain/topology';
describe('multi-room partition example',()=>{
 it('opens a ready-to-edit three-room plan',()=>{
  const p=junctionDemoProject();
  const floor=p.floors[0];
  expect(floor.rooms).toHaveLength(3);
  const partition=sharedPartitionForRoomEdge(floor,floor.rooms[0].id,'right')!;
  expect(partition).not.toBeNull();
  expect(partition.roomIds).toHaveLength(3);
  moveSharedPartition(floor,partition.wallId,4.5,.1);
  expect(roomArea(floor,floor.rooms[0])).toBeCloseTo(27);
  expect(validateFloor(floor).filter(i=>i.severity==='error')).toEqual([]);
 });
 it('supports a 2x2 grid of four rooms',()=>{
  const f=emptyFloor();
  insertRectangle(f,{x:0,y:0},{x:4,y:3},'A');
  insertRectangle(f,{x:0,y:3},{x:4,y:6},'B');
  insertRectangle(f,{x:4,y:0},{x:8,y:3},'C');
  insertRectangle(f,{x:4,y:3},{x:8,y:6},'D');
  const partition=sharedPartitionForRoomEdge(f,f.rooms[0].id,'right')!;
  expect(partition).not.toBeNull();
  expect(partition.roomIds).toHaveLength(4);
  expect(partition.wallIds).toHaveLength(2);
  moveSharedPartition(f,partition.wallId,3.5,.1);
  expect(f.rooms.map(r=>roomArea(f,r))).toEqual([10.5,10.5,13.5,13.5]);
  expect(validateFloor(f).filter(i=>i.severity==='error')).toEqual([]);
 });
});
