import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace} from '../src/lib/workspace';
import {createSection,linkRoute,updateTrades,removeRouteSide} from '../src/lib/design';
import {removalLabel,restoreRemoval} from '../src/lib/removalUndo';
import {findInNetwork} from '../src/lib/networkSearch';
import type {Catalog} from '../src/lib/catalog';
const fixture=()=>{const w=emptyWorkspace();const system=createSection('System','system'),a=createSection('A','planet',system.id),b=createSection('B','planet',system.id);w.design.sections=[system,a,b];return {w,system,a,b};};
test('planet undo preserves later notes and restores only the deleted planet',()=>{const {w,a,b}=fixture();const after=structuredClone(w);after.design.sections=after.design.sections.filter(p=>p.id!==a.id);const current=structuredClone(after);current.design.sections.find(p=>p.id===b.id)!.notes='new note';const restored=restoreRemoval(w,after,current);assert.equal(restored.design.sections.length,3);assert.equal(restored.design.sections.find(p=>p.id===b.id)!.notes,'new note');assert.equal(removalLabel(w,after),'Planet removed');});
test('favorite undo preserves later additions and order',()=>{const w=emptyWorkspace();w.favorites=[1,2,3];const after={...w,favorites:[1,3]};assert.deepEqual(restoreRemoval(w,after,{...after,favorites:[3,1,4]}).favorites,[3,2,1,4]);});
test('note undo does not roll back unrelated typing',()=>{const w=emptyWorkspace();w.planning.notes=[{id:'a',title:'A',body:'one',folderId:null},{id:'b',title:'B',body:'two',folderId:null}];const after=structuredClone(w);after.planning.notes.shift();const current=structuredClone(after);current.planning.notes[0].body='new words';assert.equal(restoreRemoval(w,after,current).planning.notes[1].body,'new words');assert.equal(removalLabel(w,current),'Note or folder removed');});
test('linked route undo restores both sides and preserves unrelated edits',()=>{const {w,a,b}=fixture();a.imports=[{id:'route',itemId:1,amount:'20',unit:'items/min',destination:'',planetIds:[b.id]}];w.design=linkRoute(w.design,a.id,'imports','route');const after={...w,design:updateTrades(w.design,a.id,'imports',[])};const current=structuredClone(after);current.design.sections[0].notes='later';const restored=restoreRemoval(w,after,current);assert.deepEqual(restored.design.sections.find(p=>p.id===a.id)!.imports,w.design.sections.find(p=>p.id===a.id)!.imports);assert.deepEqual(restored.design.sections.find(p=>p.id===b.id)!.exports,w.design.sections.find(p=>p.id===b.id)!.exports);assert.equal(restored.design.sections[0].notes,'later');});
test('one-side unlink undo restores links and rejects conflicting later route edits',()=>{const {w,a,b}=fixture();a.imports=[{id:'route',itemId:1,amount:'20',unit:'items/min',destination:'',planetIds:[b.id]}];w.design=linkRoute(w.design,a.id,'imports','route');const after={...w,design:removeRouteSide(w.design,a.id,'imports','route')};assert.deepEqual(restoreRemoval(w,after,after),w);const current=structuredClone(after);current.design.sections.find(p=>p.id===b.id)!.exports[0].links={[a.id]:'different-edge'};assert.throws(()=>restoreRemoval(w,after,current));});
test('ordinary edits do not create removal actions',()=>{const {w}=fixture();const after=structuredClone(w);after.design.sections[0].notes='changed';assert.equal(removalLabel(w,after),null);});
test('network search finds recorded routes and factory inputs and outputs separately',()=>{const {w,a}=fixture();a.exports=[{id:'export',itemId:3,amount:'60',unit:'items/min',destination:''}];a.factories={factory:{id:'factory',name:'Assembly',itemId:3,recipeId:1,facilityId:2304,beltId:2001,sorterId:2013,reach:1,mode:'infrastructure',target:60,unit:'minute',machineCount:1,oneBeltPerItem:false}};const catalog={recipes:[{id:1,name:'Recipe',type:'ASSEMBLE',seconds:3,inputs:[1,2],outputs:[3,1,4,1]}]} as Catalog;assert.deepEqual(findInNetwork(w.design,catalog,3).map(r=>r.kind),['Exports','Produces']);assert.equal(findInNetwork(w.design,catalog,1)[0].kind,'Uses');assert.equal(findInNetwork(w.design,catalog,4)[0].kind,'Produces');assert.deepEqual(findInNetwork(w.design,catalog,99),[]);a.factories.factory.facilityId=999;assert.equal(findInNetwork(w.design,catalog,1)[0].detail,'Assembly · rate unavailable');});

