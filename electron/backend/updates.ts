export type UpdateState = { status:'idle'|'checking'|'current'|'available'|'downloading'|'installing'|'error'; version?:string; progress?:number; message?:string; platform:string };
interface Updater {
 autoDownload:boolean; autoInstallOnAppQuit:boolean; allowPrerelease:boolean; allowDowngrade:boolean;
 on(event:string, listener:(value:any)=>void):unknown;
 checkForUpdates():Promise<unknown>;
 downloadUpdate():Promise<unknown>;
 quitAndInstall(silent?:boolean,forceRun?:boolean):void;
}
export function createUpdates(updater:Updater, environment:{packaged:boolean;platform:string}, publish:(state:UpdateState)=>void, prepare:()=>Promise<void>) {
 let state:UpdateState={status:'idle',platform:environment.platform};
 let checking:Promise<UpdateState>|undefined;
 let installing=false;
 const set=(change:Partial<UpdateState>)=>{state={...state,...change};publish(state);return state;};
 updater.autoDownload=false;
 updater.autoInstallOnAppQuit=false;
 updater.allowPrerelease=false;
 updater.allowDowngrade=false;
 updater.on('update-available',(info:{version:string})=>set({status:'available',version:info.version,message:undefined}));
 updater.on('update-not-available',()=>set({status:'current',version:undefined,message:undefined}));
 updater.on('download-progress',(info:{percent:number})=>set({status:'downloading',progress:Math.round(info.percent)}));
 updater.on('error',()=>set({status:'error',message:'The update could not be completed. Please try again or use the release download.'}));
 async function check() {
  if(!environment.packaged||environment.platform!=='win32')return set({status:'idle',message:environment.platform==='darwin'?'This unsigned Mac build is updated manually. Windows releases cannot be installed on Mac.':'Update checks are available in the installed Windows app.'});
  if(installing)return state;
  if(checking)return checking;
  set({status:'checking',message:undefined});
  checking=(async()=>{try{await updater.checkForUpdates();}catch{set({status:'error',message:'Could not check for updates. Check your connection and try again.'});}return state;})();
  try{return await checking;}finally{checking=undefined;}
 }
 async function install() {
  if(installing||environment.platform!=='win32'||!environment.packaged||!state.version)return state;
  installing=true;
  try {
   set({status:'downloading',progress:0,message:undefined});
   await updater.downloadUpdate();
   await prepare();
   set({status:'installing',message:'Opening the installer. Follow any Windows prompts to finish updating.'});
   // Visible installer: do not hide installer errors behind silent mode.
   updater.quitAndInstall(false,true);
  } catch {set({status:'error',message:'Could not download or prepare the update. Your workspace has been kept. Please try again.'});}
  finally {installing=false;}
  return state;
 }
 const timer=setInterval(()=>{void check();},4*60*60*1000);timer.unref();
 return {check,install,getState:()=>state,stop:()=>clearInterval(timer)};
}
