import {useEffect,useRef,useState} from 'react';
import type {UpdateState} from '../../electron/backend/updates';
import {flushWorkspaceWrites} from '../lib/persistence';
import {openInBrowser} from '../lib/wikiLinks';
export function UpdateControl(){
 const [state,setState]=useState<UpdateState>({status:'idle',platform:''});
 const [open,setOpen]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const bridge=window.dspWiki;if(!bridge)return;let alive=true;const stop=bridge.onUpdateState(value=>{if(alive)setState(value);});void bridge.getUpdateState().then(value=>{if(alive)setState(value);}).catch(()=>{});return()=>{alive=false;stop();};},[]);
 useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
 const busy=['checking','downloading','installing'].includes(state.status);
 const available=!!state.version;
 async function check(){setOpen(true);if(!window.dspWiki){setState({status:'idle',platform:'',message:'Update checks are available in the desktop app.'});return;}try{setState(await window.dspWiki.checkUpdate());}catch{setState(s=>({...s,status:'error',message:'Could not check for updates. Please try again.'}));}}
 async function install(){try{setState(s=>({...s,status:'downloading',progress:0}));await flushWorkspaceWrites();await window.dspWiki?.installUpdate();}catch{setState(s=>({...s,status:'error',message:'Could not save pending changes. Please retry before updating.'}));}}
 return <><div className="version-controls"><small className="app-version" aria-label={`App version ${__APP_VERSION__}`}>v{__APP_VERSION__}</small><button className={`update-button ${available?'available':''}`} aria-label={available?`Update available: ${state.version}`:'Check for updates'} data-tooltip={available?`Update to ${state.version}`:'Check for updates'} onClick={()=>void check()} disabled={busy}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M19 8a8 8 0 1 0 1 8M19 3v5h-5M12 7v10m-4-4 4 4 4-4"/></svg></button></div><dialog ref={dialog} className="update-dialog" onCancel={e=>{if(busy)e.preventDefault();else setOpen(false);}}><h2>App update</h2><p role="status">{state.status==='checking'?'Checking for updates…':state.status==='downloading'?`Downloading update… ${state.progress??0}%`:state.status==='installing'?state.message:state.status==='current'?"You’re up to date.":state.status==='available'?`Version ${state.version} is available. Update now?`:state.message??'Check for a newer release.'}</p>{state.status==='available'&&<p className="note">Your changes will be saved before the installer opens.</p>}<div className="update-actions">{!busy&&<button onClick={()=>setOpen(false)}>{available?'Later':'OK'}</button>}{state.status==='available'&&<button onClick={()=>void install()}>Update</button>}{state.status==='error'&&<><button onClick={()=>void check()}>Retry</button><button onClick={()=>openInBrowser('https://github.com/cicatellid13/dyson/releases/latest')}>Release download</button></>}</div></dialog></>;
}
