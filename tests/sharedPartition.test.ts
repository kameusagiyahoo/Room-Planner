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
 it('moves a vertical T-junction dividing one large and two small rooms',()=>{
   const f=emptyFloor();
   const a=insertRectangle(f,{x:0,y:0},{x:4,y:6},'LDK');
   const b=insertRectangle(f,{x:4,y:0},{x:8,y:3},'洋室');
   const c=insertRectangle(f,{x:4,y:3},{x:8,y:6},'子ども部屋');
   const segments=f.walls.filter(w=>{
     const start=f.vertices.find(v=>v.id===w.a),end=f.vertices.find(v=>v.id===w.b);
     return start?.x===4&&end?.x===4;
   });
   expect(segments).toHaveLength(2);
   const p=sharedPartitionForWall(f,segments[0].id)!;
   expect(p).not.toBeNull();
   expect(p.roomIds).toHaveLength(3);
   expect(p.wallIds).toHaveLength(2);
   expect(p.vertexIds).toHaveLength(3);
   expect(sharedPartitionForWall(f,segments[1].id)?.wallIds).toEqual(p.wallIds);
   expect(sharedPartitionForRoomEdge(f,a.id,'right')?.wallIds).toEqual(p.wallIds);
   moveSharedPartition(f,segments[1].id,5.5,.1);
   expect(roomArea(f,a)).toBeCloseTo(33);
   expect(roomArea(f,b)).toBeCloseTo(7.5);
   expect(roomArea(f,c)).toBeCloseTo(7.5);
   expect(validateFloor(f).filter(i=>i.severity==='error')).toEqual([]);
 });
 it('keeps a horizontal T-junction and updates all three rooms',()=>{
   const f=emptyFloor();
   const a=insertRectangle(f,{x:0,y:0},{x:3,y:4},'北1');
   const b=insertRectangle(f,{x:3,y:0},{x:6,y:4},'北2');
   const c=insertRectangle(f,{x:0,y:4},{x:6,y:8},'南');
   const wall=f.walls.find(w=>{
     const a=f.vertices.find(v=>v.id===w.a),b=f.vertices.find(v=>v.id===w.b);
     return a?.y===4&&b?.y===4;
   })!;
   const p=sharedPartitionForWall(f,wall.id)!;
   expect(p.roomIds).toHaveLength(3);
   moveSharedPartition(f,wall.id,3,.1);
   expect(roomArea(f,a)).toBeCloseTo(9);
   expect(roomArea(f,b)).toBeCloseTo(9);
   expect(roomArea(f,c)).toBeCloseTo(30);
   expect(validateFloor(f).filter(i=>i.severity==='error')).toEqual([]);
 });
 it('keeps offsets on moved shared door and preserves window center on branch',()=>{
   const f=emptyFloor();
   insertRectangle(f,{x:0,y:0},{x:4,y:6},'A');
   insertRectangle(f,{x:4,y:0},{x:8,y:3},'B');
   insertRectangle(f,{x:4,y:3},{x:8,y:6},'C');
   const partitionWalls=f.walls.filter(w=>{
      const a=f.vertices.find(v=>v.id===w.a),b=f.vertices.find(v=>v.id===w.b);
      return a?.x===4&&b?.x===4;
   });
   const door=addOpening(f,partitionWalls[0].id,1.5,'door');
   const branch=f.walls.find(w=>{
      const a=f.vertices.find(v=>v.id===w.a),b=f.vertices.find(v=>v.id===w.b);
      return a?.y===3&&b?.y===3&&Math.max(a.x,b.x)===8;
   })!;
   const window=addOpening(f,branch.id,2.5,'window');
   const before=openingMidpoint(f,branch,window.offset)!;
   moveSharedPartition(f,partitionWalls[0].id,4.5,.1);
   expect(door.offset).toBeCloseTo(1.5);
   expect(openingMidpoint(f,branch,window.offset)?.x).toBeCloseTo(before.x);
   expect(validateFloor(f).filter(i=>i.severity==='error')).toEqual([]);
 });
 it('clamps all affected room widths on a three-room partition',()=>{
   const f=emptyFloor();
   insertRectangle(f,{x:0,y:0},{x:4,y:6},'A');
   insertRectangle(f,{x:4,y:0},{x:8,y:3},'B');
   insertRectangle(f,{x:4,y:3},{x:8,y:6},'C');
   const wall=f.walls.find(w=>{
     const a=f.vertices.find(v=>v.id===w.a),b=f.vertices.find(v=>v.id===w.b);
     return a?.x===4&&b?.x===4;
   })!;
   const p=sharedPartitionForWall(f,wall.id)!;
   expect(proposedPartitionCoordinate(p,-100,.1)).toBe(.5);
   expect(proposedPartitionCoordinate(p,100,.1)).toBe(7.5);
 });
 it('rolls back a failed T-junction move without changing any vertices or openings',()=>{
   const f=emptyFloor();
   insertRectangle(f,{x:0,y:0},{x:4,y:6},'A');
   insertRectangle(f,{x:4,y:0},{x:8,y:3},'B');
   insertRectangle(f,{x:4,y:3},{x:8,y:6},'C');
   const partition=f.walls.find(w=>{
     const a=f.vertices.find(v=>v.id===w.a),b=f.vertices.find(v=>v.id===w.b);
     return a?.x===4&&b?.x===4;
   })!;
   const wall=f.walls.find(w=>{
     const a=f.vertices.find(v=>v.id===w.a),b=f.vertices.find(v=>v.id===w.b);
     return a?.y===0&&b?.y===0&&Math.max(a.x,b.x)===4;
   })!;
   addOpening(f,wall.id,3,'window');
   const before=JSON.stringify(f);
   expect(()=>moveSharedPartition(f,partition.id,.5,.1)).toThrow('取り消しました');
   expect(JSON.stringify(f)).toBe(before);
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
