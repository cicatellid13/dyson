import { emptyPlanning } from './planning';
import { useSyncExternalStore } from 'react';
import { DESIGN_KEY, parseDesign } from './design';
import { emptyWorkspace, type Workspace, type SyncView } from './workspace';
import type { Catalog } from './catalog';

type State = { ready: boolean; view: SyncView; catalog: Catalog | null; error: string };
let state: State = { ready: false, view: { data: emptyWorkspace(), status: 'pending', message: '' }, catalog: null, error: '' };
const listeners = new Set<() => void>();
let initialization: Promise<void> | undefined;
let writes = Promise.resolve();
let pending = 0;
const recoveryKey = 'dsp-workspace-recovery';
function emit() { listeners.forEach(listener => listener()); }
function backup(data: Workspace) {
  localStorage.setItem(DESIGN_KEY, JSON.stringify(data.design));
  localStorage.setItem('dsp-favorites', JSON.stringify(data.favorites));
  localStorage.setItem('dsp-dark-fog', String(data.darkFog));
}
function legacy(): Workspace {
  const raw = JSON.parse(localStorage.getItem('dsp-favorites') ?? '[]');
  return { planning: emptyPlanning(), design: parseDesign(localStorage.getItem(DESIGN_KEY)), favorites: Array.isArray(raw) ? raw.filter(Number.isInteger) : [], darkFog: localStorage.getItem('dsp-dark-fog') === 'true' };
}
export function initializePersistence() {
  if (initialization) return initialization;
  initialization = (async () => {
    try {
      if (!window.dspWiki?.loadWorkspace) throw Error('Open the desktop app to connect to your cloud workspace.');
      const result = await window.dspWiki.loadWorkspace(legacy(), JSON.parse(localStorage.getItem(recoveryKey) || 'null') || undefined);
      state = { ready: true, view: result.view, catalog: result.catalog, error: '' };
      localStorage.removeItem(recoveryKey);
      window.dspWiki.onWorkspaceChanged(view => {
        if (pending || state.error) return;
        state = { ...state, view }; emit();
      });
    } catch (error) { state = { ...state, error: error instanceof Error ? error.message : 'Unable to open workspace.' }; initialization = undefined; }
    emit();
  })();
  return initialization;
}
export function updateWorkspace(change: (current: Workspace) => Workspace) {
  const current = state.view.data;
  const recovery = JSON.parse(localStorage.getItem(recoveryKey) || 'null');
  const base = !pending && recovery ? recovery.base as Workspace : current;
  const next = change(current);
  try {
    const recovery = JSON.parse(localStorage.getItem(recoveryKey) || 'null');
    localStorage.setItem(recoveryKey, JSON.stringify({ base: recovery?.base || base, data: next }));
    backup(next);
  } catch {
    state = { ...state, error: 'Local recovery storage is full or unavailable. This edit was not applied.' }; emit(); return;
  }
  state = { ...state, view: { ...state.view, data: next, status: state.view.status === 'conflict' ? 'conflict' : 'pending' }, error: '' };
  pending++; emit();
  writes = writes.then(async () => {
    try {
      const view = await window.dspWiki!.saveWorkspace(next, base);
      if (pending === 1) { state = { ...state, view }; if (!state.error) localStorage.removeItem(recoveryKey); }
    } catch { state = { ...state, error: 'Could not save to the desktop backend. Your recovery copy is kept locally. Retry saving before closing.' }; }
    finally { pending--; emit(); }
  });
}
export async function resolveWorkspace(choice: 'local' | 'cloud') {
  await writes;
  try { const view = await window.dspWiki!.resolveWorkspace(choice); state = { ...state, view, error: '' }; backup(view.data); localStorage.removeItem(recoveryKey); }
  catch { state = { ...state, error: 'Could not resolve the conflict while cloud storage is unavailable.' }; }
  emit();
}
export async function retrySync() { await writes; await window.dspWiki?.syncWorkspace(); }
export function useWorkspace() { return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => state); }
