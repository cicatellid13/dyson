/// <reference types="vite/client" />

interface DspWikiBridge {
  listProfiles:()=>Promise<import('./lib/profiles').ProfileIndex>;
  switchProfile:(id:string,recovery?:{base:import('./lib/workspace').Workspace;data:import('./lib/workspace').Workspace})=>Promise<import('./lib/profiles').ProfileWorkspace>;
  createProfile:(name:string)=>Promise<import('./lib/profiles').ProfileWorkspace>;
  renameProfile:(id:string,name:string)=>Promise<import('./lib/profiles').ProfileIndex>;
  getUpdateState: () => Promise<import('../electron/backend/updates').UpdateState>;
  checkUpdate: () => Promise<import('../electron/backend/updates').UpdateState>;
  installUpdate: () => Promise<import('../electron/backend/updates').UpdateState>;
  onUpdateState: (callback: (state: import('../electron/backend/updates').UpdateState) => void) => () => void;
  loadWorkspace: (legacy: import('./lib/workspace').Workspace, recovery?: { base: import('./lib/workspace').Workspace; data: import('./lib/workspace').Workspace }) => Promise<import('./lib/profiles').ProfileWorkspace>;
  saveWorkspace: (data: import('./lib/workspace').Workspace, base: import('./lib/workspace').Workspace) => Promise<import('./lib/workspace').SyncView>;
  syncWorkspace: () => Promise<void>;
  resolveWorkspace: (choice: 'local' | 'cloud') => Promise<import('./lib/workspace').SyncView>;
  onWorkspaceChanged: (handler: (view: import('./lib/workspace').SyncView) => void) => () => void;
  openExternal: (url: string) => Promise<void>;
  onNavigateWiki?: (handler: (title: string) => void) => () => void;
}

interface Window {
  dspWiki?: DspWikiBridge;
}

declare const __APP_VERSION__: string;
