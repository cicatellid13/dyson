import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from './backend/database';
import { Persistence } from './backend/persistence';
import { validateWorkspace } from '../src/lib/workspace';
import { autoUpdater } from 'electron-updater';
import { startUpdates, updateBeforeOpening } from './backend/updates';
import bundled from '../public/data/catalog.json';
import type { Catalog } from '../src/lib/catalog';

// Preserve existing profiles across product-name changes.
app.setPath('userData', path.join(app.getPath('appData'), 'dsp-wiki-desktop'));
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();
app.on('second-instance', () => { const window = BrowserWindow.getAllWindows()[0]; if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
function safeExternal(url: unknown) {
  if(typeof url !== 'string') return;
  try { const parsed=new URL(url); if(parsed.protocol==='https:'||parsed.protocol==='http:') return shell.openExternal(parsed.href); } catch { /* Ignore malformed external links. */ }
}
ipcMain.handle('open-external', (_event, url:unknown) => safeExternal(url));
let persistence: Persistence | undefined;
function storage() {
  if (!persistence) {
    const envFiles = [path.join(app.getPath('userData'), '.env'), ...(!app.isPackaged ? [path.join(app.getAppPath(), '.env')] : [])];
    persistence = new Persistence(new Database(envFiles), path.join(app.getPath('userData'), 'cloud-workspace.json'), view => {
      for (const window of BrowserWindow.getAllWindows()) window.webContents.send('workspace-changed', view);
    });
  }
  return persistence;
}
function trusted(event: Electron.IpcMainInvokeEvent) {
  if (event.senderFrame !== event.sender.mainFrame) throw Error('Untrusted request.');
  const url = event.senderFrame?.url || '';
  if (devServerUrl && !app.isPackaged && new URL(url).origin === new URL(devServerUrl).origin) return;
  if (url.startsWith('file:') && fileURLToPath(url) === path.join(__dirname, '../dist/index.html')) return;
  throw Error('Untrusted request.');
}
ipcMain.handle('workspace-load', async (event, legacy, recovery) => { trusted(event); try { return await storage().initialize(validateWorkspace(legacy), bundled as unknown as Catalog, recovery); } catch { throw Error('Could not open shared storage. Check the app .env and MongoDB network access. Local data is preserved.'); } });
ipcMain.handle('workspace-save', async (event, value, base) => { trusted(event); try { return await storage().save(value, base); } catch { throw Error('Workspace could not be saved locally.'); } });
ipcMain.handle('workspace-sync', async event => { trusted(event); await storage().sync(); });
ipcMain.handle('workspace-resolve', async (event, choice) => { trusted(event); if (choice !== 'local' && choice !== 'cloud') throw Error('Invalid choice.'); try { return await storage().resolve(choice); } catch { throw Error('Could not reach cloud storage.'); } });
let closing = false;
app.on('before-quit', event => {
  if (!persistence || closing) return;
  event.preventDefault(); closing = true;
  void persistence.close().catch(() => {}).finally(() => app.quit());
});
function createWindow(){
  const win=new BrowserWindow({width:1400,height:960,minWidth:900,minHeight:650,title:'DSP Toolkit',backgroundColor:'#101719',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.on('focus', () => { void persistence?.sync(); });
  win.webContents.setWindowOpenHandler(({url})=>{void safeExternal(url);return {action:'deny'};});
  win.webContents.on('will-navigate',(event,url)=>{event.preventDefault();void safeExternal(url);});
  win.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  if(devServerUrl&&!app.isPackaged) void win.loadURL(devServerUrl);
  else void win.loadFile(path.join(__dirname,'../dist/index.html'));
}
let starting = true;
function showUpdateNotice(version: string) {
  const notice=new BrowserWindow({width:390,height:155,resizable:false,alwaysOnTop:true,autoHideMenuBar:true,title:'DSP Toolkit',backgroundColor:'#101719',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  const safeVersion=version.replace(/[^a-zA-Z0-9.+-]/g,'');
  void notice.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(`<html><body style="margin:0;padding:22px;background:#101719;color:#dfe7e9;font:14px system-ui;text-align:center"><p>Updating to version ${safeVersion}</p><button onclick="window.close()" style="background:#294238;border:1px solid #486353;border-radius:5px;color:#dfe7e9;padding:7px 30px;cursor:pointer">OK</button><script>setTimeout(()=>window.close(),5000)</script></body></html>`));
  setTimeout(()=>{if(!notice.isDestroyed())notice.close();},5500).unref();
}
if (hasInstanceLock) app.whenReady().then(async()=>{
  setInterval(()=>{void persistence?.sync();},30000).unref();
  const installed=await updateBeforeOpening(autoUpdater,{packaged:app.isPackaged,platform:process.platform},showUpdateNotice);
  if(installed)return;
  starting=false;createWindow();
  // The startup check already ran; background checks resume on their normal cadence.
  startUpdates(autoUpdater, { packaged: app.isPackaged, platform: process.platform }, undefined, false);
  app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});
});
app.on('window-all-closed',()=>{if(!starting&&process.platform!=='darwin')app.quit();});
