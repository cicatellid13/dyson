import { pairs, type Recipe } from './catalog';
import { BELTS, FACILITIES, SORTERS, SORTER_BUDGET } from './factoryEquipment';
export type PlannerMode = 'capacity' | 'infrastructure' | 'machines';
export type PlannerConfig = {recipe:Recipe;itemId:number;facilityId:number;beltId:number;sorterId:number;reach:number;mode:PlannerMode;target:number;machineCount?:number;oneBeltPerItem?:boolean;unit:'second'|'minute'};
export type Stream = {id:number;rate:number;belts:number;sortersPerMachine:number;sorters:number;beltUtilization:number};
export type Plan = {ok:false;reason:string} | {ok:true;machines:number;machineOnlyCount:number;perMachine:number;target:number;installed:number;sustainable:number;machineUtilization:number;beltUtilization:number;sorterRate:number;sorters:number;inputs:Stream[];outputs:Stream[];notes:string[];beltLimited:boolean;limitingBeltItems:number[];sorterLimited:boolean};
const ceil = (n:number) => Math.ceil(n - Number.EPSILON * 8 * Math.max(1, Math.abs(n)));
export function unsupportedRecipe(recipe:Recipe):string|undefined {
  if (!FACILITIES.some(f=>f.type===recipe.type)) return `${recipe.type === 'FRACTIONATE' ? 'Fractionation uses probabilistic outputs and is' : 'This production method is'} not supported yet.`;
  if (pairs(recipe.inputs).some(i=>pairs(recipe.outputs).some(o=>o.id===i.id))) return 'Recycling recipes need a recirculation model and are not supported yet. Choose a conventional recipe.';
}
export function calculateFactory(c:PlannerConfig):Plan {
  const fail = (reason:string):Plan=>({ok:false,reason});
  const r=c.recipe;
  if (!Number.isFinite(r.seconds)||r.seconds<=0 || !r.outputs.length || r.inputs.length%2 || r.outputs.length%2 || [...r.inputs,...r.outputs].some((n,i)=>!Number.isFinite(n)||n<=0 || (i%2===0&&!Number.isInteger(n)))) return fail('The recipe has invalid quantities or crafting time.');
  const unsupported=unsupportedRecipe(r); if(unsupported) return fail(unsupported);
  const facility=FACILITIES.find(f=>f.id===c.facilityId&&f.type===r.type),belt=BELTS.find(b=>b.id===c.beltId),sorter=SORTERS.find(s=>s.id===c.sorterId);
  if(!facility||!belt||!sorter||![1,2,3].includes(c.reach)) return fail('Choose compatible equipment and a sorter reach of 1–3 grids.');
  if(!['capacity','infrastructure','machines'].includes(c.mode)||!['second','minute'].includes(c.unit)) return fail('Choose a valid calculation mode and rate unit.');
  const aggregate=(v:number[])=>Array.from(pairs(v).reduce((map,p)=>map.set(p.id,(map.get(p.id)??0)+p.count),new Map<number,number>()),([id,count])=>({id,count}));
  const ins=aggregate(r.inputs),outs=aggregate(r.outputs),output=outs.find(o=>o.id===c.itemId);
  if(!output) return fail('This recipe does not produce the selected item.');
  let target=c.mode==='capacity'?belt.rate:c.target/(c.unit==='minute'?60:1);
  if(c.mode!=='machines'&&(!Number.isFinite(target)||target<=0||target>1e9)) return fail('Enter a positive target no greater than 1 billion items/second.');
  const streams=[...ins,...outs];
  if(streams.length>SORTER_BUDGET) return fail(`This recipe needs more than the modeled ${SORTER_BUDGET} sorter connections per machine.`);
  const perMachine=output.count*facility.speed/r.seconds, sorterRate=sorter.rate/c.reach;
  let beltLimited=false,sorterLimited=false;
  let limitingBeltItems:number[]=[];
  if(c.mode==='machines') {
    if(!Number.isSafeInteger(c.machineCount)||c.machineCount!<=0||c.machineCount!>1000000) return fail('Enter a whole machine count from 1 to 1,000,000.');
    if(c.reach===1&&streams.length>4) return fail('This recipe needs more than four material lanes. Choose a sorter reach of 2 or 3 grids for the modeled four-sided layout.');
    // Enumerate the small, discrete sorter budget to find the exact achievable rate.
    let best=0;
    const allocate=(index:number,budget:number,limit:number):void=>{
      if(index===streams.length){best=Math.max(best,limit);return;}
      for(let n=1;n<=budget;n++){
        const cost=c.reach===1?2*Math.ceil(n/2):n;
        if(cost>budget)break;
        allocate(index+1,budget-cost,Math.min(limit,n*sorterRate*output.count/streams[index].count));
      }
    };
    allocate(0,SORTER_BUDGET,perMachine);
    sorterLimited=best<perMachine-1e-10;
    target=best*c.machineCount!;
    if(c.oneBeltPerItem){
      const beltLimit=Math.min(...streams.map(s=>belt.rate*output.count/s.count));
      beltLimited=beltLimit<target-1e-10;
      if(beltLimited){
        limitingBeltItems=streams.filter(s=>Math.abs(belt.rate*output.count/s.count-beltLimit)<1e-10).map(s=>s.id);
        sorterLimited=false;
      }
      target=Math.min(target,beltLimit);
    }
  }
  const rates=streams.map(s=>target*s.count/output.count);
  // Conservative four-side layout: two sorter positions per side. At one-grid
  // reach, reserve each side for a single material lane. Longer reach permits
  // two lanes, charged at the slower farthest-reach speed for every transfer.
  const counts=(n:number)=>rates.map(rate=>Math.max(1,ceil(rate/n/sorterRate)));
  if(c.reach===1&&streams.length>4) return fail('This recipe needs more than four material lanes. Choose a sorter reach of 2 or 3 grids for the modeled four-sided layout.');
  const needed=(n:number)=>c.reach===1?counts(n).reduce((total,count)=>total+2*Math.ceil(count/2),0):counts(n).reduce((total,count)=>total+count,0);
  const machineOnlyCount=Math.max(1,ceil(target/perMachine));
  // Monotone search: extra machines reduce per-machine transfer until all streams fit.
  let low=machineOnlyCount,high=low;
  while(needed(high)>SORTER_BUDGET&&high<Number.MAX_SAFE_INTEGER/2) high*=2;
  if(!Number.isSafeInteger(high)||needed(high)>SORTER_BUDGET) return fail('The requested configuration exceeds the supported planning range.');
  while(low<high){const middle=Math.floor((low+high)/2);if(needed(middle)<=SORTER_BUDGET)high=middle;else low=middle+1;}
  const machines=c.mode==='machines'?c.machineCount!:low;
  const stream=(s:{id:number;count:number}):Stream=>{
    const rate=target*s.count/output.count,belts=Math.max(1,ceil(rate/belt.rate)),sortersPerMachine=Math.max(1,ceil(rate/machines/sorterRate));
    return {id:s.id,rate,belts,sortersPerMachine,sorters:sortersPerMachine*machines,beltUtilization:rate/(belts*belt.rate)};
  };
  const inputs=ins.map(stream),outputs=outs.map(stream),all=[...inputs,...outputs];
  const sustainable=Math.min(machines*perMachine,...all.map(s=>s.sorters*sorterRate*target/s.rate),...all.map(s=>s.belts*belt.rate*target/s.rate),target);
  const notes=[`Uses up to ${SORTER_BUDGET} sorter connections per machine, across four sides, with two connections per side and dedicated input/output lanes. At one-grid reach, each side carries one material; longer reach permits two. This is a conservative rate-planning budget, not a tile-verified blueprint. Check belt routing and available ports before building.`, 'Full power, continuous ingredients, unstacked belts and one item per sorter trip. Nominal sorter rate assumes unobstructed pickup.'];
  if(machines>machineOnlyCount)notes.unshift(`Sorter transfers require ${machines-machineOnlyCount} additional machines. Faster sorters or shorter reach can reduce this.`);
  if(outputs.length>1)notes.push('Keep every output moving. A backed-up byproduct stops the recipe.');
  if(c.mode==='capacity')notes.push('The selected item’s single output belt sets the target; byproducts use separate belts.');
  return {ok:true,beltLimited,limitingBeltItems,sorterLimited,machines,machineOnlyCount,perMachine,target,installed:machines*perMachine,sustainable,machineUtilization:target/(machines*perMachine),beltUtilization:outputs.find(o=>o.id===c.itemId)!.beltUtilization,sorterRate,sorters:all.reduce((sum,s)=>sum+s.sorters,0),inputs,outputs,notes};
}
