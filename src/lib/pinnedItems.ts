export type PinId = number | string;
export type PinnedStripEntry = {id:PinId;name:string;icon:string|null;kind:'item'|'planet'|'system'};
export const locationPinId = (kind:'planet'|'system',id:string) => `${kind}:${id}`;
export function parseLocationPin(id:PinId):{kind:'planet'|'system';id:string}|null {
  if(typeof id!=='string')return null;
  const match=/^(planet|system):(.+)$/.exec(id);
  return match&&match[2].length<=200?{kind:match[1] as 'planet'|'system',id:match[2]}:null;
}
export const pinToken = (id:PinId) => typeof id==='number'?`item:${id}`:id;

export function resolvePinnedEntries(ids:PinId[],items:{id:number;name:string;icon:string|null}[],sections:{id:string;kind:'planet'|'system';parentId:string|null;name:string}[]):PinnedStripEntry[] {
  return ids.flatMap<PinnedStripEntry>(id=>{
    if(typeof id==='number'){
      const item=items.find(item=>item.id===id);
      return item?[{id,name:item.name,icon:item.icon,kind:'item'}]:[];
    }
    const target=parseLocationPin(id);
    const section=sections.find(section=>section.id===target?.id&&section.kind===target.kind);
    if(!section)return [];
    const parent=sections.find(parent=>parent.id===section.parentId&&parent.kind==='system');
    const name=section.name||(section.kind==='planet'?'Untitled planet':'Unnamed system');
    return [{id,name:section.kind==='planet'?`${parent?.name||'Unassigned system'}/${name}`:name,icon:null,kind:section.kind}];
  });
}

export const PINNED_ITEMS_KEY = 'dsp-pinned-items-v1';

export function addPinnedItem(ids:PinId[], id:PinId):PinId[] {
  return ids.includes(id) ? ids : [...ids,id];
}

export function normalizePinnedItems(value: unknown): PinId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is PinId => typeof id==='number'&&Number.isSafeInteger(id)&&id>0||parseLocationPin(id)!==null))];
}

export function loadPinnedItems(): PinId[] {
  try { return normalizePinnedItems(JSON.parse(localStorage.getItem(PINNED_ITEMS_KEY) ?? 'null')); }
  catch { return []; }
}

export function movePinnedItem(ids: PinId[], source: PinId, target: PinId): PinId[] {
  const from = ids.indexOf(source), to = ids.indexOf(target);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, source);
  return next;
}
