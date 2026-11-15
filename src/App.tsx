import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { PlanEditor } from './components/PlanEditor';
import type { DrawTool } from './components/PlanEditor';
import { BuildingViewer3D } from './components/BuildingViewer3D';
import { MobileDock } from './components/MobileDock';
import { NudgePad } from './components/NudgePad';
import {rectangularRoomBounds,resizableRoomEdges,resizeRoomEdge,resizeFurnitureCorner} from './domain/resize';
import type {RoomEdge,FurnitureCorner} from './domain/resize';
import {sharedPartitionForWall,moveSharedPartition} from './domain/sharedPartition';
import {snapPoint,snapValue,nudgePoint,SNAP_STEPS,snapLabel} from './domain/snap';
import type {SnapStep} from './domain/snap';
import type { HouseProject, Point } from './domain/model';
import { emptyProject, exampleProject, emptyFloor } from './domain/model';
import { roomArea, roundGrid, distance, wallPoints } from './domain/geometry';
import { insertRectangle } from './domain/topology';
import { addOpening, moveOpening } from './domain/openings';
import {PRESETS,addFurniture,changeFurniture} from './domain/furniture';
import {addStair,stairDestination} from './domain/stairs';
import {demoStairProject} from './domain/demoStairProject';
import {junctionDemoProject} from './domain/junctionDemoProject';
import {nearestFurnitureClearance,furnitureClearances,minimumPassageDiameter} from './domain/clearance';
import { validateProject } from './domain/validation';
import { loadDraft, saveDraft } from './storage/local';
import { loadRemote, saveRemote } from './storage/github';
import type { GitHubTarget } from './storage/github';

