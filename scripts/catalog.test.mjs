import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('../src/lib/catalog.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {pairs,recipesFor,batchesFor,catalogForDarkFog,isDefenseItem,overviewParagraphs}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const c=JSON.parse(readFileSync(new URL('../public/data/catalog.json',import.meta.url),'utf8'));
const ids=new Set(c.items.map(i=>i.id));
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
