import {describe,it,expect} from 'vitest';
import {emptyFloor,exampleProject} from '../src/domain/model';
import {roomArea,wallPoints} from '../src/domain/geometry';
import {insertRectangle,splitWall} from '../src/domain/topology';
import {addOpening,moveOpening} from '../src/domain/openings';
import {validateFloor} from '../src/domain/validation';
describe('shared wall topology',()=>{
  it('adds a partially adjacent room and splits shared wall',()=>{
    const f=emptyFloor();insertRectangle(f,{x:0,y:0},{x:4,y:4},'A');
    const second=insertRectangle(f,{x:4,y:1},{x:7,y:3},'B');
    expect(f.walls.length).toBe(9);
    expect(second.boundary.length).toBe(4);
    expect(roomArea(f,f.rooms[0])).toBe(16);
    expect(roomArea(f,second)).toBe(6);
    const shared=new Set(f.rooms[0].boundary.map(l=>l.wallId));
    expect(second.boundary.filter(l=>shared.has(l.wallId))).toHaveLength(1);
    expect(validateFloor(f)).toEqual([]);
  });
  it('rejects overlapping rooms',()=>{
    const f=emptyFloor();insertRectangle(f,{x:0,y:0},{x:4,y:4},'A');
    expect(()=>insertRectangle(f,{x:2,y:2},{x:6,y:6},'B')).toThrow('重複');
  });
  it('reassigns an opening to the second segment after split',()=>{
    const f=emptyFloor();insertRectangle(f,{x:0,y:0},{x:4,y:4},'A');
    const w=f.walls.find(w=>{const p=wallPoints(f,w);return p?.[0].x===4&&p?.[1].x===4;})!;
    const o=addOpening(f,w.id,3,'door');
    splitWall(f,w.id,{x:4,y:1});
    expect(o.wallId).not.toBe(w.id);
    expect(o.offset).toBeCloseTo(2);
    expect(validateFloor(f)).toEqual([]);
  });
});
describe('door / window editing',()=>{
  it('places, moves and catches overlap',()=>{
    const f=exampleProject().floors[0];
    const w=f.walls.find(w=>w.id==='w7')!;
    const added=addOpening(f,w.id,3,'door');
    expect(validateFloor(f)).toEqual([]);
    moveOpening(f,added.id,1.2);
    expect(validateFloor(f).some(e=>e.message.includes('重な'))).toBe(true);
  });
  it('refuses split through a door',()=>{
    const f=exampleProject().floors[0];
    expect(()=>splitWall(f,'w7',{x:5,y:1.2})).toThrow('ドア・窓');
  });
});
