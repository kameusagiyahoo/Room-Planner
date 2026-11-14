import {describe,it,expect} from 'vitest';
import {exampleProject} from '../src/domain/model';
import {blocked,makeCollisionWorld,movePlayer} from '../src/domain/collision';
describe('first-person collision',()=>{
  const sample=()=>exampleProject().floors[0];
  it('prevents crossing a solid wall',()=>{
    const w=makeCollisionWorld(sample());
    const p=movePlayer(w,{x:1,y:2},{x:0,y:-5});
    expect(p.y).toBeGreaterThan(0.25);
  });
  it('prevents crossing a closed door',()=>{
    const w=makeCollisionWorld(sample());
    const p=movePlayer(w,{x:4,y:1.15},{x:2,y:0});
    expect(p.x).toBeLessThan(5);
  });
  it('permits crossing an open door',()=>{
    const f=sample();f.openings.find(o=>o.id==='door-1')!.open=true;
    const w=makeCollisionWorld(f);
    const p=movePlayer(w,{x:4,y:1.15},{x:1.4,y:0});
    expect(p.x).toBeGreaterThan(5.15);
  });
  it('windows remain solid even though transparent',()=>{
    const w=makeCollisionWorld(sample());
    expect(blocked(w,{x:2.0,y:4})).toBe(true);
  });
  it('furniture prevents walking through sofa',()=>{
    const w=makeCollisionWorld(sample());
    expect(blocked(w,{x:1.5,y:1.4})).toBe(true);
  });
  it('sliding permits tangential movement',()=>{
    const w=makeCollisionWorld(sample());
    const p=movePlayer(w,{x:0.5,y:0.5},{x:-1,y:1});
    expect(p.x).toBeGreaterThan(0.25);
    expect(p.y).toBeGreaterThan(1);
  });
  it('rotation of furniture affects collision',()=>{
    const f=sample();f.furniture=[{id:'f',name:'table',kind:'table',x:2,y:2,width:2,depth:.4,height:.7,rotation:90}];
    const w=makeCollisionWorld(f);
    expect(blocked(w,{x:3,y:3})).toBe(true);
    expect(blocked(w,{x:2.1,y:2.1})).toBe(false);
  });
});
