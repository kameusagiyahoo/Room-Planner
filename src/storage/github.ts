import type { HouseProject } from '../domain/model';
export type GitHubTarget={owner:string;repo:string;branch:string;token:string};
export type RemoteProject={project:HouseProject;sha:string};
function normalize(target:GitHubTarget,projectId:string){
  if(!/^[\w.-]+$/.test(target.owner)||!/^[\w.-]+$/.test(target.repo)||!target.branch||!/^[\w.-]+$/.test(projectId))
    throw Error('リポジトリ名、ブランチ、プロジェクトIDを確認してください');
  return 'https://api.github.com/repos/'+encodeURIComponent(target.owner)+'/'+encodeURIComponent(target.repo)+'/contents/projects/'+encodeURIComponent(projectId)+'/project.json';
}
async function request(target:GitHubTarget,url:string,init:RequestInit={}):Promise<Response>{
  if(!target.token.trim())throw Error('GitHubトークンを入力してください');
  const response=await fetch(url,{...init,headers:{
    'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
    'Authorization':'Bearer '+target.token,...init.headers
  }});
  if(!response.ok && response.status!==404){
    const info=await response.json().catch(()=>({}));
    throw Error('GitHub '+response.status+': '+(info.message||response.statusText)+(response.status===409||response.status===422?'（競合または権限不足。再読み込みして確認）':''));
  }
  return response;
}
export async function loadRemote(target:GitHubTarget,id:string):Promise<RemoteProject|null>{
  const url=normalize(target,id)+'?ref='+encodeURIComponent(target.branch);
  const response=await request(target,url);
  if(response.status===404)return null;
  const body=await response.json();
  if(typeof body.content!=='string'||typeof body.sha!=='string')throw Error('GitHubのレスポンス形式が不正です');
  const bytes=Uint8Array.from(atob(body.content.replace(/\s/g,'')),c=>c.charCodeAt(0));
  const text=new TextDecoder().decode(bytes);
  return {project:JSON.parse(text) as HouseProject,sha:body.sha};
}
export async function saveRemote(target:GitHubTarget,project:HouseProject,knownSha:string|null):Promise<string>{
  const url=normalize(target,project.id);
  // Unknown local version must never silently overwrite an existing remote file.
  if(!knownSha){
    const existing=await loadRemote(target,project.id);
    if(existing)throw Error('既存の保存データがあります。先にGitHubから読み込んでください（上書きを防止しました）');
  }
  const bytes=new TextEncoder().encode(JSON.stringify(project,null,2)+'\n');
  let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
  const body:Record<string,string>={message:'Save floor plan '+project.name,content:btoa(binary),branch:target.branch};
  if(knownSha)body.sha=knownSha;
  const response=await request(target,url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(response.status===404)throw Error('保存先リポジトリまたはブランチが見つかりません');
  const result=await response.json();
  if(typeof result.content?.sha!=='string')throw Error('保存応答のSHAがありません');
  return result.content.sha;
}
