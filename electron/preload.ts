import { contextBridge, shell } from "electron";

contextBridge.exposeInMainWorld("dspWiki", {
  openExternal: (url: string) => shell.openExternal(url),
});
