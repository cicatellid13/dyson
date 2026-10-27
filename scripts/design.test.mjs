import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/design.ts', import.meta.url), 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const { createSection, parseDesign, removeSection, linkExport, linkRoute, updateTrades, routeReadiness, removeRouteSide } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
test('systems, planets, notes and independent trade lists survive persistence', () => {
 const system = createSection('  Home system  ', 'system');
 const planet = createSection('Forge', 'planet', system.id);
 const standalone = createSection('Outpost', 'planet', system.id);
 planet.notes = 'Build smelters\nReserve the north pole.';
 planet.imports.push({id:'iron',itemId:1001,amount:'360',unit:'items/min',destination:'Outpost'});
 system.exports.push({id:'steel',itemId:1103,amount:'',unit:'items',destination:''});
 const data={version:1,sections:[system,planet,standalone]};
 assert.deepEqual(parseDesign(JSON.stringify(data)),data);
 assert.equal(system.name,'Home system');assert.equal(system.imports.length,0);assert.equal(planet.exports.length,0);
});
test('deleting a system removes only that system and its planets', () => {
 const system=createSection('System','system');const child=createSection('Planet','planet',system.id);const other=createSection('Other','system');
 const data={version:1,sections:[system,child,other]};
 assert.deepEqual(removeSection(data,system.id).sections,[other]);assert.equal(data.sections.length,3);
 assert.deepEqual(removeSection(data,child.id).sections,[system,other]);
});
test('corrupt and orphaned saved designs are rejected instead of silently reset', () => {
 assert.throws(()=>parseDesign('{oops'));assert.throws(()=>parseDesign('{"version":2,"sections":[]}'));
 const child=createSection('Orphan','planet','missing');assert.throws(()=>parseDesign(JSON.stringify({version:1,sections:[child]})));
 const planet=createSection('Not a system','planet','missing');child.parentId=planet.id;assert.throws(()=>parseDesign(JSON.stringify({version:1,sections:[planet,child]})));
 assert.deepEqual(parseDesign(null),{version:1,sections:[]});
});
test('planet routes preserve identity across rename, reload, and deletion', () => {
 const system=createSection('Sol','system');
 const planet=createSection('Forge','planet',system.id);
 const source=createSection('Mine','planet',system.id);
 source.parentId=null; // Legacy standalone fixture remains readable.
 source.exports.push({id:'ore',itemId:1001,amount:'120',unit:'items/min',destination:'',planetId:planet.id});
 planet.name='New Forge';
 const data=parseDesign(JSON.stringify({version:1,sections:[system,planet,source]}));
 assert.equal(data.sections[2].exports[0].planetId,planet.id);
 const deleted=parseDesign(JSON.stringify(removeSection(data,system.id)));
 assert.equal(deleted.sections[0].exports[0].planetId,planet.id);
 assert.ok(!deleted.sections.some(s=>s.id===planet.id));
 source.exports[0].planetId=42;
 assert.throws(()=>parseDesign(JSON.stringify({version:1,sections:[source]})));
});
test('new planets require a system while legacy standalone planets remain recoverable', () => {
 assert.throws(()=>createSection('Planet','planet'), /Choose a system/);
 assert.throws(()=>createSection('Nested','system','parent'), /cannot be nested/);
 const system=createSection('Sol','system');
 const planet=createSection('Earth','planet',system.id);
 assert.equal(planet.parentId,system.id);
 const legacy={...planet,parentId:null,notes:'Keep my notes'};
 const restored=parseDesign(JSON.stringify({version:1,sections:[legacy]}));
 assert.equal(restored.sections[0].notes,'Keep my notes');
 restored.sections.push(system);restored.sections[0].parentId=system.id;
 assert.equal(parseDesign(JSON.stringify(restored)).sections[0].parentId,system.id);
});
test('linked exports create one counterpart, sync both ways, move, and remove atomically',()=>{
 const system=createSection('System','system'), a=createSection('A','planet',system.id), b=createSection('B','planet',system.id), c=createSection('C','planet',system.id);
 a.exports=[{id:'route',itemId:1303,amount:'120',unit:'items/min',destination:'',planetId:b.id}];
 let data={version:1,sections:[system,a,b,c]};
 data=linkExport(data,a.id,'route');
 const find=id=>data.sections.find(s=>s.id===id);
 assert.equal(find(b.id).imports.length,1);assert.equal(find(b.id).imports[0].planetId,a.id);
 data=linkExport(data,a.id,'route');assert.equal(find(b.id).imports.length,1);
 data=updateTrades(data,b.id,'imports',find(b.id).imports.map(e=>({...e,amount:'240'})));
 assert.equal(find(a.id).exports[0].amount,'240');
 data=updateTrades(data,a.id,'exports',find(a.id).exports.map(e=>({...e,planetId:c.id})));
 assert.equal(find(b.id).imports.length,0);assert.equal(find(c.id).imports[0].amount,'240');
 assert.deepEqual(parseDesign(JSON.stringify(data)),data);
 data=updateTrades(data,c.id,'imports',[]);assert.equal(find(a.id).exports.length,0);
});
test('linking preserves unrelated planned imports and reuses exact matches',()=>{
 const system=createSection('System','system'),a=createSection('A','planet',system.id),b=createSection('B','planet',system.id);
 a.specializations=['Science','Smelting'];
 a.exports=[{id:'export',itemId:1303,amount:'120',unit:'items/min',destination:'',planetId:b.id}];
 b.imports=[{...a.exports[0],id:'existing',planetId:a.id}];
 const data=linkExport({version:1,sections:[system,a,b]},a.id,'export');
 assert.equal(data.sections[2].imports.length,1);assert.equal(data.sections[2].imports[0].id,'existing');
 assert.deepEqual(parseDesign(JSON.stringify(data)).sections[1].specializations,['Science','Smelting']);
});