type ViewMode='2d'|'3d'|'split';
type MobilePanel='project'|'floors'|'tools'|'check'|null;
type RemoteMeta={key:string;sha:string};
const clone=(p:HouseProject)=>structuredClone(p);
const remoteKey=(t:GitHubTarget,id:string)=>[t.owner,t.repo,t.branch,id].join('/');
function download(name:string,content:string){
  const url=URL.createObjectURL(new Blob([content],{type:'application/json;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}
export default function App(){
  const [project,setProject]=useState<HouseProject>(()=>exampleProject());
  const [loaded,setLoaded]=useState(false);
  const [tool,setTool]=useState<DrawTool>('select');
  const [activeFloorId,setActiveFloorId]=useState<string>('floor-1');
  const [view,setView]=useState<ViewMode>(()=>typeof window!=='undefined'&&window.matchMedia('(max-width:730px)').matches?'2d':'split');
  const [mobilePanel,setMobilePanel]=useState<MobilePanel>(null);
  const [selectedRoom,setSelectedRoom]=useState<string|null>(null);
  const [selectedWall,setSelectedWall]=useState<string|null>(null);
  const [selectedOpening,setSelectedOpening]=useState<string|null>(null);
  const [selectedFurniture,setSelectedFurniture]=useState<string|null>(null);
  const [preset,setPreset]=useState<string>('sofa');
  const [snapStep,setSnapStep]=useState<SnapStep>(.1);
  const [selectedVertex,setSelectedVertex]=useState<string|null>(null);
  const [selectedStair,setSelectedStair]=useState<string|null>(null);
  const [stairTarget,setStairTarget]=useState<string>('');
  const [measurePoints,setMeasurePoints]=useState<Point[]>([]);
  const [status,setStatus]=useState('サンプルを読み込みました');
  const [draftStatus,setDraftStatus]=useState<'保存中'|'一時保存済み'|'未保存'>('未保存');
  const [target,setTarget]=useState<GitHubTarget>({owner:'kameusagiyahoo',repo:'Room-Planner-Data',branch:'main',token:''});
  const [remoteId,setRemoteId]=useState('sample-basic');
  const [remoteMeta,setRemoteMeta]=useState<RemoteMeta|null>(null);
  const [busy,setBusy]=useState(false);
  const history=useRef<HouseProject[]>([]),redo=useRef<HouseProject[]>([]);
  const activeFloorIndex=Math.max(0,project.floors.findIndex(f=>f.id===activeFloorId));
  const floor=project.floors[activeFloorIndex];
  const issues=useMemo(()=>validateProject(project),[project]);
  const hasErrors=issues.some(x=>x.severity==='error');
  const area=floor.rooms.reduce((s,r)=>s+roomArea(floor,r),0);
  const activeRoom=floor.rooms.find(r=>r.id===selectedRoom);
  const activeRoomBounds=activeRoom?rectangularRoomBounds(floor,activeRoom.id):null;
  const freeRoomEdges=activeRoom?resizableRoomEdges(floor,activeRoom.id):[];
  const roomWidthEdge=freeRoomEdges.includes('right')?'right':freeRoomEdges.includes('left')?'left':null;
  const roomDepthEdge=freeRoomEdges.includes('bottom')?'bottom':freeRoomEdges.includes('top')?'top':null;
  const activeWall=floor.walls.find(w=>w.id===selectedWall);
  const activePartition=activeWall?sharedPartitionForWall(floor,activeWall.id):null;
  const activeOpening=floor.openings.find(o=>o.id===selectedOpening);
  const activeFurniture=floor.furniture.find(f=>f.id===selectedFurniture);
  const activeVertex=floor.vertices.find(v=>v.id===selectedVertex);
  const activeStair=(floor.stairs??[]).find(s=>s.id===selectedStair);
  const otherFloors=project.floors.filter(f=>f.id!==floor.id);
  const nearestGap=activeFurniture?nearestFurnitureClearance(floor,activeFurniture.id):null;
  const collisionWarnings=furnitureClearances(floor).filter(item=>item.overlap);
  const measureDistance=measurePoints.length===2?distance(measurePoints[0],measurePoints[1]):null;
  const minimumDiameter=measurePoints.length===2?minimumPassageDiameter(floor,measurePoints[0],measurePoints[1]):null;
  const addMeasurePoint=(point:Point)=>setMeasurePoints(prev=>prev.length>=2?[point]:[...prev,point]);
  const selectRoom=(id:string|null)=>{setSelectedRoom(id);setSelectedWall(null);setSelectedOpening(null);setSelectedFurniture(null);setSelectedStair(null);setSelectedVertex(null);};
  const selectWall=(id:string|null)=>{setSelectedWall(id);setSelectedRoom(null);setSelectedOpening(null);setSelectedFurniture(null);setSelectedStair(null);setSelectedVertex(null);};
  const selectOpening=(id:string|null)=>{setSelectedOpening(id);setSelectedWall(null);setSelectedRoom(null);setSelectedFurniture(null);setSelectedStair(null);setSelectedVertex(null);};

  const selectStair=(id:string|null)=>{setSelectedVertex(null);setSelectedStair(id);setSelectedFurniture(null);setSelectedRoom(null);setSelectedWall(null);setSelectedOpening(null);};
  const placeStair=(p:Point)=>edit(next=>{
    const destination=stairTarget&&stairTarget!==floor.id?stairTarget:otherFloors[0]?.id;
    if(!destination)throw Error('先に移動先の階を追加してください');
    const stair=addStair(next.floors[activeFloorIndex],destination,snapPoint(p,snapStep));
    selectStair(stair.id);
  },'階段を配置しました');
  const updateStair=(id:string,patch:Record<string,string|number>)=>edit(next=>{
    const stair=(next.floors[activeFloorIndex].stairs??[]).find(s=>s.id===id);
    if(stair)Object.assign(stair,patch);
  },'階段を更新しました');
  const moveStair=(id:string,p:Point)=>edit(next=>{
    const stair=(next.floors[activeFloorIndex].stairs??[]).find(s=>s.id===id);
    if(stair)Object.assign(stair,snapPoint(p,snapStep));
  },'階段を移動しました');
  const nudgeStair=(id:string,dx:number,dy:number)=>{
    const stair=floor.stairs?.find(s=>s.id===id);if(!stair)return;
    updateStair(id,nudgePoint(stair,{x:dx,y:dy},snapStep));
  };
  const removeStair=(id:string)=>edit(next=>{
    const f=next.floors[activeFloorIndex];f.stairs=(f.stairs??[]).filter(s=>s.id!==id);
    setSelectedStair(null);
  },'階段を削除しました');
  const goViaStair=(id:string)=>{
    const target=stairDestination(project,floor.id,id);
    if(!target){setStatus('移動先の階がありません');return;}
    switchFloor(target.floorId);setView('3d');setStatus('階段で移動先の階を表示しました');
  };
  const selectFurniture=(id:string|null)=>{setSelectedVertex(null);setSelectedFurniture(id);setSelectedRoom(null);setSelectedWall(null);setSelectedOpening(null);};
  useEffect(()=>{
    let alive=true;
    loadDraft().then(draft=>{
      if(!alive)return;
      if(draft&&validateProject(draft).every(issue=>issue.severity!=='error')){
        setProject(draft);setRemoteId(draft.id);setActiveFloorId(draft.floors[0].id);setStatus('作業中の間取りを復元しました');
      }
    }).catch(()=>setStatus('ローカル一時保存を利用できません')).finally(()=>{if(alive)setLoaded(true);});
    return ()=>{alive=false;};
  },[]);
  useEffect(()=>{
    if(!loaded)return;
    setDraftStatus('保存中');
    const t=setTimeout(()=>{saveDraft(project).then(()=>setDraftStatus('一時保存済み')).catch(()=>setDraftStatus('未保存'));},600);
    return ()=>clearTimeout(t);
  },[loaded,project]);

  const replace=(next:HouseProject,message:string)=>{
    history.current.push(clone(project));if(history.current.length>40)history.current.shift();
    redo.current=[];next.updatedAt=new Date().toISOString();
    setProject(next);setStatus(message);
  };
  const edit=(mutate:(next:HouseProject)=>void,message:string)=>{
    const next=clone(project);
    try{
      mutate(next);
      const errors=validateProject(next).filter(i=>i.severity==='error');
      if(errors.length){setStatus('変更を取り消しました: '+errors[0].message);return;}
      replace(next,message);
    }catch(e){setStatus(e instanceof Error?e.message:String(e));}
  };
  const addRoom=(a:Point,b:Point)=>edit(next=>{
    const floor=next.floors[activeFloorIndex];
    insertRectangle(floor,a,b,'部屋'+(floor.rooms.length+1),snapStep);
  },'部屋を追加しました');
  const moveVertex=(id:string,p:Point)=>edit(next=>{
    const v=next.floors[activeFloorIndex].vertices.find(x=>x.id===id);
    if(!v)throw Error('頂点がありません');
    Object.assign(v,snapPoint(p,snapStep));
  },'頂点を移動しました');
  const selectVertex=(id:string|null)=>{
    setSelectedVertex(id);setSelectedFurniture(null);setSelectedStair(null);
    setSelectedRoom(null);setSelectedWall(null);setSelectedOpening(null);
  };
  const nudgeVertex=(id:string,dx:number,dy:number)=>{
    const vertex=floor.vertices.find(v=>v.id===id);if(vertex)moveVertex(id,nudgePoint(vertex,{x:dx,y:dy},snapStep));
  };
  const addDoorOrWindow=(kind:'door'|'window',wallId:string,offset:number)=>edit(next=>{
    const opening=addOpening(next.floors[activeFloorIndex],wallId,snapValue(offset,snapStep),kind);
    setSelectedOpening(opening.id);setSelectedRoom(null);setSelectedWall(null);
  },kind==='door'?'ドアを追加しました':'窓を追加しました');
  const repositionOpening=(id:string,offset:number)=>edit(next=>{
    moveOpening(next.floors[activeFloorIndex],id,snapValue(offset,snapStep));
  },'開口部を移動しました');
  const updateWallThickness=(id:string,thickness:number)=>edit(next=>{
    const wall=next.floors[activeFloorIndex].walls.find(w=>w.id===id);
    if(wall)wall.thickness=thickness;
  },'壁厚を更新しました');
  const shiftSharedWall=(id:string,coordinate:number)=>edit(next=>{
    moveSharedPartition(next.floors[activeFloorIndex],id,coordinate,snapStep);
  },'共有壁と隣接する2部屋の寸法を更新しました');
  const updateOpening=(id:string,patch:Record<string,string|number|boolean>)=>edit(next=>{
    const opening=next.floors[activeFloorIndex].openings.find(o=>o.id===id);
    if(opening)Object.assign(opening,patch);
  },'開口部を更新しました');
  const removeOpening=(id:string)=>edit(next=>{
    next.floors[activeFloorIndex].openings=next.floors[activeFloorIndex].openings.filter(o=>o.id!==id);
    setSelectedOpening(null);
  },'開口部を削除しました');
  const place=(p:Point)=>edit(next=>{
    const f=addFurniture(next.floors[activeFloorIndex],preset,snapPoint(p,snapStep));
    selectFurniture(f.id);
  },'家具を追加しました');
  const moveFurniture=(id:string,p:Point)=>edit(next=>{
    changeFurniture(next.floors[activeFloorIndex],id,snapPoint(p,snapStep));
  },'家具を移動しました');
  const resizeFurniture=(id:string,corner:FurnitureCorner,p:Point)=>edit(next=>{
    const f=next.floors[activeFloorIndex].furniture.find(f=>f.id===id);
    if(!f)throw Error('家具が見つかりません');
    changeFurniture(next.floors[activeFloorIndex],id,resizeFurnitureCorner(f,corner,p,snapStep));
  },'家具の幅・奥行きを変更しました');
  const resizeRoom=(id:string,edge:RoomEdge,p:Point)=>edit(next=>{
    resizeRoomEdge(next.floors[activeFloorIndex],id,edge,
      edge==='left'||edge==='right'?p.x:p.y,snapStep);
  },'部屋の寸法を変更しました');
  const updateFurniture=(id:string,patch:Record<string,string|number>)=>edit(next=>{
    changeFurniture(next.floors[activeFloorIndex],id,patch);
  },'家具を更新しました');
  const nudgeFurniture=(id:string,dx:number,dy:number)=>{
    const f=floor.furniture.find(f=>f.id===id);if(!f)return;
    updateFurniture(id,nudgePoint(f,{x:dx,y:dy},snapStep));
  };
  const cloneFurniture=(id:string)=>edit(next=>{
    const items=next.floors[activeFloorIndex].furniture;
    const f=items.find(f=>f.id===id);if(!f)return;
    const newId=globalThis.crypto.randomUUID();
    items.push({...f,id:'furniture-'+newId,name:f.name+'（コピー）',
      x:snapValue(f.x+.3,snapStep),y:snapValue(f.y+.3,snapStep)});
    setSelectedFurniture('furniture-'+newId);
  },'家具を複製しました');
  const deleteFurniture=(id:string)=>edit(next=>{
    next.floors[activeFloorIndex].furniture=next.floors[activeFloorIndex].furniture.filter(f=>f.id!==id);
    selectFurniture(null);
  },'家具を削除しました');
  const undo=()=>{
    const prev=history.current.pop();if(!prev)return;
    redo.current.push(clone(project));setProject(prev);setStatus('元に戻しました');
  };
  const redoChange=()=>{
    const next=redo.current.pop();if(!next)return;
    history.current.push(clone(project));setProject(next);setStatus('やり直しました');
  };
  const importFile=async(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    try{
      const parsed:unknown=JSON.parse(await file.text());
      const issues=validateProject(parsed);
      const errors=issues.filter(i=>i.severity==='error');
      if(errors.length)throw Error('不正なファイル: '+errors[0].message);
      const next=parsed as HouseProject;
      replace(next,'JSONを読み込みました');setActiveFloorId(next.floors[0].id);
      setRemoteId(next.id);setRemoteMeta(null);selectRoom(null);
    }catch(err){setStatus('読み込み失敗: '+String(err));}
  };
  const changeTarget=(field:'owner'|'repo'|'branch'|'token',value:string)=>{
    setTarget(t=>({...t,[field]:value}));setRemoteMeta(null);
  };
  const upload=async()=>{
    if(hasErrors){setStatus('データ不整合があるため保存できません');return;}
    setBusy(true);
    try{
      if(remoteId!==project.id)throw Error('保存IDと現在のプロジェクトIDが異なります。読み込み対象は変更できますが、保存は現在のIDに行います');
      const sha=remoteMeta?.key===remoteKey(target,project.id)?remoteMeta.sha:null;
      const savedSha=await saveRemote(target,project,sha);
      setRemoteMeta({key:remoteKey(target,project.id),sha:savedSha});
      setStatus('GitHubに保存しました（コミット作成完了）');
    }catch(e){setStatus('GitHub保存失敗: '+String(e));}
    finally{setBusy(false);}
  };
  const downloadFromGitHub=async()=>{
    setBusy(true);
    try{
      const file=await loadRemote(target,remoteId);
      if(!file)throw Error('対象のプロジェクトが見つかりません');
      const issues=validateProject(file.project);
      const errors=issues.filter(i=>i.severity==='error');
      if(errors.length)throw Error('遠隔JSONの検証に失敗: '+errors[0].message);
      replace(file.project,'GitHubから読み込みました');setActiveFloorId(file.project.floors[0].id);
      setRemoteMeta({key:remoteKey(target,remoteId),sha:file.sha});
      selectRoom(null);
    }catch(e){setStatus('GitHub読込失敗: '+String(e));}
    finally{setBusy(false);}
  };
  const switchFloor=(id:string)=>{
    setActiveFloorId(id);setSelectedRoom(null);setSelectedWall(null);setSelectedOpening(null);
    setSelectedFurniture(null);setSelectedStair(null);setSelectedVertex(null);setMeasurePoints([]);setMobilePanel(null);
  };
  const addFloor=()=>{
    const f=emptyFloor((project.floors.length+1)+'階');
    f.elevation=project.floors.reduce((max,x)=>Math.max(max,x.elevation+x.ceilingHeight+.2),0);
    edit(next=>{next.floors.push(f);},'階を追加しました');
    switchFloor(f.id);
  };
  const renameFloor=(name:string)=>edit(next=>{next.floors[activeFloorIndex].name=name;},'階の名前を更新しました');
  const changeElevation=(value:number)=>edit(next=>{next.floors[activeFloorIndex].elevation=value;},'階の高さを更新しました');
  const removeFloor=()=>{
    if(project.floors.some(other=>other.id!==floor.id&&(other.stairs??[]).some(s=>s.toFloorId===floor.id))){
      setStatus('他の階の階段が参照しています。先に接続階段を削除してください');return;
    }
    if(project.floors.length<=1){setStatus('最低1階が必要です');return;}
    const nextId=project.floors.find(f=>f.id!==floor.id)!.id;
    edit(next=>{next.floors.splice(activeFloorIndex,1);},'階を削除しました');
    switchFloor(nextId);
  };
  const setName=(name:string)=>edit(next=>{next.name=name;},'名前を変更しました');
  const createNew=()=>{const p=emptyProject();replace(p,'新しい間取りを作成しました');setActiveFloorId(p.floors[0].id);selectRoom(null);setRemoteMeta(null);setRemoteId(p.id);};
  const startExample=()=>{const p=exampleProject();replace(p,'サンプルを読み込みました');setActiveFloorId(p.floors[0].id);selectRoom(null);setRemoteMeta(null);setRemoteId(p.id);};
  const startStairDemo=()=>{const p=demoStairProject();replace(p,'階段付き2階建ての練習サンプルを読み込みました');
    setActiveFloorId(p.floors[0].id);selectRoom(null);setSelectedStair(null);setMeasurePoints([]);
    setRemoteMeta(null);setRemoteId(p.id);setView('3d');
  };
  const startJunctionDemo=()=>{
    const p=junctionDemoProject();
    replace(p,'T字接合の3部屋サンプルを読み込みました');
    setActiveFloorId(p.floors[0].id);selectRoom(null);setSelectedStair(null);setMeasurePoints([]);
    setRemoteMeta(null);setRemoteId(p.id);setTool('select');setView('2d');setMobilePanel(null);
  };
  const selectTool=(next:DrawTool)=>{
    setTool(next);setView('2d');
    setMobilePanel(next==='furniture'||next==='stairs'?'tools':null);
    if(next==='measure')setMeasurePoints([]);
  };
  return <div className={'app '+(mobilePanel?'mobile-sheet-open mobile-sheet-'+mobilePanel:'')}>
    <header className="header">
      <div className="brand"><strong>Room Planner</strong><span>住宅間取りエディタ</span></div>
      <div className="mobile-header-floor"><label htmlFor="mobile-floor">階</label>
        <select id="mobile-floor" value={floor.id} onChange={e=>switchFloor(e.target.value)}>
          {project.floors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      <div className="header-right"><button onClick={()=>setView('2d')} aria-pressed={view==='2d'}>2D</button>
      <button onClick={()=>setView('3d')} aria-pressed={view==='3d'}>3D</button>
      <button className="split-button" onClick={()=>setView('split')} aria-pressed={view==='split'}>分割</button>
      <button className="mobile-undo" onClick={undo} disabled={!history.current.length} aria-label="元に戻す">↶</button></div>
    </header>
    {mobilePanel&&<button type="button" className="mobile-scrim" onClick={()=>setMobilePanel(null)} aria-label="編集パネルを閉じる"/>}
    <div className="layout">
      <aside className="controls" aria-label="設定・編集パネル">
        <div className="mobile-sheet-heading"><strong>{mobilePanel==='floors'?'階の設定':mobilePanel==='project'?'プロジェクト':mobilePanel==='check'?'検証':'道具・詳細設定'}</strong>
          <button onClick={()=>setMobilePanel(null)} aria-label="パネルを閉じる">閉じる ×</button></div>
        <div className="mobile-check-panel">
          <h2>干渉・整合性</h2>
          <p className={collisionWarnings.length?'error':'ok'}>家具の干渉：{collisionWarnings.length}件</p>
          <p className={hasErrors?'error':'ok'}>基本検証：{hasErrors?'エラーあり':'OK'}</p>
          {issues.length?issues.map((issue,i)=><p key={i} className={issue.severity==='error'?'error':'warning'}>{issue.message}</p>):<p>検証上の問題は見つかりませんでした。</p>}
        </div>
        <section className="panel panel-project">
          <h2>プロジェクト</h2>
          <label>名前<input value={project.name} onChange={e=>setName(e.target.value)}/></label>
          <div className="actions"><button onClick={createNew}>新規</button><button onClick={startExample}>練習用サンプル</button>
            <button onClick={startStairDemo}>階段付き2階建て</button>
            <button onClick={startJunctionDemo}>T字接合3部屋</button></div>
          <div className="actions"><button onClick={undo} disabled={!history.current.length}>戻す</button><button onClick={redoChange} disabled={!redo.current.length}>やり直し</button></div>
          <div className="actions"><button onClick={()=>download(project.id+'.json',JSON.stringify(project,null,2)+'\n')}>JSON出力</button>
            <label className="file-button">JSON読込<input type="file" accept=".json,application/json" onChange={importFile}/></label></div>
          <small>編集データはIndexedDBへ自動一時保存（{draftStatus}）</small>
        </section>
        <section className="panel panel-floors">
          <h2>階の管理</h2>
          <label>表示する階<select value={floor.id} onChange={e=>switchFloor(e.target.value)}>
            {project.floors.map(f=><option key={f.id} value={f.id}>{f.name}（床高さ {f.elevation.toFixed(2)}m）</option>)}
          </select></label>
          <label>階の名前<input value={floor.name} onChange={e=>renameFloor(e.target.value)}/></label>
          <label>床高さ (m)<input type="number" step=".1" value={floor.elevation} onChange={e=>changeElevation(Number(e.target.value))}/></label>
          <div className="actions"><button onClick={addFloor}>階を追加</button>
            <button onClick={removeFloor} disabled={project.floors.length<=1}>現在の階を削除</button></div>
          <small>各階の間取り・家具・ドア・窓を個別編集。階段を歩いて昇降するには、上下階に階段を収める部屋と踊り場が必要です。</small>
        </section>
        <section className="panel panel-tools">
          <h2>2D編集</h2>
          <label className="snap-settings">グリッド吸着
            <select value={snapStep} onChange={e=>setSnapStep(Number(e.target.value) as SnapStep)}>
              {SNAP_STEPS.map(s=><option key={s} value={s}>{snapLabel(s)}</option>)}
            </select>
          </label>
          <div className="actions">
            <button aria-pressed={tool==='select'} onClick={()=>setTool('select')}>選択</button>
            <button aria-pressed={tool==='room'} onClick={()=>{setTool('room');setView('2d');}}>部屋追加</button>
            <button aria-pressed={tool==='vertex'} onClick={()=>{setTool('vertex');setView('2d');}}>頂点移動</button>
            <button aria-pressed={tool==='door'} onClick={()=>{setTool('door');setView('2d');}}>ドア</button>
            <button aria-pressed={tool==='window'} onClick={()=>{setTool('window');setView('2d');}}>窓</button>
            <button aria-pressed={tool==='furniture'} onClick={()=>{setTool('furniture');setView('2d');}}>家具追加</button>
            <button aria-pressed={tool==='stairs'} onClick={()=>{setTool('stairs');setView('2d');}}>階段配置</button>
            <button aria-pressed={tool==='measure'} onClick={()=>{setTool('measure');setView('2d');setMeasurePoints([]);}}>通路計測</button>
          </div>
          <small>{tool==='room'?'間取りの上でドラッグして矩形部屋を追加':tool==='vertex'?'黄色い頂点をドラッグ（共有壁も連動）':tool==='door'?'壁をクリックしてドアを配置':tool==='window'?'壁をクリックして窓を配置':tool==='furniture'?'家具を選び、図面をタップして配置':tool==='measure'?'計測したい経路上の2点を順番にタップ':tool==='stairs'?'移動先の階を選び、図面をタップして階段を配置':'部屋・壁・ドア・窓を選択。開口部はドラッグで移動できます'}</small>
          {tool==='stairs'&&<label>階段の移動先<select value={stairTarget||otherFloors[0]?.id||''} onChange={e=>setStairTarget(e.target.value)}>
            {otherFloors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
          </select>{!otherFloors.length&&<small>先に2階などを追加してください。</small>}</label>}
          {activeStair&&<div className="inspector">
            <h3>階段の設定</h3>
            <label>移動先<select value={activeStair.toFloorId} onChange={e=>updateStair(activeStair.id,{toFloorId:e.target.value})}>
              {otherFloors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
            </select></label>
            {(['x','y','width','run','rotation'] as const).map(field=><label key={field}>
              {({x:'X (m)',y:'Y (m)',width:'幅 (m)',run:'水平長 (m)',rotation:'回転 (度)'})[field]}
              <input type="number" step={field==='rotation'?15:.1} value={activeStair[field]}
                onChange={e=>updateStair(activeStair.id,{[field]:Number(e.target.value)})}/>
            </label>)}
            <NudgePad step={snapStep||.05} onNudge={(dx,dy)=>nudgeStair(activeStair.id,dx,dy)}/>
            <div className="actions"><button onClick={()=>updateStair(activeStair.id,{rotation:(activeStair.rotation+90)%360})}>90°回転</button></div>
            <div className="actions"><button onClick={()=>goViaStair(activeStair.id)}>移動先の階へ</button>
              <button onClick={()=>removeStair(activeStair.id)}>階段削除</button></div>
            <small>3D歩行モードで階段の下端・上端から進むと、自動的に昇降します。段板は簡易モデルです。</small>
          </div>}
          {tool==='measure'&&<div className="inspector">
            <h3>通路の幅を概算</h3>
            {measureDistance===null?<small>図面の2点をタップして経路を指定します。</small>:<>
              <div>経路長：<strong>{measureDistance.toFixed(2)} m</strong></div>
              <div>最小自由円直径：<strong>{minimumDiameter?.toFixed(2)} m</strong></div>
              <small>経路上0.1m間隔の点で、壁・窓・閉扉・家具に接しない円の直径を計算した保守的な指標。正式な廊下有効幅ではありません。</small>
              <button onClick={()=>setMeasurePoints([])}>計測点をリセット</button>
            </>}
          </div>}
          {tool==='furniture'&&<label>家具の種類<select value={preset} onChange={e=>setPreset(e.target.value)}>
            {PRESETS.map(p=><option key={p.kind} value={p.kind}>{p.name} ({p.width}×{p.depth}m)</option>)}
          </select></label>}
          {activeFurniture&&<div className="inspector">
            <h3>家具の編集</h3>
            <small>図面上で選択中の家具の角をドラッグすると幅・奥行きを変更できます。小さい家具は拡大すると四隅のハンドルが表示されます。</small>
            <div className={nearestGap?.overlap?'error':'ok'}>
              {nearestGap?nearestGap.overlap?'壁・家具に接触または干渉あり':'最小周囲すき間 '+nearestGap.gap.toFixed(2)+' m':'近くに比較対象なし'}
            </div>
            {nearestGap&&!nearestGap.overlap&&nearestGap.gap<0.7&&<small>すき間0.7m未満。通行・家具の引き出し動作を確認してください。</small>}
            <label>名前<input value={activeFurniture.name} onChange={e=>updateFurniture(activeFurniture.id,{name:e.target.value})}/></label>
            {(['x','y','width','depth','height','rotation'] as const).map(field=><label key={field}>
              {({x:'X (m)',y:'Y (m)',width:'幅 (m)',depth:'奥行 (m)',height:'高さ (m)',rotation:'回転 (度)'})[field]}
              <input type="number" step={field==='rotation'?15:.05} value={activeFurniture[field]}
                onChange={e=>updateFurniture(activeFurniture.id,{[field]:Number(e.target.value)})}/>
            </label>)}
            <NudgePad step={snapStep||.05} onNudge={(dx,dy)=>nudgeFurniture(activeFurniture.id,dx,dy)}/>
            <div className="actions"><button onClick={()=>cloneFurniture(activeFurniture.id)}>複製</button>
              <button onClick={()=>updateFurniture(activeFurniture.id,{rotation:(activeFurniture.rotation+90)%360})}>90°回転</button>
            <button onClick={()=>deleteFurniture(activeFurniture.id)}>削除</button></div>
          </div>}
          {activeVertex&&<div className="inspector">
            <h3>壁の頂点の位置</h3>
            <label>X (m)<input type="number" step=".05" value={activeVertex.x}
              onChange={e=>moveVertex(activeVertex.id,{x:Number(e.target.value),y:activeVertex.y})}/></label>
            <label>Y (m)<input type="number" step=".05" value={activeVertex.y}
              onChange={e=>moveVertex(activeVertex.id,{x:activeVertex.x,y:Number(e.target.value)})}/></label>
            <NudgePad step={snapStep||.05} onNudge={(dx,dy)=>nudgeVertex(activeVertex.id,dx,dy)}/>
            <small>接続している壁の形状も一緒に更新されます。部屋の形状が不正になる移動は取り消されます。</small>
          </div>}
          {activeRoom&&<div className="inspector">
            {activeRoomBounds&&<div className="dimension-fields">
              <label>部屋の幅 (m)
                <input type="number" min=".5" step=".05" disabled={!roomWidthEdge}
                  value={Number((activeRoomBounds.maxX-activeRoomBounds.minX).toFixed(2))}
                  onChange={e=>{
                    if(!roomWidthEdge)return;
                    const desired=Number(e.target.value);
                    resizeRoom(activeRoom.id,roomWidthEdge,{
                      x:roomWidthEdge==='right'?activeRoomBounds.minX+desired:activeRoomBounds.maxX-desired,y:0});
                  }}/>
              </label>
              <label>部屋の奥行き (m)
                <input type="number" min=".5" step=".05" disabled={!roomDepthEdge}
                  value={Number((activeRoomBounds.maxY-activeRoomBounds.minY).toFixed(2))}
                  onChange={e=>{
                    if(!roomDepthEdge)return;
                    const desired=Number(e.target.value);
                    resizeRoom(activeRoom.id,roomDepthEdge,{
                      x:0,y:roomDepthEdge==='bottom'?activeRoomBounds.minY+desired:activeRoomBounds.maxY-desired});
                  }}/>
              </label>
            </div>}
            {activeRoomBounds&&<div className="room-dimension-summary">
              幅 {(activeRoomBounds.maxX-activeRoomBounds.minX).toFixed(2)}m × 奥行 {(activeRoomBounds.maxY-activeRoomBounds.minY).toFixed(2)}m
              <small>{freeRoomEdges.length?'図面の青いハンドルで外壁側の辺を移動できます。':'共有壁を含むため、辺の直接変更はできません。'}</small>
            </div>}
            <label>部屋名<input value={activeRoom.name} onChange={e=>edit(next=>{const r=next.floors[activeFloorIndex].rooms.find(r=>r.id===activeRoom.id);if(r)r.name=e.target.value;},'部屋名を変更')}/></label>
            <div>{roomArea(floor,activeRoom).toFixed(2)}㎡ / {(roomArea(floor,activeRoom)/1.62).toFixed(1)}帖</div></div>}

          {activeWall&&<div className="inspector">
            <h3>選択中の壁</h3>
            <div>壁長：{(wallPoints(floor,activeWall)?distance(...wallPoints(floor,activeWall)!):0).toFixed(2)}m</div>
            <label>壁厚 (m)<input type="number" min=".05" max=".6" step=".01" value={activeWall.thickness} onChange={e=>updateWallThickness(activeWall.id,Number(e.target.value))}/></label>
            {activePartition?<div className="shared-wall-inspector">
              <strong>共有壁を連動移動</strong>
              <small>橙色ハンドルをドラッグするか、位置を入力すると接続する{activePartition.roomIds.length}部屋が連動します。</small>
              <label>{activePartition.axis==='x'?'X座標 (m)':'Y座標 (m)'}
                <input type="number" step={snapStep||.05} min={activePartition.minCoordinate}
                  max={activePartition.maxCoordinate} value={Number(activePartition.coordinate.toFixed(3))}
                  onChange={e=>shiftSharedWall(activePartition.wallId,Number(e.target.value))}/>
              </label>
              <div className="actions">
                <button onClick={()=>shiftSharedWall(activePartition.wallId,activePartition.coordinate-(snapStep||.05))}>− {Math.round((snapStep||.05)*100)}cm</button>
                <button onClick={()=>shiftSharedWall(activePartition.wallId,activePartition.coordinate+(snapStep||.05))}>＋ {Math.round((snapStep||.05)*100)}cm</button>
              </div>
              <small>各部屋の幅・奥行きは最低0.5m。建具の配置が不正になる場合、変更を取り消します。</small>
            </div>:<small>不完全なT字接合・斜め壁・部屋の一部だけの共有壁は、形状を守るため連動移動に未対応です。</small>}
          </div>}
          {activeOpening&&<div className="inspector">
            <h3>{activeOpening.kind==='door'?'ドア':'窓'}の寸法・種類</h3>
            <label>幅 (m)<input type="number" min=".3" max="6" step=".05" value={activeOpening.width} onChange={e=>updateOpening(activeOpening.id,{width:Number(e.target.value)})}/></label>
            <label>高さ (m)<input type="number" min=".3" max="4" step=".05" value={activeOpening.height} onChange={e=>updateOpening(activeOpening.id,{height:Number(e.target.value)})}/></label>
            {activeOpening.kind==='window'&&<label>床からの高さ (m)<input type="number" min="0" max="3" step=".05" value={activeOpening.sillHeight} onChange={e=>updateOpening(activeOpening.id,{sillHeight:Number(e.target.value)})}/></label>}
            <label>壁の始点から中央まで (m)<input type="number" min="0" step=".05" value={Number(activeOpening.offset.toFixed(2))} onChange={e=>repositionOpening(activeOpening.id,Number(e.target.value))}/></label>
            <label>種類<select value={activeOpening.style} onChange={e=>updateOpening(activeOpening.id,{style:e.target.value})}>
              {activeOpening.kind==='door'?<>
                <option value="hinged">開き戸</option><option value="sliding">引き戸</option>
              </>:<><option value="sliding">引き違い窓</option><option value="fixed">FIX窓</option></>}
            </select></label>
            {activeOpening.kind==='door'&&<>
              {activeOpening.style==='hinged'&&<label>左右勝手<select value={activeOpening.swing||'right'} onChange={e=>updateOpening(activeOpening.id,{swing:e.target.value})}>
                <option value="right">右</option><option value="left">左</option>
              </select></label>}
              <label className="check-label"><input type="checkbox" checked={!!activeOpening.open} onChange={e=>updateOpening(activeOpening.id,{open:e.target.checked})}/> 3Dでドアを開く（簡易表示）</label>
            </>}
            <button onClick={()=>removeOpening(activeOpening.id)}>このドア・窓を削除</button>
          </div>}
          <div className="metrics"><strong>{area.toFixed(2)}㎡</strong><span>部屋面積合計（壁芯概算）</span><strong>{(area/1.62).toFixed(1)}帖</strong></div>
        </section>
        <section className="panel panel-project">
          <h2>GitHubに保存・読み込み</h2>
          <small>専用の非公開データリポジトリを用意し、Contents権限付きFine-grained PATを使用。トークンはこの画面内のメモリのみに保持。</small>
          <label>所有者<input value={target.owner} onChange={e=>changeTarget('owner',e.target.value)}/></label>
          <label>データリポジトリ<input value={target.repo} onChange={e=>changeTarget('repo',e.target.value)}/></label>
          <label>ブランチ<input value={target.branch} onChange={e=>changeTarget('branch',e.target.value)}/></label>
          <label>プロジェクトID<input value={remoteId} onChange={e=>setRemoteId(e.target.value)}/></label>
          <label>アクセストークン<input type="password" autoComplete="off" value={target.token} onChange={e=>changeTarget('token',e.target.value)}/></label>
          <div className="actions"><button disabled={busy||!target.token} onClick={downloadFromGitHub}>GitHub読込</button>
            <button className="primary" disabled={busy||hasErrors||!target.token} onClick={upload}>GitHub保存</button></div>
          <small>保存パス：projects/{project.id}/project.json。既存のJSONは読み込まずに上書きできません。</small>
        </section>
      </aside>
      <main className={'workspace '+view}>
        {view!=='3d'&&<section className="view-pane"><h2>2D間取り <span>{floor.name} / 1mグリッド / SVG</span></h2>
          <div className="view-body"><PlanEditor floor={floor} tool={tool} snapStep={snapStep} onSnapChange={setSnapStep}
          measurePoints={measurePoints} onMeasurePoint={addMeasurePoint} selectedRoom={selectedRoom} selectedWall={selectedWall} selectedOpening={selectedOpening} selectedFurniture={selectedFurniture} selectedStair={selectedStair} selectedVertex={selectedVertex}
          onSelectRoom={selectRoom} onSelectWall={selectWall} onSelectOpening={selectOpening} onSelectFurniture={selectFurniture} onSelectStair={selectStair} onSelectVertex={selectVertex}
          onAddRoom={addRoom} onMoveVertex={moveVertex} onAddOpening={addDoorOrWindow} onMoveOpening={repositionOpening} onAddStair={placeStair} onMoveStair={moveStair} onAddFurniture={place} onMoveFurniture={moveFurniture}
          onResizeFurniture={resizeFurniture} onResizeRoom={resizeRoom} onMoveSharedWall={shiftSharedWall}/></div></section>}
        {view!=='2d'&&<section className="view-pane"><h2>3D表示 <span>{floor.name} / 俯瞰 / 衝突判定付き歩行</span></h2>
          <div className="view-body"><BuildingViewer3D project={project} activeFloorId={floor.id} onFloorChange={switchFloor}/></div></section>}
      </main>
      <aside className="right-pane">
        <section className="panel"><h2>家具干渉診断</h2>
          <div className={collisionWarnings.length?'error':'ok'}>{collisionWarnings.length?'干渉・接触 '+collisionWarnings.length+' 箇所（家具方向別の件数）':'検出された干渉なし'}</div>
          <small>家具と壁、家具同士の平面形状を比較。高さ方向の詳細判定は未対応。</small>
        </section>
        <section className="panel"><h2>整合性チェック</h2>
          <strong className={hasErrors?'error':'ok'}>{hasErrors?'エラーあり':'基本検証OK'}</strong>
          <div className="issue-list">{issues.length?issues.map((issue,i)=><p key={i} className={issue.severity==='error'?'error':'warning'}>{issue.message} {issue.itemId||''}</p>):<small>壁参照・部屋の閉合・開口位置・寸法をチェックしました</small>}</div>
        </section>
        <section className="panel"><h2>実装状況</h2>
          <p>利用可能：矩形部屋、頂点ドラッグ、面積、2D/3D、JSON入出力、GitHub手動保存</p>
          <p>現在：複数階の編集、家具カタログ、3D歩行、階段の連続昇降と床開口。今後：折返し階段、段差の精密物理、GLB家具読み込み</p>
        </section>
      </aside>
    </div>
    <MobileDock view={view} tool={tool} floorName={floor.name}
      selectedName={activeFurniture?.name||activeRoom?.name||(activeStair?'階段':activeOpening?'建具':activeWall?'壁':undefined)}
      onSelectTool={selectTool} onViewChange={v=>{setView(v);setMobilePanel(null);}}
      onOpenPanel={p=>setMobilePanel(current=>current===p?null:p)}
      onUndo={undo} onRedo={redoChange}
      canUndo={history.current.length>0} canRedo={redo.current.length>0}/>
    <footer className="status" role="status">{status}</footer>
  </div>;
}
