import {emptyFloor,exampleProject} from './model';
import {addRectangle} from './geometry';
import {addStair} from './stairs';
import {traversableRoute,routeForStair} from './stairWalking';
export function demoStairProject(){
  const p=exampleProject();p.id='sample-two-storey';p.name='2階建て・階段ウォークスルー';
  const first=p.floors[0];first.name='1階';first.elevation=0;
  for(const vertex of first.vertices)if(vertex.y===4)vertex.y=6;
  const second=emptyFloor('2階');second.elevation=2.8;
  addRectangle(second,{x:0,y:0},{x:8,y:6},'2階ホール');
  second.furniture.push({id:'demo-upstairs-bed',name:'ベッド',kind:'double-bed',
    x:.8,y:1,width:1.4,depth:2,height:.55,rotation:0});
  p.floors.push(second);
  const stair=addStair(first,second.id,{x:3.45,y:1.2});
  if(!traversableRoute(p,routeForStair(p,first.id,stair.id)!))
    throw Error('階段付きサンプルの配置が不正です');
  return p;
}
