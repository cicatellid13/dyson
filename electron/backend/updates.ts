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
export function startUpdates(updater: Updater, environment: { packaged: boolean; platform: string }, intervalMs = 4 * 60 * 60 * 1000) {
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
  void check();
  const timer = setInterval(() => { void check(); }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
