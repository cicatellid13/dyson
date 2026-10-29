import {pairs,type Catalog } from './catalog';
import { calculateSavedFactory } from './savedFactories';
import type { DesignData } from './design';
export type NetworkMatch={planetId:string;planetName:string;systemName:string;kind:'Produces'|'Exports'|'Imports'|'Uses';detail:string;entryId?:string;factoryId?:string;rate?:number;metric?:string};
export function findInNetwork(data:DesignData,catalog:Catalog,itemId:number):NetworkMatch[]{
 const results:NetworkMatch[]=[];
 for(const p of data.sections.filter(s=>s.kind==='planet')){
  const base={planetId:p.id,planetName:p.name,systemName:data.sections.find(s=>s.id===p.parentId)?.name??'Unassigned'};
  for(const direction of ['imports','exports'] as const)for(const e of p[direction])if(e.itemId===itemId)results.push({...base,kind:direction==='imports'?'Imports':'Exports',entryId:e.id,metric:e.amount.trim()&&Number.isFinite(Number(e.amount))?`${e.amount} ${e.unit} configured`:undefined,detail:e.amount?`${e.amount} ${e.unit} configured`:'Rate not specified'});
  for(const f of Object.values(p.factories??{})){
   const result=calculateSavedFactory(catalog,f);
   if(result.ok){for(const [rows,kind] of [[result.outputs,'Produces'],[result.inputs,'Uses']] as const){const row=rows.find(r=>r.id===itemId);if(row)results.push({...base,kind,factoryId:f.id,rate:row.rate*60,metric:`${f.name} · ${(row.rate*60).toLocaleString(undefined,{maximumFractionDigits:2})}/min planned`,detail:`${f.name} · ${(row.rate*60).toLocaleString(undefined,{maximumFractionDigits:2})}/min planned`});}}
   else {const recipe=catalog.recipes.find(r=>r.id===f.recipeId);for(const [items,kind] of [[recipe?.outputs,'Produces'],[recipe?.inputs,'Uses']] as const)if(items&&pairs(items).some(p=>p.id===itemId))results.push({...base,kind,factoryId:f.id,detail:`${f.name} · rate unavailable`});if(!recipe&&f.itemId===itemId)results.push({...base,kind:'Produces',factoryId:f.id,detail:`${f.name} · recipe unavailable`});}
  }
 }
 return results.sort((a,b)=>a.systemName.localeCompare(b.systemName)||a.planetName.localeCompare(b.planetName)||a.kind.localeCompare(b.kind));
}
