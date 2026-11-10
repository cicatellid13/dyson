import { profileStorageKey, type ProfileInfo, type ProfileWorkspace } from './profiles';
import { setSessionProfile } from './sessionExpansion';
import { setPlannerProfile } from './plannerPreferences';
import { loadPinnedItems, loadPinnedGroups, migrateLocalPins, PINNED_MIGRATION_KEY } from './pinnedItems';
import { removalLabel, restoreRemoval } from './removalUndo';
import { emptyPlanning } from './planning';
import { useSyncExternalStore } from 'react';
import { DESIGN_KEY, parseDesign } from './design';
import { emptyWorkspace, type Workspace, type SyncView } from './workspace';
import type { Catalog } from './catalog';

type State = { profileId:string;profiles:ProfileInfo[];switching:boolean;profileError?:string;ready: boolean; view: SyncView; catalog: Catalog | null; error: string; undoLabel?:string; undoError?:string };
let state: State = { profileId:'shared',profiles:[{id:'shared',name:'Current play-through',createdAt:''}],switching:false,ready: false, view: { data: emptyWorkspace(), status: 'pending', message: '' }, catalog: null, error: '' };
const listeners = new Set<() => void>();
let initialization: Promise<void> | undefined;
let writes = Promise.resolve();
let lastRemoval:{before:Workspace;after:Workspace}|null=null;
let restoring=false;
let undoTimer: ReturnType<typeof setTimeout> | undefined;
export function dismissRemoval(){clearTimeout(undoTimer);lastRemoval=null;state={...state,undoLabel:undefined,undoError:undefined};emit();}
export function undoRemoval(){if(!lastRemoval)return;try{const next=restoreRemoval(lastRemoval.before,lastRemoval.after,state.view.data);restoring=true;updateWorkspace(()=>next);if(!state.error)dismissRemoval();}catch(error){state={...state,undoError:error instanceof Error?error.message:"Unable to undo."};emit();}finally{restoring=false;}}
let pending = 0;
function recoveryKey(){return profileStorageKey('dsp-workspace-recovery',state.profileId);}
function deviceKey(key:string){return profileStorageKey(key,state.profileId);}
function emit() { listeners.forEach(listener => listener()); }
function backup(data: Workspace) {
  localStorage.setItem(deviceKey(DESIGN_KEY), JSON.stringify(data.design));
  localStorage.setItem(deviceKey('dsp-favorites'), JSON.stringify(data.favorites));
  localStorage.setItem(deviceKey('dsp-dark-fog'), String(data.darkFog));
}
function legacy(): Workspace {
  if(state.profileId!=='shared')return emptyWorkspace();
  const raw = JSON.parse(localStorage.getItem('dsp-favorites') ?? '[]');
  return { planning: emptyPlanning(), design: parseDesign(localStorage.getItem(DESIGN_KEY)), favorites: Array.isArray(raw) ? raw.filter(Number.isInteger) : [], darkFog: localStorage.getItem('dsp-dark-fog') === 'true' };
}
export function initializePersistence() {
  if (initialization) return initialization;
  initialization = (async () => {
    try {
      if (!window.dspWiki?.loadWorkspace) throw Error('Open the desktop app to connect to your cloud workspace.');
      if(window.dspWiki.listProfiles){
        const index=await window.dspWiki.listProfiles();
        state={...state,...index};setSessionProfile(index.profileId);setPlannerProfile(index.profileId);
      }
      const result = await window.dspWiki.loadWorkspace(legacy(), JSON.parse(localStorage.getItem(recoveryKey()) || 'null') || undefined);
      state = { ...state,...(result.profileId?{profileId:result.profileId,profiles:result.profiles}:{}),ready: true, view: result.view, catalog: result.catalog, error: '' };
      localStorage.removeItem(recoveryKey());
      window.dspWiki.onWorkspaceChanged(view => {
        if (pending || state.error || state.switching) return;
        state = { ...state, view }; emit();
      });
      if(state.profileId==='shared'&&localStorage.getItem(PINNED_MIGRATION_KEY)!=='1'){
        const pins=loadPinnedItems(),groups=loadPinnedGroups();
        if(pins.length||Object.values(groups).some(ids=>ids.length)){
          updateWorkspace(current=>({...current,pinned:migrateLocalPins(current.pinned,pins,groups)}));
          await flushWorkspaceWrites();
        }
        localStorage.setItem(PINNED_MIGRATION_KEY,'1');
      }
    } catch (error) { state = { ...state, error: error instanceof Error ? error.message : 'Unable to open workspace.' }; initialization = undefined; }
    emit();
  })();
  return initialization;
}
export function updateWorkspace(change: (current: Workspace) => Workspace) {
  if(state.switching)return;
  const current = state.view.data;
  const recovery = JSON.parse(localStorage.getItem(recoveryKey()) || 'null');
  const base = !pending && recovery ? recovery.base as Workspace : current;
  const next = change(current);
  try {
    const recovery = JSON.parse(localStorage.getItem(recoveryKey()) || 'null');
    localStorage.setItem(recoveryKey(), JSON.stringify({ base: recovery?.base || base, data: next }));
    backup(next);
  } catch {
    state = { ...state, error: 'Local recovery storage is full or unavailable. This edit was not applied.' }; emit(); return;
  }
  const removed=restoring?null:removalLabel(current,next);
  if(removed){clearTimeout(undoTimer);undoTimer=setTimeout(dismissRemoval,30000);lastRemoval={before:structuredClone(current),after:structuredClone(next)};state={...state,undoLabel:removed,undoError:undefined};}
  state = { ...state, view: { ...state.view, data: next, status: state.view.status === 'conflict' ? 'conflict' : 'pending' }, error: '' };
  pending++; emit();
  writes = writes.then(async () => {
    try {
      const view = await window.dspWiki!.saveWorkspace(next, base);
      if (pending === 1) { state = { ...state, view }; if (!state.error) localStorage.removeItem(recoveryKey()); }
    } catch { state = { ...state, error: 'Could not save to the desktop backend. Your recovery copy is kept locally. Retry saving before closing.' }; }
    finally { pending--; emit(); }
  });
}
export async function resolveWorkspace(choice: 'local' | 'cloud') {
  await writes;
  try { const view = await window.dspWiki!.resolveWorkspace(choice); state = { ...state, view, error: '' }; backup(view.data); localStorage.removeItem(recoveryKey()); }
  catch { state = { ...state, error: 'Could not resolve the conflict while cloud storage is unavailable.' }; }
  emit();
}
export async function retrySync() { await writes; await window.dspWiki?.syncWorkspace(); }
export function useWorkspace() { return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => state); }

