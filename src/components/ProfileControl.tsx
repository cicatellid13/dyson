import { useState } from 'react';
import { ThemedSelect } from './ThemedSelect';
import { createProfile,refreshProfiles,renameProfile,switchProfile,useWorkspace } from '../lib/persistence';

export function ProfileControl(){
  const cloud=useWorkspace();
  const [mode,setMode]=useState<'new'|'rename'|null>(null),[name,setName]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const current=cloud.profiles.find(profile=>profile.id===cloud.profileId);
  const locked=busy||cloud.switching||cloud.view.status==='conflict';
  async function submit(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError('');
    try{if(mode==='new')await createProfile(name);else await renameProfile(name);setMode(null);}
    catch(error){setError(error instanceof Error?error.message:'Unable to save play-through.');}
    finally{setBusy(false);}
  }
  return <section className="profile-control" aria-label="Play-through profiles">
    <span className="profile-caption">PLAY-THROUGH</span>
    <div className="profile-picker-row">
      <ThemedSelect aria-label="Saved play-through" value={cloud.profileId} disabled={locked} onChange={event=>{setError('');void switchProfile(event.target.value).catch(()=>{});}}>
        {cloud.profiles.map(profile=><option value={profile.id} key={profile.id}>{profile.name}</option>)}
      </ThemedSelect>
      <button type="button" className="profile-action" aria-label="Rename play-through" data-tooltip="Rename play-through" disabled={locked} onClick={()=>{setMode('rename');setName(current?.name??'');setError('');}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 4 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 15v5Z"/></svg></button>
      <button type="button" className="profile-action" aria-label="New play-through" data-tooltip="New play-through" disabled={locked} onClick={()=>{setMode('new');setName('');setError('');}}>+</button>
    </div>
    {mode&&<form className="profile-form" onSubmit={submit}>
      <label>{mode==='new'?'New play-through':'Rename play-through'}<input autoFocus aria-label="Play-through name" value={name} maxLength={80} disabled={busy} onChange={event=>setName(event.target.value)}/></label>
      {mode==='new'&&<p>Starts empty. Your current play-through stays saved.</p>}
      <div><button type="submit" disabled={!name.trim()||locked}>{mode==='new'?'Create':'Save name'}</button><button type="button" disabled={busy} onClick={()=>setMode(null)}>Cancel</button></div>
    </form>}
    {(error||cloud.profileError)&&<p className="profile-error" role="alert">{error||cloud.profileError}</p>}
    <button type="button" className="profile-refresh" disabled={locked} onClick={()=>{setBusy(true);void refreshProfiles().catch(error=>setError(error instanceof Error?error.message:'Unable to refresh play-throughs.')).finally(()=>setBusy(false));}}>Refresh saved play-throughs</button>
  </section>;
}
