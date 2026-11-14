import {describe,it,expect} from 'vitest';
import {emptyFloor,exampleProject} from '../src/domain/model';
import {addRectangle} from '../src/domain/geometry';
import {validateFloor} from '../src/domain/validation';
describe('geometry consistency',()=>{
  it('rejects a room that folds across itself',()=>{
    const f=emptyFloor();addRectangle(f,{x:0,y:0},{x:4,y:4},'A');
    const r=f.rooms[0],corner=f.vertices.find(v=>v.x===4&&v.y===0)!;
    corner.x=-1;corner.y=2;
    expect(validateFloor(f).some(e=>e.message.includes('自己交差'))).toBe(true);
  });
  it('rejects overlapping rooms after vertex changes',()=>{
    const f=emptyFloor();addRectangle(f,{x:0,y:0},{x:4,y:4},'A');
    addRectangle(f,{x:6,y:0},{x:9,y:3},'B');
    const bottomLeft=f.vertices.find(v=>v.x===6&&v.y===0)!;
    const topLeft=f.vertices.find(v=>v.x===6&&v.y===3)!;
    bottomLeft.x=3;topLeft.x=3;
    expect(validateFloor(f).some(e=>e.message.includes('重複'))).toBe(true);
  });
  it('rejects NaN and invalid wall thickness',()=>{
    const f=exampleProject().floors[0];f.openings[0].offset=NaN;f.walls[0].thickness=0;
    expect(validateFloor(f).filter(e=>e.severity==='error').length).toBeGreaterThanOrEqual(2);
  });
});
