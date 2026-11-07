import { pairs, recipesFor, type Catalog } from './catalog';

export function taskItemLinks(catalog: Catalog, existing: number[], itemId: number, includeInputs: boolean): number[] {
  const visible = new Set(catalog.items.map(item => item.id));
  if (!visible.has(itemId)) return existing;
  const recipe = includeInputs ? recipesFor(catalog, itemId)[0] : undefined;
  const inputs = recipe ? pairs(recipe.inputs).map(input => input.id).filter(id => visible.has(id)) : [];
  return [...new Set([...existing, itemId, ...inputs])];
}
