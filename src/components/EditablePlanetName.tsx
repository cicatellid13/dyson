import { useRef, useState } from 'react';
export function EditablePlanetName({name,onChange}:{name:string;onChange:(name:string)=>void}) {
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState(name);
  const cancelled=useRef(false);
  function finish(){if(!cancelled.current&&draft.trim()&&draft.trim()!==name)onChange(draft.trim());setEditing(false);}
  return <div className="planet-name-field">{editing?<input autoFocus aria-label="Planet name" maxLength={120} value={draft} onFocus={event=>event.target.select()} onChange={event=>setDraft(event.target.value)} onBlur={finish} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}if(event.key==='Escape'){cancelled.current=true;setEditing(false);}}}/>:<><h2>{name||'Untitled planet'}</h2><button type="button" aria-label="Edit planet name" data-tooltip="Edit planet name" onClick={()=>{cancelled.current=false;setDraft(name);setEditing(true);}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14l-1 7 6-2"/></svg></button></>}</div>;
}
