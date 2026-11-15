import { describe,it,expect } from 'vitest';
import { exampleProject } from '../src/domain/model';
import { validateProject } from '../src/domain/validation';
describe('topology and openings',()=>{
  it('accepts sample',()=>expect(validateProject(exampleProject())).toEqual([]));
  it('rejects missing wall',()=>{const p=exampleProject();p.floors[0].walls.pop();expect(validateProject(p).some(x=>x.severity==='error')).toBe(true);});
  it('rejects protruding opening',()=>{const p=exampleProject();p.floors[0].openings[0].width=20;expect(validateProject(p).some(x=>x.message.includes('はみ出'))).toBe(true);});
  it('rejects overlapping opening',()=>{const p=exampleProject();p.floors[0].openings.push({...p.floors[0].openings[0],id:'door-overlap',offset:1.2});expect(validateProject(p).some(x=>x.message.includes('重な'))).toBe(true);});
});
