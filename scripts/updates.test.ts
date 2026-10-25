import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startUpdates, updateBeforeOpening } from '../electron/backend/updates';
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function fake(checkForUpdates = async (): Promise<{downloadPromise?: Promise<unknown>} | null> => null) {
  return { autoDownload: false, autoInstallOnAppQuit: false, allowPrerelease: true, allowDowngrade: true, on() {}, checkForUpdates };
}
test('updater is disabled for development and non-Windows platforms', () => {
  let checks = 0;
  const updater = fake(async () => { checks++; return null; });
  startUpdates(updater, { packaged: false, platform: 'win32' })();
  startUpdates(updater, { packaged: true, platform: 'darwin' })();
  assert.equal(checks, 0);
});
test('downloads in background, installs on quit, and never overlaps downloads', async () => {
  let checks = 0;
  let finish!: () => void;
  const downloadPromise = new Promise<void>(resolve => { finish = resolve; });
  const updater = fake(async () => { checks++; return { downloadPromise }; });
  const stop = startUpdates(updater, { packaged: true, platform: 'win32' }, 5);
  try {
    await pause(30);
    assert.equal(checks, 1);
    assert.equal(updater.autoDownload, true);
    assert.equal(updater.autoInstallOnAppQuit, true);
    assert.equal(updater.allowPrerelease, false);
    assert.equal(updater.allowDowngrade, false);
    finish();
    await pause(30);
    assert.ok(checks > 1);
  } finally { finish(); stop(); }
});
test('network and download failures are retried without unhandled rejections', async () => {
  let checks = 0;
  const updater = fake(async () => {
    if (++checks === 1) throw Error('Offline');
    return { downloadPromise: Promise.reject(Error('Interrupted download')) };
  });
  const stop = startUpdates(updater, { packaged: true, platform: 'win32' }, 5);
  try { await pause(35); assert.ok(checks > 1); } finally { stop(); }
});

test('startup installs a downloaded update and relaunches before editing begins',async()=>{
 let installed=false; const notices:string[]=[];
 const updater={...fake(async()=>({updateInfo:{version:'1.2.12'},downloadPromise:Promise.resolve()})),quitAndInstall:(silent?:boolean,relaunch?:boolean)=>{assert.equal(silent,true);assert.equal(relaunch,true);installed=true;}};
 assert.equal(await updateBeforeOpening(updater,{packaged:true,platform:'win32'},v=>notices.push(v)),true);
 assert.equal(installed,true);assert.deepEqual(notices,['1.2.12']);
});
test('slow startup download opens app and never restarts an active session later',async()=>{
 let finish!:()=>void;let installs=0;
 const updater={...fake(async()=>({downloadPromise:new Promise<void>(resolve=>{finish=resolve;})})),quitAndInstall:()=>{installs++;}};
 assert.equal(await updateBeforeOpening(updater,{packaged:true,platform:'win32'},()=>{},5),false);
 finish();await pause(10);assert.equal(installs,0);
});
test('offline startup and Mac startup continue without installation',async()=>{
 const updater={...fake(async()=>{throw Error('offline');}),quitAndInstall:()=>{throw Error('must not install');}};
 assert.equal(await updateBeforeOpening(updater,{packaged:true,platform:'win32'},()=>{}),false);
 assert.equal(await updateBeforeOpening(updater,{packaged:true,platform:'darwin'},()=>{}),false);
});
