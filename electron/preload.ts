import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('dspWiki', {
  getUpdateState: () => ipcRenderer.invoke('update-state'),
  checkUpdate: () => ipcRenderer.invoke('update-check'),
  installUpdate: () => ipcRenderer.invoke('update-install'),
  onUpdateState: (callback: (state: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state);
    ipcRenderer.on('update-state', listener);
    return () => ipcRenderer.removeListener('update-state', listener);
  },
  listProfiles: () => ipcRenderer.invoke('profiles-list'),
  switchProfile: (id:string,recovery?:unknown) => ipcRenderer.invoke('profile-switch',id,recovery),
  createProfile: (name:string) => ipcRenderer.invoke('profile-create',name),
  renameProfile: (id:string,name:string) => ipcRenderer.invoke('profile-rename',id,name),
  loadWorkspace: (legacy: unknown, recovery: unknown) => ipcRenderer.invoke('workspace-load', legacy, recovery),
  saveWorkspace: (data: unknown, base: unknown) => ipcRenderer.invoke('workspace-save', data, base),
  syncWorkspace: () => ipcRenderer.invoke('workspace-sync'),
  resolveWorkspace: (choice: 'local' | 'cloud') => ipcRenderer.invoke('workspace-resolve', choice),
  onWorkspaceChanged: (callback: (view: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, view: unknown) => callback(view);
    ipcRenderer.on('workspace-changed', listener);
    return () => ipcRenderer.removeListener('workspace-changed', listener);
  },
  openExternal: (url:string):Promise<void> => ipcRenderer.invoke('open-external',url),
});
