import type {Point} from '../domain/model';
type Props={step:number;onNudge:(dx:number,dy:number)=>void};
const buttons:{dx:number;dy:number;label:string;text:string}[]=[
  {dx:0,dy:-1,label:'上へ移動',text:'↑'},
  {dx:-1,dy:0,label:'左へ移動',text:'←'},
  {dx:1,dy:0,label:'右へ移動',text:'→'},
  {dx:0,dy:1,label:'下へ移動',text:'↓'}
];
export function NudgePad({step,onNudge}:Props){
  return <div className="nudge-control" aria-label="配置位置の微調整">
    <span>位置調整（1回 {Math.round(step*100)}cm）</span>
    <div className="nudge-buttons">
      {buttons.map(button=><button key={button.label} type="button" aria-label={button.label}
        onClick={()=>onNudge(button.dx,button.dy)}>{button.text}</button>)}
    </div>
  </div>;
}
