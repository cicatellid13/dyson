export type Item = { id:number; name:string; type:string; grid_index?:number; description:string; overview?: {text:string; itemId?:number; bold?:boolean}[][]; overviewSource?:string; icon:string|null; stack_size:number; can_build?:boolean; mining_from?:string; explicit_produce_from?:string; energy?:number };
export type Recipe = {id:number; name:string; type:string; inputs:number[]; outputs:number[]; seconds:number; handcraft?:boolean; explicit?:boolean; description?:string};
export type Catalog = {items:Item[]; recipes:Recipe[]; facilities:Record<string,{name:string; buildings:number[]}>; techs:{id:number;name:string;recipes?:number[]}[]; categories:Record<string,string>; downloaded:string; sourceUpdated:string; source:string; revision:number};
export const pairs = (values:number[]) => Array.from({length:values.length/2},(_,i)=>({id:values[i*2],count:values[i*2+1]}));
export function recipesFor(c:Catalog,id:number) { return c.recipes.filter(r=>pairs(r.outputs).some(x=>x.id===id)).sort((a,b)=>Number(!!a.explicit)-Number(!!b.explicit)||a.id-b.id); }
export function batchesFor(recipe:Recipe,id:number,quantity:number) { const output=pairs(recipe.outputs).find(x=>x.id===id); return output ? Math.ceil(quantity/output.count) : 0; }

// Combat-only parts and units live in general component/product categories.
const DEFENSE_ITEM_IDS = new Set([
  1128, 1129, 1130, // combustible / explosive units
  1601, 1602, 1603, 1604, 1605, 1606, 1607, 1608, 1609, 1610, 1611, 1612, 1613,
  5101, 5102, 5103, 5111, 5112, // combat drones and ships
]);
export function isDefenseItem(item?: Item): boolean {
  return !!item && (item.type === 'TURRET' || item.type === 'DEFENSE' || DEFENSE_ITEM_IDS.has(item.id));
}

/** A view of the snapshot; saved favorites and logistics data remain untouched. */
export function catalogForDarkFog(source: Catalog, enabled: boolean): Catalog {
  if (enabled) return source;
  const items = source.items.filter(item => !isDefenseItem(item) && item.type !== 'DARK_FOG');
  const ids = new Set(items.map(item => item.id));
  return {
    ...source, items,
    recipes: source.recipes.filter(recipe => [...pairs(recipe.inputs), ...pairs(recipe.outputs)].every(pair => ids.has(pair.id))),
    facilities: Object.fromEntries(Object.entries(source.facilities).map(([key, facility]) => [key, {...facility, buildings: facility.buildings.filter(id => ids.has(id))}])),
  };
}