export async function flushWorkspaceWrites() { await writes; if(state.error) throw Error('Workspace could not be saved.'); }

export async function refreshProfiles(){
  const index=await window.dspWiki!.listProfiles();
  state={...state,profiles:index.profiles};emit();
}
async function changeProfile(open:()=>Promise<ProfileWorkspace>){
  if(state.switching)return;
  state={...state,switching:true,profileError:undefined};emit();
  try{
    await flushWorkspaceWrites();
    if(state.view.status==='conflict')throw Error('Resolve the workspace conflict before switching play-throughs.');
    const result=await open();
    dismissRemoval();setSessionProfile(result.profileId);setPlannerProfile(result.profileId);
    state={...state,...result,ready:true,switching:false,error:'',profileError:undefined};emit();
  }catch(error){state={...state,switching:false,profileError:error instanceof Error?error.message:'Unable to open play-through.'};emit();throw error;}
}
export function switchProfile(id:string){return changeProfile(async()=>{const recovery=JSON.parse(localStorage.getItem(profileStorageKey('dsp-workspace-recovery',id))||'null')||undefined;const result=await window.dspWiki!.switchProfile(id,recovery);localStorage.removeItem(profileStorageKey('dsp-workspace-recovery',id));return result;});}
export function createProfile(name:string){return changeProfile(()=>window.dspWiki!.createProfile(name));}
export async function renameProfile(name:string){
  const result=await window.dspWiki!.renameProfile(state.profileId,name);
  state={...state,profiles:result.profiles,profileError:undefined};emit();
}
