import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mergeWorkspace, encode, workspacePatch } from '../electron/backend/merge';
import { Persistence } from '../electron/backend/persistence';
import { emptyWorkspace, type Workspace } from '../src/lib/workspace';
import type { Database } from '../electron/backend/database';
import type { Catalog } from '../src/lib/catalog';
const fixture = (): Workspace => ({ ...emptyWorkspace(), design: { version: 1, sections: [{ id:'sol', kind:'system', parentId:null, name:'Sol', notes:'', imports:[], exports:[] }] } });
const copy = <T,>(x:T):T => structuredClone(x);
test('merges independent notes, favorites and settings across devices', () => {
 const base=fixture(), local=copy(base), remote=copy(base);
 local.design.sections[0].notes='Local note'; local.favorites=[1]; remote.favorites=[2]; remote.darkFog=true;
 const merged=mergeWorkspace(base,local,remote);
 assert.equal(merged.design.sections[0].notes,'Local note'); assert.deepEqual(merged.favorites,[1,2]); assert.equal(merged.darkFog,true);
});
test('same-field conflicts and deletion versus editing do not silently overwrite', () => {
 const base=fixture(), local=copy(base), remote=copy(base);
 local.design.sections[0].notes='local'; remote.design.sections[0].notes='remote';
 assert.throws(()=>mergeWorkspace(base,local,remote), /conflict/);
 local.design.sections=[]; assert.throws(()=>mergeWorkspace(base,local,remote), /conflict/);
});
test('patches only changed sections and fields',()=>{
 const base=fixture(), next=copy(base); next.darkFog=true;
 assert.deepEqual(workspacePatch(encode(base),encode(next)),{set:{'data.darkFog':true},unset:{}});
 next.design.sections=[]; assert.deepEqual(workspacePatch(encode(base),encode(next)).unset,{'data.sections.sol':''});
});
test('offline saves survive restart; recovery, revision retry and conflicts preserve data',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'dsp-sync-')); const cache=path.join(dir,'cache.json');
 let remote=fixture(), revision=0, offline=false, collisions=0, writes=0;
 const db={seedCatalog:async(c:Catalog)=>c,initializeWorkspace:async()=>({data:copy(remote),revision}),readWorkspace:async()=>{if(offline)throw Error('offline'); return {data:copy(remote),revision};},writeWorkspace:async(_p:Workspace,n:Workspace,r:number)=>{writes++;if(collisions-->0)return false;if(r!==revision)return false;remote=copy(n);revision++;return true;},close:async()=>{}} as unknown as Database;
 const bundled={} as Catalog;
 let p=new Persistence(db,cache,()=>{});
 try {
  await p.initialize(fixture(),bundled);
  const next=fixture();next.design.sections[0].notes='saved offline';offline=true;
  await p.save(next,fixture());await p.sync(); assert.equal(p.view().status,'offline');await p.close();
  p=new Persistence(db,cache,()=>{});await p.initialize(fixture(),bundled);assert.equal(p.view().data.design.sections[0].notes,'saved offline');
  offline=false;collisions=1;await p.sync();assert.equal(remote.design.sections[0].notes,'saved offline');assert.equal(writes,2);
  assert.equal((await p.initialize(fixture(),bundled)).view.data.design.sections[0].notes,'saved offline');
  const before=copy(p.view().data), recovered=copy(before);recovered.darkFog=true;await p.close();
  p=new Persistence(db,cache,()=>{});await p.initialize(fixture(),bundled,{base:before,data:recovered});assert.equal(remote.darkFog,true);
  const local=copy(remote);local.design.sections[0].notes='mine';await p.save(local,remote);
  remote.design.sections[0].notes='theirs';revision++;await p.sync();assert.equal(p.view().status,'conflict');assert.equal(p.view().data.design.sections[0].notes,'mine');
  await p.resolve('cloud');assert.equal(p.view().data.design.sections[0].notes,'theirs');
  assert.ok(JSON.parse(await readFile(cache,'utf8')).data);
 }finally{await p.close();await rm(dir,{recursive:true,force:true});}
});
