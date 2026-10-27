import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateFactory, type PlannerConfig } from '../src/lib/factoryPlanner';
const base:PlannerConfig={recipe:{id:1,name:'Test',type:'ASSEMBLE',seconds:3,inputs:[1,2,2,1],outputs:[3,1]},itemId:3,facilityId:2304,beltId:2001,sorterId:2013,reach:1,mode:'capacity',target:360,unit:'minute'};
const plan=(changes:Partial<PlannerConfig>={})=>{const p=calculateFactory({...base,...changes});assert.equal(p.ok,true);if(!p.ok)throw Error(p.reason);return p;};
test('one belt solves 18 machines, ingredients and logistics',()=>{const p=plan();assert.equal(p.machines,18);assert.equal(p.sustainable,6);assert.equal(p.inputs[0].rate,12);assert.equal(p.inputs[0].belts,2);assert.equal(p.outputs[0].belts,1);assert.equal(p.machineUtilization,1);assert.equal(p.beltUtilization,1);assert.equal(p.sorters,54);});
test('speed multipliers and rounding preserve fractional utilization',()=>{const p=plan({facilityId:2303});assert.equal(p.machines,24);const q=plan({target:350,mode:'infrastructure'});assert.equal(q.machines,18);assert.ok(Math.abs(q.machineUtilization-350/360)<1e-12);});
test('target units are equivalent and output uses multiple belts',()=>{const a=plan({mode:'infrastructure',target:600}),b=plan({mode:'infrastructure',target:10,unit:'second'});assert.deepEqual(a,b);assert.equal(a.machines,30);assert.equal(a.outputs[0].belts,2);assert.equal(a.beltUtilization,10/12);});
test('multiple outputs and fractional quantities use separate output belts',()=>{const p=plan({recipe:{...base.recipe,outputs:[3,.5,4,2]}});assert.equal(p.machines,36);assert.equal(p.outputs[1].rate,24);assert.equal(p.outputs[1].belts,4);assert.equal(p.inputs[0].rate,24);});
test('sorter limits add machines until all transfers fit conservative budget',()=>{const recipe={...base.recipe,seconds:1,inputs:[1,20,2,20],outputs:[3,1]};const p=plan({recipe,sorterId:2011});assert.ok(p.machines>p.machineOnlyCount);assert.ok([...p.inputs,...p.outputs].reduce((n,s)=>n+s.sortersPerMachine,0)<=8);assert.equal(p.sustainable,6);const q=plan({recipe,sorterId:2011,reach:3});assert.ok(q.machines>p.machines);assert.equal(q.sorterRate,.5);});
test('selected alternate recipe changes consumption',()=>{const p=plan({recipe:{...base.recipe,id:2,inputs:[5,4],seconds:6}});assert.equal(p.machines,36);assert.equal(p.inputs[0].id,5);assert.equal(p.inputs[0].rate,24);});
test('invalid targets, equipment, recipe and reach produce explanations',()=>{for(const target of [0,-1,NaN,Infinity])assert.equal(calculateFactory({...base,mode:'infrastructure',target}).ok,false);for(const patch of [{reach:0},{reach:4},{facilityId:2302},{beltId:999},{sorterId:2014},{itemId:999},{recipe:{...base.recipe,seconds:0}},{recipe:{...base.recipe,inputs:[1]}}])assert.equal(calculateFactory({...base,...patch}).ok,false);});
test('unsupported fractionation, loops and impossible connection count',()=>{for(const recipe of [{...base.recipe,type:'FRACTIONATE'},{...base.recipe,inputs:[3,1]},{...base.recipe,inputs:[1,1,2,1,4,1,5,1,6,1,7,1,8,1,9,1]}])assert.equal(calculateFactory({...base,recipe}).ok,false);});
test('all standard facility families and upgrades apply their speed',()=>{for(const [type,facilityId,speed] of [['SMELT',2319,3],['CHEMICAL',2317,2],['REFINE',2308,1],['PARTICLE',2310,1],['RESEARCH',2902,3],['ASSEMBLE',2318,3]] as const){const p=plan({recipe:{...base.recipe,type},facilityId});assert.equal(p.perMachine,speed/3);}});
test('rounding at exact decimal boundaries does not add a belt',()=>{const p=plan({mode:'infrastructure',unit:'second',target:12.000000000000002});assert.equal(p.outputs[0].belts,2);assert.equal(p.machines,36);});
test('repeat calls are deterministic without mutating input',()=>{const frozen=structuredClone(base);assert.deepEqual(calculateFactory(frozen),calculateFactory(base));assert.deepEqual(frozen,base);});

test('short reach rejects too many dedicated lanes and longer reach resolves it',()=>{const recipe={...base.recipe,inputs:[1,1,2,1,4,1,5,1]};assert.equal(calculateFactory({...base,recipe}).ok,false);assert.equal(plan({recipe,reach:2}).sustainable,6);});

import { normalizePlannerPreferences, updatePlannerPreferences, PLANNER_PREFERENCES_KEY } from '../src/lib/plannerPreferences';
test('equipment preferences validate saved values and use one last facility',()=>{
 assert.deepEqual(normalizePlannerPreferences(null),{facilityId:2303,beltId:2001,sorterId:2011,reach:1});
 assert.deepEqual(normalizePlannerPreferences({facilityId:2317,beltId:2003,sorterId:2013,reach:3}),{facilityId:2317,beltId:2003,sorterId:2013,reach:3});
 assert.deepEqual(normalizePlannerPreferences({facilityId:999,beltId:-1,sorterId:2014,reach:99}),normalizePlannerPreferences(null));
});
test('only equipment choices are persisted, with last facility replacing the previous one',()=>{
 const data=new Map<string,string>();
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)}});
 try{updatePlannerPreferences({facilityId:2305,beltId:2003});updatePlannerPreferences({facilityId:2317,reach:2});const saved=JSON.parse(data.get(PLANNER_PREFERENCES_KEY)!);assert.deepEqual(saved,{facilityId:2317,beltId:2003,sorterId:2011,reach:2});}
 finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else Reflect.deleteProperty(globalThis,'localStorage');}
});
