import { validateWorkspace, type Workspace } from '../../src/lib/workspace';
export type StoredData = { sections: Record<string, Workspace['design']['sections'][number]>; favorites: number[]; darkFog: boolean };
export function encode(data: Workspace): StoredData { return { sections: Object.fromEntries(data.design.sections.map(s => [s.id, s])), favorites: data.favorites, darkFog: data.darkFog }; }
export function decode(data: StoredData): Workspace { return validateWorkspace({ design: { version: 1, sections: Object.values(data.sections) }, favorites: data.favorites, darkFog: data.darkFog }); }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
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
  // Favorites are independent membership toggles, so unrelated changes combine.
  const favorites = [...new Set([...b.favorites, ...l.favorites, ...r.favorites])].filter(id =>
    l.favorites.includes(id) === b.favorites.includes(id) ? r.favorites.includes(id) : l.favorites.includes(id));
  const merged = mergeValue({ ...b, favorites: [] }, { ...l, favorites: [] }, { ...r, favorites: [] }) as StoredData;
  return decode({ ...merged, favorites });
}
export function workspacePatch(previous: StoredData, next: StoredData) {
  const set: Record<string, unknown> = {}, unset: Record<string, ''> = {};
  for (const id of new Set([...Object.keys(previous.sections), ...Object.keys(next.sections)])) {
    if (!next.sections[id]) unset[`data.sections.${id}`] = '';
    else if (!same(previous.sections[id], next.sections[id])) set[`data.sections.${id}`] = next.sections[id];
  }
  if (!same(previous.favorites, next.favorites)) set['data.favorites'] = next.favorites;
  if (previous.darkFog !== next.darkFog) set['data.darkFog'] = next.darkFog;
  return { set, unset };
}
