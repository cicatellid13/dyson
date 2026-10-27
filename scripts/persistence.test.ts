import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mergeWorkspace, encode, decode, workspacePatch } from '../electron/backend/merge';
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

test('system and planet ordering preserves hierarchy and survives cloud encoding', async () => {
 const { orderedSections, reorderSections } = await import('../src/lib/design');
 const { decode } = await import('../electron/backend/merge');
 const base = fixture();
 const system = base.design.sections[0];
 base.design.sections.push({...system,id:'other',name:'Other'}, {...system,id:'p1',kind:'planet',parentId:'sol'}, {...system,id:'p2',kind:'planet',parentId:'sol'}, {...system,id:'p3',kind:'planet',parentId:'other'});
 const local=copy(base), remote=copy(base);
 local.design = reorderSections(reorderSections(local.design,'other','sol'),'p2','p1');
 remote.design.sections.find(s=>s.id==='p1')!.notes='Keep this edit';
 const result=decode(encode(mergeWorkspace(base,local,remote)));
 assert.deepEqual(orderedSections(result.design.sections.filter(s=>s.kind==='system')).map(s=>s.id),['other','sol']);
 assert.deepEqual(orderedSections(result.design.sections.filter(s=>s.parentId==='sol')).map(s=>s.id),['p2','p1']);
 assert.equal(result.design.sections.find(s=>s.id==='p1')!.notes,'Keep this edit');
 assert.deepEqual(reorderSections(base.design,'p1','p3'),base.design);
 assert.deepEqual(reorderSections(base.design,'sol','p1'),base.design);
});

test('logistics graph resolves direction, deduplicates mirrored cargo and excludes unavailable routes', async () => {
 const {logisticsRoutes}=await import('../src/lib/logisticsGraph');
 const base=fixture().design.sections[0];
 const entry={id:'cargo',itemId:1001,amount:'',unit:'items' as const,destination:''};
 const a={...base,id:'a',kind:'planet' as const,parentId:'sol',imports:[],exports:[{...entry,planetId:'b'},{...entry,id:'outside',planetId:'external'},{...entry,id:'hidden',itemId:999,planetId:'b'}]};
 const b={...base,id:'b',kind:'planet' as const,parentId:'sol',imports:[{...entry,planetId:'a'}],exports:[]};
 assert.deepEqual(logisticsRoutes([a,b],new Set([1001])),[{from:'a',to:'b',items:[1001]}]);
 assert.deepEqual(logisticsRoutes([],new Set()),[]);
});

test('favorite order survives sync while independent additions are retained', () => {
 const base=fixture();base.favorites=[1,2,3];
 const local=copy(base),remote=copy(base);local.favorites=[3,1,2];remote.favorites=[1,2,3,4];
 assert.deepEqual(mergeWorkspace(base,local,remote).favorites,[3,1,2,4]);
 assert.deepEqual(mergeWorkspace(base,base,local).favorites,[3,1,2]);
 const conflict=copy(base);conflict.favorites=[2,1,3];
 assert.throws(()=>mergeWorkspace(base,local,conflict),/conflict/);
});
test('catalog default view merges with unrelated workspace changes and persists as a small patch',()=>{
 const base=fixture(), local=copy(base), remote=copy(base);
 local.defaultCatalogView='grid'; remote.favorites=[1303];
 const merged=mergeWorkspace(base,local,remote);
 assert.equal(merged.defaultCatalogView,'grid');assert.deepEqual(merged.favorites,[1303]);
 assert.deepEqual(workspacePatch(encode(base),encode(local)).set,{'data.defaultCatalogView':'grid'});
});
test('checklist tasks and specializations survive storage and merge independent edits',()=>{
 const base=fixture();
 base.planning.notes=[{id:'note',folderId:null,title:'Build',body:'Keep this text',checklist:[{id:'task',type:'production',text:'Build smelters',done:false}]}];
 const local=copy(base),remote=copy(base);
 local.planning.notes[0].checklist![0].done=true;
 remote.design.sections[0].notes='Other change';
 const merged=mergeWorkspace(base,local,remote);
 assert.equal(merged.planning.notes[0].checklist![0].done,true);
 assert.equal(merged.planning.notes[0].body,'Keep this text');
 assert.equal(merged.planning.notes[0].checklist![0].type,'production');
 assert.equal(merged.design.sections[0].notes,'Other change');
});

test('saved planet labels persist and merge across machines independently of planet assignments',()=>{
 const base=fixture(),local=copy(base),remote=copy(base);
 local.design.planetTypes=['Crystal world'];remote.design.planetTypes=['Ocean world'];
 local.design.specializationTypes=['Antimatter'];
 const merged=mergeWorkspace(base,local,remote);
 assert.deepEqual(merged.design.planetTypes,['Crystal world','Ocean world']);
 assert.deepEqual(decode(encode(merged)).design.specializationTypes,['Antimatter']);
 const patch=workspacePatch(encode(base),encode(merged));
 assert.deepEqual(patch.set['data.planetTypes'],['Crystal world','Ocean world']);
});
