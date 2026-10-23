import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startUpdates } from '../electron/backend/updates';
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
