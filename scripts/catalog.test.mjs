import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('../src/lib/catalog.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {pairs,recipesFor,batchesFor,catalogForDarkFog,isDefenseItem,overviewParagraphs}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const c=JSON.parse(readFileSync(new URL('../public/data/catalog.json',import.meta.url),'utf8'));
const ids=new Set(c.items.map(i=>i.id));
const pinnedCompiled=ts.transpileModule(readFileSync(new URL('../src/lib/pinnedItems.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {addPinnedItem,normalizePinnedItems,movePinnedItem,loadPinnedItems,locationPinId,parseLocationPin,pinToken,resolvePinnedEntries,normalizePinnedGroups,storeGroupedItem,removeGroupedItem,insertPinnedItem,classifyPinDrop,taskPinAdditions,applyTaskPinAdditions,orderPinnedGroup}=await import('data:text/javascript;base64,'+Buffer.from(pinnedCompiled).toString('base64'));
test('pinned items recover safely from malformed device storage and keep a unique order',()=>{
 assert.deepEqual(normalizePinnedItems([1303,1101,1303,'1102',null,-1,0,1.5]),[1303,1101]);
 assert.deepEqual(normalizePinnedItems({ids:[1303]}),[]);
 const previous=globalThis.localStorage;
 try{
  globalThis.localStorage={getItem:()=>JSON.stringify([1303,1101,1303])};
  assert.deepEqual(loadPinnedItems(),[1303,1101]);
  globalThis.localStorage={getItem:()=>'{corrupt'};assert.deepEqual(loadPinnedItems(),[]);
  globalThis.localStorage={getItem:()=>{throw Error('Unavailable');}};assert.deepEqual(loadPinnedItems(),[]);
 }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});
test('mixed item and location pins preserve legacy pins and resolve current names by stable ID',()=>{
 const system={id:'s1',kind:'system',parentId:null,name:'Sadira'};
 const planet={id:'p1',kind:'planet',parentId:'s1',name:'IV'};
 const item={id:1303,name:'Processor',icon:'icons/1303.png'};
 const pins=normalizePinnedItems([1303,'planet:p1','system:s1',1303,'planet:p1','planet:','unknown:s1']);
 assert.deepEqual(pins,[1303,'planet:p1','system:s1']);
 assert.notEqual(pinToken(1303),pinToken('planet:1303'));
 assert.equal(locationPinId('planet','p1'),'planet:p1');
 assert.deepEqual(parseLocationPin('system:s1'),{kind:'system',id:'s1'});
 assert.equal(parseLocationPin(1303),null);
 assert.deepEqual(resolvePinnedEntries(pins,[item],[system,planet]).map(entry=>[entry.kind,entry.name]),[['item','Processor'],['planet','Sadira/IV'],['system','Sadira']]);
 assert.equal(resolvePinnedEntries(['planet:p1'],[],[{...system,name:'Renamed'},planet])[0].name,'Renamed/IV');
 assert.deepEqual(resolvePinnedEntries(pins,[],[system]).map(entry=>entry.id),['system:s1']);
 assert.equal(resolvePinnedEntries(['planet:p1'],[],[{...planet,parentId:null}])[0].name,'Unassigned system/IV');
 assert.deepEqual(movePinnedItem(pins,'system:s1',1303),['system:s1',1303,'planet:p1']);
 assert.deepEqual(addPinnedItem(pins,'system:s1'),pins);
});
test('planet task links hydrate on pin and new associations sync without undoing manual shortcut removal',()=>{
 const planet={id:'p1',kind:'planet',parentId:'s1',name:'Home',checklist:[{id:'t1',itemIds:[1303,1101],requiredInputs:{1101:1303}}]};
 const initial={pinned:[],links:{}};
 const unpinned=taskPinAdditions([], [planet],initial);
 assert.deepEqual(unpinned.additions,{});
 const pinned=taskPinAdditions(['planet:p1'],[planet],unpinned.snapshot);
 assert.deepEqual(pinned.additions,{'planet:p1':[1303,1101]});
 const groups=applyTaskPinAdditions({'planet:p1':[1102]},pinned.additions);
 assert.deepEqual(groups,{'planet:p1':[1102,1303,1101]});
 const renamed=taskPinAdditions(['planet:p1'],[{...planet,name:'Renamed'}],pinned.snapshot);
 assert.deepEqual(renamed.additions,{});
 const removed=removeGroupedItem(groups,'planet:p1',1101);
 assert.deepEqual(applyTaskPinAdditions(removed,renamed.additions),removed);
 const newTask={...planet,checklist:[...planet.checklist,{id:'t2',itemIds:[1101,1102]}]};
 const added=taskPinAdditions(['planet:p1'],[newTask],renamed.snapshot);
 assert.deepEqual(added.additions,{'planet:p1':[1101,1102]});
 assert.deepEqual(applyTaskPinAdditions(removed,added.additions),{'planet:p1':[1102,1303,1101]});
 const unchanged=taskPinAdditions(['planet:p1'],[newTask],added.snapshot);
 assert.deepEqual(unchanged.additions,{});
 assert.equal(applyTaskPinAdditions(groups,{}),groups);
 const unpin=taskPinAdditions([], [newTask],added.snapshot);
 const repin=taskPinAdditions(['planet:p1'],[newTask],unpin.snapshot);
 assert.deepEqual(repin.additions,{'planet:p1':[1303,1101,1102]});
});
test('task item removal removes group shortcuts after their final association is removed',()=>{
 const before={id:'p1',kind:'planet',checklist:[{id:'a',itemIds:[1303,1101]},{id:'b',itemIds:[1101]}]};
 const initial=taskPinAdditions(['planet:p1'],[before],{pinned:[],links:{}});
 const oneLeft={...before,checklist:[{id:'a',itemIds:[1303]},{id:'b',itemIds:[1101]}]};
 const first=taskPinAdditions(['planet:p1'],[oneLeft],initial.snapshot);
 assert.deepEqual(first.removals,{});
 const last=taskPinAdditions(['planet:p1'],[{...before,checklist:[{id:'a',itemIds:[1303]}]}],first.snapshot);
 assert.deepEqual(last.removals,{'planet:p1':[1101]});
 const groups={'planet:p1':[1102,1101,1303]};
 assert.deepEqual(applyTaskPinAdditions(groups,last.additions,last.removals),{'planet:p1':[1102,1303]});
 const cleared=taskPinAdditions([], [{...before,checklist:[]}],last.snapshot);
 assert.deepEqual(cleared.removals,{'planet:p1':[1303]});
});
test('required inputs move directly behind their parent ahead of existing group items',()=>{
 const tasks=[{id:'a',itemIds:[1303,1101,1102],requiredInputs:{1101:1303,1102:1303}}];
 const previous=[1101,9999,1303,8888,1102];
 assert.deepEqual(orderPinnedGroup(previous,tasks),[9999,1303,1101,1102,8888]);
 assert.deepEqual(orderPinnedGroup([1303,8888,1102,1101],tasks),[1303,1101,1102,8888]);
 assert.deepEqual(orderPinnedGroup(previous,[]),previous);
 const ordered=orderPinnedGroup(previous,tasks);
 assert.deepEqual(orderPinnedGroup(ordered,tasks),ordered);
 const shared=[...tasks,{id:'b',itemIds:[7777,1101],requiredInputs:{1101:7777}}];
 assert.deepEqual(orderPinnedGroup([1303,1101,7777,1102],shared),[1303,1102,7777,1101]);
 const cycle=[{id:'a',itemIds:[1,2],requiredInputs:{1:2,2:1}}];
 assert.deepEqual(orderPinnedGroup([1,2],cycle),[1,2]);
 assert.deepEqual(previous,[1101,9999,1303,8888,1102]);
});
test('planet group required-input arrows reflect current to-do associations and deduplicate across tasks',()=>{
 const item={id:1101,name:'Iron Ingot',icon:null},planet={id:'p1',kind:'planet',parentId:null,name:'Home',checklist:[{id:'t1',itemIds:[1101],requiredInputs:{1101:1303}},{id:'t2',itemIds:[1101]}]};
 const groups={'planet:p1':[1101]};
 const entry=resolvePinnedEntries(['planet:p1'],[item],[planet],groups)[0];
 assert.deepEqual(entry.children,[{...item,requiredInput:true}]);
 const changed=resolvePinnedEntries(['planet:p1'],[item],[{...planet,checklist:[{id:'t2',itemIds:[1101]}]}],groups)[0];
 assert.deepEqual(changed.children,[item]);
});
test('planet groups deduplicate, transfer children, and preserve unrelated shortcuts',()=>{
 const groups=normalizePinnedGroups({'planet:p1':[1303,1303,'1101',1101],'system:s1':[1303],invalid:[1102]});
 assert.deepEqual(groups,{'planet:p1':[1303,1101]});
 const copied=storeGroupedItem(groups,'planet:p2',1303,'external');
 assert.deepEqual(copied,{'planet:p1':[1303,1101],'planet:p2':[1303]});
 assert.deepEqual(storeGroupedItem(copied,'planet:p2',1303,'external'),copied);
 const moved=storeGroupedItem(groups,'planet:p2',1303,{planet:'planet:p1'});
 assert.deepEqual(moved,{'planet:p1':[1101],'planet:p2':[1303]});
 assert.deepEqual(removeGroupedItem(moved,'planet:p2',1303),{'planet:p1':[1101],'planet:p2':[]});
 assert.deepEqual(storeGroupedItem(groups,'system:s1',1303,'strip'),groups);
 assert.deepEqual(groups,{'planet:p1':[1303,1101]});
 const entries=resolvePinnedEntries(['planet:p1'],[{id:1303,name:'Processor',icon:null}],[{id:'p1',kind:'planet',parentId:null,name:'Home'}],groups);
 assert.deepEqual(entries[0].children,[{id:1303,name:'Processor',icon:null}]);
});
test('planet center grouping and edge insertion remain distinct for item and location drags',()=>{
 assert.deepEqual(classifyPinDrop(21,0,42,true),{kind:'group'});
 assert.deepEqual(classifyPinDrop(3,0,42,true),{kind:'reorder',side:'before'});
 assert.deepEqual(classifyPinDrop(39,0,42,true),{kind:'reorder',side:'after'});
 assert.deepEqual(classifyPinDrop(21,0,42,false),{kind:'reorder',side:'after'});
 const pins=['planet:p1',1303,'system:s1'];
 assert.deepEqual(insertPinnedItem(pins,1303,'planet:p1','before'),[1303,'planet:p1','system:s1']);
 assert.deepEqual(insertPinnedItem(pins,'planet:p1','system:s1','after'),[1303,'system:s1','planet:p1']);
 assert.deepEqual(insertPinnedItem(pins,1101,'planet:p1','after'),['planet:p1',1101,1303,'system:s1']);
 assert.deepEqual(insertPinnedItem(pins,1303,1303,'before'),pins);
 assert.deepEqual(pins,['planet:p1',1303,'system:s1']);
});
test('dropping an item pins it once and preserves existing pin order',()=>{
 const pins=[1303,1101];
 assert.deepEqual(addPinnedItem(pins,1102),[1303,1101,1102]);
 assert.deepEqual(addPinnedItem(pins,1303),[1303,1101]);
 assert.deepEqual(addPinnedItem([],1303),[1303]);
 assert.deepEqual(pins,[1303,1101]);
});
test('reordering pins preserves every item without mutating the stored order',()=>{
 const pins=[1303,1101,1102];
 assert.deepEqual(movePinnedItem(pins,1303,1102),[1101,1102,1303]);
 assert.deepEqual(movePinnedItem(pins,1102,1303),[1102,1303,1101]);
 assert.deepEqual(movePinnedItem(pins,9999,1303),pins);
 assert.deepEqual(movePinnedItem(pins,1303,9999),pins);
 assert.deepEqual(movePinnedItem(pins,1303,1303),pins);
 assert.deepEqual(pins,[1303,1101,1102]);
});
test('all enabled items have a bundled image with a valid file signature',()=>{
 assert.ok(c.items.length>150);assert.equal(ids.size,c.items.length);
 for(const i of c.items){assert.ok(i.icon,i.name);const p=new URL('../public/'+i.icon,import.meta.url);assert.ok(existsSync(p),i.name);const b=readFileSync(p);assert.ok(b.subarray(0,4).equals(Buffer.from([137,80,78,71]))||b.subarray(0,4).toString()==='RIFF'||b.subarray(0,2).equals(Buffer.from([255,216])),i.name);}
});
test('recipes have valid quantities, times, and references',()=>{
 assert.ok(c.recipes.length>150);
 for(const r of c.recipes){assert.ok(Number.isFinite(r.seconds)&&r.seconds>0,r.name);for(const values of [r.inputs,r.outputs]){assert.equal(values.length%2,0);for(const p of pairs(values)){assert.ok(ids.has(p.id),r.name);assert.ok(p.count>0,r.name);}}}
 for(const f of Object.values(c.facilities))for(const id of f.buildings)assert.ok(ids.has(id));
});
test('Processor has two circuit boards and two microcrystalline components',()=>{
 const r=recipesFor(c,1303)[0];assert.deepEqual(r.inputs,[1301,2,1302,2]);assert.equal(r.seconds,3);assert.equal(batchesFor(r,1303,10),10);
 assert.ok(c.techs.some(t=>t.recipes?.includes(r.id)));
});
test('batch rounding includes surplus output',()=>{
 const r=recipesFor(c,1301)[0];assert.equal(batchesFor(r,1301,3),2);assert.equal(pairs(r.outputs)[0].count*2,4);
});
test('alternate recipes and fractionation byproducts survive import',()=>{
 assert.ok(recipesFor(c,1126).length>=2);const r=c.recipes.find(r=>r.type==='FRACTIONATE');assert.equal(pairs(r.outputs).length,2);assert.equal(r.seconds,0.017);assert.equal(batchesFor(r,1121,1),100);
});

test('Dark Fog off removes combat content and all recipe/facility references without mutating the snapshot',()=>{
 const before=JSON.stringify(c);const filtered=catalogForDarkFog(c,false);
 const allowed=new Set(filtered.items.map(item=>item.id));
 assert.ok(filtered.items.length<c.items.length);
 assert.ok(filtered.items.every(item=>!isDefenseItem(item)&&item.type!=='DARK_FOG'));
 for(const recipe of filtered.recipes)for(const pair of [...pairs(recipe.inputs),...pairs(recipe.outputs)])assert.ok(allowed.has(pair.id));
 for(const facility of Object.values(filtered.facilities))assert.ok(facility.buildings.every(id=>allowed.has(id)));
 assert.ok(allowed.has(1303));
 assert.equal(JSON.stringify(c),before);
 assert.equal(catalogForDarkFog(c,true),c);
});
test('cached Overviews preserve paragraphs and resolve aliases to valid local items',()=>{
 const graphene=c.items.find(i=>i.name==='Graphene');
 assert.equal(graphene.overview.length,3);
 assert.ok(graphene.overview.flat().some(s=>s.text==='ILS'&&s.itemId===2104));
 assert.ok(graphene.overview[2].map(s=>s.text).join('').includes('fuel'));
 for(const item of c.items)for(const paragraph of item.overview??[])for(const segment of paragraph){
  assert.equal(typeof segment.text,'string');if(segment.itemId)assert.ok(ids.has(segment.itemId));
 }
});

test('item overviews start with the in-game description and retain linked reference text',()=>{
 for(const item of c.items){
  const paragraphs=overviewParagraphs(item);
  assert.equal(paragraphs[0].map(s=>s.text).join(''),item.description,item.name);
  for(const paragraph of [...item.overview??[],...item.supplementalOverview??[]]){
   const text=paragraph.map(s=>s.text).join('').replace(/\s+/g,' ').trim().toLowerCase();
   assert.ok(paragraphs.some(p=>p.map(s=>s.text).join('').replace(/\s+/g,' ').trim().toLowerCase()===text),item.name);
   for(const segment of paragraph)if(segment.itemId)assert.ok(ids.has(segment.itemId),item.name);
  }
 }
 assert.equal(overviewParagraphs({description:'Same description.',overview:[[{text:' Same  description. '}]]}).length,1);
 assert.equal(overviewParagraphs({description:'Description only.'}).length,1);
});

test('wiki additions retain valid sources, grid positions, recipe IDs and Dark Fog visibility',()=>{
 const positions=new Set();
 for(const item of c.items){
  assert.ok(!positions.has(item.grid_index),`Duplicate grid cell: ${item.name}`);positions.add(item.grid_index);
  if(item.buildingDetails){
   assert.ok(item.can_build,item.name);
   assert.ok(item.buildingDetails.source.startsWith('https://dsp-wiki.com/'));
   assert.ok(Number.isFinite(Date.parse(item.buildingDetails.checked)));
   assert.equal(new Set(item.buildingDetails.fields.map(f=>f.label)).size,item.buildingDetails.fields.length);
   for(const field of item.buildingDetails.fields)assert.ok(field.label&&field.value,item.name);
  }
 }
 assert.equal(new Set(c.recipes.map(r=>r.id)).size,c.recipes.length);
 assert.equal(new Set(c.techs.map(t=>t.id)).size,c.techs.length);
 const plane=c.items.find(i=>i.id===2315);
 assert.equal(plane.buildingDetails.fields.find(f=>f.label==='Operating power').value,'1.44 MW');
 assert.equal(plane.buildingDetails.fields.find(f=>f.label==='Footprint').value,'3×3');
 assert.deepEqual(recipesFor(c,2401)[0].inputs,[1101,3,1111,4,1401,2,1301,2]);
 assert.equal(recipesFor(c,2401)[0].seconds,4);
 assert.deepEqual(recipesFor(c,1211)[0].inputs,[1209,1,5201,12]);
 assert.ok(catalogForDarkFog(c,false).items.some(i=>i.id===2401));
 assert.ok(!catalogForDarkFog(c,false).items.some(i=>i.id===1211));
 assert.ok(c.items.find(i=>i.id===1130).overview.length);
 for(const id of [2401,1211])assert.ok(c.techs.some(t=>t.recipes?.includes(recipesFor(c,id)[0].id)));
});