test('network tooltips contain specified metrics only',()=>{const {w,a}=fixture();a.imports=[{id:'no-rate',itemId:3,amount:'',unit:'items/min',destination:''},{id:'rate',itemId:3,amount:'900',unit:'items/min',destination:''}];const rows=findInNetwork(w.design,{recipes:[]} as unknown as Catalog,3);assert.equal(rows[0].metric,undefined);assert.equal(rows[1].metric,'900 items/min');});

test('to-do undo restores deleted tasks while preserving later task edits', () => {
  const {w, a} = fixture();
  a.checklist = [
    {id:'first', text:'Build smelters', done:true, type:'production'},
    {id:'second', text:'Import ore', done:false, type:'import'},
  ];
  const after = structuredClone(w);
  after.design.sections[1].checklist!.shift();
  const current = structuredClone(after);
  current.design.sections[1].checklist![0].text = 'Import more ore';
  const restored = restoreRemoval(w, after, current);
  assert.equal(removalLabel(w, after), 'To-do item removed');
  assert.deepEqual(restored.design.sections[1].checklist, [a.checklist[0], {...a.checklist[1], text:'Import more ore'}]);
  const edited = structuredClone(w);
  edited.design.sections[1].checklist![0].done = false;
  assert.equal(removalLabel(w, edited), null);
});

test('to-do reordering preserves filtered-out slots and does not create undo removal', async () => {
  const {reorderTodos} = await import('../src/lib/reorderTodos');
  const {w, a} = fixture();
  a.checklist = [
    {id:'a', text:'First', done:false, type:'production'},
    {id:'hidden', text:'Power', done:false, type:'power'},
    {id:'b', text:'Second', done:true, type:'production'},
    {id:'c', text:'Third', done:false, type:'production'},
  ];
  const reordered = reorderTodos(a.checklist, ['a','b','c'], 'a', 'c');
  assert.deepEqual(reordered.map(task => task.id), ['b','hidden','c','a']);
  const after = structuredClone(w);
  after.design.sections[1].checklist = reordered;
  assert.equal(removalLabel(w, after), null);
  assert.equal(reorderTodos(a.checklist, ['a','b'], 'missing', 'b'), a.checklist);
});

test('saved factory status validates and survives workspace serialization', async () => {
  const {validateFactories} = await import('../src/lib/savedFactories');
  const {encode, decode} = await import('../electron/backend/merge');
  const {w,a} = fixture();
  a.factories = {factory:{id:'factory',name:'Assembly',itemId:3,recipeId:1,facilityId:2304,beltId:2001,sorterId:2013,reach:1,mode:'infrastructure',target:60,unit:'minute',machineCount:1,oneBeltPerItem:false}};
  assert.doesNotThrow(() => validateFactories(a.factories));
  a.factories.factory.status = 'built';
  assert.equal(decode(encode(w)).design.sections.find(p=>p.id===a.id)!.factories!.factory.status, 'built');
  assert.throws(() => validateFactories({factory:{...a.factories!.factory,status:'invalid'}}));
});

test('task item links survive database encoding and deletion undo', async()=>{
 const {encode,decode}=await import('../electron/backend/merge');
 const {w,a}=fixture();
 a.checklist=[{id:'linked-task',text:'Build components',done:false,type:'production',itemIds:[1101,1102]}];
 const restored=decode(encode(w));
 assert.deepEqual(restored.design.sections.find(p=>p.id===a.id)!.checklist![0].itemIds,[1101,1102]);
 const after=structuredClone(w);after.design.sections.find(p=>p.id===a.id)!.checklist=[];
 assert.deepEqual(restoreRemoval(w,after,after).design.sections.find(p=>p.id===a.id)!.checklist,a.checklist);
});
test('task item links reject duplicate and invalid IDs while legacy tasks remain valid',async()=>{
 const {validatePlanning}=await import('../src/lib/planning');
 const validate=(itemIds?:unknown)=>validatePlanning({folders:[],notes:[{id:'note',folderId:null,title:'',body:'',checklist:[{id:'task',text:'',done:false,...(itemIds===undefined?{}:{itemIds})}]}]});
 assert.doesNotThrow(()=>validate());
 assert.doesNotThrow(()=>validate([1101,1102]));
 for(const ids of [[1,1],[-1],[1.5],['1'],null]) assert.throws(()=>validate(ids));
});

