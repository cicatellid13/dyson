import { pairs, recipesFor, type Catalog } from './catalog';

export function taskItemLinks(catalog: Catalog, existing: number[], itemId: number, includeInputs: boolean, recipeId?: number): number[] {
  const visible = new Set(catalog.items.map(item => item.id));
  if (!visible.has(itemId)) return existing;
  const recipes = includeInputs ? recipesFor(catalog, itemId) : [];
  const recipe = recipeId === undefined ? recipes[0] : recipes.find(option => option.id === recipeId);
  const inputs = recipe ? pairs(recipe.inputs).map(input => input.id).filter(id => visible.has(id)) : [];
  return [...new Set([...existing, itemId, ...inputs])];
}

// Record provenance only for newly attached inputs; manually attached items stay unmarked.
export function taskItemAttachment(catalog: Catalog, task: {itemIds?:number[]; requiredInputs?:Record<string,number>}, itemId:number, includeInputs:boolean, recipeId?:number) {
  const itemIds=taskItemLinks(catalog,task.itemIds??[],itemId,includeInputs,recipeId);
  const requiredInputs={...task.requiredInputs};
  delete requiredInputs[itemId];
  if(includeInputs) for(const id of itemIds) {
    if(id!==itemId && !(task.itemIds??[]).includes(id)) requiredInputs[id]=itemId;
  }
  return {itemIds,requiredInputs};
}
export function removeTaskItem(task:{itemIds?:number[];requiredInputs?:Record<string,number>},id:number,removeInputs=true){
  const removed=new Set([id,...(removeInputs?Object.entries(task.requiredInputs??{}).filter(([,parent])=>parent===id).map(([key])=>Number(key)):[])]);
  return {itemIds:(task.itemIds??[]).filter(itemId=>!removed.has(itemId)),requiredInputs:Object.fromEntries(Object.entries(task.requiredInputs??{}).filter(([key,parent])=>!removed.has(Number(key))&&!removed.has(parent)))};
}