test('route readiness requires the matching resource and reciprocal endpoint without modifying routes',()=>{
 const system=createSection('Sol','system'),a=createSection('A','planet',system.id),b=createSection('B','planet',system.id);
 const route={id:'route',itemId:1001,amount:'',unit:'items/min',destination:'',planetId:b.id};
 const sections=[system,a,b];
 assert.equal(routeReadiness(sections,a.id,'exports',route).ready,false);
 b.imports=[{...route,planetId:'another'}];
 assert.equal(routeReadiness(sections,a.id,'exports',route).ready,false);
 b.imports=[{...route,planetId:a.id}];
 assert.equal(routeReadiness(sections,a.id,'exports',route).ready,true);
 b.exports=[{...route,planetId:a.id}];
 assert.equal(routeReadiness(sections,a.id,'imports',route).ready,true);
 assert.equal(routeReadiness(sections,a.id,'imports',{...route,planetId:undefined}).ready,false);
 assert.equal(a.exports.length,0);
});

test('matching export can be created from an import, including across systems',()=>{
 const sol=createSection('Sol','system'),alpha=createSection('Alpha','system');
 const a=createSection('A','planet',sol.id),b=createSection('B','planet',alpha.id);
 a.imports=[{id:'import',itemId:1001,amount:'30',unit:'items/min',destination:'',planetId:b.id}];
 let data=linkRoute({version:1,sections:[sol,alpha,a,b]},a.id,'imports','import');
 assert.equal(data.sections.find(s=>s.id===b.id).exports[0].planetId,a.id);
 assert.equal(routeReadiness(data.sections,a.id,'imports',data.sections.find(s=>s.id===a.id).imports[0]).ready,true);
 data=linkRoute(data,a.id,'imports','import');
 assert.equal(data.sections.find(s=>s.id===b.id).exports.length,1);
});

test('removing only one linked side preserves and unlinks the opposite entry',()=>{
 const system=createSection('Sol','system'),a=createSection('A','planet',system.id),b=createSection('B','planet',system.id);
 a.exports=[{id:'out',itemId:1001,amount:'30',unit:'items/min',destination:'',planetId:b.id}];
 const linked=linkRoute({version:1,sections:[system,a,b]},a.id,'exports','out');
 const next=removeRouteSide(linked,a.id,'exports','out');
 assert.equal(next.sections.find(s=>s.id===a.id).exports.length,0);
 const remaining=next.sections.find(s=>s.id===b.id).imports;
 assert.equal(remaining.length,1);assert.equal(remaining[0].linkId,undefined);assert.equal(remaining[0].amount,'30');
 assert.equal(linked.sections.find(s=>s.id===a.id).exports.length,1);
});
