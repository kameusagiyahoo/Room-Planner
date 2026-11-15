import {describe,it,expect} from 'vitest';
import {demoStairProject} from '../src/domain/demoStairProject';
import {routeForStair,traversableRoute,stairwellOpenings,tryEnterStair,stairPosition,advanceStair} from '../src/domain/stairWalking';
import {validateProject} from '../src/domain/validation';
describe('two-storey example',()=>{
  it('has a traversable stairway with opening and preserves two floors',()=>{
    const p=demoStairProject();
    expect(p.floors).toHaveLength(2);
    const s=p.floors[0].stairs![0];
    const route=routeForStair(p,p.floors[0].id,s.id)!;
    expect(traversableRoute(p,route)).toBe(true);
    expect(stairwellOpenings(p,p.floors[1].id)).toHaveLength(1);
    expect(validateProject(p).filter(issue=>issue.severity==='error')).toEqual([]);
    const entry=tryEnterStair(p,p.floors[0].id,stairPosition(s,0),{x:0,y:.1})!;
    const finish=advanceStair(entry,{x:0,y:s.run+.1});
    expect(finish.floorId).toBe(p.floors[1].id);
  });
});
