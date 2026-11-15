import type {Floor,Furniture,Point} from './model';
import {newId} from './model';
export const PRESETS=[
 {kind:'sofa',name:'ソファ',width:1.8,depth:.85,height:.8},
 {kind:'bed',name:'シングルベッド',width:1,depth:2,height:.55},
 {kind:'double-bed',name:'ダブルベッド',width:1.4,depth:2,height:.55},
 {kind:'table',name:'ダイニングテーブル',width:1.4,depth:.8,height:.75},
 {kind:'chair',name:'椅子',width:.45,depth:.45,height:.85},
 {kind:'desk',name:'デスク',width:1.2,depth:.6,height:.72},
 {kind:'shelf',name:'収納棚',width:.9,depth:.4,height:1.8},
 {kind:'kitchen',name:'キッチン',width:2.4,depth:.65,height:.85},
 {kind:'fridge',name:'冷蔵庫',width:.65,depth:.7,height:1.8},
 {kind:'washer',name:'洗濯機',width:.65,depth:.65,height:1.05},
 {kind:'toilet',name:'トイレ',width:.45,depth:.75,height:.75},
 {kind:'bath',name:'浴槽',width:1.6,depth:.8,height:.6},
 {kind:'custom',name:'自由サイズ',width:1,depth:1,height:.8}
] as const;
export function addFurniture(floor:Floor,kind:string,point:Point):Furniture{
 const p=PRESETS.find(p=>p.kind===kind);if(!p)throw Error('家具がありません');
 const f:Furniture={id:newId('furniture'),name:p.name,kind:p.kind,x:point.x-p.width/2,y:point.y-p.depth/2,width:p.width,depth:p.depth,height:p.height,rotation:0};
 floor.furniture.push(f);return f;
}
export function changeFurniture(floor:Floor,id:string,patch:Partial<Furniture>){
 const f=floor.furniture.find(f=>f.id===id);if(!f)throw Error('家具がありません');
 Object.assign(f,patch);
}
