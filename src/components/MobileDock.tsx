import type {DrawTool} from './PlanEditor';

type MobilePanel='project'|'floors'|'tools'|'check';
type Props={
  view:'2d'|'3d'|'split';tool:DrawTool;floorName:string;
  onSelectTool:(tool:DrawTool)=>void;
  onViewChange:(view:'2d'|'3d')=>void;
  onOpenPanel:(panel:MobilePanel)=>void;
  onUndo:()=>void;onRedo:()=>void;canUndo:boolean;canRedo:boolean;
};
const primaryTools:{tool:DrawTool;symbol:string;label:string}[]=[
  {tool:'select',symbol:'⌖',label:'選択'},
  {tool:'room',symbol:'▢',label:'部屋'},
  {tool:'furniture',symbol:'▣',label:'家具'},
  {tool:'door',symbol:'⊏',label:'ドア'},
  {tool:'measure',symbol:'↔',label:'計測'}
];
export function MobileDock({view,tool,floorName,onSelectTool,onViewChange,onOpenPanel,onUndo,onRedo,canUndo,canRedo}:Props){
  return <nav className="mobile-dock" aria-label="スマホ用編集メニュー">
    <div className="mobile-dock-main">
      {primaryTools.map(item=><button key={item.tool} className="mobile-dock-tool"
        aria-pressed={view!=='3d'&&tool===item.tool}
        onClick={()=>onSelectTool(item.tool)}>
        <span aria-hidden="true">{item.symbol}</span><small>{item.label}</small>
      </button>)}
      <button className="mobile-dock-tool mobile-dock-all" onClick={()=>onOpenPanel('tools')}>
        <span aria-hidden="true">⋯</span><small>すべて</small>
      </button>
    </div>
    <div className="mobile-dock-sub">
      <button onClick={()=>onOpenPanel('floors')} aria-label="階を選ぶ">階：{floorName}</button>
      <button onClick={()=>onOpenPanel('project')}>保存・管理</button>
      <button onClick={()=>onOpenPanel('check')}>検証</button>
      <button onClick={onUndo} disabled={!canUndo} aria-label="元に戻す">↶</button>
      <button onClick={onRedo} disabled={!canRedo} aria-label="やり直し">↷</button>
      <div className="mobile-dock-view">
        <button onClick={()=>onViewChange('2d')} aria-pressed={view!=='3d'}>2D</button>
        <button onClick={()=>onViewChange('3d')} aria-pressed={view==='3d'}>3D</button>
      </div>
    </div>
  </nav>;
}
