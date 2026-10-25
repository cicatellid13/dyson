interface Updater {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  allowDowngrade: boolean;
  on(event: 'error', listener: (error: Error) => void): unknown;
  checkForUpdates(): Promise<{ downloadPromise?: Promise<unknown> | null } | null>;
}

// The updater's quit hook runs after main.ts finishes saving the workspace.
// Never restart an active editing session to apply a downloaded update.
export function startUpdates(updater: Updater, environment: { packaged: boolean; platform: string }, intervalMs = 4 * 60 * 60 * 1000, checkImmediately = true) {
  if (!environment.packaged || environment.platform !== 'win32') return () => {};
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  updater.on('error', () => { console.warn('App update unavailable; will retry automatically.'); });
  let checking = false;
  const check = async () => {
    if (checking) return;
    checking = true;
    try {
      const result = await updater.checkForUpdates();
      await result?.downloadPromise;
    } catch { /* Offline or incomplete releases are retried on the next check. */ }
    finally { checking = false; }
  };
  if(checkImmediately) void check();
  const timer = setInterval(() => { void check(); }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

/** Apply startup updates before the user can edit; never interrupt an editing session. */
export async function updateBeforeOpening(updater: Updater & { quitAndInstall: (silent?:boolean, forceRun?:boolean)=>void }, environment: {packaged:boolean;platform:string}, notify:(version:string)=>void, timeoutMs=30000):Promise<boolean> {
  if(!environment.packaged||environment.platform!=='win32')return false;
  updater.autoDownload=true; updater.autoInstallOnAppQuit=true;
  updater.allowPrerelease=false; updater.allowDowngrade=false;
  updater.on('error',()=>{});
  let expired=false;
  let timer:ReturnType<typeof setTimeout>;
  const timeout=new Promise<boolean>(resolve=>{timer=setTimeout(()=>{expired=true;resolve(false);},timeoutMs);});
  const operation=(async()=>{
    try {
      const result=await updater.checkForUpdates();
      if(!result?.downloadPromise || expired)return false;
      const version=(result as {updateInfo?:{version?:string}}).updateInfo?.version;
      if(version)notify(version);
      await result.downloadPromise;
      if(expired)return false;
      updater.quitAndInstall(true,true);
      return true;
    } catch {return false;}
  })();
  try{return await Promise.race([operation,timeout]);}finally{clearTimeout(timer!);}
}
