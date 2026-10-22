import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
function safeExternal(url: unknown) {
  if(typeof url !== 'string') return;
  try { const parsed=new URL(url); if(parsed.protocol==='https:'||parsed.protocol==='http:') return shell.openExternal(parsed.href); } catch { /* Ignore malformed external links. */ }
}
ipcMain.handle('open-external', (_event, url:unknown) => safeExternal(url));
function createWindow(){
  const win=new BrowserWindow({width:1400,height:960,minWidth:900,minHeight:650,title:'DSP Fieldguide',backgroundColor:'#101719',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(({url})=>{void safeExternal(url);return {action:'deny'};});
  win.webContents.on('will-navigate',(event,url)=>{event.preventDefault();void safeExternal(url);});
  win.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  if(devServerUrl&&!app.isPackaged) void win.loadURL(devServerUrl);
  else void win.loadFile(path.join(__dirname,'../dist/index.html'));
}
app.whenReady().then(()=>{createWindow();app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
