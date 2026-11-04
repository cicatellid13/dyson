import { useEffect, useState } from 'react';
import type { UpdateState } from '../../electron/backend/updates';
import { flushWorkspaceWrites } from '../lib/persistence';

export function UpdateControl() {
  const [state, setState] = useState<UpdateState>({ status: 'idle', platform: '' });
  const [hovered, setHovered] = useState(false);
  const [feedback, setFeedback] = useState(false);
  useEffect(() => {
    const bridge = window.dspWiki;
    if (!bridge) return;
    let alive = true;
    const stop = bridge.onUpdateState(value => { if (alive) setState(value); });
    void bridge.getUpdateState().then(value => { if (alive) setState(value); }).catch(() => {});
    return () => { alive = false; stop(); };
  }, []);
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(false), 5000);
    return () => clearTimeout(timer);
  }, [feedback, state.status]);

  const busy = ['checking', 'downloading', 'installing'].includes(state.status);
  const available = !!state.version;
  let message = state.message || 'Check for updates';
  if (state.status === 'checking') message = 'Checking for updates…';
  if (state.status === 'current') message = 'App up to date';
  if (state.status === 'available') message = `Version ${state.version} available. Click to update.`;
  if (state.status === 'downloading') message = `Downloading ${state.version ?? 'update'} · ${state.progress ?? 0}%`;
  if (state.status === 'error') message += available ? ' Click to retry the update.' : ' Click to retry.';

  async function activate() {
    if (busy) return;
    setFeedback(true);
    const bridge = window.dspWiki;
    if (!bridge) { setState({ status: 'idle', platform: '', message: 'Open the desktop app to check for updates.' }); return; }
    try {
      if (available) {
        setState(current => ({ ...current, status: 'downloading', progress: 0 }));
        await flushWorkspaceWrites();
        setState(await bridge.installUpdate());
      } else {
        setState(current => ({ ...current, status: 'checking' }));
        setState(await bridge.checkUpdate());
      }
    } catch {
      setState(current => ({ ...current, status: 'error', message: 'Update could not complete. Check your connection and saved changes.' }));
    }
  }

  return <div className="version-controls">
    <small className="app-version" aria-label={`App version ${__APP_VERSION__}`}>v{__APP_VERSION__}</small>
    <span className="update-control" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button className={`update-button update-${state.status}`} aria-label={message} aria-busy={busy} aria-disabled={busy} onClick={() => void activate()} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          {state.status === 'available' && <defs><linearGradient id="update-cyan" x2="0" y2="1"><stop stopColor="#f0ffff"/><stop offset=".4" stopColor="#51cce9"/><stop offset=".58" stopColor="#c2fbff"/><stop offset="1" stopColor="#36b5d6"/></linearGradient></defs>}
          {state.status === 'current' ? <path d="m5 12 4 4L19 6"/> : state.status === 'error' ? <><circle cx="12" cy="12" r="9"/><path d="M12 6v8m0 3h.01"/></> : available ? <path stroke={state.status === 'available' ? 'url(#update-cyan)' : undefined} d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/> : <path d="M19 8a8 8 0 1 0 1 8M19 3v5h-5"/>}
        </svg>
      </button>
      {(hovered || feedback) && <span className="update-feedback" role="tooltip">{message}</span>}
      <span className="sr-only" role="status">{message}</span>
    </span>
  </div>;
}
