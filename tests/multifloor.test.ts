import {describe,it,expect} from 'vitest';
import {emptyFloor,exampleProject} from '../src/domain/model';
import {validateProject} from '../src/domain/validation';
import {addRectangle} from '../src/domain/geometry';
describe('multi floor JSON',()=>{
 it('preserves independent geometry and furniture across floors',()=>{
  const project=exampleProject();
  const upper=emptyFloor('2階');upper.elevation=2.8;
  addRectangle(upper,{x:0,y:0},{x:3,y:4},'寝室');
  project.floors.push(upper);
  const loaded=JSON.parse(JSON.stringify(project));
  expect(loaded.floors).toHaveLength(2);
  expect(loaded.floors[0].furniture).toHaveLength(2);
  expect(loaded.floors[1].furniture).toHaveLength(0);
  expect(loaded.floors[1].rooms).toHaveLength(1);
  expect(validateProject(loaded).filter(i=>i.severity==='error')).toHaveLength(0);
 });
});
