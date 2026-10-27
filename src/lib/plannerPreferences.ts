import { useSyncExternalStore } from 'react';
import { BELTS, FACILITIES, SORTERS } from './factoryEquipment';
export type PlannerPreferences={facilityId:number;beltId:number;sorterId:number;reach:number};
export const PLANNER_PREFERENCES_KEY='dsp-factory-equipment-v1';
export function normalizePlannerPreferences(value:unknown):PlannerPreferences {
  const data=(value&&typeof value==='object'?value:{}) as Partial<PlannerPreferences>;
  return {facilityId:FACILITIES.some(f=>f.id===data.facilityId)?data.facilityId!:2303,beltId:BELTS.some(b=>b.id===data.beltId)?data.beltId!:2001,sorterId:SORTERS.some(s=>s.id===data.sorterId)?data.sorterId!:2011,reach:[1,2,3].includes(data.reach!)?data.reach!:1};
}
let current:PlannerPreferences|undefined;
const listeners=new Set<()=>void>();
function snapshot(){if(!current){try{current=normalizePlannerPreferences(JSON.parse(localStorage.getItem(PLANNER_PREFERENCES_KEY)??'null'));}catch{current=normalizePlannerPreferences(null);}}return current;}
function subscribe(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};}
export function updatePlannerPreferences(patch:Partial<PlannerPreferences>){current=normalizePlannerPreferences({...snapshot(),...patch});try{localStorage.setItem(PLANNER_PREFERENCES_KEY,JSON.stringify(current));}catch{/* In-memory choices still work if storage is unavailable. */}listeners.forEach(listener=>listener());}
export function usePlannerPreferences(){return useSyncExternalStore(subscribe,snapshot);}
