import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/design.ts', import.meta.url), 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const { createSection, parseDesign, removeSection } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
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
