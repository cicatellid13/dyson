import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('dspWiki', {
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
