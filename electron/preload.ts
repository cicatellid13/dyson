import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('dspWiki', {
  openExternal: (url:string):Promise<void> => ipcRenderer.invoke('open-external',url),
});
