import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Profiles } from '../electron/backend/profiles';
import type { Database } from '../electron/backend/database';
import type { Catalog } from '../src/lib/catalog';
import { emptyWorkspace,type Workspace } from '../src/lib/workspace';
import { profileName,profileStorageKey,validProfileId,type ProfileInfo } from '../src/lib/profiles';
const copy=<T,>(value:T):T=>structuredClone(value);
function server(){
 const docs=new Map<string,{data:Workspace;revision:number}>();
 const profiles:ProfileInfo[]=[{id:'shared',name:'Current play-through',createdAt:'2026-01-01'}];
 let offline=false;
 const check=()=>{if(offline)throw Error('offline');};
 const database=(id:string)=>({
  listProfiles:async()=>{check();return copy(profiles);},
  createProfile:async(value:unknown)=>{check();const name=profileName(value);if(profiles.some(p=>p.name.toLowerCase()===name.toLowerCase()))throw Error('already exists');const profile={id:`profile-${profiles.length}`,name,createdAt:new Date().toISOString()};profiles.push(profile);docs.set(profile.id,{data:emptyWorkspace(),revision:0});return copy(profile);},
  renameProfile:async(id:string,value:unknown)=>{check();profiles.find(p=>p.id===id)!.name=profileName(value);},
  seedCatalog:async(c:Catalog)=>{check();return c;},
  initializeWorkspace:async(legacy:Workspace)=>{check();if(!docs.has(id))docs.set(id,{data:copy(legacy),revision:0});return copy(docs.get(id)!);},
  readWorkspace:async()=>{check();return copy(docs.get(id)!);},
  writeWorkspace:async(_previous:Workspace,next:Workspace,revision:number)=>{check();const doc=docs.get(id)!;if(doc.revision!==revision)return false;docs.set(id,{data:copy(next),revision:revision+1});return true;},close:async()=>{}
 }) as unknown as Database;
 return {database,docs,setOffline:(value:boolean)=>{offline=value;}};
}
const catalog={downloaded:'2026-01-01'} as Catalog;
test('profile names and storage paths validate without changing original backup keys',()=>{
 assert.equal(profileName('  My galaxy  '),'My galaxy');
 for(const value of ['',null,'a'.repeat(81)])assert.throws(()=>profileName(value));
 for(const id of ['../other','__proto__','a/b',''])assert.equal(validProfileId(id),false);
 assert.equal(profileStorageKey('backup','shared'),'backup');
 assert.equal(profileStorageKey('backup','profile-1'),'backup:profile:profile-1');
});
test('existing data, new saves, switching, restart and a second machine remain isolated',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'dsp-profiles-'));const remote=server();
 let mac=new Profiles([],path.join(dir,'mac'),catalog,()=>{},remote.database);
 const windows=new Profiles([],path.join(dir,'windows'),catalog,()=>{},remote.database);
 try{
  const existing=emptyWorkspace();existing.favorites=[1303];existing.pinned={items:['planet:home',1101],groups:{'planet:home':[1101]}};existing.planning.notes=[{id:'n',folderId:null,title:'Original',body:'Keep me'}];
  const original=await mac.initialize(existing);assert.deepEqual(original.view.data,existing);
  const fresh=await mac.create('Second run');assert.deepEqual(fresh.view.data,emptyWorkspace());
  const next=copy(fresh.view.data);next.favorites=[1102];next.darkFog=true;
  await mac.save(next,fresh.view.data);
  assert.deepEqual((await mac.switch('shared')).view.data,existing);
  assert.deepEqual((await mac.switch(fresh.profileId)).view.data,next);
  await mac.rename(fresh.profileId,'Dark Fog run');
  await assert.rejects(mac.create('DARK FOG RUN'),/already exists/);
  await mac.close();mac=new Profiles([],path.join(dir,'mac'),catalog,()=>{},remote.database);
  const reopened=await mac.initialize(emptyWorkspace());assert.equal(reopened.profileId,fresh.profileId);assert.deepEqual(reopened.view.data,next);
  const other=await windows.initialize(emptyWorkspace());assert.equal(other.profileId,'shared');assert.deepEqual(other.view.data,existing);
  assert.equal(other.profiles.find(p=>p.id===fresh.profileId)!.name,'Dark Fog run');
  assert.deepEqual((await windows.switch(fresh.profileId)).view.data,next);
  const more=copy(next);more.favorites.push(1103);await windows.save(more,next);await windows.flush();await mac.sync();
  assert.deepEqual((await mac.initialize(emptyWorkspace())).view.data,more);
  assert.deepEqual(remote.docs.get('shared')!.data,existing);
  remote.setOffline(true);await mac.close();mac=new Profiles([],path.join(dir,'mac'),catalog,()=>{},remote.database);
  const offline=await mac.initialize(emptyWorkspace());assert.equal(offline.profileId,fresh.profileId);assert.equal(offline.view.status,'offline');assert.deepEqual(offline.view.data,more);
  assert.deepEqual((await mac.switch('shared')).view.data,existing);
  await assert.rejects(mac.switch('../unsafe'),/not found/);
 }finally{await mac.close();await windows.close();await rm(dir,{recursive:true,force:true});}
});
test('failed uncached switch preserves active data; renderer recovery applies only to its target',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'dsp-profiles-'));const remote=server();const manager=new Profiles([],dir,catalog,()=>{},remote.database);
 try{
  const original=emptyWorkspace();original.favorites=[1303];await manager.initialize(original);
  const second=await manager.create('Another');await manager.switch('shared');
  const recovered=emptyWorkspace();recovered.favorites=[1101];
  assert.deepEqual((await manager.switch(second.profileId,{base:emptyWorkspace(),data:recovered})).view.data,recovered);
  assert.deepEqual((await manager.switch('shared')).view.data,original);
  await remote.database('shared').createProfile('Uncached');await manager.list();remote.setOffline(true);
  await assert.rejects(manager.switch('profile-2'),/initialize/);
  assert.equal((await manager.initialize(emptyWorkspace())).profileId,'shared');
  assert.deepEqual((await manager.initialize(emptyWorkspace())).view.data,original);
 }finally{await manager.close();await rm(dir,{recursive:true,force:true});}
});
