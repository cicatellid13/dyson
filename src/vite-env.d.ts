/// <reference types="vite/client" />

interface DspWikiBridge {
  loadWorkspace: (legacy: import('./lib/workspace').Workspace, recovery?: { base: import('./lib/workspace').Workspace; data: import('./lib/workspace').Workspace }) => Promise<{view: import('./lib/workspace').SyncView; catalog: import('./lib/catalog').Catalog}>;
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
