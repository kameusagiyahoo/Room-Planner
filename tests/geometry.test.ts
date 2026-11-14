import { describe,it,expect } from 'vitest';
import { addRectangle,polygonArea,roomArea } from '../src/domain/geometry';
import { emptyFloor,exampleProject } from '../src/domain/model';
describe('area and shared wall',()=>{
  it('area',()=>expect(polygonArea([{x:0,y:0},{x:4,y:0},{x:4,y:3},{x:0,y:3}])).toBe(12));
  it('sample rooms',()=>{const f=exampleProject().floors[0];expect(roomArea(f,f.rooms[0])).toBe(20);expect(roomArea(f,f.rooms[1])).toBe(12);});
  it('shared exact wall',()=>{const f=emptyFloor();addRectangle(f,{x:0,y:0},{x:3,y:3},'A');addRectangle(f,{x:3,y:0},{x:6,y:3},'B');expect(f.walls.length).toBe(7);expect(f.rooms[1].boundary[3].wallId).toBe(f.rooms[0].boundary[1].wallId);});
});
