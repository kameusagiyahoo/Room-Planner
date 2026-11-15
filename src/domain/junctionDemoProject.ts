import {emptyProject} from './model';
import {insertRectangle} from './topology';
import {validateFloor} from './validation';
import {sharedPartitionForRoomEdge} from './sharedPartition';

/** Three-room T junction: a large living room and two smaller rooms. */
export function junctionDemoProject(){
  const p=emptyProject();
  p.id='sample-three-room-junction';p.name='共有壁の連動編集（3部屋）';
  const floor=p.floors[0];floor.name='1階';
  const living=insertRectangle(floor,{x:0,y:0},{x:4,y:6},'LDK');
  insertRectangle(floor,{x:4,y:0},{x:8,y:3},'洋室');
  insertRectangle(floor,{x:4,y:3},{x:8,y:6},'子ども部屋');
  if(sharedPartitionForRoomEdge(floor,living.id,'right')?.roomIds.length!==3||
    validateFloor(floor).some(issue=>issue.severity==='error'))
    throw Error('T字接合サンプルの接続構造が不正です');
  return p;
}