test('task item drop optionally adds only direct default-recipe inputs without duplicates',async()=>{
 const {taskItemLinks}=await import('../src/lib/taskItemLinks');
 const catalog={items:[1,2,3,4,5].map(id=>({id})),recipes:[{id:2,inputs:[5,1],outputs:[1,1]},{id:1,inputs:[2,2,3,1,99,1],outputs:[1,1]},{id:3,inputs:[4,1],outputs:[2,1]}]} as Catalog;
 assert.deepEqual(taskItemLinks(catalog,[],1,false),[1]);
 assert.deepEqual(taskItemLinks(catalog,[3],1,true),[3,1,2]);
 assert.deepEqual(taskItemLinks(catalog,[1,2,3],1,true),[1,2,3]);
 assert.deepEqual(taskItemLinks(catalog,[],4,true),[4]);
 assert.deepEqual(taskItemLinks(catalog,[1],99,true),[1]);
});

test('pointer drag leaves quick clicks alone and starts once after the threshold',async()=>{
 const {createPointerDragSession}=await import('../src/lib/pointerDragSession');
 const events:string[]=[];
 const callbacks={start:()=>{events.push('start');return true;},over:()=>{events.push('over');return true;},drop:()=>{events.push('drop');},end:(dropped:boolean)=>{events.push(`end:${dropped}`);}};
 const click=createPointerDragSession({x:0,y:0},callbacks);
 click.move({x:2,y:2});assert.equal(click.release({x:2,y:2}),false);assert.deepEqual(events,[]);
 const drag=createPointerDragSession({x:0,y:0},callbacks);
 drag.move({x:7,y:0});drag.move({x:20,y:0});assert.equal(drag.release({x:30,y:0}),true);
 assert.equal(events.filter(e=>e==='start').length,1);assert.equal(events.filter(e=>e==='drop').length,1);assert.equal(events.at(-1),'end:true');
 drag.cancel();drag.release({x:40,y:0});assert.equal(events.filter(e=>e.startsWith('end:')).length,1);
});
test('pointer drag revalidates the actual release target and cancels without mutations',async()=>{
 const {createPointerDragSession}=await import('../src/lib/pointerDragSession');
 let drops=0,ends=0;
 const callbacks={start:()=>true,over:(p:{x:number;y:number})=>p.x<50,drop:()=>{drops++;},end:()=>{ends++;}};
 const drag=createPointerDragSession({x:0,y:0},callbacks);drag.move({x:10,y:0});drag.release({x:100,y:0});assert.equal(drops,0);assert.equal(ends,1);
 const cancelled=createPointerDragSession({x:0,y:0},callbacks);cancelled.move({x:10,y:0});cancelled.cancel();cancelled.release({x:20,y:0});assert.equal(drops,0);assert.equal(ends,2);
});
test('rejected drag start and failed drop both clean up once',async()=>{
 const {createPointerDragSession}=await import('../src/lib/pointerDragSession');
 let ends=0;
 const rejected=createPointerDragSession({x:0,y:0},{start:()=>false,over:()=>{throw Error('must not visit');},drop:()=>{},end:()=>{ends++;}});
 rejected.move({x:10,y:0});rejected.cancel();assert.equal(ends,1);
 const failed=createPointerDragSession({x:0,y:0},{start:()=>true,over:()=>true,drop:()=>{throw Error('drop failed');},end:()=>{ends++;}});
 failed.move({x:10,y:0});assert.throws(()=>failed.release({x:20,y:0}));failed.cancel();assert.equal(ends,2);
});

test('removing a main task item removes its attached inputs but preserves unrelated items',async()=>{
 const {taskItemAttachment,removeTaskItem}=await import('../src/lib/taskItemLinks');
 const catalog={items:[1,2,3].map(id=>({id})),recipes:[{id:1,inputs:[2,2,3,1],outputs:[1,1]}]} as Catalog;
 const linked=taskItemAttachment(catalog,{},1,true);
 assert.deepEqual(linked,{itemIds:[1,2,3],requiredInputs:{2:1,3:1}});
 assert.deepEqual(taskItemAttachment(catalog,{itemIds:[2]},1,true).requiredInputs,{3:1});
 assert.deepEqual(taskItemAttachment(catalog,linked,2,false).requiredInputs,{3:1});
 assert.deepEqual(removeTaskItem(linked,1),{itemIds:[],requiredInputs:{}});
 assert.deepEqual(removeTaskItem(linked,1,false),{itemIds:[2,3],requiredInputs:{}});
 assert.deepEqual(removeTaskItem({...linked,itemIds:[1,2,3,4,5],requiredInputs:{...linked.requiredInputs,5:4}},1),{itemIds:[4,5],requiredInputs:{5:4}});
 assert.deepEqual(removeTaskItem(taskItemAttachment(catalog,{itemIds:[2]},1,true),1),{itemIds:[2],requiredInputs:{}});
 assert.deepEqual(removeTaskItem(linked,2).requiredInputs,{3:1});
});
