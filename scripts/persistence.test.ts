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
  const next=fixture();next.design.sections[0].notes='saved offline';next.planning={folders:[{id:'folder',name:'Factory'}],notes:[{id:'note',folderId:'folder',title:'Smelters',body:'Keep this offline plan'}]};offline=true;
  await p.save(next,fixture());await p.sync(); assert.equal(p.view().status,'offline');await p.close();
  p=new Persistence(db,cache,()=>{});await p.initialize(fixture(),bundled);assert.equal(p.view().data.design.sections[0].notes,'saved offline');assert.equal(p.view().data.planning.notes[0].body,'Keep this offline plan');
  offline=false;collisions=1;await p.sync();assert.equal(remote.design.sections[0].notes,'saved offline');assert.equal(writes,2);
  assert.equal((await p.initialize(fixture(),bundled)).view.data.design.sections[0].notes,'saved offline');
  const before=copy(p.view().data), recovered=copy(before);recovered.darkFog=true;await p.close();
  p=new Persistence(db,cache,()=>{});await p.initialize(fixture(),bundled,{base:before,data:recovered});assert.equal(remote.darkFog,true);
  const local=copy(remote);local.design.sections[0].notes='mine';await p.save(local,remote);
  remote.design.sections[0].notes='theirs';revision++;await p.sync();assert.equal(p.view().status,'conflict');assert.equal(p.view().data.design.sections[0].notes,'mine');
  await p.resolve('cloud');assert.equal(p.view().data.design.sections[0].notes,'theirs');
  const stale=copy(p.view().data);remote.design.sections[0].notes='new remote';revision++;await p.sync();
  const edit=copy(stale);edit.design.sections[0].notes='stale renderer edit';
  const result=await p.save(edit,stale);assert.equal(result.status,'conflict');assert.equal(result.data.design.sections[0].notes,'stale renderer edit');
  await p.resolve('cloud');assert.equal(p.view().data.design.sections[0].notes,'new remote');
  assert.ok(JSON.parse(await readFile(cache,'utf8')).data);
 }finally{await p.close();await rm(dir,{recursive:true,force:true});}
});

test('old workspace records gain empty planning without changing planets or favorites', async () => {
 const { validateWorkspace } = await import('../src/lib/workspace');
 const old = { design:fixture().design, favorites:[1303], darkFog:true };
 const migrated=validateWorkspace(old);
 assert.deepEqual(migrated.planning,{folders:[],notes:[]});
 assert.deepEqual(migrated.design,old.design); assert.deepEqual(migrated.favorites,[1303]);
});
test('planning records merge and patch independently; same-note and folder-deletion conflicts remain visible', async () => {
 const { removePlanningFolder } = await import('../src/lib/planning');
 const base=fixture();
 base.planning={folders:[{id:'plans',name:'Plans'}],notes:[{id:'a',folderId:'plans',title:'Forge',body:''},{id:'b',folderId:'plans',title:'Mining',body:''}]};
 const local=copy(base), remote=copy(base);
 local.planning.notes[0].body='Build smelters'; remote.planning.notes[1].body='Find iron';
 const merged=mergeWorkspace(base,local,remote);
 assert.equal(merged.planning.notes[0].body,'Build smelters');assert.equal(merged.planning.notes[1].body,'Find iron');
 assert.deepEqual(Object.keys(workspacePatch(encode(base),encode(local)).set),['data.notes.a']);
 remote.planning.notes[0].body='Different plan';assert.throws(()=>mergeWorkspace(base,local,remote));
 local.planning=removePlanningFolder(base.planning,'plans');assert.throws(()=>mergeWorkspace(base,local,remote));
 assert.deepEqual(Object.keys(workspacePatch(encode(base),encode(local)).unset).sort(),['data.folders.plans','data.notes.a','data.notes.b']);
});
test('planning validation rejects orphaned notes and unsafe record IDs', async()=>{
 const {validateWorkspace}=await import('../src/lib/workspace');
 const data=fixture();data.planning.notes=[{id:'note',folderId:'missing',title:'Plan',body:'text'}];assert.throws(()=>validateWorkspace(data));
 data.planning.notes[0].folderId=null; data.planning.notes[0].id='__proto__';assert.throws(()=>validateWorkspace(data));
});
test('planet types survive validation and merge with independent edits',()=>{
 const base=fixture();base.design.sections.push({id:'earth',parentId:'sol',kind:'planet',name:'Earth',notes:'',imports:[],exports:[]});
 const local=copy(base), remote=copy(base);local.design.sections[1].planetType='Ocean';remote.design.sections[0].notes='System plan';
 const result=mergeWorkspace(base,local,remote);assert.equal(result.design.sections[1].planetType,'Ocean');assert.equal(result.design.sections[0].notes,'System plan');
});

test('planning order survives database encoding and merges with independent note edits', async () => {
 const { ordered, reorderPlanning, nextScratchTitle } = await import('../src/lib/planning');
 const { decode } = await import('../electron/backend/merge');
 const base = fixture();
 base.planning = { folders:[{id:'a',name:'A'},{id:'b',name:'B'}], notes:[{id:'one',folderId:'a',title:'scratch 1',body:''},{id:'two',folderId:'a',title:'scratch 2',body:''},{id:'three',folderId:'b',title:'Other',body:''}] };
 const local=copy(base), remote=copy(base);
 local.planning = reorderPlanning(reorderPlanning(local.planning,'folder','b','a'),'note','two','one');
 remote.planning.notes[0].body = 'Independent edit';
 const result = decode(encode(mergeWorkspace(base,local,remote)));
 assert.deepEqual(ordered(result.planning.folders).map(f=>f.id),['b','a']);
 assert.deepEqual(ordered(result.planning.notes.filter(n=>n.folderId==='a')).map(n=>n.id),['two','one']);
 assert.equal(result.planning.notes.find(n=>n.id==='one')?.body,'Independent edit');
 assert.deepEqual(reorderPlanning(base.planning,'note','one','three'),base.planning);
 assert.equal(nextScratchTitle(base.planning.notes),'scratch 3');
 assert.equal(nextScratchTitle([]),'scratch 1');
});
