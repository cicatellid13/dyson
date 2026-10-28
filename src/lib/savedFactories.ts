import type { Catalog } from './catalog';
import { calculateFactory } from './factoryPlanner';
import { BELTS, FACILITIES, SORTERS } from './factoryEquipment';
export type FactorySettings={itemId:number;recipeId:number;facilityId:number;beltId:number;sorterId:number;reach:number;mode:'infrastructure'|'machines';target:number;unit:'second'|'minute';machineCount:number;oneBeltPerItem:boolean};
export type SavedFactory=FactorySettings&{id:string;name:string};
export function validateFactories(value:unknown):asserts value is Record<string,SavedFactory>{
 if(value===undefined)return;
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>500)throw Error('Invalid factory plans.');
 for(const [id,p] of Object.entries(value as Record<string,SavedFactory>)){
  if(!/^[a-zA-Z0-9_-]+$/.test(id)||['__proto__','constructor','prototype'].includes(id)||!p||p.id!==id||typeof p.name!=='string'||!p.name.trim()||p.name.length>120||![p.itemId,p.recipeId].every(n=>Number.isInteger(n)&&n>0)||!FACILITIES.some(f=>f.id===p.facilityId)||!BELTS.some(b=>b.id===p.beltId)||!SORTERS.some(s=>s.id===p.sorterId)||![1,2,3].includes(p.reach)||!['infrastructure','machines'].includes(p.mode)||!['second','minute'].includes(p.unit)||!Number.isFinite(p.target)||p.target<=0||p.target>6e10||!Number.isSafeInteger(p.machineCount)||p.machineCount<1||p.machineCount>1000000||typeof p.oneBeltPerItem!=='boolean')throw Error('Invalid factory plan.');
 }
}
export function calculateSavedFactory(catalog:Catalog,plan:FactorySettings){const recipe=catalog.recipes.find(r=>r.id===plan.recipeId);return recipe?calculateFactory({...plan,recipe}):{ok:false as const,reason:'The saved recipe is unavailable in this catalog.'};}
export function factoryTotals(catalog:Catalog,plans:SavedFactory[]){
 const inputs=new Map<number,number>(),outputs=new Map<number,number>();let unavailable=0;
 for(const p of plans){const result=calculateSavedFactory(catalog,p);if(!result.ok){unavailable++;continue;}for(const [rows,map] of [[result.inputs,inputs],[result.outputs,outputs]] as const)for(const s of rows)map.set(s.id,(map.get(s.id)??0)+s.rate);}
 return {inputs,outputs,unavailable};
}
