import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { PlanEditor } from './components/PlanEditor';
import type { DrawTool } from './components/PlanEditor';
import { Viewer3D } from './components/Viewer3D';
import type { HouseProject, Point } from './domain/model';
import { emptyProject, exampleProject } from './domain/model';
import { roomArea, roundGrid, distance, wallPoints } from './domain/geometry';
import { insertRectangle } from './domain/topology';
import { addOpening, moveOpening } from './domain/openings';
import {PRESETS,addFurniture,changeFurniture} from './domain/furniture';
import {nearestFurnitureClearance,furnitureClearances,minimumPassageDiameter} from './domain/clearance';
import { validateProject } from './domain/validation';
import { loadDraft, saveDraft } from './storage/local';
import { loadRemote, saveRemote } from './storage/github';
import type { GitHubTarget } from './storage/github';

type ViewMode='2d'|'3d'|'split';
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
  const [view,setView]=useState<ViewMode>('split');
  const [selectedRoom,setSelectedRoom]=useState<string|null>(null);
  const [selectedWall,setSelectedWall]=useState<string|null>(null);
  const [selectedOpening,setSelectedOpening]=useState<string|null>(null);
  const [selectedFurniture,setSelectedFurniture]=useState<string|null>(null);
  const [preset,setPreset]=useState<string>('sofa');
  const [measurePoints,setMeasurePoints]=useState<Point[]>([]);
  const [status,setStatus]=useState('サンプルを読み込みました');
  const [draftStatus,setDraftStatus]=useState<'保存中'|'一時保存済み'|'未保存'>('未保存');
  const [target,setTarget]=useState<GitHubTarget>({owner:'kameusagiyahoo',repo:'Room-Planner-Data',branch:'main',token:''});
  const [remoteId,setRemoteId]=useState('sample-basic');
  const [remoteMeta,setRemoteMeta]=useState<RemoteMeta|null>(null);
  const [busy,setBusy]=useState(false);
  const history=useRef<HouseProject[]>([]),redo=useRef<HouseProject[]>([]);
  const floor=project.floors[0];
  const issues=useMemo(()=>validateProject(project),[project]);
  const hasErrors=issues.some(x=>x.severity==='error');
  const area=floor.rooms.reduce((s,r)=>s+roomArea(floor,r),0);
  const activeRoom=floor.rooms.find(r=>r.id===selectedRoom);
  const activeWall=floor.walls.find(w=>w.id===selectedWall);
  const activeOpening=floor.openings.find(o=>o.id===selectedOpening);
  const activeFurniture=floor.furniture.find(f=>f.id===selectedFurniture);
  const nearestGap=activeFurniture?nearestFurnitureClearance(floor,activeFurniture.id):null;
  const collisionWarnings=furnitureClearances(floor).filter(item=>item.overlap);
  const measureDistance=measurePoints.length===2?distance(measurePoints[0],measurePoints[1]):null;
  const minimumDiameter=measurePoints.length===2?minimumPassageDiameter(floor,measurePoints[0],measurePoints[1]):null;
  const addMeasurePoint=(point:Point)=>setMeasurePoints(prev=>prev.length>=2?[point]:[...prev,point]);
  const selectRoom=(id:string|null)=>{setSelectedRoom(id);setSelectedWall(null);setSelectedOpening(null);};
  const selectWall=(id:string|null)=>{setSelectedWall(id);setSelectedRoom(null);setSelectedOpening(null);};
  const selectOpening=(id:string|null)=>{setSelectedOpening(id);setSelectedWall(null);setSelectedRoom(null);};

  const selectFurniture=(id:string|null)=>{setSelectedFurniture(id);setSelectedRoom(null);setSelectedWall(null);setSelectedOpening(null);};
  useEffect(()=>{
    let alive=true;
    loadDraft().then(draft=>{
      if(!alive)return;
      if(draft&&validateProject(draft).every(issue=>issue.severity!=='error')){
        setProject(draft);setRemoteId(draft.id);setStatus('作業中の間取りを復元しました');
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
    const floor=next.floors[0];
    insertRectangle(floor,a,b,'部屋'+(floor.rooms.length+1));
  },'部屋を追加しました');
  const moveVertex=(id:string,p:Point)=>edit(next=>{
    const v=next.floors[0].vertices.find(x=>x.id===id);
    if(!v)throw Error('頂点がありません');
    v.x=roundGrid(p.x);v.y=roundGrid(p.y);
  },'頂点を移動しました');
  const addDoorOrWindow=(kind:'door'|'window',wallId:string,offset:number)=>edit(next=>{
    const opening=addOpening(next.floors[0],wallId,offset,kind);
    setSelectedOpening(opening.id);setSelectedRoom(null);setSelectedWall(null);
  },kind==='door'?'ドアを追加しました':'窓を追加しました');
  const repositionOpening=(id:string,offset:number)=>edit(next=>{
    moveOpening(next.floors[0],id,offset);
  },'開口部を移動しました');
  const updateWallThickness=(id:string,thickness:number)=>edit(next=>{
    const wall=next.floors[0].walls.find(w=>w.id===id);
    if(wall)wall.thickness=thickness;
  },'壁厚を更新しました');
  const updateOpening=(id:string,patch:Record<string,string|number|boolean>)=>edit(next=>{
    const opening=next.floors[0].openings.find(o=>o.id===id);
    if(opening)Object.assign(opening,patch);
  },'開口部を更新しました');
  const removeOpening=(id:string)=>edit(next=>{
    next.floors[0].openings=next.floors[0].openings.filter(o=>o.id!==id);
    setSelectedOpening(null);
  },'開口部を削除しました');
  const place=(p:Point)=>edit(next=>{
    const f=addFurniture(next.floors[0],preset,p);
    selectFurniture(f.id);
  },'家具を追加しました');
  const moveFurniture=(id:string,p:Point)=>edit(next=>{
    changeFurniture(next.floors[0],id,{x:roundGrid(p.x),y:roundGrid(p.y)});
  },'家具を移動しました');
  const updateFurniture=(id:string,patch:Record<string,string|number>)=>edit(next=>{
    changeFurniture(next.floors[0],id,patch);
  },'家具を更新しました');
  const deleteFurniture=(id:string)=>edit(next=>{
    next.floors[0].furniture=next.floors[0].furniture.filter(f=>f.id!==id);
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
      replace(next,'JSONを読み込みました');
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
      replace(file.project,'GitHubから読み込みました');
      setRemoteMeta({key:remoteKey(target,remoteId),sha:file.sha});
      selectRoom(null);
    }catch(e){setStatus('GitHub読込失敗: '+String(e));}
    finally{setBusy(false);}
  };
  const setName=(name:string)=>edit(next=>{next.name=name;},'名前を変更しました');
  const createNew=()=>{const p=emptyProject();replace(p,'新しい間取りを作成しました');selectRoom(null);setRemoteMeta(null);setRemoteId(p.id);};
  const startExample=()=>{const p=exampleProject();replace(p,'サンプルを読み込みました');selectRoom(null);setRemoteMeta(null);setRemoteId(p.id);};
  return <div className="app">
    <header className="header">
      <div className="brand"><strong>Room Planner</strong><span>GitHub Pages / v0.1</span></div>
      <div className="header-right"><button onClick={()=>setView('2d')} aria-pressed={view==='2d'}>2D</button>
      <button onClick={()=>setView('3d')} aria-pressed={view==='3d'}>3D</button>
      <button className="split-button" onClick={()=>setView('split')} aria-pressed={view==='split'}>分割</button></div>
    </header>
    <div className="layout">
      <aside className="controls">
        <section className="panel">
          <h2>プロジェクト</h2>
          <label>名前<input value={project.name} onChange={e=>setName(e.target.value)}/></label>
          <div className="actions"><button onClick={createNew}>新規</button><button onClick={startExample}>練習用サンプル</button></div>
          <div className="actions"><button onClick={undo} disabled={!history.current.length}>戻す</button><button onClick={redoChange} disabled={!redo.current.length}>やり直し</button></div>
          <div className="actions"><button onClick={()=>download(project.id+'.json',JSON.stringify(project,null,2)+'\n')}>JSON出力</button>
            <label className="file-button">JSON読込<input type="file" accept=".json,application/json" onChange={importFile}/></label></div>
          <small>編集データはIndexedDBへ自動一時保存（{draftStatus}）</small>
        </section>
        <section className="panel">
          <h2>2D編集</h2>
          <div className="actions">
            <button aria-pressed={tool==='select'} onClick={()=>setTool('select')}>選択</button>
            <button aria-pressed={tool==='room'} onClick={()=>{setTool('room');setView('2d');}}>部屋追加</button>
            <button aria-pressed={tool==='vertex'} onClick={()=>{setTool('vertex');setView('2d');}}>頂点移動</button>
            <button aria-pressed={tool==='door'} onClick={()=>{setTool('door');setView('2d');}}>ドア</button>
            <button aria-pressed={tool==='window'} onClick={()=>{setTool('window');setView('2d');}}>窓</button>
            <button aria-pressed={tool==='furniture'} onClick={()=>{setTool('furniture');setView('2d');}}>家具追加</button>
            <button aria-pressed={tool==='measure'} onClick={()=>{setTool('measure');setView('2d');setMeasurePoints([]);}}>通路計測</button>
          </div>
          <small>{tool==='room'?'間取りの上でドラッグして矩形部屋を追加':tool==='vertex'?'黄色い頂点をドラッグ（共有壁も連動）':tool==='door'?'壁をクリックしてドアを配置':tool==='window'?'壁をクリックして窓を配置':tool==='furniture'?'家具を選び、図面をタップして配置':tool==='measure'?'計測したい経路上の2点を順番にタップ':'部屋・壁・ドア・窓を選択。開口部はドラッグで移動できます'}</small>
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
            <div className="actions"><button onClick={()=>updateFurniture(activeFurniture.id,{rotation:(activeFurniture.rotation+90)%360})}>90°回転</button>
            <button onClick={()=>deleteFurniture(activeFurniture.id)}>削除</button></div>
          </div>}
          {activeRoom&&<div className="inspector"><label>部屋名<input value={activeRoom.name} onChange={e=>edit(next=>{const r=next.floors[0].rooms.find(r=>r.id===activeRoom.id);if(r)r.name=e.target.value;},'部屋名を変更')}/></label>
            <div>{roomArea(floor,activeRoom).toFixed(2)}㎡ / {(roomArea(floor,activeRoom)/1.62).toFixed(1)}帖</div></div>}

          {activeWall&&<div className="inspector">
            <h3>選択中の壁</h3>
            <div>壁長：{(wallPoints(floor,activeWall)?distance(...wallPoints(floor,activeWall)!):0).toFixed(2)}m</div>
            <label>壁厚 (m)<input type="number" min=".05" max=".6" step=".01" value={activeWall.thickness} onChange={e=>updateWallThickness(activeWall.id,Number(e.target.value))}/></label>
            <small>共有壁の頂点を動かすと、隣接する部屋も更新されます。</small>
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
        <section className="panel">
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
        {view!=='3d'&&<section className="view-pane"><h2>2D間取り <span>1mグリッド / SVG</span></h2>
          <div className="view-body"><PlanEditor floor={floor} tool={tool} measurePoints={measurePoints} onMeasurePoint={addMeasurePoint} selectedRoom={selectedRoom} selectedWall={selectedWall} selectedOpening={selectedOpening} selectedFurniture={selectedFurniture}
          onSelectRoom={selectRoom} onSelectWall={selectWall} onSelectOpening={selectOpening} onSelectFurniture={selectFurniture}
          onAddRoom={addRoom} onMoveVertex={moveVertex} onAddOpening={addDoorOrWindow} onMoveOpening={repositionOpening} onAddFurniture={place} onMoveFurniture={moveFurniture}/></div></section>}
        {view!=='2d'&&<section className="view-pane"><h2>3D表示 <span>俯瞰 / 衝突判定付き歩行</span></h2>
          <div className="view-body"><Viewer3D floor={floor}/></div></section>}
      </main>
      <aside className="right-pane">
        <section className="panel"><h2>家具干渉診断</h2>
          <div className={collisionWarnings.length?'error':'ok'}>{collisionWarnings.length?'干渉・接触 '+collisionWarnings.length+' 箇所（家具方向別の件数）':'検出された干渉なし'}</div>
          <small>家具と壁、家具同士の平面形状を比較。高さ方向の詳細判定は未対応。</small>
        </section>
        <section className="panel"><h2>整合性チェック</h2>
          <strong className={hasErrors?'error':'ok'}>{hasErrors?'エラーあり':'基本検証OK'}</strong>
          <div className="issue-list">{issues.length?issues.map((issue,i)=><p key={i} className="error">{issue.message} {issue.itemId||''}</p>):<small>壁参照・部屋の閉合・開口位置・寸法をチェックしました</small>}</div>
        </section>
        <section className="panel"><h2>実装状況</h2>
          <p>利用可能：矩形部屋、頂点ドラッグ、面積、2D/3D、JSON入出力、GitHub手動保存</p>
          <p>今後：家具カタログ、階段・複数階、歩行の改良。現在：基本的な3D歩行と壁・ドア・窓・家具の衝突判定</p>
        </section>
      </aside>
    </div>
    <footer className="status" role="status">{status}</footer>
  </div>;
}
