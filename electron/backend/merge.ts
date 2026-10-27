import { isDeepStrictEqual } from 'node:util';
import type { PlanningFolder, PlanningNote } from '../../src/lib/planning';
import { validateWorkspace, type Workspace } from '../../src/lib/workspace';
export type StoredData = { planetTypes?: string[]; specializationTypes?: string[]; defaultCatalogView?: 'list' | 'grid'; sections: Record<string, Workspace['design']['sections'][number]>; favorites: number[]; darkFog: boolean; folders?: Record<string, PlanningFolder>; notes?: Record<string, PlanningNote> };
export function encode(data: Workspace): StoredData { return { ...(data.design.planetTypes?.length?{planetTypes:data.design.planetTypes}:{}), ...(data.design.specializationTypes?.length?{specializationTypes:data.design.specializationTypes}:{}), ...(data.defaultCatalogView ? {defaultCatalogView:data.defaultCatalogView} : {}), folders: Object.fromEntries((data.planning?.folders ?? []).map(f => [f.id, f])), notes: Object.fromEntries((data.planning?.notes ?? []).map(n => [n.id, n])), sections: Object.fromEntries(data.design.sections.map(s => [s.id, s])), favorites: data.favorites, darkFog: data.darkFog }; }
export function decode(data: StoredData): Workspace { return validateWorkspace({ defaultCatalogView:data.defaultCatalogView, planning: { folders: Object.values(data.folders ?? {}), notes: Object.values(data.notes ?? {}) }, design: { version: 1, ...(data.planetTypes?.length?{planetTypes:data.planetTypes}:{}), ...(data.specializationTypes?.length?{specializationTypes:data.specializationTypes}:{}), sections: Object.values(data.sections) }, favorites: data.favorites, darkFog: data.darkFog }); }
const same = isDeepStrictEqual;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function mergeValue(base: unknown, local: unknown, remote: unknown): unknown {
  if (same(local, base)) return remote;
  if (same(remote, base) || same(local, remote)) return local;
  if (object(base) && object(local) && object(remote)) {
    const result: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
      const value = mergeValue(base[key], local[key], remote[key]);
      if (value !== undefined) result[key] = value;
    }
    return result;
  }
  throw Error('conflict');
}
export function mergeWorkspace(base: Workspace, local: Workspace, remote: Workspace): Workspace {
  const b = encode(base), l = encode(local), r = encode(remote);
  // Saved suggestions are an additive vocabulary; independent additions combine.
  for(const key of ['planetTypes','specializationTypes'] as const) {
    const union=[...new Set([...(b[key]??[]),...(l[key]??[]),...(r[key]??[])])];
    if(union.length){b[key]=union;l[key]=union;r[key]=union;}
  }
  // Favorites are independent membership toggles, so unrelated changes combine.
  const membership = [...new Set([...b.favorites, ...l.favorites, ...r.favorites])].filter(id =>
    l.favorites.includes(id) === b.favorites.includes(id) ? r.favorites.includes(id) : l.favorites.includes(id));
  const baseCommon = b.favorites.filter(id=>l.favorites.includes(id));
  const localCommon = l.favorites.filter(id=>b.favorites.includes(id));
  const remoteCommon = r.favorites.filter(id=>baseCommon.includes(id));
  const localReordered = !same(baseCommon,localCommon);
  const remoteReordered = !same(b.favorites.filter(id=>r.favorites.includes(id)),r.favorites.filter(id=>b.favorites.includes(id)));
  if(localReordered && remoteReordered && !same(localCommon.filter(id=>r.favorites.includes(id)),remoteCommon))throw Error('conflict');
  const preferred = localReordered ? l.favorites : remoteReordered ? r.favorites : membership;
  const favorites = [...new Set([...preferred,...membership])].filter(id=>membership.includes(id));
  const merged = mergeValue({ ...b, favorites: [] }, { ...l, favorites: [] }, { ...r, favorites: [] }) as StoredData;
  return decode({ ...merged, favorites });
}
export function workspacePatch(previous: StoredData, next: StoredData) {
  const set: Record<string, unknown> = {}, unset: Record<string, ''> = {};
  for (const id of new Set([...Object.keys(previous.sections), ...Object.keys(next.sections)])) {
    if (!next.sections[id]) unset[`data.sections.${id}`] = '';
    else if (!same(previous.sections[id], next.sections[id])) set[`data.sections.${id}`] = next.sections[id];
  }
  for (const key of ['folders', 'notes'] as const) {
    const before = previous[key] ?? {}, after = next[key] ?? {};
    for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (!after[id]) unset[`data.${key}.${id}`] = '';
      else if (!same(before[id], after[id])) set[`data.${key}.${id}`] = after[id];
    }
  }
  for (const key of ['planetTypes','specializationTypes'] as const) if(!same(previous[key],next[key])) set[`data.${key}`]=next[key]??[];
  if (!same(previous.favorites, next.favorites)) set['data.favorites'] = next.favorites;
  if (previous.defaultCatalogView !== next.defaultCatalogView) { if(next.defaultCatalogView) set['data.defaultCatalogView']=next.defaultCatalogView; else unset['data.defaultCatalogView']=''; }
  if (previous.darkFog !== next.darkFog) set['data.darkFog'] = next.darkFog;
  return { set, unset };
}
