export type PinId = number | string;
export type PinnedGroupItem = {id:number;name:string;icon:string|null;requiredInput?:boolean};
type PlanetTask = {id:string;itemIds?:number[];requiredInputs?:Record<string,number>};
type TaskSection = {id:string;kind:'planet'|'system';checklist?:PlanetTask[]};
export type TaskPinSnapshot = {pinned:string[];links:Record<string,string[]>};
export type PinnedGroups = Record<string,number[]>;
export type PinItemSource = 'external'|'strip'|{planet:string};
export type PinnedStripEntry = {id:PinId;name:string;icon:string|null;kind:'item'|'planet'|'system';children?:PinnedGroupItem[]};
export type PinDropSide = 'before'|'after';
export const locationPinId = (kind:'planet'|'system',id:string) => `${kind}:${id}`;
export function parseLocationPin(id:PinId):{kind:'planet'|'system';id:string}|null {
  if(typeof id!=='string')return null;
  const match=/^(planet|system):(.+)$/.exec(id);
  return match&&match[2].length<=200?{kind:match[1] as 'planet'|'system',id:match[2]}:null;
}
export const pinToken = (id:PinId) => typeof id==='number'?`item:${id}`:id;

export function resolvePinnedEntries(ids:PinId[],items:{id:number;name:string;icon:string|null}[],sections:(TaskSection&{parentId:string|null;name:string})[],groups:PinnedGroups={}):PinnedStripEntry[] {
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
    return [{id,name:section.kind==='planet'?`${parent?.name||'Unassigned system'}/${name}`:name,icon:null,kind:section.kind,children:section.kind==='planet'?orderPinnedGroup(groups[id]??[],section.checklist??[]).flatMap(id=>{
      const item=items.find(item=>item.id===id);
      const required=(section.checklist??[]).some(task=>task.itemIds?.includes(id)&&task.requiredInputs?.[id]!==undefined);
      return item?[{...item,...(required?{requiredInput:true as const}:{})}]:[];
    }):undefined}];
  });
}

export const PINNED_ITEMS_KEY = 'dsp-pinned-items-v1';
export const PINNED_GROUPS_KEY = 'dsp-pinned-planet-groups-v1';

/** Required-input blocks override an item's previous standalone position. */
export function orderPinnedGroup(ids:number[],tasks:PlanetTask[]):number[] {
  const present=new Set(ids),parentByInput=new Map<number,number>();
  for(const task of tasks)for(const input of task.itemIds??[]){
    const parent=task.requiredInputs?.[input];
    if(parent===undefined||parent===input||!task.itemIds?.includes(parent)||!present.has(parent)||!present.has(input))continue;
    parentByInput.delete(input);parentByInput.set(input,parent);
  }
  const children=new Map<number,number[]>();
  for(const [input,parent] of parentByInput)children.set(parent,[...(children.get(parent)??[]),input]);
  const result:number[]=[],seen=new Set<number>();
  function emit(id:number){if(seen.has(id))return;seen.add(id);result.push(id);for(const child of children.get(id)??[])emit(child);}
  for(const id of ids)if(!parentByInput.has(id))emit(id);
  for(const id of ids)emit(id); // Cyclic cross-task dependencies still render each shortcut once.
  return result;
}

/** Track new and removed associations; another task can still keep an item linked. */
export function taskPinAdditions(pins:PinId[],sections:TaskSection[],previous:TaskPinSnapshot):{additions:PinnedGroups;removals:PinnedGroups;snapshot:TaskPinSnapshot} {
  const pinned=pins.filter((pin):pin is string=>parseLocationPin(pin)?.kind==='planet');
  const links:Record<string,string[]>={},additions:PinnedGroups={},removals:PinnedGroups={};
  for(const section of sections){
    if(section.kind!=='planet')continue;
    const key=locationPinId('planet',section.id),seen=new Set(previous.links[key]??[]);
    const associations=(section.checklist??[]).flatMap(task=>(task.itemIds??[]).map(id=>({id,key:JSON.stringify([task.id,id])})));
    links[key]=associations.map(link=>link.key);
    const remaining=new Set(associations.map(link=>link.id));
    const removed=[...new Set((previous.links[key]??[]).map(link=>JSON.parse(link)[1] as number))].filter(id=>!remaining.has(id));
    if(removed.length)removals[key]=removed;
    if(!pinned.includes(key))continue;
    const ids=[...new Set(associations.filter(link=>!previous.pinned.includes(key)||!seen.has(link.key)).map(link=>link.id))];
    if(ids.length)additions[key]=ids;
  }
  return {additions,removals,snapshot:{pinned,links}};
}
export function applyTaskPinAdditions(groups:PinnedGroups,additions:PinnedGroups,removals:PinnedGroups={}):PinnedGroups {
  let next=groups;
  for(const planet of new Set([...Object.keys(additions),...Object.keys(removals)])){
    const previous=next[planet]??[],removed=new Set(removals[planet]??[]);
    const merged=[...new Set([...previous.filter(id=>!removed.has(id)),...(additions[planet]??[])])];
    if(merged.length!==previous.length||merged.some((id,index)=>id!==previous[index]))next={...next,[planet]:merged};
  }
  return next;
}

export function normalizePinnedGroups(value:unknown):PinnedGroups {
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  return Object.fromEntries(Object.entries(value).filter(([key])=>parseLocationPin(key)?.kind==='planet').map(([key,ids])=>[key,normalizePinnedItems(ids).filter((id):id is number=>typeof id==='number')]));
}
export function loadPinnedGroups():PinnedGroups {
  try{return normalizePinnedGroups(JSON.parse(localStorage.getItem(PINNED_GROUPS_KEY)??'null'));}catch{return {};}
}
export function removeGroupedItem(groups:PinnedGroups,planet:string,id:number):PinnedGroups {
  return {...groups,[planet]:(groups[planet]??[]).filter(item=>item!==id)};
}
export function storeGroupedItem(groups:PinnedGroups,planet:string,id:number,source:PinItemSource):PinnedGroups {
  if(parseLocationPin(planet)?.kind!=='planet')return groups;
  const next=typeof source==='object'&&source.planet!==planet?removeGroupedItem(groups,source.planet,id):groups;
  return {...next,[planet]:[...new Set([...(next[planet]??[]),id])]};
}
export function insertPinnedItem(ids:PinId[],source:PinId,target:PinId|null,side:PinDropSide):PinId[] {
  if(source===target)return ids;
  const next=ids.filter(id=>id!==source),index=target===null?-1:next.indexOf(target);
  next.splice(index<0?next.length:index+(side==='after'?1:0),0,source);
  return next;
}
/** Only the center of a planet accepts grouping; its edges remain insertion zones. */
export function classifyPinDrop(x:number,left:number,width:number,itemOnPlanet:boolean):{kind:'group'}|{kind:'reorder';side:PinDropSide} {
  const fraction=(x-left)/Math.max(1,width);
  return itemOnPlanet&&fraction>=.22&&fraction<=.78?{kind:'group'}:{kind:'reorder',side:fraction<.5?'before':'after'};
}

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
