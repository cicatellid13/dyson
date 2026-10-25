import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('../src/lib/catalog.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {pairs,recipesFor,batchesFor,catalogForDarkFog,isDefenseItem}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
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
