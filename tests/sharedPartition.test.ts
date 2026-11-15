import {describe,it,expect} from 'vitest';
import {emptyFloor,exampleProject} from '../src/domain/model';
import {insertRectangle} from '../src/domain/topology';
import {addOpening} from '../src/domain/openings';
import {openingMidpoint,roomArea} from '../src/domain/geometry';
import {validateFloor} from '../src/domain/validation';
import {sharedPartitionForWall,sharedPartitionForRoomEdge,moveSharedPartition,
  proposedPartitionCoordinate,partitionMidpoint} from '../src/domain/sharedPartition';

describe('linked partition editor',()=>{
 it('moves the sample middle wall and keeps both room boundaries valid',()=>{
   const f=exampleProject().floors[0],p=sharedPartitionForWall(f,'w7')!;
   expect(p?.axis).toBe('x');
   expect(p?.roomIds.sort()).toEqual(['bedroom','living']);
   expect(sharedPartitionForRoomEdge(f,'living','right')?.wallId).toBe('w7');
   expect(sharedPartitionForRoomEdge(f,'bedroom','left')?.wallId).toBe('w7');
   expect(partitionMidpoint(p)).toEqual({x:5,y:2});
   const o=f.openings.find(o=>o.id==='door-1')!;
   const moved=moveSharedPartition(f,'w7',4.25,.05);
   expect(moved).toBe(4.25);
   expect(f.vertices.find(v=>v.id==='v2')?.x).toBe(4.25);
   expect(f.vertices.find(v=>v.id==='v5')?.x).toBe(4.25);
   expect(roomArea(f,f.rooms[0])).toBeCloseTo(17);
   expect(roomArea(f,f.rooms[1])).toBeCloseTo(15);
   expect(o.offset).toBeCloseTo(1.15);
   expect(validateFloor(f).filter(i=>i.severity==='error')).toEqual([]);
 });
 it('preserves doors and windows anchored to unaffected outer walls',()=>{
   const f=emptyFloor();
   insertRectangle(f,{x:0,y:0},{x:4,y:4},'A');
   insertRectangle(f,{x:4,y:0},{x:8,y:4},'B');
   const vertical=f.walls.find(w=>{
      const a=f.vertices.find(v=>v.id===w.a),b=f.vertices.find(v=>v.id===w.b);
      return a?.x===4&&b?.x===4;
   })!;
   const rightTop=f.walls.find(w=>{
      const a=f.vertices.find(v=>v.id===w.a),b=f.vertices.find(v=>v.id===w.b);
      return a?.y===0&&b?.y===0&&Math.min(a.x,b.x)===4;
   })!;
   const window=addOpening(f,rightTop.id,2,'window');
   const before=openingMidpoint(f,rightTop,window.offset)!;
   moveSharedPartition(f,vertical.id,3.2,.1);
   const after=openingMidpoint(f,rightTop,window.offset)!;
   expect(after.x).toBeCloseTo(before.x);
   expect(after.y).toBeCloseTo(before.y);
   expect(validateFloor(f).filter(i=>i.severity==='error')).toEqual([]);
 });
 it('moves a horizontal divider and changes adjacent heights',()=>{
   const f=emptyFloor();
   insertRectangle(f,{x:0,y:0},{x:6,y:3},'top');
   insertRectangle(f,{x:0,y:3},{x:6,y:6},'bottom');
   const wall=f.walls.find(w=>{
      const a=f.vertices.find(v=>v.id===w.a),b=f.vertices.find(v=>v.id===w.b);
      return a?.y===3&&b?.y===3;
   })!;
   expect(sharedPartitionForWall(f,wall.id)?.axis).toBe('y');
   moveSharedPartition(f,wall.id,3.5,.1);
   expect(roomArea(f,f.rooms[0])).toBeCloseTo(21);
   expect(roomArea(f,f.rooms[1])).toBeCloseTo(15);
   expect(validateFloor(f).filter(i=>i.severity==='error')).toEqual([]);
 });
 it('clamps movement to both minimum room widths',()=>{
   const f=exampleProject().floors[0],p=sharedPartitionForWall(f,'w7')!;
   expect(proposedPartitionCoordinate(p,-50,.1)).toBe(.5);
   expect(proposedPartitionCoordinate(p,50,.1)).toBe(7.5);
   expect(moveSharedPartition(f,'w7',50,.1)).toBe(7.5);
   expect(validateFloor(f).filter(i=>i.severity==='error')).toEqual([]);
 });
 it('refuses partitions when an adjacent room covers only part of one side',()=>{
   const f=emptyFloor();insertRectangle(f,{x:0,y:0},{x:4,y:4},'A');
   insertRectangle(f,{x:4,y:0},{x:7,y:2},'B');
   const w=f.walls.find(w=>{
      const a=f.vertices.find(v=>v.id===w.a),b=f.vertices.find(v=>v.id===w.b);
      return a?.x===4&&b?.x===4&&Math.abs(a.y-b.y)===2;
   })!;
   expect(sharedPartitionForWall(f,w.id)).toBeNull();
 });
 it('does not change any coordinates on rejected move due to opening being trapped',()=>{
   const f=emptyFloor();insertRectangle(f,{x:0,y:0},{x:4,y:4},'A');
   insertRectangle(f,{x:4,y:0},{x:8,y:4},'B');
   const w=f.walls.find(w=>{
      const a=f.vertices.find(v=>v.id===w.a),b=f.vertices.find(v=>v.id===w.b);
      return a?.x===4&&b?.x===4;
   })!;
   const leftTop=f.walls.find(w=>{
      const a=f.vertices.find(v=>v.id===w.a),b=f.vertices.find(v=>v.id===w.b);
      return a?.y===0&&b?.y===0&&Math.max(a.x,b.x)===4&&Math.min(a.x,b.x)===0;
   })!;
   addOpening(f,leftTop.id,3,'window');
   const before=JSON.stringify(f);
   expect(()=>moveSharedPartition(f,w.id,.6,.1)).toThrow('取り消しました');
   expect(JSON.stringify(f)).toBe(before);
 });
});
