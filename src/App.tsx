import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { PlanEditor } from './components/PlanEditor';
import type { DrawTool } from './components/PlanEditor';
import { Viewer3D } from './components/Viewer3D';
import type { HouseProject, Point } from './domain/model';
import { emptyProject, exampleProject } from './domain/model';
import { addRectangle, roomArea, roundGrid } from './domain/geometry';
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
    addRectangle(floor,a,b,'部屋'+(floor.rooms.length+1));
  },'部屋を追加しました');
  const moveVertex=(id:string,p:Point)=>edit(next=>{
    const v=next.floors[0].vertices.find(x=>x.id===id);
    if(!v)throw Error('頂点がありません');
    v.x=roundGrid(p.x);v.y=roundGrid(p.y);
  },'頂点を移動しました');
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
      if(issues.length)throw Error('不正なファイル: '+issues[0].message);
      const next=parsed as HouseProject;
      replace(next,'JSONを読み込みました');
      setRemoteId(next.id);setRemoteMeta(null);setSelectedRoom(null);
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
      if(issues.length)throw Error('遠隔JSONの検証に失敗: '+issues[0].message);
      replace(file.project,'GitHubから読み込みました');
      setRemoteMeta({key:remoteKey(target,remoteId),sha:file.sha});
      setSelectedRoom(null);
    }catch(e){setStatus('GitHub読込失敗: '+String(e));}
    finally{setBusy(false);}
  };
  const setName=(name:string)=>edit(next=>{next.name=name;},'名前を変更しました');
  const createNew=()=>{const p=emptyProject();replace(p,'新しい間取りを作成しました');setSelectedRoom(null);setRemoteMeta(null);setRemoteId(p.id);};
  const startExample=()=>{const p=exampleProject();replace(p,'サンプルを読み込みました');setSelectedRoom(null);setRemoteMeta(null);setRemoteId(p.id);};
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
          </div>
          <small>{tool==='room'?'間取りの上でドラッグして矩形部屋を追加':tool==='vertex'?'黄色い頂点をドラッグ（共有壁も連動）':'部屋を選択し名前を変更できます'}</small>
          {activeRoom&&<div className="inspector"><label>部屋名<input value={activeRoom.name} onChange={e=>edit(next=>{const r=next.floors[0].rooms.find(r=>r.id===activeRoom.id);if(r)r.name=e.target.value;},'部屋名を変更')}/></label>
            <div>{roomArea(floor,activeRoom).toFixed(2)}㎡ / {(roomArea(floor,activeRoom)/1.62).toFixed(1)}帖</div></div>}
          <div className="metrics"><strong>{area.toFixed(2)}㎡</strong><span>部屋面積合計（内法概算）</span><strong>{(area/1.62).toFixed(1)}帖</strong></div>
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
          <div className="view-body"><PlanEditor floor={floor} tool={tool} selectedRoom={selectedRoom} onSelect={setSelectedRoom} onAddRoom={addRoom} onMoveVertex={moveVertex}/></div></section>}
        {view!=='2d'&&<section className="view-pane"><h2>3D俯瞰 <span>ドラッグ: 回転 / スクロール: 拡大</span></h2>
          <div className="view-body"><Viewer3D floor={floor}/></div></section>}
      </main>
      <aside className="right-pane">
        <section className="panel"><h2>整合性チェック</h2>
          <strong className={hasErrors?'error':'ok'}>{hasErrors?'エラーあり':'基本検証OK'}</strong>
          <div className="issue-list">{issues.length?issues.map((issue,i)=><p key={i} className="error">{issue.message} {issue.itemId||''}</p>):<small>壁参照・部屋の閉合・開口位置・寸法をチェックしました</small>}</div>
        </section>
        <section className="panel"><h2>実装状況</h2>
          <p>利用可能：矩形部屋、頂点ドラッグ、面積、2D/3D、JSON入出力、GitHub手動保存</p>
          <p>今後：開口部編集、家具カタログ、階段、3D歩行・衝突判定</p>
        </section>
      </aside>
    </div>
    <footer className="status" role="status">{status}</footer>
  </div>;
}
