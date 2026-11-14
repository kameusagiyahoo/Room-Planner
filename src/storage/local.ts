import type { HouseProject } from '../domain/model';
const DB='room-planner-local-v1', STORE='drafts', KEY='active';
function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
export async function loadDraft():Promise<HouseProject|null>{
  const db=await openDb();
  try{return await new Promise((resolve,reject)=>{
    const req=db.transaction(STORE,'readonly').objectStore(STORE).get(KEY);
    req.onsuccess=()=>resolve((req.result as HouseProject)||null);
    req.onerror=()=>reject(req.error);
  });}finally{db.close();}
}
export async function saveDraft(project:HouseProject):Promise<void>{
  const db=await openDb();
  try{await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(project,KEY);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
  });}finally{db.close();}
}
